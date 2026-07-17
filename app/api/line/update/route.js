import { NextResponse } from "next/server";
import { getCustomerAuthContext } from "@/lib/auth/customer";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isTrustedOrigin } from "@/lib/security/request-origin";

export async function PATCH(request) {
  if (!isTrustedOrigin(request)) {
    return NextResponse.json({ error: "forbidden_origin" }, { status: 403 });
  }

  const auth = await getCustomerAuthContext();
  const customerId = auth.customerId;

  if (!customerId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const payload = await request.json().catch(() => ({}));
  const address =
    typeof payload?.address === "string" ? payload.address.trim().slice(0, 500) : null;
  const location =
    typeof payload?.location === "string" ? payload.location.trim().slice(0, 200) : null;
  const phone =
    typeof payload?.phone === "string" ? payload.phone.replace(/[^\d+]/g, "").slice(0, 20) : null;
  const displayName =
    typeof payload?.display_name === "string"
      ? payload.display_name.trim().slice(0, 120)
      : null;

  if (phone && !/^\+?\d{8,15}$/.test(phone)) {
    return NextResponse.json({ error: "invalid_phone" }, { status: 400 });
  }

  const supabase =
    auth.mode === "supabase" ? auth.supabase : createSupabaseAdminClient();

  const { data, error } = await supabase
    .from("customes")
    .update({
      address,
      location,
      phone,
      display_name: displayName,
      updated_at: new Date().toISOString(),
    })
    .eq("id", customerId)
    .select(
      "line_user_id, line_msg_user_id, display_name, profile_image_url, address, location, phone, last_login_at"
    )
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: "supabase_update_error" }, { status: 500 });
  }

  return NextResponse.json({ profile: data });
}
