import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(value || ""),
  );
}

export function formatOrderStatus(status) {
  switch (status) {
    case "pending":
      return "รอดำเนินการ";
    case "preparing":
      return "กำลังจัดเตรียม";
    case "shipping":
      return "กำลังจัดส่ง";
    case "installed":
      return "ติดตั้งสำเร็จ";
    case "completed":
      return "เสร็จสิ้น";
    default:
      return status || "ไม่ทราบสถานะ";
  }
}

export function formatPaymentStatus(status) {
  switch (status) {
    case "awaiting_verification":
      return "รอตรวจสอบการชำระเงิน";
    case "pending":
      return "รอชำระเงิน";
    case "paid":
      return "ชำระเงินแล้ว";
    case "failed":
      return "ชำระเงินไม่สำเร็จ";
    case "refunded":
      return "คืนเงินแล้ว";
    default:
      return status || "ไม่ทราบสถานะ";
  }
}

function formatSize(sku) {
  if (!sku) return "-";
  if (sku.size_label) return sku.size_label;
  if (sku.width_mm && sku.aspect_ratio && sku.rim_inch) {
    return `${sku.width_mm}/${sku.aspect_ratio}R${sku.rim_inch}`;
  }
  return "-";
}

function buildTimeline(order, appointment) {
  const timeline = [];
  if (order?.created_at) {
    timeline.push({
      key: "created",
      title: "สร้างคำสั่งซื้อ",
      time: order.created_at,
      tone: "done",
    });
  }
  timeline.push({
    key: "payment",
    title: `สถานะการชำระเงิน: ${formatPaymentStatus(order?.payment_status)}`,
    time: order?.updated_at || order?.created_at || null,
    tone: order?.payment_status === "paid" ? "done" : "pending",
  });
  if (appointment?.scheduled_at) {
    timeline.push({
      key: "appointment",
      title: "นัดติดตั้ง",
      time: appointment.scheduled_at,
      tone: "done",
    });
  }
  timeline.push({
    key: "order-status",
    title: `สถานะออเดอร์: ${formatOrderStatus(order?.status)}`,
    time: order?.updated_at || order?.created_at || null,
    tone: order?.status === "completed" ? "done" : "pending",
  });
  return timeline;
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
      return (
        (data || []).map((item) => {
          const quantity = Number(item.quantity || 0);
          const unitPrice = Number(item.unit_price ?? item.price ?? 0);
          const lineTotal = Number(
            item.line_total ?? item.total ?? unitPrice * quantity,
          );
          return {
            id: item.id,
            quantity,
            unitPrice,
            lineTotal,
            skuId: item.sku?.id || null,
            name:
              `${item.sku?.product?.brand || ""} ${item.sku?.product?.name || ""}`.trim() ||
              "-",
            size: formatSize(item.sku),
          };
        }) || []
      );
    }
  }

  return [];
}

export async function fetchOrderDetailsForCustomer({
  auth,
  orderId,
  includeSlipPreview = true,
  slipSignedUrlSeconds = 60 * 10,
}) {
  const customerId = auth?.customerId;
  if (!customerId) return null;

  const admin =
    auth.mode === "supabase" ? auth.supabase : createSupabaseAdminClient();

  const { data: order } = await admin
    .from("orders")
    .select("*")
    .eq("id", orderId)
    .eq("customer_id", customerId)
    .maybeSingle();

  if (!order) return null;

  const items = await fetchOrderItemsFlexible(admin, orderId);
  const { data: appointment } = await admin
    .from("install_appointments")
    .select("*")
    .eq("order_id", orderId)
    .order("scheduled_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  let slipPreviewUrl = "";
  const slipPath =
    typeof order.slip_url === "string" ? order.slip_url.trim() : "";
  if (includeSlipPreview && slipPath && slipPath.startsWith(`${customerId}/`)) {
    const { data: signedData } = await admin.storage
      .from("slips")
      .createSignedUrl(slipPath, slipSignedUrlSeconds);
    slipPreviewUrl = signedData?.signedUrl || "";
  }

  const itemSubTotal = items.reduce(
    (sum, item) => sum + Number(item.lineTotal || 0),
    0,
  );
  const serviceFee = Number(order.service_fee || 0);
  const shippingFee = Number(order.shipping_fee || 0);
  const grandTotal = Number(
    order.total_amount || itemSubTotal + serviceFee + shippingFee,
  );

  return {
    customerId,
    order,
    items,
    appointment: appointment || null,
    slipPreviewUrl,
    totals: {
      itemSubTotal,
      serviceFee,
      shippingFee,
      grandTotal,
    },
    timeline: buildTimeline(order, appointment),
  };
}
