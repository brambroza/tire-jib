"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

export default function ProductCard({ product }) {
  const [added, setAdded] = useState(false);
  const timerRef = useRef(null);
  const [imgError, setImgError] = useState(false);
  const [adding, setAdding] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const router = useRouter();
  const rawSkuId = product?.id ?? product?.sku_id ?? product?.skuId ?? "";
  const skuId = String(rawSkuId).trim();
  const imageCandidates = [
    ...(Array.isArray(product?.imageFiles) ? product.imageFiles : []),
    product?.imageFile,
    product?.imageUrl,
  ];
  const imageSrc =
    imageCandidates
      .map((url) => String(url || "").trim())
      .find(Boolean) || "";




  useEffect(() => {
    setHydrated(true);
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  const handleAdd = async () => {
    if (adding) return;
  if (!skuId) {
    window.dispatchEvent(
      new CustomEvent("cart:snackbar", {
        detail: {
          tone: "error",
          title: "เพิ่มไม่สำเร็จ",
          message: "เพิ่มสินค้าไม่ได้: รายการนี้ยังไม่พร้อมสั่งซื้อ",
        },
      })
    );
    return;
  }

  if (product.stockVariant ==='out') {
    window.dispatchEvent(
      new CustomEvent("cart:snackbar", {
        detail: {
          tone: "error",
          title: "เพิ่มไม่สำเร็จ",
          message: "เพิ่มสินค้าไม่ได้: สินค้าหมดชั่วคราว",
        },
      })
    );
    return;
  }




    setAdding(true);
    // Optimistic UI: show immediate feedback and badge update without waiting network roundtrip.
    setAdded(true);
    window.dispatchEvent(new Event("cart:updated"));
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    timerRef.current = setTimeout(() => setAdded(false), 800);

    try {
      const response = await fetch("/api/cart/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sku_id: skuId, quantity: 1 }),
      });

      if (response.status === 401) {
        router.push("/auth");
        setAdded(false);
        window.dispatchEvent(new Event("cart:updated"));
        return;
      }

      if (response.ok) {
        window.dispatchEvent(
          new CustomEvent("cart:snackbar", { detail: { message: "เพิ่มสินค้าแล้ว" } })
        );
      } else {
        setAdded(false);
        window.dispatchEvent(new Event("cart:updated"));
      }
    } finally {
      setAdding(false);
    }
  };

  const fallbackHref =
    typeof product?.href === "string" && product.href.trim()
      ? product.href.trim()
      : null;
  const detailHref = skuId ? `/products/${encodeURIComponent(skuId)}` : fallbackHref;

  return (
    <div className="product-card">
      {detailHref && (
        <a className="product-link-overlay" href={detailHref} aria-label="ดูรายละเอียดสินค้า" />
      )}
      <div className="product-img">
        {hydrated && imageSrc && !imgError ? (
          <img
            src={imageSrc}
            alt={`${product.brand} ${product.name}`}
            className="product-img-real"
            onError={() => setImgError(true)}
          />
        ) : (
          <svg className="tire-svg" viewBox="0 0 90 90">
            <circle cx="45" cy="45" r="42" fill="#2a2a2a" stroke="#1a1a1a" strokeWidth="1" />
            <circle cx="45" cy="45" r="28" fill="#3a3a3a" />
            <circle cx="45" cy="45" r="16" fill="#222" />
            <circle cx="45" cy="45" r="8" fill="#6abf2e" />
            <rect x="43" y="3" width="4" height="8" rx="2" fill="#555" />
            <rect x="43" y="79" width="4" height="8" rx="2" fill="#555" />
            <rect x="3" y="43" width="8" height="4" rx="2" fill="#555" />
            <rect x="79" y="43" width="8" height="4" rx="2" fill="#555" />
          </svg>
        )}
        {product.badge && (
          <span className={["product-badge", `badge-${product.badge.variant}`].join(" ")}>
            {product.badge.label}
          </span>
        )}
        <span className="badge-365">365 วัน</span>
      </div>
      <div className="product-body">
        <div className="product-name">{product.size}</div>
        <div className="product-brand">{product.brand}</div>
        <div className="product-size">{product.name}</div>
        <div className="product-footer">
          <div className="product-price-wrap">
            {product.oldPrice && <div className="product-price-old">{product.oldPrice}</div>}
            <div className="product-price">
              {product.price}
              <span className="product-unit">/เส้น</span>
            </div>
            <div
              className={[
                "product-stock",
                product.stockVariant === "low" || product.stockVariant === "out"
                  ? "stock-out"
                  : "stock-ok",
              ].join(" ")}
            >
              {product.stock}
            </div>
          </div>
          <button
            className={["btn-add", added ? "added" : null].filter(Boolean).join(" ")}
            type="button"
            onClick={handleAdd}
            disabled={adding}
            
          >
            {adding ? <span className="btn-add-spinner" aria-hidden="true" /> : added ? "✓" : "ซื้อ"}
          </button>
        </div>
        {detailHref && (
          <a className="product-detail-link" href={detailHref}>
            ดูรายละเอียดสินค้า
          </a>
        )}
        <div className="warranty-strip">{product.warranty}</div>
      </div>
    </div>
  );
}
