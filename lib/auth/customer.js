import { cookies } from "next/headers";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { readLineSessionFromCookieStore } from "@/lib/auth/line-session";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function getDevelopmentCustomerId() {
  if (process.env.NODE_ENV !== "development") return null;
  if (process.env.DEV_AUTH_BYPASS_ENABLED !== "true") return null;

  const customerId = String(process.env.DEV_AUTH_CUSTOMER_ID || "").trim();
  return UUID_PATTERN.test(customerId) ? customerId : null;
}

export async function getCustomerAuthContext() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user?.id) {
    return {
      mode: "supabase",
      customerId: user.id,
      lineUserId: null,
      user,
      supabase,
    };
  }

  const cookieStore = await cookies();
  const lineSession = readLineSessionFromCookieStore(cookieStore);
  if (!lineSession?.customerId || !lineSession?.lineUserId) {
    const developmentCustomerId = getDevelopmentCustomerId();
    if (developmentCustomerId) {
      return {
        mode: "line",
        customerId: developmentCustomerId,
        lineUserId: null,
        user: null,
        supabase,
        developmentBypass: true,
      };
    }

    return {
      mode: null,
      customerId: null,
      lineUserId: null,
      user: null,
      supabase,
    };
  }

  return {
    mode: "line",
    customerId: lineSession.customerId,
    lineUserId: lineSession.lineUserId,
    user: null,
    supabase,
  };
}
