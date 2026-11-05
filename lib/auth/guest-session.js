import { createHmac, timingSafeEqual } from "crypto";

/**
 * Signed cookie for customers who order without logging in ("guest").
 * The guest still gets a `customes` row so the existing cart/checkout code
 * (keyed by customer_id) works unchanged.
 */
export const GUEST_SESSION_COOKIE = "guest_session";
export const GUEST_LINE_USER_PREFIX = "guest:";
const DEFAULT_MAX_AGE = 60 * 60 * 24 * 30;

function getGuestSessionSecret() {
  const secret = process.env.LINE_SESSION_SECRET || process.env.LINE_CHANNEL_SECRET;
  if (!secret) {
    throw new Error("missing_guest_session_secret");
  }
  return secret;
}

function sign(payloadB64, secret) {
  // "guest." prefix keeps guest signatures distinct from LINE session signatures.
  return createHmac("sha256", secret).update(`guest.${payloadB64}`).digest("base64url");
}

/**
 * @param {{ customerId: string }} input
 * @param {{ maxAge?: number }} [options]
 * @returns {string}
 */
export function createGuestSessionToken({ customerId }, { maxAge = DEFAULT_MAX_AGE } = {}) {
  if (!customerId) throw new Error("invalid_guest_session_payload");
  const now = Math.floor(Date.now() / 1000);
  const payloadB64 = Buffer.from(
    JSON.stringify({ customerId: String(customerId), guest: true, iat: now, exp: now + maxAge })
  ).toString("base64url");
  return `${payloadB64}.${sign(payloadB64, getGuestSessionSecret())}`;
}

/**
 * @param {unknown} token
 * @returns {{ customerId: string, guest: true, exp: number } | null}
 */
export function verifyGuestSessionToken(token) {
  if (!token || typeof token !== "string") return null;
  const [payloadB64, signature] = token.split(".");
  if (!payloadB64 || !signature) return null;

  const received = Buffer.from(signature);
  const expected = Buffer.from(sign(payloadB64, getGuestSessionSecret()));
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8"));
    if (!payload?.customerId || payload?.guest !== true || !payload?.exp) return null;
    if (payload.exp <= Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

/** @param {{ get(name: string): { value: string } | undefined }} cookieStore */
export function readGuestSessionFromCookieStore(cookieStore) {
  return verifyGuestSessionToken(cookieStore.get(GUEST_SESSION_COOKIE)?.value);
}

/**
 * @param {import("next/server").NextResponse} response
 * @param {{ customerId: string }} input
 */
export function setGuestSessionCookie(response, { customerId }, { maxAge = DEFAULT_MAX_AGE } = {}) {
  response.cookies.set(GUEST_SESSION_COOKIE, createGuestSessionToken({ customerId }, { maxAge }), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  });
}

/** @param {import("next/server").NextResponse} response */
export function clearGuestSessionCookie(response) {
  response.cookies.delete(GUEST_SESSION_COOKIE);
}

/**
 * True for the placeholder line_user_id given to guest customers.
 * These must never be used as a LINE push recipient.
 * @param {unknown} lineUserId
 */
export function isGuestLineUserId(lineUserId) {
  return typeof lineUserId === "string" && lineUserId.startsWith(GUEST_LINE_USER_PREFIX);
}
