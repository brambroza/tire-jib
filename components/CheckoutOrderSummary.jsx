"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { formatTHB } from "@/lib/utils/format";

export default function CheckoutOrderSummary({ initialCart }) {
  const router = useRouter();
  const cart = initialCart?.cart || null;
  const items = Array.isArray(initialCart?.items) ? initialCart.items : [];
  const total = Number(initialCart?.total || 0);
  const fulfillmentType = cart?.fulfillment_type || "delivery";
  const initialServiceFee = 0;
  /*   typeof cart?.service_fee === "number"
      ?  cart.service_fee
      : fulfillmentType === "install"
        ? 0
        : 0; */
  const initialShippingFee = 0; // fulfillmentType === "delivery" ? Number(cart?.shipping_fee || 0) : 0;
  const [serviceFee, setServiceFee] = useState(initialServiceFee);
  const [shippingFee, setShippingFee] = useState(initialShippingFee);
  const totalAmount = useMemo(() => total + serviceFee + shippingFee, [total, serviceFee, shippingFee]);
  const [busyItemId, setBusyItemId] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    setServiceFee(initialServiceFee);
    setShippingFee(initialShippingFee);
  }, [initialServiceFee, initialShippingFee]);

  useEffect(() => {
    const handleFeePreview = (event) => {
      const detail = event?.detail || {};
      if (typeof detail.serviceFee === "number") {
        setServiceFee(0);
      }
      if (typeof detail.shippingFee === "number") {
        setShippingFee(0);
      }
    };
    window.addEventListener("checkout:fees-preview", handleFeePreview);
    return () => window.removeEventListener("checkout:fees-preview", handleFeePreview);
  }, []);

  const refreshData = () => {
    window.dispatchEvent(new Event("cart:updated"));
    router.refresh();
  };

  const updateQuantity = async (itemId, nextQty) => {
    if (!itemId || nextQty < 1 || nextQty > 99 || busyItemId) return;
    setBusyItemId(itemId);
    setMessage("");
    try {
      const res = await fetch("/api/cart/item", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ item_id: itemId, quantity: nextQty }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(payload?.detail || payload?.error || "update_failed");
      }
      refreshData();
    } catch (error) {
      setMessage(error?.message || "อัปเดตจำนวนไม่สำเร็จ");
    } finally {
      setBusyItemId("");
    }
  };

  const removeItem = async (itemId) => {
    if (!itemId || busyItemId) return;
    setBusyItemId(itemId);
    setMessage("");
    try {
      const res = await fetch("/api/cart/item", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ item_id: itemId }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(payload?.detail || payload?.error || "delete_failed");
      }
      refreshData();
    } catch (error) {
      setMessage(error?.message || "ลบสินค้าไม่สำเร็จ");
    } finally {
      setBusyItemId("");
    }
  };

  if (!cart || items.length === 0) {
    return <div className="checkout-placeholder">ยังไม่มีสินค้าในตะกร้า</div>;
  }

  return (
    <div className="checkout-summary">
      <div className="checkout-order-table">
        <div className="checkout-order-head">
          <div>สินค้าในตะกร้า</div>
          <div>จำนวน</div>
          <div>ราคา</div>
          <div>รวม</div>
        </div>
        {items.map((item) => {
          const isBusy = busyItemId === item.id;
          return (
            <div key={item.id} className="checkout-order-row">
              <div className="checkout-order-product">
                <div className="checkout-item-title">ขนาด {item.size}</div>
                <div className="checkout-item-sub">{item.name}</div>
              </div>
              <div className="checkout-item-actions checkout-item-qty-cell">
                <button
                  className="checkout-qty-btn"
                  type="button"
                  onClick={() => updateQuantity(item.id, item.quantity - 1)}
                  disabled={isBusy || item.quantity <= 1}
                  aria-label="ลดจำนวน"
                >
                  −
                </button>
                <div className="checkout-item-qty">{item.quantity} เส้น </div>
                <button
                  className="checkout-qty-btn"
                  type="button"
                  onClick={() => updateQuantity(item.id, item.quantity + 1)}
                  disabled={isBusy || item.quantity >= 99}
                  aria-label="เพิ่มจำนวน"
                >
                  +
                </button>
                <button
                  className="checkout-remove-btn"
                  type="button"
                  onClick={() => removeItem(item.id)}
                  disabled={isBusy}
                >
                  ลบ
                </button>
              </div>
              <div className="checkout-item-price">{formatTHB(item.unitPrice)}</div>
              <div className="checkout-item-price">{formatTHB(item.lineTotal)}</div>
            </div>
          );
        })}
      </div>

      <div className="checkout-summary-row">
        <span>รวมสินค้า</span>
        <strong>{formatTHB(total)}</strong>
      </div>
      <div className="checkout-summary-row">
        <span>ค่าบริการติดตั้ง</span>
        <strong>{formatTHB(serviceFee)}</strong>
      </div>
      <div className="checkout-summary-row">
        <span>ค่าบริการนอกเขตพื้นที่</span>
        <strong>{formatTHB(shippingFee)}</strong>
      </div>
      <div className="checkout-summary-total">
        <span>ยอดรวมสุทธิ</span>
        <strong>{formatTHB(totalAmount)}</strong>
      </div>
      {message && <div className="checkout-status">{message}</div>}
    </div>
  );
}
