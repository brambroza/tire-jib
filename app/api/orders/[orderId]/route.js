import { NextResponse } from "next/server";
import { getCustomerAuthContext } from "@/lib/auth/customer";
import { fetchOrderDetailsForCustomer, isUuid } from "@/lib/orders/details";

export async function GET(_request, { params }) {
  try {
    const resolvedParams = await params;
    const orderId = resolvedParams?.orderId;

    if (!isUuid(orderId)) {
      return NextResponse.json({ error: "invalid_order_id" }, { status: 400 });
    }

    const auth = await getCustomerAuthContext();
    if (!auth.customerId) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const orderDetail = await fetchOrderDetailsForCustomer({
      auth,
      orderId,
      includeSlipPreview: true,
      slipSignedUrlSeconds: 60 * 10,
    });

    if (!orderDetail) {
      return NextResponse.json({ error: "order_not_found" }, { status: 404 });
    }

    return NextResponse.json({
      order: orderDetail.order,
      items: orderDetail.items,
      appointment: orderDetail.appointment,
      totals: orderDetail.totals,
      timeline: orderDetail.timeline,
      slip_preview_url: orderDetail.slipPreviewUrl || null,
    });
  } catch (error) {
    console.error("Order detail api error", error);
    return NextResponse.json({ error: "unexpected_error" }, { status: 500 });
  }
}
