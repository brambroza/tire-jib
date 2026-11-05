/**
 * Pure helpers that turn a raw product row into the view model used by
 * `components/ProductCard.jsx`. Kept free of React so it can be unit-tested
 * with `node --test`.
 */

/**
 * Resolve the SKU identifier from the various shapes the API returns.
 *
 * @param {object | null | undefined} product Raw product row.
 * @returns {string} Trimmed SKU id, or empty string when none is available.
 */
export function resolveSkuId(product) {
  const raw = product?.id ?? product?.sku_id ?? product?.skuId ?? "";
  return String(raw).trim();
}

/**
 * Pick the first non-empty image URL from `imageFiles`, `imageFile` or `imageUrl`.
 *
 * @param {object | null | undefined} product Raw product row.
 * @returns {string} Image URL or empty string.
 */
export function resolveImageSrc(product) {
  const candidates = [
    ...(Array.isArray(product?.imageFiles) ? product.imageFiles : []),
    product?.imageFile,
    product?.imageUrl,
  ];
  return candidates.map((url) => String(url || "").trim()).find(Boolean) || "";
}

/**
 * Build the product detail URL. Prefers the SKU route, falls back to `product.href`.
 *
 * @param {object | null | undefined} product Raw product row.
 * @param {string} skuId Resolved SKU id.
 * @returns {string | null} Detail href or null when the card has no destination.
 */
export function resolveDetailHref(product, skuId) {
  if (skuId) {
    return `/products/${encodeURIComponent(skuId)}`;
  }
  const fallback = typeof product?.href === "string" ? product.href.trim() : "";
  return fallback || null;
}

/**
 * Map the API `stockVariant` to a tone used by the stock indicator.
 *
 * @param {string | undefined} stockVariant One of `ok`, `low`, `out`.
 * @returns {"ok" | "low" | "out"} Normalised tone.
 */
export function resolveStockTone(stockVariant) {
  if (stockVariant === "out") return "out";
  if (stockVariant === "low") return "low";
  return "ok";
}

/**
 * Strip a leading emoji / symbol prefix (for example `🛡️ `) so the card can
 * render its own icon in front of the text.
 *
 * @param {string | undefined} text Raw label.
 * @returns {string} Label without the leading non-alphanumeric prefix.
 */
export function stripLeadingSymbol(text) {
  return String(text || "")
    .replace(/^[^\p{L}\p{N}]+/u, "")
    .trim();
}

/**
 * Build the complete view model consumed by `ProductCard`.
 *
 * @param {object | null | undefined} product Raw product row.
 * @returns {{
 *   skuId: string,
 *   imageSrc: string,
 *   detailHref: string | null,
 *   stockTone: "ok" | "low" | "out",
 *   isOutOfStock: boolean,
 *   canAdd: boolean,
 *   altText: string,
 *   stockText: string,
 *   warrantyText: string,
 * }} View model.
 */
export function buildProductCardModel(product) {
  const skuId = resolveSkuId(product);
  const stockTone = resolveStockTone(product?.stockVariant);
  const isOutOfStock = stockTone === "out";
  const brand = String(product?.brand || "").trim();
  const name = String(product?.name || "").trim();

  return {
    skuId,
    imageSrc: resolveImageSrc(product),
    detailHref: resolveDetailHref(product, skuId),
    stockTone,
    isOutOfStock,
    canAdd: Boolean(skuId) && !isOutOfStock,
    altText: [brand, name].filter(Boolean).join(" ") || "ยางรถยนต์",
    stockText: stripLeadingSymbol(product?.stock),
    warrantyText: stripLeadingSymbol(product?.warranty),
  };
}

/**
 * Split a formatted price such as `฿2,145` into its currency symbol and amount
 * so the symbol can be rendered smaller than the number.
 *
 * @param {string | number | undefined} price Formatted price string.
 * @returns {{ symbol: string, amount: string }} Symbol (may be empty) and amount.
 */
export function splitPrice(price) {
  const text = String(price ?? "").trim();
  const firstDigit = text.search(/[0-9]/);
  if (firstDigit <= 0) {
    return { symbol: "", amount: text };
  }
  return { symbol: text.slice(0, firstDigit).trim(), amount: text.slice(firstDigit).trim() };
}

/**
 * Build the price-group chip shown above the price for logged-in customers.
 * Returns null for guests (no `priceGroup` on the product).
 *
 * @param {{ code?: string, name?: string, isGeneral?: boolean } | null | undefined} priceGroup
 *   Group of the price actually used, as attached by the server query layer.
 * @returns {{ label: string, tone: "general" | "member" | "dealer" } | null} Chip model.
 */
export function resolvePriceGroupChip(priceGroup) {
  if (!priceGroup || typeof priceGroup !== "object") return null;
  const code = String(priceGroup.code || "").trim();
  const name = String(priceGroup.name || code).trim();
  if (!name) return null;
  const tone = priceGroup.isGeneral || code === "general"
    ? "general"
    : code.startsWith("dealer")
      ? "dealer"
      : "member";
  return { label: `ราคา${name}`, tone };
}

/**
 * Build the promotion chip shown next to the price when the customer's price
 * group has an active `promo_price`. Returns null when there is no promotion.
 *
 * @param {{ isPromo?: boolean, discountPercent?: number } | null | undefined} promo
 *   Promotion summary attached by the server query layer.
 * @returns {{ label: string, percent: number } | null} Chip model.
 */
export function resolvePromoChip(promo) {
  if (!promo || typeof promo !== "object" || promo.isPromo !== true) return null;
  const percent = Number(promo.discountPercent);
  const safePercent = Number.isFinite(percent) && percent > 0 ? Math.round(percent) : 0;
  return {
    label: safePercent > 0 ? `โปรโมชั่น -${safePercent}%` : "โปรโมชั่น",
    percent: safePercent,
  };
}

/** Badge variants rendered as a diagonal corner ribbon instead of a pill. */
export const RIBBON_VARIANTS = Object.freeze(["promo", "hot", "new", "sale"]);

/**
 * Decide whether a badge is shown as a corner ribbon and normalise its label
 * (leading emoji removed so the ribbon stays short; signs such as `-10%` are kept).
 *
 * @param {{ label?: string, variant?: string } | null | undefined} badge Badge from `getProductBadges`.
 * @returns {{ label: string, variant: string } | null} Ribbon model or null for pill badges.
 */
export function resolveRibbon(badge) {
  if (!badge || typeof badge !== "object") return null;
  const variant = String(badge.variant || "").trim();
  // Strip only emoji prefixes so labels such as "-10%" keep their sign.
  const label = String(badge.label || "")
    .replace(/^[\p{Extended_Pictographic}\uFE0F\u200D\s]+/u, "")
    .trim();
  if (!label || !RIBBON_VARIANTS.includes(variant)) return null;
  return { label, variant };
}

/**
 * Parse a displayed price (e.g. `฿2,145`, `1,400.50`, or a number) into a number.
 *
 * @param {string | number | null | undefined} price Formatted or numeric price.
 * @returns {number | null} Numeric price, or null when it cannot be parsed.
 */
export function parsePriceValue(price) {
  if (typeof price === "number") return Number.isFinite(price) ? price : null;
  const digits = String(price ?? "").replace(/[^0-9.]/g, "");
  if (!digits) return null;
  const value = Number.parseFloat(digits);
  return Number.isFinite(value) ? value : null;
}

/**
 * Return a new array of products sorted by their displayed price, lowest first.
 * Uses the effective price shown on the card (promo price when on promotion).
 * Products without a parsable price go last; ties keep their original order.
 *
 * @template {{ price?: string | number }} T
 * @param {T[] | null | undefined} products Product card models.
 * @returns {T[]} Sorted copy (input is not mutated).
 */
export function sortProductsByPriceAsc(products) {
  if (!Array.isArray(products)) return [];
  return products
    .map((product, index) => ({ product, index, value: parsePriceValue(product?.price) }))
    .sort((a, b) => {
      if (a.value === null && b.value === null) return a.index - b.index;
      if (a.value === null) return 1;
      if (b.value === null) return -1;
      return a.value - b.value || a.index - b.index;
    })
    .map((entry) => entry.product);
}
