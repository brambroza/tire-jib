"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ProductDetailAddToCartButton({
  skuId,
  disabled = false,
  maxQuantity = 99,
}) {
  const quantityLimit = Math.max(1, Math.min(Number(maxQuantity) || 1, 99));
  const [quantity, setQuantity] = useState(1);
  const [adding, setAdding] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const router = useRouter();

  const handleCheckout = async () => {
    if (!skuId || adding || disabled) return;
    setAdding(true);
    setErrorMessage("");

    try {
      const response = await fetch("/api/cart/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sku_id: skuId, quantity }),
      });

      if (response.status === 401) {
        router.push("/auth");
        return;
      }

      if (response.ok) {
        window.dispatchEvent(new Event("cart:updated"));
        router.push("/checkout");
        return;
      }

      const payload = await response.json().catch(() => ({}));
      const messages = {
        insufficient_stock: "สินค้าในสต็อกไม่เพียงพอตามจำนวนที่เลือก",
        quantity_limit_exceeded: "จำนวนรวมในตะกร้าต้องไม่เกิน 99 เส้น",
        out_of_stock: "สินค้าหมดชั่วคราว",
      };
      setErrorMessage(messages[payload?.error] || "ไม่สามารถเพิ่มสินค้าได้ กรุณาลองอีกครั้ง");
    } catch {
      setErrorMessage("เกิดข้อผิดพลาดในการเชื่อมต่อ กรุณาลองอีกครั้ง");
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="product-detail-order">
      <div className="product-detail-quantity-row">
        <span className="product-detail-quantity-label">จำนวน</span>
        <div className="product-detail-stepper" aria-label="เลือกจำนวนยาง">
          <button
            type="button"
            aria-label="ลดจำนวน"
            onClick={() => setQuantity((current) => Math.max(1, current - 1))}
            disabled={disabled || adding || quantity <= 1}
          >
            −
          </button>
          <output aria-live="polite">{quantity}</output>
          <button
            type="button"
            aria-label="เพิ่มจำนวน"
            onClick={() => setQuantity((current) => Math.min(quantityLimit, current + 1))}
            disabled={disabled || adding || quantity >= quantityLimit}
          >
            +
          </button>
        </div>
        <span className="product-detail-quantity-unit">เส้น</span>
      </div>

      {errorMessage ? <div className="product-detail-order-error">{errorMessage}</div> : null}

      <div className="product-detail-order-actions">
        <button
          className={`product-detail-cta ${adding ? "is-loading" : ""}`}
          type="button"
          onClick={handleCheckout}
          disabled={disabled || adding}
        >
          {adding ? (
            <span className="product-detail-cta-spinner" aria-hidden="true" />
          ) : (
            "ชำระเงิน"
          )}
        </button>
        <button
          className="product-detail-back"
          type="button"
          onClick={() => router.back()}
          disabled={adding}
        >
          ย้อนกลับ
        </button>
      </div>
    </div>
  );
}
