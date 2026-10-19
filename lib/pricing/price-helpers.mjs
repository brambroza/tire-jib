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
