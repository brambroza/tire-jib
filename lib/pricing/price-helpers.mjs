// Pure price-group helpers. No framework imports so they run under node --test.

/**
 * Build the list of price group ids to query, most specific first.
 * Duplicates and empty values are removed.
 *
 * @param {string|null|undefined} groupId
 * @param {string|null|undefined} generalGroupId
 * @returns {string[]}
 */
export function buildPriceGroupIds(groupId, generalGroupId) {
  return Array.from(
    new Set([groupId, generalGroupId].map((id) => String(id || "").trim()).filter(Boolean)),
  );
}

/**
 * Pick the price row for a customer: the customer's group price first,
 * then the general price, then whatever row exists.
 *
 * @param {Array<{ group_id?: string }> | null | undefined} prices
 * @param {string|null|undefined} groupId
 * @param {string|null|undefined} generalGroupId
 * @returns {object | undefined}
 */
export function pickPriceRow(prices, groupId, generalGroupId) {
  if (!Array.isArray(prices) || prices.length === 0) return undefined;
  const byGroup = (id) =>
    id ? prices.find((row) => String(row?.group_id) === String(id)) : undefined;
  return byGroup(groupId) || byGroup(generalGroupId) || prices[0];
}

/**
 * Convert a raw numeric-ish value to a finite number, or null when it is
 * empty / not a number.
 *
 * @param {unknown} value
 * @returns {number | null}
 */
function toFiniteNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

/**
 * Resolve the price a customer actually pays for a price row, taking the
 * optional group-level `promo_price` into account.
 *
 * A promotion is active only when `promo_price` is a finite number that is
 * strictly lower than `price` (mirrors the DB check constraint). When the
 * promotion is active, `price` holds the promo amount and `basePrice` holds
 * the regular price so the UI can show it struck through.
 *
 * @param {{ price?: unknown, promo_price?: unknown } | null | undefined} row Price row.
 * @returns {{
 *   price: number,
 *   basePrice: number,
 *   isPromo: boolean,
 *   discountPercent: number,
 *   saving: number,
 * }}
 */
export function resolveEffectivePrice(row) {
  const basePrice = toFiniteNumber(row?.price) ?? 0;
  const promoPrice = toFiniteNumber(row?.promo_price);
  const isPromo = promoPrice !== null && promoPrice >= 0 && promoPrice < basePrice;

  if (!isPromo) {
    return { price: basePrice, basePrice, isPromo: false, discountPercent: 0, saving: 0 };
  }

  const saving = basePrice - promoPrice;
  const discountPercent = basePrice > 0 ? Math.round((saving / basePrice) * 100) : 0;
  return { price: promoPrice, basePrice, isPromo: true, discountPercent, saving };
}
