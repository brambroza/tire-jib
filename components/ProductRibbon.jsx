import { resolveRibbon } from "@/lib/product/card-model.mjs";

/**
 * Inline SVG paths per ribbon variant (24x24 viewBox). Plain SVG keeps this
 * component usable from server components, unlike `@iconify/react`.
 */
const RIBBON_ICON_PATHS = {
  promo:
    "M3 11.2V5a2 2 0 0 1 2-2h6.2a2 2 0 0 1 1.4.6l8.2 8.2a2 2 0 0 1 0 2.8l-6.2 6.2a2 2 0 0 1-2.8 0L3.6 12.6a2 2 0 0 1-.6-1.4ZM7.5 9a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z",
  hot:
    "M12 2c.6 2.8 2.1 4.6 4.1 6.6C17.9 10.4 19 12.3 19 14.5A7 7 0 0 1 5 14.5c0-2.4 1.1-4.1 2.4-5.4.3 1.3 1 2.3 2.1 2.9-.3-2.9.6-5.8 2.5-10Zm0 18a3 3 0 0 0 3-3c0-1.6-1.2-2.5-2.1-3.4-.5 1-1.1 1.6-1.9 2-.3-.6-.5-1.1-.5-1.7A3.3 3.3 0 0 0 9 17a3 3 0 0 0 3 3Z",
  new:
    "M12 2.5l1.9 5.1 5.1 1.9-5.1 1.9L12 16.5l-1.9-5.1L5 9.5l5.1-1.9L12 2.5Zm6.5 11l.9 2.6 2.6.9-2.6.9-.9 2.6-.9-2.6-2.6-.9 2.6-.9.9-2.6ZM5 15l.8 2.2L8 18l-2.2.8L5 21l-.8-2.2L2 18l2.2-.8L5 15Z",
  sale:
    "M18.3 4.3a1 1 0 0 1 1.4 1.4l-14 14a1 1 0 0 1-1.4-1.4l14-14ZM7.5 4a3.5 3.5 0 1 1 0 7 3.5 3.5 0 0 1 0-7Zm0 2a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Zm9 7a3.5 3.5 0 1 1 0 7 3.5 3.5 0 0 1 0-7Zm0 2a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Z",
};

/**
 * Diagonal corner ribbon (left-middle to top-centre) for product badges such
 * as promotion, best seller, hot deal and new arrival. Each variant gets its
 * own icon, gradient and a CSS shimmer sweep (disabled under reduced motion).
 * Renders nothing when the badge is not a ribbon variant. Safe in both server
 * and client components.
 *
 * @param {{ badge: { label?: string, variant?: string } | null | undefined, size?: "sm" | "lg" }} props
 *   Badge from `getProductBadges` and the ribbon size (`lg` for the detail page).
 * @returns {JSX.Element | null}
 */
export default function ProductRibbon({ badge, size = "sm" }) {
  const ribbon = resolveRibbon(badge);
  if (!ribbon) return null;

  const iconPath = RIBBON_ICON_PATHS[ribbon.variant] || RIBBON_ICON_PATHS.promo;

  return (
    <span
      className={["product-ribbon", size === "lg" ? "product-ribbon-lg" : null].filter(Boolean).join(" ")}
      data-variant={ribbon.variant}
      aria-label={ribbon.label}
    >
      <span className="product-ribbon-text">
        <span className="product-ribbon-shine" aria-hidden="true" />
        <svg className="product-ribbon-icon" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
          <path d={iconPath} />
        </svg>
        <span className="product-ribbon-label">{ribbon.label}</span>
      </span>
    </span>
  );
}
