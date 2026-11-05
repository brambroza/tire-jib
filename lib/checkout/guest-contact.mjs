/**
 * Contact details for guest checkout (customers ordering without login).
 * Pure functions only (no browser/Next imports) so they run under node --test
 * and can be shared by CheckoutFlow (client) and /api/cart/checkout (server).
 */

export const GUEST_NAME_MAX = 100;
export const GUEST_ADDRESS_MAX = 500;

/**
 * Normalize a Thai phone number: drop spaces/dashes/dots/brackets and turn
 * +66 / 66 prefixes into a leading 0.
 * @param {unknown} value
 * @returns {string}
 */
export function normalizeThaiPhone(value) {
  let digits = String(value ?? "").replace(/[\s\-().]/g, "");
  if (digits.startsWith("+66")) digits = `0${digits.slice(3)}`;
  else if (/^66\d{8,9}$/.test(digits)) digits = `0${digits.slice(2)}`;
  return digits;
}

/**
 * Validate guest contact fields.
 * @param {{ name?: unknown, phone?: unknown, address?: unknown }} input
 * @returns {{ ok: boolean, value: { name: string, phone: string, address: string },
 *   errors: { name?: string, phone?: string, address?: string } }}
 */
export function validateGuestContact(input) {
  const name = String(input?.name ?? "").replace(/\s+/g, " ").trim();
  const phone = normalizeThaiPhone(input?.phone);
  const address = String(input?.address ?? "").trim();
  const errors = {};

  if (name.length < 2) errors.name = "กรุณากรอกชื่อผู้สั่งซื้อ";
  else if (name.length > GUEST_NAME_MAX) errors.name = `ชื่อยาวเกิน ${GUEST_NAME_MAX} ตัวอักษร`;

  // Thai mobile (0X XXXX XXXX) or landline (0X XXX XXXX).
  if (!/^0\d{8,9}$/.test(phone)) errors.phone = "กรุณากรอกเบอร์โทรให้ถูกต้อง เช่น 0812345678";

  if (address.length < 5) errors.address = "กรุณากรอกที่อยู่";
  else if (address.length > GUEST_ADDRESS_MAX) errors.address = `ที่อยู่ยาวเกิน ${GUEST_ADDRESS_MAX} ตัวอักษร`;

  return { ok: Object.keys(errors).length === 0, value: { name, phone, address }, errors };
}
