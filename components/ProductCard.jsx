"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@iconify/react";
import { buildProductCardModel, resolvePriceGroupChip, splitPrice } from "@/lib/product/card-model.mjs";
import { playAddToCartFeedback, useProductCardMotion } from "@/lib/motion/useProductCardMotion";

/** How long the "added" check state stays visible on the buy button. */
const ADDED_FEEDBACK_MS = 900;

/**
 * Dispatch a snackbar event consumed by `CartSnackbar`.
 *
 * @param {{ tone?: "error" | "success", title?: string, message: string }} detail Snackbar payload.
 * @returns {void}
 */
function showSnackbar(detail) {
  window.dispatchEvent(new CustomEvent("cart:snackbar", { detail }));
}

/**
 * Minimal product card with GSAP motion (scroll reveal, hover tilt, add-to-cart feedback).
 *
 * @param {{ product: object, index?: number }} props Product row and its grid index (used for stagger).
 * @returns {JSX.Element}
 */
export default function ProductCard({ product, index = 0 }) {
  const [added, setAdded] = useState(false);
  const [adding, setAdding] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const timerRef = useRef(null);
  const cardRef = useRef(null);
  const mediaRef = useRef(null);
  const bounceRef = useRef(null);
  const buttonRef = useRef(null);
  const chipRef = useRef(null);
  const router = useRouter();

  const model = buildProductCardModel(product);
  const { skuId, imageSrc, detailHref, stockTone, isOutOfStock, canAdd, altText, stockText, warrantyText } = model;

  useProductCardMotion({ cardRef, mediaRef, index });

  useEffect(() => {
    setHydrated(true);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  /**
   * Add one unit of this SKU to the cart with optimistic feedback.
   *
   * @returns {Promise<void>}
   */
  const handleAdd = async () => {
    if (adding) return;

    if (!skuId) {
      showSnackbar({ tone: "error", title: "เพิ่มไม่สำเร็จ", message: "รายการนี้ยังไม่พร้อมสั่งซื้อ" });
      return;
    }
    if (isOutOfStock) {
      showSnackbar({ tone: "error", title: "เพิ่มไม่สำเร็จ", message: "สินค้าหมดชั่วคราว" });
      return;
    }

    setAdding(true);
    setAdded(true);
    playAddToCartFeedback({ button: buttonRef.current, bounce: bounceRef.current, chip: chipRef.current });
    window.dispatchEvent(new Event("cart:updated"));
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setAdded(false), ADDED_FEEDBACK_MS);

    try {
      const response = await fetch("/api/cart/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sku_id: skuId, quantity: 1 }),
      });

      if (response.status === 401) {
        setAdded(false);
        window.dispatchEvent(new Event("cart:updated"));
        router.push("/auth");
        return;
      }

      if (response.ok) {
        showSnackbar({ message: "เพิ่มสินค้าแล้ว" });
      } else {
        setAdded(false);
        window.dispatchEvent(new Event("cart:updated"));
      }
    } catch {
      setAdded(false);
      window.dispatchEvent(new Event("cart:updated"));
      showSnackbar({ tone: "error", title: "เพิ่มไม่สำเร็จ", message: "เชื่อมต่อไม่ได้ ลองใหม่อีกครั้ง" });
    } finally {
      setAdding(false);
    }
  };

  const showImage = hydrated && imageSrc && !imgError;
  const price = splitPrice(product?.price);
  const priceGroupChip = resolvePriceGroupChip(product?.priceGroup);
  const buttonLabel = isOutOfStock ? "สินค้าหมด" : added ? "เพิ่มแล้ว" : "เพิ่มลงตะกร้า";

  return (
    <article
      ref={cardRef}
      className={["product-card", isOutOfStock ? "is-out" : null].filter(Boolean).join(" ")}
      data-tone={stockTone}
    >
      {detailHref && (
        <a className="product-link-overlay" href={detailHref} aria-label={`ดูรายละเอียด ${altText}`} />
      )}

      <div className="product-media">
        <div className="product-media-parallax" ref={mediaRef}>
          <div className="product-media-inner" ref={bounceRef}>
            {showImage ? (
              <img
                src={imageSrc}
                alt={altText}
                className="product-media-img"
                loading="lazy"
                decoding="async"
                onError={() => setImgError(true)}
              />
            ) : (
              <svg className="product-media-placeholder" viewBox="0 0 90 90" aria-hidden="true">
                <circle cx="45" cy="45" r="42" fill="#2a2a2a" />
                <circle cx="45" cy="45" r="28" fill="#3a3a3a" />
                <circle cx="45" cy="45" r="16" fill="#222" />
                <circle cx="45" cy="45" r="8" fill="#6abf2e" />
              </svg>
            )}
          </div>
        </div>

        {product?.badge?.label && (
          <span className={["product-badge", `badge-${product.badge.variant}`].join(" ")}>
            {product.badge.label}
          </span>
        )}

        <span className="product-warranty-pill">
          <Icon icon="solar:shield-check-bold" aria-hidden="true" />
          365 วัน
        </span>
      </div>

      <div className="product-body">
        <div className="product-brand">{product?.brand}</div>
        <h3 className="product-title">{product?.size}</h3>
        <div className="product-sub">{product?.name}</div>

        {stockText && (
          <div className="product-stock" data-tone={stockTone}>
            <span className="product-stock-dot" aria-hidden="true" />
            {stockText}
          </div>
        )}

        <div className="product-footer">
          <div className="product-price-wrap">
            {priceGroupChip && (
              <span className="product-price-group" data-tone={priceGroupChip.tone}>
                <Icon
                  icon={priceGroupChip.tone === "dealer" ? "solar:crown-bold" : "solar:user-id-bold"}
                  aria-hidden="true"
                />
                {priceGroupChip.label}
              </span>
            )}
            {product?.oldPrice && <s className="product-price-old">{product.oldPrice}</s>}
            <div className="product-price">
              {price.symbol && <span className="product-currency">{price.symbol}</span>}
              {price.amount}
              <span className="product-unit">/เส้น</span>
            </div>
          </div>

          <button
            ref={buttonRef}
            className={["btn-add", added ? "is-added" : null].filter(Boolean).join(" ")}
            type="button"
            onClick={handleAdd}
            disabled={adding || !canAdd}
            aria-label={buttonLabel}
            title={buttonLabel}
          >
            <span className="btn-add-chip" ref={chipRef} aria-hidden="true">
              +1
            </span>
            {adding ? (
              <span className="btn-add-spinner" aria-hidden="true" />
            ) : added ? (
              <Icon icon="solar:check-circle-bold" aria-hidden="true" />
            ) : isOutOfStock ? (
              <span>หมด</span>
            ) : (
              <>
                <Icon icon="solar:cart-plus-bold" aria-hidden="true" />
                <span>ซื้อ</span>
              </>
            )}
          </button>
        </div>

        {warrantyText && (
          <div className="product-warranty">
            <Icon icon="solar:shield-check-linear" aria-hidden="true" />
            {warrantyText}
          </div>
        )}
      </div>
    </article>
  );
}
