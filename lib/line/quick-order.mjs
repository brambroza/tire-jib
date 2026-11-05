/**
 * Helpers for the LINE "quick order" link (/line/order?sku=...&qty=...&n=...).
 * The LINE bot (tireshop-portal webhook) puts this link on product cards so a
 * tap adds the SKU to the cart and lands the customer on /checkout.
 *
 * Pure functions only (no browser/Next imports) so they run under node --test.
 */

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const NONCE_PATTERN = /^[0-9a-zA-Z_-]{4,32}$/;

export const QUICK_ORDER_MAX_QTY = 99;
export const QUICK_ORDER_DEFAULT_QTY = 1;
export const QUICK_ORDER_DESTINATION = "/checkout";

/**
 * Parse and validate quick-order query params.
 * @param {URLSearchParams | { get(name: string): string | null }} params
 * @returns {{ skuId: string, quantity: number, nonce: string | null } | null}
 *   null when the SKU id is missing or malformed.
 */
export function parseQuickOrderParams(params) {
  const skuId = String(params?.get?.("sku") ?? "").trim();
  if (!UUID_PATTERN.test(skuId)) return null;

  const rawQty = Number(params.get("qty") ?? QUICK_ORDER_DEFAULT_QTY);
  const quantity = Number.isInteger(rawQty)
    ? Math.min(Math.max(rawQty, 1), QUICK_ORDER_MAX_QTY)
    : QUICK_ORDER_DEFAULT_QTY;

  const rawNonce = String(params.get("n") ?? "").trim();
  const nonce = NONCE_PATTERN.test(rawNonce) ? rawNonce : null;

  return { skuId, quantity, nonce };
}

/**
 * Accept only same-site relative paths for post-login redirects
 * (blocks open redirects such as "//evil.com" or "https://evil.com").
 * @param {unknown} value
 * @returns {string | null}
 */
export function sanitizeReturnTo(value) {
  if (typeof value !== "string") return null;
  const path = value.trim();
  if (!path || path.length > 512) return null;
  if (!path.startsWith("/") || path.startsWith("//") || path.startsWith("/\\")) return null;
  if (/[\u0000-\u001f]/.test(path)) return null;
  return path;
}

/**
 * Add a nonce to the "already ordered" list, keeping only the most recent ones.
 * @param {string[]} doneList previously stored nonces
 * @param {string} nonce
 * @param {number} [limit]
 * @returns {string[]}
 */
export function rememberNonce(doneList, nonce, limit = 30) {
  const list = Array.isArray(doneList) ? doneList.filter((x) => typeof x === "string" && x !== nonce) : [];
  list.push(nonce);
  return list.slice(-limit);
}

/**
 * Thai message for an /api/cart/add error code.
 * @param {string | undefined} code
 * @returns {string}
 */
export function quickOrderErrorMessage(code) {
  const messages = {
    insufficient_stock: "สินค้าในสต็อกไม่เพียงพอตามจำนวนที่เลือก",
    quantity_limit_exceeded: "จำนวนรวมในตะกร้าต้องไม่เกิน 99 เส้น",
    out_of_stock: "สินค้าหมดชั่วคราว",
    sku_not_available: "ไม่พบสินค้านี้ หรือสินค้าถูกปิดการขายแล้ว",
  };
  return messages[code] || "ไม่สามารถเพิ่มสินค้าลงตะกร้าได้ กรุณาลองอีกครั้ง";
}
