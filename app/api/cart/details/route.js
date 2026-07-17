import { NextResponse } from "next/server";
import { getCustomerAuthContext } from "@/lib/auth/customer";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { fetchActiveCartWithAdmin } from "@/lib/supabase/queries";

export async function GET() {
  try {
    const auth = await getCustomerAuthContext();
    const customerId = auth.customerId;

    if (!customerId) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const supabase =
      auth.mode === "supabase" ? auth.supabase : createSupabaseAdminClient();

    const cartData = await fetchActiveCartWithAdmin(supabase, customerId);
    return NextResponse.json(cartData);
  } catch (error) {
    console.error("Cart details error", error);
    return NextResponse.json({ error: "unexpected_error" }, { status: 500 });
  }
}
