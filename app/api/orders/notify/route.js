import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { queueAndProcessOrderEventNotification } from "@/lib/notifications/jobs";
import { isSupportedNotificationEventType } from "@/lib/notifications/line-flex";
import { isInternalApiAuthorized } from "@/lib/security/internal-api";

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(value || "")
  );
}

export async function POST(request) {
  try {
    if (!isInternalApiAuthorized(request)) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const payload = await request.json().catch(() => ({}));
    const eventType = String(payload?.event_type || "").trim();
    const orderId = String(payload?.order_id || "").trim();
    const customerId = String(payload?.customer_id || "").trim();
    const idempotencyKey = String(payload?.idempotency_key || "").trim();

    if (!isSupportedNotificationEventType(eventType)) {
      return NextResponse.json({ error: "invalid_event_type" }, { status: 400 });
    }
    if (!isUuid(orderId) || !isUuid(customerId)) {
      return NextResponse.json({ error: "invalid_order_or_customer_id" }, { status: 400 });
    }

    const dedupeKey = idempotencyKey || `${orderId}:${eventType}`;

    const supabase = createSupabaseAdminClient();
    const result = await queueAndProcessOrderEventNotification({
      supabase,
      eventType,
      customerId,
      orderId,
      dedupeKey,
    });

    return NextResponse.json({ ok: true, result });
  } catch (error) {
    console.error("Queue order notification error", error);
    return NextResponse.json({ error: "unexpected_error" }, { status: 500 });
  }
}
