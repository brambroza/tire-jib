import { NextResponse } from "next/server";
import { getCustomerAuthContext } from "@/lib/auth/customer";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  try {
    const auth = await getCustomerAuthContext();
    const customerId = auth.customerId;

    if (!customerId) {
      return NextResponse.json({ count: 0, total: 0 });
    }

    const supabase =
      auth.mode === "supabase" ? auth.supabase : createSupabaseAdminClient();

    const { data: cart } = await supabase
      .from("carts")
      .select("id")
      .eq("customer_id", customerId)
      .eq("status", "active")
      .maybeSingle();

    if (!cart) {
      return NextResponse.json({ count: 0, total: 0 });
    }

    const { data: items } = await supabase
      .from("cart_items")
      .select("quantity")
      .eq("cart_id", cart.id);

    const count = (items || []).reduce((sum, item) => sum + (item.quantity || 0), 0);
    return NextResponse.json({ count, total: count });
  } catch (error) {
    console.error("Cart summary error", error);
    return NextResponse.json({ count: 0, total: 0 });
  }
}
