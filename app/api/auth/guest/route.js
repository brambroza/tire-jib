import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { getCustomerAuthContext } from "@/lib/auth/customer";
import { GUEST_LINE_USER_PREFIX, setGuestSessionCookie } from "@/lib/auth/guest-session";
import { fetchGeneralGroup } from "@/lib/pricing/customer-group";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isTrustedOrigin } from "@/lib/security/request-origin";

/**
 * Start a guest session so a customer can order without logging in.
 * Creates a placeholder `customes` row (general price group, no LINE identity)
 * and sets a signed `guest_session` cookie. Reuses the current session when the
 * visitor is already logged in or already a guest.
 */
export async function POST(request) {
  try {
    if (!isTrustedOrigin(request)) {
      return NextResponse.json({ error: "forbidden_origin" }, { status: 403 });
    }

    const auth = await getCustomerAuthContext();
    if (auth.customerId) {
      return NextResponse.json({ ok: true, mode: auth.mode });
    }

    const admin = createSupabaseAdminClient();
    const general = await fetchGeneralGroup(admin);
    if (!general?.id) {
      return NextResponse.json({ error: "general_group_missing" }, { status: 500 });
    }

    const { data, error } = await admin
      .from("customes")
      .insert({
        // line_user_id is NOT NULL + unique; the prefix marks it as a non-LINE placeholder.
        line_user_id: `${GUEST_LINE_USER_PREFIX}${randomUUID()}`,
        line_msg_user_id: null,
        display_name: "ลูกค้าทั่วไป (ไม่เป็นสมาชิก)",
        login_state: false,
        line_is_friend: false,
        group_id: general.id,
      })
      .select("id")
      .single();

    if (error || !data?.id) {
      console.error("Guest customer create failed", error);
      return NextResponse.json({ error: "guest_create_failed" }, { status: 500 });
    }

    const response = NextResponse.json({ ok: true, mode: "guest" });
    setGuestSessionCookie(response, { customerId: data.id });
    return response;
  } catch (error) {
    console.error("Guest session error", error);
    return NextResponse.json({ error: "unexpected_error" }, { status: 500 });
  }
}
