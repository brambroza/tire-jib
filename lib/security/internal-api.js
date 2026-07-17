import { timingSafeEqual } from "crypto";

function safeCompare(a, b) {
  const aBuffer = Buffer.from(String(a || ""));
  const bBuffer = Buffer.from(String(b || ""));
  if (aBuffer.length !== bBuffer.length) return false;
  return timingSafeEqual(aBuffer, bBuffer);
}

function readProvidedKey(request) {
  const headerKey = request.headers.get("x-internal-api-key")?.trim();
  if (headerKey) return headerKey;

  const authHeader = request.headers.get("authorization") || "";
  if (authHeader.toLowerCase().startsWith("bearer ")) {
    return authHeader.slice(7).trim();
  }

  return "";
}

export function isInternalApiAuthorized(request) {
  const expectedKey = process.env.INTERNAL_API_KEY || process.env.NOTIFICATION_API_KEY || "";
  if (!expectedKey) return false;
  const providedKey = readProvidedKey(request);
  if (!providedKey) return false;
  return safeCompare(providedKey, expectedKey);
}
