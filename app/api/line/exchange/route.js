import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  clearLineSessionCookie,
  setLineSessionCookie,
} from "@/lib/auth/line-session";
import { isTrustedOrigin } from "@/lib/security/request-origin";
import { fetchLineFriendshipStatus } from "@/lib/line/friendship";

const LINE_TOKEN_URL = "https://api.line.me/oauth2/v2.1/token";
const LINE_PROFILE_URL = "https://api.line.me/v2/profile";

export async function POST(request) {
  try {
    if (!isTrustedOrigin(request)) {
      return NextResponse.json({ error: "forbidden_origin" }, { status: 403 });
    }

    const { code, codeVerifier } = await request.json();

    if (!code || !codeVerifier) {
      return NextResponse.json({ error: "missing_code_or_verifier" }, { status: 400 });
    }

    const channelId = process.env.NEXT_PUBLIC_LINE_CHANNEL_ID;
    const channelSecret = process.env.LINE_CHANNEL_SECRET;
    const redirectUri = `${process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin}/line/callback`;

    if (!channelId || !channelSecret) {
      console.error("LINE env missing", { hasChannelId: Boolean(channelId), hasChannelSecret: Boolean(channelSecret) });
      return NextResponse.json({ error: "missing_line_env" }, { status: 500 });
    }

    const tokenResponse = await fetch(LINE_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
        client_id: channelId,
        client_secret: channelSecret,
        code_verifier: codeVerifier,
      }),
    });

    const tokenPayload = await tokenResponse.json();
    if (!tokenResponse.ok) {
      console.error("LINE token error", {
        status: tokenResponse.status,
        statusText: tokenResponse.statusText,
        detail: tokenPayload,
        redirectUri,
      });
      return NextResponse.json({ error: "line_token_error", detail: tokenPayload }, { status: 400 });
    }

    const profileResponse = await fetch(LINE_PROFILE_URL, {
      headers: { Authorization: `Bearer ${tokenPayload.access_token}` },
    });

    const profile = await profileResponse.json();
    if (!profileResponse.ok) {
      console.error("LINE profile error", {
        status: profileResponse.status,
        statusText: profileResponse.statusText,
        detail: profile,
      });
      return NextResponse.json({ error: "line_profile_error", detail: profile }, { status: 400 });
    }

    const supabase = createSupabaseAdminClient();
    let isLineFriend = null;
    let friendshipCheckError = null;
    try {
      isLineFriend = await fetchLineFriendshipStatus(tokenPayload.access_token);
    } catch (error) {
      friendshipCheckError = String(error?.message || "friendship_check_failed");
      console.error("LINE friendship status error", { friendshipCheckError });
    }

    const now = new Date().toISOString();
    const upsertPayload = {
      line_user_id: profile.userId,
      line_msg_user_id: profile.userId,
      display_name: profile.displayName ?? null,
      profile_image_url: profile.pictureUrl ?? null,
      login_state: true,
      last_login_at: now,
    };
    if (typeof isLineFriend === "boolean") {
      upsertPayload.line_is_friend = isLineFriend;
      upsertPayload.line_friendship_checked_at = now;
    }

    const { data, error } = await supabase
      .from("customes")
      .upsert(
      upsertPayload,
        { onConflict: "line_user_id" }
      )
      .select("id, line_user_id, line_msg_user_id, display_name, profile_image_url, line_is_friend")
      .single();

    if (error) {
      console.error("Supabase upsert error", { error });
      return NextResponse.json({ error: "supabase_upsert_error" }, { status: 500 });
    }
    if (!data?.id) {
      return NextResponse.json({ error: "line_profile_not_persisted" }, { status: 500 });
    }

    const response = NextResponse.json({
      ok: true,
      profile: {
        line_user_id: data?.line_user_id ?? profile.userId,
        line_msg_user_id: data?.line_msg_user_id ?? null,
        display_name: data?.display_name ?? profile.displayName ?? null,
        profile_image_url: data?.profile_image_url ?? profile.pictureUrl ?? null,
        line_is_friend: typeof data?.line_is_friend === "boolean" ? data.line_is_friend : null,
      },
      line_add_friend_url: "https://line.me/R/ti/p/@Hijib",
      friendship_check_error: friendshipCheckError,
    });
    setLineSessionCookie(response, {
      customerId: data.id,
      lineUserId: profile.userId,
    });
    response.cookies.delete("line_user_id");
    response.cookies.delete("line_customer_id");
    return response;
  } catch (error) {
    const response = NextResponse.json({ error: "unexpected_error" }, { status: 500 });
    clearLineSessionCookie(response);
    console.error("LINE exchange unexpected error", error);
    return response;
  }
}
