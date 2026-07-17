import { NextResponse } from "next/server";
import { getCustomerAuthContext } from "@/lib/auth/customer";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isTrustedOrigin } from "@/lib/security/request-origin";
import { queueAndProcessOrderEventNotification } from "@/lib/notifications/jobs";

const FULFILLMENT_TYPES = new Set(["install", "delivery"]);
const PAYMENT_OPTIONS = new Set(["full", "deposit"]);
const MIN_SCHEDULE_LEAD_MINUTES = 60;
const IDEMPOTENCY_KEY_MAX_LENGTH = 120;
const DATE_TRANS_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function normalizeIsoDateTime(value) {
  if (!value || typeof value !== "string") return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function isFutureSchedule(isoString) {
  const scheduledMs = new Date(isoString).getTime();
  if (Number.isNaN(scheduledMs)) return false;
  return scheduledMs - Date.now() >= MIN_SCHEDULE_LEAD_MINUTES * 60 * 1000;
}

async function verifySlipOwnership(supabase, customerId, slipPath) {
  const fileName = slipPath.split("/").pop();
  if (!fileName) return false;

  const { data, error } = await supabase.storage
    .from("slips")
    .list(customerId, { search: fileName, limit: 1 });

  if (error) {
    return false;
  }
  return Boolean((data || []).find((item) => item.name === fileName));
}

function normalizeIdempotencyKey(value) {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > IDEMPOTENCY_KEY_MAX_LENGTH) return "";
  if (!/^[A-Za-z0-9._:-]+$/.test(trimmed)) return "";
  return trimmed;
}

async function callCheckoutCartAtomic(supabase, params) {
  const candidates = [
    params,
    {
      ...params,
      p_province: undefined,
    },
  ].map((payload) => {
    const nextPayload = { ...payload };
    if (nextPayload.p_province === undefined) {
      delete nextPayload.p_province;
    }
    return nextPayload;
  });

  const tried = [];
  for (const payload of candidates) {
    const { data, error } = await supabase.rpc("checkout_cart_atomic", payload);
    if (!error) {
      return { data, tried };
    }
    tried.push({
      keys: Object.keys(payload),
      message: error.message || "",
      hint: error.hint || "",
      code: error.code || "",
    });
  }

  const detail = tried
    .map((item) => `${item.keys.join(",")}:${item.message}${item.hint ? `|hint=${item.hint}` : ""}`)
    .join(" ; ");
  return {
    data: null,
    error: { message: detail || "checkout_rpc_failed" },
    tried,
  };
}

async function generateOrderNo(supabase) {
  const { data, error } = await supabase.rpc("next_order_no_monthly", {
    p_prefix: "JIB",
  });
  if (error) {
    throw new Error(error.message || "generate_order_no_failed");
  }
  const orderNo = typeof data === "string" ? data.trim() : "";
  if (!orderNo) {
    throw new Error("generate_order_no_empty");
  }
  return orderNo;
}

export async function PATCH(request) {
  try {
    console.log("[checkout-api] PATCH /api/cart/checkout start");
    if (!isTrustedOrigin(request)) {
      console.log("[checkout-api] forbidden origin");
      return NextResponse.json({ error: "forbidden_origin" }, { status: 403 });
    }

    const payload = await request.json().catch(() => ({}));
    const fulfillmentType = payload?.fulfillment_type;
    const scheduledAt = normalizeIsoDateTime(payload?.scheduled_at);
    const slipPath = typeof payload?.slip_path === "string" ? payload.slip_path.trim() : "";
    const address = typeof payload?.address === "string" ? payload.address.trim() : null;
    const province = typeof payload?.province === "string" ? payload.province.trim() : null;
    const locationLat =
      payload?.location_lat !== null && payload?.location_lat !== undefined
        ? Number(payload.location_lat)
        : null;
    const locationLon =
      payload?.location_lon !== null && payload?.location_lon !== undefined
        ? Number(payload.location_lon)
        : null;
    const idempotencyKey = normalizeIdempotencyKey(
      request.headers.get("idempotency-key") || payload?.idempotency_key
    );
    const paymentOption =
      typeof payload?.payment_option === "string" ? payload.payment_option.trim() : "full";
    const dateTrans =
      typeof payload?.datetrans === "string" && DATE_TRANS_PATTERN.test(payload.datetrans.trim())
        ? payload.datetrans.trim()
        : null;
    const timeTrans =
      typeof payload?.timetrans === "string" && payload.timetrans.trim()
        ? payload.timetrans.trim()
        : null;

    const auth = await getCustomerAuthContext();
    const customerId = auth.customerId;
    console.log("[checkout-api] auth resolved", {
      mode: auth.mode,
      customerId,
      fulfillmentType,
      paymentOption,
      hasSlipPath: Boolean(slipPath),
      hasScheduledAt: Boolean(scheduledAt),
      idempotencyKey,
    });

    if (!customerId) {
      console.log("[checkout-api] return unauthorized: missing customerId");
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    if (!idempotencyKey) {
      console.log("[checkout-api] return bad request: missing_idempotency_key");
      return NextResponse.json({ error: "missing_idempotency_key" }, { status: 400 });
    }

    if (!FULFILLMENT_TYPES.has(fulfillmentType)) {
      console.log("[checkout-api] return bad request: invalid_fulfillment_type", { fulfillmentType });
      return NextResponse.json({ error: "invalid_fulfillment_type" }, { status: 400 });
    }
    if (!PAYMENT_OPTIONS.has(paymentOption)) {
      console.log("[checkout-api] return bad request: invalid_payment_option", { paymentOption });
      return NextResponse.json({ error: "invalid_payment_option" }, { status: 400 });
    }
    if (fulfillmentType === "install" && !scheduledAt) {
      console.log("[checkout-api] return bad request: invalid_scheduled_at", {
        scheduled_at: payload?.scheduled_at,
      });
      return NextResponse.json({ error: "invalid_scheduled_at" }, { status: 400 });
    }
    if (fulfillmentType === "install" && !isFutureSchedule(scheduledAt)) {
      console.log("[checkout-api] return bad request: scheduled_at_too_soon", { scheduledAt });
      return NextResponse.json({ error: "scheduled_at_too_soon" }, { status: 400 });
    }

    const slipFile = slipPath.split("/").pop() || "";
    const validSlipFile = /\.(jpg|jpeg|png|webp)$/i.test(slipFile);
    if (!slipPath || !slipPath.startsWith(`${customerId}/`) || !validSlipFile) {
      console.log("[checkout-api] return bad request: invalid_slip_path", {
        customerId,
        slipPath,
        validSlipFile,
      });
      return NextResponse.json({ error: "invalid_slip_path" }, { status: 400 });
    }

    if (fulfillmentType === "delivery") {
      if (!address) {
        console.log("[checkout-api] return bad request: invalid_delivery_location", {
          hasAddress: Boolean(address),
        });
        return NextResponse.json({ error: "invalid_delivery_location" }, { status: 400 });
      }
    }

    // Use service-role client for server-side checkout flow to avoid RLS visibility gaps
    // between steps (create/update order -> queue notification).
    const supabase = createSupabaseAdminClient();
    console.log("[checkout-api] using admin supabase client for checkout flow", {
      authMode: auth.mode,
    });
    const hasOwnedSlip = await verifySlipOwnership(supabase, customerId, slipPath);
    console.log("[checkout-api] verifySlipOwnership", { customerId, slipPath, hasOwnedSlip });
    if (!hasOwnedSlip) {
      console.log("[checkout-api] return bad request: slip_not_found");
      return NextResponse.json({ error: "slip_not_found" }, { status: 400 });
    }

    const { error: updateCartError } = await supabase
      .from("carts")
      .update({
        payment_option: paymentOption,
        datetrans: dateTrans,
        timetrans: timeTrans,
      })
      .eq("customer_id", customerId)
      .eq("status", "active");

    if (updateCartError) {
      console.error("Update cart payment option failed", updateCartError);
      return NextResponse.json(
        { error: "cart_payment_option_update_failed", detail: updateCartError.message },
        { status: 500 }
      );
    }
    let orderNo = "";
    try {
      orderNo = await generateOrderNo(supabase);
      console.log("[checkout-api] orderNo generated", { orderNo });
    } catch (orderNoError) {
      console.error("Generate order no failed", orderNoError);
      return NextResponse.json(
        { error: "generate_order_no_failed", detail: String(orderNoError?.message || "") },
        { status: 500 }
      );
    }

    const { data: rpcData, error: rpcError } = await callCheckoutCartAtomic(supabase, {
      p_customer_id: customerId,
      p_fulfillment_type: fulfillmentType,
      p_scheduled_at: scheduledAt,
      p_slip_path: slipPath,
      p_address: address,
      p_province: province,
      p_location_lat: Number.isNaN(locationLat) ? null : locationLat,
      p_location_lon: Number.isNaN(locationLon) ? null : locationLon,
      p_order_no: orderNo,
      p_idempotency_key: idempotencyKey,
      p_site_code: "car_retail",
      p_group_code: "general",
    });

    if (rpcError) {
      console.log("[checkout-api] checkout_cart_atomic failed", { detail: rpcError.message });
      const detail = rpcError.message || "checkout_rpc_failed";
      const lowerDetail = detail.toLowerCase();
      const missingFunction =
        detail.includes("checkout_cart_atomic") &&
        (lowerDetail.includes("function") || lowerDetail.includes("schema cache"));
      const inProgress = lowerDetail.includes("idempotency_in_progress");

      return NextResponse.json(
        {
          error: missingFunction ? "checkout_rpc_missing" : "checkout_atomic_failed",
          detail,
        },
        { status: missingFunction ? 500 : inProgress ? 409 : 400 }
      );
    }

    const row = Array.isArray(rpcData) ? rpcData[0] : rpcData;
    console.log("[checkout-api] checkout_cart_atomic success", { row });
    if (!row?.order_id) {
      console.log("[checkout-api] return server error: checkout_atomic_empty_result");
      return NextResponse.json({ error: "checkout_atomic_empty_result" }, { status: 500 });
    }
    const grandTotal = Number(row.grand_total || 0);
    const depositAmount = 500;
    const payNowAmount = paymentOption === "deposit" ? depositAmount : grandTotal;

    const { error: updateOrderError } = await supabase
      .from("orders")
      .update({
        payment_option: paymentOption,
        deposit_amount: paymentOption === "deposit" ? depositAmount : 0,
        pay_now_amount: payNowAmount,
        datetrans: dateTrans,
        timetrans: timeTrans,
      })
      .eq("id", row.order_id);

    if (updateOrderError) {
      console.error("Update payment option failed", updateOrderError);
      return NextResponse.json(
        { error: "order_payment_option_update_failed", detail: updateOrderError.message },
        { status: 500 }
      );
    }

    const { error: updateAppointmentError } = await supabase
      .from("install_appointments")
      .update({
        datetrans: dateTrans,
        timetrans: timeTrans,
      })
      .eq("order_id", row.order_id);

    if (updateAppointmentError) {
      console.error("Update appointment date/time text failed", updateAppointmentError);
      return NextResponse.json(
        { error: "appointment_date_time_update_failed", detail: updateAppointmentError.message },
        { status: 500 }
      );
    }

    let notificationResult = null;
    try {
      console.log("[checkout-api] queue notification start", {
        customerId,
        orderId: row.order_id,
      });
      notificationResult = await queueAndProcessOrderEventNotification({
        supabase,
        eventType: "order_confirmed",
        customerId,
        orderId: row.order_id,
        dedupeKey: `${customerId}:${idempotencyKey}:order_confirmed`,
      });
      console.log("[checkout-api] queue notification result", notificationResult);
      if (!notificationResult?.queued) {
        console.error("Notification not queued", {
          customerId,
          orderId: row.order_id,
          result: notificationResult,
        });
      }
    } catch (notificationError) {
      console.error("Queue order_confirmed notification error", notificationError);
    }

    return NextResponse.json({
      ok: true,
      order: {
        id: row.order_id,
        order_no: row.order_no,
        status: "pending",
        payment_status: "awaiting_verification",
      },
      totals: {
        items_total: Number(row.items_total || 0),
        service_fee: Number(row.service_fee || 0),
        shipping_fee: Number(row.shipping_fee || 0),
        grand_total: grandTotal,
        pay_now_amount: payNowAmount,
      },
      notification: notificationResult
        ? {
            queued: Boolean(notificationResult.queued),
            duplicated: Boolean(notificationResult.duplicated),
            reason: notificationResult.reason || null,
            job_id: notificationResult.jobId || null,
            line_user_id: notificationResult.lineUserId || null,
          }
        : null,
    });
  } catch (error) {
    console.error("[checkout-api] unexpected error", error);
    return NextResponse.json({ error: "unexpected_error" }, { status: 500 });
  }
}
