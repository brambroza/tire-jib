import { NextResponse } from "next/server";
import { getCustomerAuthContext } from "@/lib/auth/customer";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const auth = await getCustomerAuthContext();
  const customerId = auth.customerId;

  if (!customerId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase =
    auth.mode === "supabase" ? auth.supabase : createSupabaseAdminClient();

  const { data, error } = await supabase
    .from("customes")
    .select(
      "id, line_user_id, line_msg_user_id, display_name, profile_image_url, address, location, phone, last_login_at"
    )
    .eq("id", customerId)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: "supabase_fetch_error" }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  if (auth.lineUserId && data.line_user_id && data.line_user_id !== auth.lineUserId) {
    return NextResponse.json({ error: "session_mismatch" }, { status: 403 });
  }

  return NextResponse.json({ profile: data });
}
