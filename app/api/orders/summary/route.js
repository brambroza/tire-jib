import { NextResponse } from "next/server";
import { getCustomerAuthContext } from "@/lib/auth/customer";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  try {
    const auth = await getCustomerAuthContext();
    const customerId = auth.customerId;

    if (!customerId) {
      return NextResponse.json({ hasOrder: false });
    }

    const admin =
      auth.mode === "supabase" ? auth.supabase : createSupabaseAdminClient();

    const { data: pendingCarts } = await admin
      .from("carts")
      .select("id")
      .eq("customer_id", customerId)
      .in("status", ["waitingconfirm"])
      .limit(1);

    const { data: orders } = await admin
      .from("orders")
      .select("id")
      .eq("customer_id", customerId)
      .limit(1);

    return NextResponse.json({
      hasOrder: Boolean(pendingCarts?.length || orders?.length),
    });
  } catch (error) {
    console.error("Orders summary error", error);
    return NextResponse.json({ hasOrder: false });
  }
}
