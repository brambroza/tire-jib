"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { formatTHB } from "@/lib/utils/format";

const MIN_QTY = 1;
const MAX_QTY = 99;

/**
 * Inline SVG icons used by the order summary.
 * Kept local so the component has no icon-library dependency.
 */
const Icon = {
  tire: (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="3.5" />
      <path d="M12 3v5.5M12 15.5V21M3 12h5.5M15.5 12H21" />
    </svg>
  ),
  trash: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14M10 10v7M14 10v7" />
    </svg>
  ),
  chevron: (
    <svg className="checkout-chevron" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 9l6 6 6-6" />
    </svg>
  ),
};

/**
 * Order summary card for the checkout page.
 * Shows cart items with touch-friendly quantity controls, a delete
 * confirmation sheet, and the fee breakdown. Collapses to a one-line
 * header once the checkout flow moves past the first step.
 *
 * @param {{ initialCart: { cart: object|null, items: Array, total: number } }} props
 */
export default function CheckoutOrderSummary({ initialCart }) {
  const router = useRouter();
  const cart = initialCart?.cart || null;
  const items = Array.isArray(initialCart?.items) ? initialCart.items : [];
  const total = Number(initialCart?.total || 0);
  // Fees are previewed by CheckoutFlow; both are currently forced to 0 by business rule.
  const [serviceFee, setServiceFee] = useState(0);
  const [shippingFee, setShippingFee] = useState(0);
  const totalAmount = useMemo(
    () => total + serviceFee + shippingFee,
    [total, serviceFee, shippingFee]
  );
  const [busyItemId, setBusyItemId] = useState("");
  const [message, setMessage] = useState("");
  const [open, setOpen] = useState(true);
  const [pendingRemove, setPendingRemove] = useState(null);

  useEffect(() => {
    const handleFeePreview = (event) => {
      const detail = event?.detail || {};
      if (typeof detail.serviceFee === "number") setServiceFee(0);
      if (typeof detail.shippingFee === "number") setShippingFee(0);
    };
    const handleStepChange = (event) => {
      const step = Number(event?.detail?.step || 1);
      setOpen(step === 1);
    };
    window.addEventListener("checkout:fees-preview", handleFeePreview);
    window.addEventListener("checkout:step-change", handleStepChange);
    return () => {
      window.removeEventListener("checkout:fees-preview", handleFeePreview);
      window.removeEventListener("checkout:step-change", handleStepChange);
    };
  }, []);

  /** Re-fetch server data and notify the cart badge after any mutation. */
  const refreshData = () => {
    window.dispatchEvent(new Event("cart:updated"));
    router.refresh();
  };

  /**
   * Update the quantity of a cart line.
   * @param {string} itemId
   * @param {number} nextQty
   */
  const updateQuantity = async (itemId, nextQty) => {
    if (!itemId || nextQty < MIN_QTY || nextQty > MAX_QTY || busyItemId) return;
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

  /**
   * Remove a cart line after the user confirmed in the sheet.
   * @param {string} itemId
   */
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

  const confirmRemove = () => {
    const target = pendingRemove;
    setPendingRemove(null);
    if (target?.id) removeItem(target.id);
  };

  if (!cart || items.length === 0) {
    return <div className="checkout-placeholder">ยังไม่มีสินค้าในตะกร้า</div>;
  }

  return (
    <div className={`checkout-summary-card ${open ? "open" : ""}`}>
      <button
        className="checkout-summary-head"
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
      >
        <b>สรุปคำสั่งซื้อ</b>
        <span className="checkout-summary-meta">
          {items.length} รายการ · {formatTHB(totalAmount)}
        </span>
        {Icon.chevron}
      </button>

      <div className="checkout-summary-body">
        <div className="checkout-items">
          {items.map((item) => {
            const isBusy = busyItemId === item.id;
            return (
              <div key={item.id} className={`checkout-item ${isBusy ? "busy" : ""}`}>
                <div className="checkout-item-top">
                  <div className="checkout-item-thumb">{Icon.tire}</div>
                  <div className="checkout-item-info">
                    <div className="checkout-item-title">ขนาด {item.size}</div>
                    <div className="checkout-item-sub">{item.name}</div>
                    <div className="checkout-item-unit">{formatTHB(item.unitPrice)} / เส้น</div>
                  </div>
                </div>
                <div className="checkout-item-bottom">
                  <div className="checkout-qty" role="group" aria-label={`จำนวน ${item.size}`}>
                    <button
                      className="checkout-qty-btn"
                      type="button"
                      onClick={() => updateQuantity(item.id, item.quantity - 1)}
                      disabled={isBusy || item.quantity <= MIN_QTY}
                      aria-label="ลดจำนวน"
                    >
                      −
                    </button>
                    <output className="checkout-qty-value" aria-live="polite">
                      {item.quantity}
                      <small>เส้น</small>
                    </output>
                    <button
                      className="checkout-qty-btn"
                      type="button"
                      onClick={() => updateQuantity(item.id, item.quantity + 1)}
                      disabled={isBusy || item.quantity >= MAX_QTY}
                      aria-label="เพิ่มจำนวน"
                    >
                      +
                    </button>
                  </div>
                  <div className="checkout-item-right">
                    <span className="checkout-item-price">{formatTHB(item.lineTotal)}</span>
                    <button
                      className="checkout-remove-btn"
                      type="button"
                      onClick={() => setPendingRemove(item)}
                      disabled={isBusy}
                      aria-label={`ลบ ${item.size} ออกจากตะกร้า`}
                    >
                      {Icon.trash}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="checkout-totals">
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
        </div>
        {message && <div className="checkout-status">{message}</div>}
      </div>

      {pendingRemove && (
        <div
          className="checkout-sheet-mask"
          onClick={(event) => {
            if (event.target === event.currentTarget) setPendingRemove(null);
          }}
        >
          <div className="checkout-sheet" role="dialog" aria-modal="true" aria-labelledby="checkout-remove-title">
            <div className="checkout-sheet-grab" />
            <h3 id="checkout-remove-title">ลบสินค้านี้ออกจากตะกร้า?</h3>
            <p>
              ขนาด {pendingRemove.size} · {pendingRemove.name} · {pendingRemove.quantity} เส้น
            </p>
            <button className="checkout-sheet-danger" type="button" onClick={confirmRemove}>
              ลบออกจากตะกร้า
            </button>
            <button className="checkout-btn-soft" type="button" onClick={() => setPendingRemove(null)}>
              เก็บไว้ก่อน
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
