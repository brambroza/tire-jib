const ALLOWED_ORIGIN_ENV_KEYS = ["NEXT_PUBLIC_SITE_URL", "SITE_URL"];

function normalizeOrigin(value) {
  if (!value || typeof value !== "string") return null;
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

function getAllowedOrigins(request) {
  const allowed = new Set();
  const requestOrigin = normalizeOrigin(request.url);
  if (requestOrigin) {
    allowed.add(requestOrigin);
  }

  for (const key of ALLOWED_ORIGIN_ENV_KEYS) {
    const envOrigin = normalizeOrigin(process.env[key]);
    if (envOrigin) {
      allowed.add(envOrigin);
    }
  }

  return allowed;
}

export function isTrustedOrigin(request) {
  const allowedOrigins = getAllowedOrigins(request);
  if (!allowedOrigins.size) return false;

  const originHeader = normalizeOrigin(request.headers.get("origin"));
  if (originHeader) {
    return allowedOrigins.has(originHeader);
  }

  const refererHeader = normalizeOrigin(request.headers.get("referer"));
  if (refererHeader) {
    return allowedOrigins.has(refererHeader);
  }

  return false;
}
