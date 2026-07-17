import { buildOrderFlexMessage, isSupportedNotificationEventType } from "@/lib/notifications/line-flex";
import { isLineMessagingConfigured, sendLineFlexMessage } from "@/lib/notifications/line-messaging";

const MAX_RETRY_ATTEMPTS = 5;
const ORDER_LOOKUP_RETRY_ATTEMPTS = 4;
const ORDER_LOOKUP_RETRY_DELAY_MS = 250;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function calcNextRetryIso(attemptCount) {
  const safeAttempt = Math.max(1, Number(attemptCount || 1));
  const delaySec = Math.min(900, 15 * 2 ** (safeAttempt - 1));
  return new Date(Date.now() + delaySec * 1000).toISOString();
}

function normalizeUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(value || "")
  )
    ? String(value)
    : "";
}

async function fetchOrderItemsFlexible(admin, orderId) {
  const attempts = [
    `
      id,
      quantity,
      unit_price,
      line_total,
      sku:skus(
        id,
        size_label,
        width_mm,
        aspect_ratio,
        rim_inch,
        product:products(
          brand,
          name
        )
      )
    `,
    `
      id,
      quantity,
      price,
      total,
      sku:skus(
        id,
        size_label,
        width_mm,
        aspect_ratio,
        rim_inch,
        product:products(
          brand,
          name
        )
      )
    `,
    `
      id,
      quantity,
      sku:skus(
        id,
        size_label,
        width_mm,
        aspect_ratio,
        rim_inch,
        product:products(
          brand,
          name
        )
      )
    `,
  ];

  for (const select of attempts) {
    const { data, error } = await admin
      .from("order_items")
      .select(select)
      .eq("order_id", orderId)
      .order("id", { ascending: true });

    if (!error) {
      return (data || []).map((item) => ({
        id: item.id,
        quantity: Number(item.quantity || 0),
        unit_price: Number(item.unit_price ?? item.price ?? 0),
        line_total: Number(item.line_total ?? item.total ?? 0),
        brand: item.sku?.product?.brand || "",
        name: item.sku?.product?.name || "",
        size:
          item.sku?.size_label ||
          (item.sku?.width_mm && item.sku?.aspect_ratio && item.sku?.rim_inch
            ? `${item.sku.width_mm}/${item.sku.aspect_ratio}R${item.sku.rim_inch}`
            : ""),
      }));
    }
  }

  return [];
}

async function fetchOrderNotificationContext({ supabase, customerId, orderId }) {
  const validCustomerId = normalizeUuid(customerId);
  const validOrderId = normalizeUuid(orderId);
  if (!validCustomerId || !validOrderId) {
    throw new Error("invalid_notification_context");
  }

  const { data: customer } = await supabase
    .from("customes")
    .select("id, line_user_id, line_msg_user_id, display_name")
    .eq("id", validCustomerId)
    .maybeSingle();

  const lineRecipientId = customer?.line_msg_user_id || customer?.line_user_id || null;
  console.log("[notify] customer context", {
    customerId: validCustomerId,
    orderId: validOrderId,
    hasCustomer: Boolean(customer?.id),
    line_user_id: customer?.line_user_id || null,
    line_msg_user_id: customer?.line_msg_user_id || null,
    lineRecipientId,
  });
  if (!lineRecipientId) {
    return { customer: null, order: null, items: [], appointment: null, totals: null };
  }
  customer.line_recipient_id = lineRecipientId;

  let order = null;
  for (let attempt = 1; attempt <= ORDER_LOOKUP_RETRY_ATTEMPTS; attempt += 1) {
    const { data } = await supabase
      .from("orders")
      .select("id, customer_id, order_no, status, payment_status, total_amount, created_at")
      .eq("id", validOrderId)
      .maybeSingle();
    if (data?.id) {
      order = data;
      break;
    }
    if (attempt < ORDER_LOOKUP_RETRY_ATTEMPTS) {
      console.log("[notify] order lookup retry", {
        orderId: validOrderId,
        customerId: validCustomerId,
        attempt,
        retryInMs: ORDER_LOOKUP_RETRY_DELAY_MS,
      });
      await sleep(ORDER_LOOKUP_RETRY_DELAY_MS);
    }
  }

  if (!order) {
    console.error("[notify] order not found for notification; fallback to minimal payload", {
      customerId: validCustomerId,
      orderId: validOrderId,
    });
    return {
      customer,
      order: {
        id: validOrderId,
        customer_id: validCustomerId,
        order_no: "-",
        status: "pending",
        payment_status: "awaiting_verification",
        total_amount: 0,
      },
      items: [],
      appointment: null,
      totals: {
        grand_total: 0,
        item_subtotal: 0,
      },
    };
  }
  if (String(order.customer_id || "") !== validCustomerId) {
    console.warn("[notify] order customer mismatch; continue notification", {
      expectedCustomerId: validCustomerId,
      actualCustomerId: order.customer_id || null,
      orderId: validOrderId,
    });
  }

  const { data: appointment } = await supabase
    .from("install_appointments")
    .select("scheduled_at, status")
    .eq("order_id", validOrderId)
    .order("scheduled_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  const items = await fetchOrderItemsFlexible(supabase, validOrderId);
  const itemSubTotal = items.reduce((sum, item) => sum + Number(item.line_total || 0), 0);

  return {
    customer,
    order,
    items,
    appointment: appointment || null,
    totals: {
      grand_total: Number(order.total_amount || itemSubTotal),
      item_subtotal: itemSubTotal,
    },
  };
}

async function insertNotificationJob({
  supabase,
  eventType,
  customerId,
  orderId,
  lineUserId,
  payload,
  dedupeKey,
}) {
  const row = {
    event_type: eventType,
    customer_id: customerId,
    order_id: orderId,
    line_user_id: lineUserId,
    payload,
    dedupe_key: dedupeKey || null,
    status: "pending",
    attempts: 0,
    max_attempts: MAX_RETRY_ATTEMPTS,
    next_retry_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("notification_jobs")
    .insert(row)
    .select("id, status, event_type, order_id")
    .maybeSingle();

  if (!error) {
    console.log("[notify] notification job inserted", {
      id: data?.id,
      eventType,
      customerId,
      orderId,
      dedupeKey: dedupeKey || null,
      lineUserId,
    });
    return { job: data, duplicated: false };
  }

  const duplicate = error.code === "23505" || String(error.message || "").includes("duplicate");
  if (!duplicate || !dedupeKey) {
    console.error("[notify] insert notification job failed", {
      eventType,
      customerId,
      orderId,
      dedupeKey: dedupeKey || null,
      error,
    });
    throw error;
  }

  const { data: existing } = await supabase
    .from("notification_jobs")
    .select("id, status, event_type, order_id")
    .eq("event_type", eventType)
    .eq("dedupe_key", dedupeKey)
    .maybeSingle();

  return { job: existing || null, duplicated: true };
}

async function processOneJob({ supabase, job }) {
  console.log("[notify] processOneJob start", {
    jobId: job.id,
    status: job.status,
    attempts: job.attempts,
  });
  const nextAttempts = Number(job.attempts || 0) + 1;
  const maxAttempts = Number(job.max_attempts || MAX_RETRY_ATTEMPTS);

  const { data: lockedJob } = await supabase
    .from("notification_jobs")
    .update({ status: "processing", updated_at: new Date().toISOString() })
    .eq("id", job.id)
    .in("status", ["pending", "failed"])
    .select("id, line_user_id, payload, attempts, max_attempts")
    .maybeSingle();

  if (!lockedJob) {
    console.log("[notify] processOneJob skipped (lock failed)", { jobId: job.id });
    return { sent: 0, skipped: 1, failed: 0 };
  }

  try {
    const payload = lockedJob.payload || {};
    await sendLineFlexMessage({
      to: lockedJob.line_user_id,
      altText: payload.altText,
      contents: payload.contents,
    });
    console.log("[notify] sendLineFlexMessage success", {
      jobId: job.id,
      to: lockedJob.line_user_id,
    });

    await supabase
      .from("notification_jobs")
      .update({
        status: "sent",
        attempts: nextAttempts,
        sent_at: new Date().toISOString(),
        last_error: null,
        next_retry_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", job.id);

    return { sent: 1, skipped: 0, failed: 0 };
  } catch (error) {
    console.error("[notify] sendLineFlexMessage failed", {
      jobId: job.id,
      error: String(error?.message || error),
    });
    const exhausted = nextAttempts >= maxAttempts;
    await supabase
      .from("notification_jobs")
      .update({
        status: exhausted ? "dead" : "failed",
        attempts: nextAttempts,
        last_error: String(error?.message || "line_send_failed").slice(0, 1000),
        next_retry_at: exhausted ? null : calcNextRetryIso(nextAttempts),
        updated_at: new Date().toISOString(),
      })
      .eq("id", job.id);

    return { sent: 0, skipped: 0, failed: 1 };
  }
}

export async function queueOrderEventNotification({
  supabase,
  eventType,
  customerId,
  orderId,
  dedupeKey,
}) {
  if (!isSupportedNotificationEventType(eventType)) {
    throw new Error("unsupported_notification_event_type");
  }

  const context = await fetchOrderNotificationContext({ supabase, customerId, orderId });
  if (!context.customer?.line_recipient_id) {
    console.log("[notify] not queued: missing_line_user_id", { customerId, orderId });
    return { queued: false, reason: "missing_line_user_id" };
  }

  const payload = buildOrderFlexMessage({
    eventType,
    order: context.order,
    items: context.items,
    appointment: context.appointment,
    totals: context.totals,
  });

  const { job, duplicated } = await insertNotificationJob({
    supabase,
    eventType,
    customerId: context.order.customer_id,
    orderId: context.order.id,
    lineUserId: context.customer.line_recipient_id,
    payload,
    dedupeKey,
  });

  return {
    queued: Boolean(job?.id),
    duplicated,
    jobId: job?.id || null,
    lineUserId: context.customer.line_recipient_id,
  };
}

export async function processPendingNotificationJobs({ supabase, limit = 20 }) {
  if (!isLineMessagingConfigured()) {
    console.log("[notify] line messaging not configured");
    return {
      ok: false,
      reason: "line_messaging_api_not_configured",
      sent: 0,
      failed: 0,
      skipped: 0,
    };
  }

  const safeLimit = Math.min(50, Math.max(1, Number(limit || 20)));
  const { data: jobs, error } = await supabase
    .from("notification_jobs")
    .select("id, status, attempts, max_attempts, line_user_id, payload")
    .in("status", ["pending", "failed"])
    .lte("next_retry_at", new Date().toISOString())
    .order("created_at", { ascending: true })
    .limit(safeLimit);

  if (error) {
    console.error("[notify] fetch pending jobs failed", error);
    throw error;
  }
  console.log("[notify] pending jobs fetched", { count: (jobs || []).length });

  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const job of jobs || []) {
    const outcome = await processOneJob({ supabase, job });
    sent += outcome.sent;
    failed += outcome.failed;
    skipped += outcome.skipped;
  }

  return { ok: true, sent, failed, skipped, processed: (jobs || []).length };
}

export async function queueAndProcessOrderEventNotification({
  supabase,
  eventType,
  customerId,
  orderId,
  dedupeKey,
}) {
  const queued = await queueOrderEventNotification({
    supabase,
    eventType,
    customerId,
    orderId,
    dedupeKey,
  });
  console.log("[notify] queueAndProcess queued result", queued);

  if (queued.queued && isLineMessagingConfigured()) {
    console.log("[notify] process pending jobs now");
    await processPendingNotificationJobs({ supabase, limit: 5 });
  }

  return queued;
}
