"use client";

import { sanitizeReturnTo } from "@/lib/line/quick-order.mjs";

const RETURN_TO_KEY = "line_return_to";

/**
 * Start LINE Login (OAuth 2.1 + PKCE) in the browser.
 * Stores state/verifier like before, plus an optional same-site path to
 * return to after /line/callback finishes.
 *
 * @param {{ returnTo?: string | null }} [options]
 * @throws {Error} when env or browser crypto is missing
 */
export async function startLineLogin({ returnTo } = {}) {
  const channelId = process.env.NEXT_PUBLIC_LINE_CHANNEL_ID;
  if (!channelId) {
    throw new Error("ยังไม่ได้ตั้งค่า NEXT_PUBLIC_LINE_CHANNEL_ID");
  }
  if (!window?.crypto?.subtle) {
    throw new Error("เบราว์เซอร์ไม่รองรับการเข้ารหัสที่จำเป็นสำหรับ LINE PKCE");
  }

  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || window.location.origin;
  const redirectTo = `${siteUrl}/line/callback`;
  const codeVerifier = randomBase64Url(32);
  const codeChallenge = await sha256Base64Url(codeVerifier);
  const state = randomBase64Url(16);

  sessionStorage.setItem("line_code_verifier", codeVerifier);
  sessionStorage.setItem("line_oauth_state", state);
  localStorage.setItem("line_code_verifier", codeVerifier);
  localStorage.setItem("line_oauth_state", state);

  const safeReturnTo = sanitizeReturnTo(returnTo);
  if (safeReturnTo) {
    sessionStorage.setItem(RETURN_TO_KEY, safeReturnTo);
    localStorage.setItem(RETURN_TO_KEY, safeReturnTo);
  } else {
    sessionStorage.removeItem(RETURN_TO_KEY);
    localStorage.removeItem(RETURN_TO_KEY);
  }

  const authUrl = new URL("https://access.line.me/oauth2/v2.1/authorize");
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("client_id", channelId);
  authUrl.searchParams.set("redirect_uri", redirectTo);
  authUrl.searchParams.set("state", state);
  authUrl.searchParams.set("scope", "openid profile friendship_status");
  authUrl.searchParams.set("code_challenge", codeChallenge);
  authUrl.searchParams.set("code_challenge_method", "S256");

  window.location.href = authUrl.toString();
}

/**
 * Read and clear the stored post-login path. Returns a safe relative path or null.
 * @returns {string | null}
 */
export function consumeLineReturnTo() {
  const value =
    sessionStorage.getItem(RETURN_TO_KEY) || localStorage.getItem(RETURN_TO_KEY);
  sessionStorage.removeItem(RETURN_TO_KEY);
  localStorage.removeItem(RETURN_TO_KEY);
  return sanitizeReturnTo(value);
}

function randomBase64Url(byteLength) {
  const bytes = new Uint8Array(byteLength);
  window.crypto.getRandomValues(bytes);
  return toBase64Url(bytes);
}

async function sha256Base64Url(value) {
  const data = new TextEncoder().encode(value);
  const hash = await window.crypto.subtle.digest("SHA-256", data);
  return toBase64Url(new Uint8Array(hash));
}

function toBase64Url(bytes) {
  const base64 = btoa(String.fromCharCode(...bytes));
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
