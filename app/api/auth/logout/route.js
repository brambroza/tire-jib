import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { clearLineSessionCookie } from "@/lib/auth/line-session";
import { isTrustedOrigin } from "@/lib/security/request-origin";

export async function POST(request) {
  if (!isTrustedOrigin(request)) {
    return NextResponse.json({ error: "forbidden_origin" }, { status: 403 });
  }

  const response = NextResponse.json({ ok: true });
  try {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut();
  } catch (error) {
    console.error("Logout error", error);
  }

  clearLineSessionCookie(response);
  response.cookies.delete("line_user_id");
  response.cookies.delete("line_customer_id");
  return response;
}
