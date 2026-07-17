import { createHmac, timingSafeEqual } from "crypto";

export const LINE_SESSION_COOKIE = "line_session";
const DEFAULT_MAX_AGE = 60 * 60 * 24 * 30;

function base64UrlEncode(value) {
  return Buffer.from(value).toString("base64url");
}

function base64UrlDecode(value) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function getLineSessionSecret() {
  const secret = process.env.LINE_SESSION_SECRET || process.env.LINE_CHANNEL_SECRET;
  if (!secret) {
    throw new Error("missing_line_session_secret");
  }
  return secret;
}

function signPayload(payloadB64, secret) {
  return createHmac("sha256", secret).update(payloadB64).digest("base64url");
}

export function createLineSessionToken(
  { customerId, lineUserId },
  { maxAge = DEFAULT_MAX_AGE } = {}
) {
  if (!customerId || !lineUserId) {
    throw new Error("invalid_line_session_payload");
  }
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    customerId: String(customerId),
    lineUserId: String(lineUserId),
    iat: now,
    exp: now + maxAge,
  };
  const payloadB64 = base64UrlEncode(JSON.stringify(payload));
  const signature = signPayload(payloadB64, getLineSessionSecret());
  return `${payloadB64}.${signature}`;
}

export function verifyLineSessionToken(token) {
  if (!token || typeof token !== "string") return null;
  const [payloadB64, signature] = token.split(".");
  if (!payloadB64 || !signature) return null;

  const expectedSig = signPayload(payloadB64, getLineSessionSecret());
  const receivedBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSig);
  if (
    receivedBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(receivedBuffer, expectedBuffer)
  ) {
    return null;
  }

  try {
    const payload = JSON.parse(base64UrlDecode(payloadB64));
    if (!payload?.customerId || !payload?.lineUserId || !payload?.exp) {
      return null;
    }
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp <= now) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

export function readLineSessionFromCookieStore(cookieStore) {
  const token = cookieStore.get(LINE_SESSION_COOKIE)?.value;
  return verifyLineSessionToken(token);
}

export function setLineSessionCookie(
  response,
  { customerId, lineUserId },
  { maxAge = DEFAULT_MAX_AGE } = {}
) {
  const token = createLineSessionToken({ customerId, lineUserId }, { maxAge });
  response.cookies.set(LINE_SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  });
}

export function clearLineSessionCookie(response) {
  response.cookies.delete(LINE_SESSION_COOKIE);
}
