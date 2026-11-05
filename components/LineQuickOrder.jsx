"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { startLineLogin } from "@/lib/auth/line-login";
import {
  QUICK_ORDER_DESTINATION,
  cartHasSku,
  parseQuickOrderParams,
  quickOrderErrorMessage,
  rememberNonce,
} from "@/lib/line/quick-order.mjs";

const DONE_KEY = "line_quick_order_done";

function readDoneList() {
  try {
    return JSON.parse(localStorage.getItem(DONE_KEY) || "[]");
  } catch {
    return [];
  }
}

function writeDoneList(list) {
  try {
    localStorage.setItem(DONE_KEY, JSON.stringify(list));
  } catch {
    // storage unavailable (private mode) — duplicate guard is best-effort only
  }
}

/**
 * True when this card was already ordered in this browser AND the SKU is
 * still in the active cart. If the cart was emptied (order placed, item
 * removed, different account) the item must be added again.
 * @param {{ skuId: string, nonce: string | null }} parsed
 */
async function isAlreadyInCart(parsed) {
  if (!parsed.nonce || !readDoneList().includes(parsed.nonce)) return false;
  try {
    const response = await fetch("/api/cart/details", { cache: "no-store" });
    if (!response.ok) return false;
    return cartHasSku(await response.json(), parsed.skuId);
  } catch {
    return false;
  }
}

/**
 * Handles /line/order: add SKU to cart, then replace the page with /checkout
 * so Back does not re-add the item. When the visitor is not logged in, they
 * choose between ordering as a guest (name/phone/address at checkout) or
 * logging in with LINE.
 */
export default function LineQuickOrder() {
  const searchParams = useSearchParams();
  const startedRef = useRef(false);
  const [state, setState] = useState({ phase: "working", message: "กำลังเพิ่มสินค้าลงตะกร้า..." });
  const [order, setOrder] = useState(null);

  const goToCheckout = () => window.location.replace(QUICK_ORDER_DESTINATION);

  /** @param {{ skuId: string, quantity: number, nonce: string | null }} parsed */
  const addToCart = async (parsed) => {
    setState({ phase: "working", message: "กำลังเพิ่มสินค้าลงตะกร้า..." });
    try {
      const response = await fetch("/api/cart/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sku_id: parsed.skuId, quantity: parsed.quantity }),
      });

      if (response.status === 401) {
        setState({ phase: "choose", message: "เลือกวิธีสั่งซื้อ" });
        return;
      }

      if (response.ok) {
        if (parsed.nonce) writeDoneList(rememberNonce(readDoneList(), parsed.nonce));
        window.dispatchEvent(new Event("cart:updated"));
        setState({ phase: "working", message: "เพิ่มลงตะกร้าแล้ว กำลังไปหน้าชำระเงิน..." });
        goToCheckout();
        return;
      }

      const payload = await response.json().catch(() => ({}));
      setState({ phase: "error", message: quickOrderErrorMessage(payload?.error) });
    } catch {
      setState({ phase: "error", message: "เกิดข้อผิดพลาดในการเชื่อมต่อ กรุณาลองอีกครั้ง" });
    }
  };

  const orderAsGuest = async () => {
    if (!order) return;
    setState({ phase: "working", message: "กำลังเตรียมการสั่งซื้อ..." });
    try {
      const response = await fetch("/api/auth/guest", { method: "POST" });
      if (!response.ok) throw new Error("guest_failed");
      await addToCart(order);
    } catch {
      setState({ phase: "choose", message: "เริ่มการสั่งซื้อไม่สำเร็จ กรุณาลองอีกครั้ง" });
    }
  };

  const loginWithLine = async () => {
    if (!order) return;
    setState({ phase: "working", message: "กำลังเข้าสู่ระบบด้วย LINE..." });
    try {
      await startLineLogin({ returnTo: `${window.location.pathname}${window.location.search}` });
    } catch (error) {
      setState({ phase: "error", message: error?.message || "ไม่สามารถเชื่อมต่อ LINE ได้" });
    }
  };

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    const parsed = parseQuickOrderParams(searchParams);
    setOrder(parsed);
    if (!parsed) {
      setState({ phase: "error", message: "ลิงก์สั่งซื้อไม่ถูกต้อง กรุณากดปุ่มจากแชท LINE อีกครั้ง" });
      return;
    }

    (async () => {
      // Same card tapped again and the item is still in the cart: don't add twice.
      if (await isAlreadyInCart(parsed)) {
        goToCheckout();
        return;
      }
      await addToCart(parsed);
    })();
    // Run once per page load; searchParams is stable for this landing page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="auth-card auth-card-clean">
      <div className="auth-header auth-header-line auth-header-clean">
        <div className="auth-title">สั่งซื้อจาก LINE</div>
        {order ? <div className="auth-subtitle">จำนวน {order.quantity} เส้น</div> : null}
      </div>
      <div className="auth-body">
        <div className={`auth-status ${state.phase === "error" ? "error" : "info"}`} role="status">
          {state.message}
        </div>

        {state.phase === "choose" && order ? (
          <>
            <button className="auth-line auth-line-big auth-guest" type="button" onClick={orderAsGuest}>
              สั่งซื้อเลย ไม่ต้องสมัครสมาชิก
            </button>
            <div className="auth-helper">กรอกชื่อ ที่อยู่ และเบอร์โทรในขั้นตอนถัดไป</div>
            <div className="auth-divider-text">หรือ</div>
            <button
              className="auth-line auth-line-big auth-line-clean"
              type="button"
              onClick={loginWithLine}
            >
              เข้าสู่ระบบด้วย LINE
            </button>
            <div className="auth-helper">รับแจ้งสถานะคำสั่งซื้อและช่องทางชำระเงินทาง LINE</div>
          </>
        ) : null}

        {state.phase === "error" ? (
          <div className="auth-trust-list">
            {order ? (
              <a className="cart-link" href={`/products/${order.skuId}`}>
                ดูหน้าสินค้า
              </a>
            ) : null}
            <a className="cart-link" href={QUICK_ORDER_DESTINATION}>
              ไปหน้าชำระเงิน
            </a>
          </div>
        ) : null}
      </div>
    </div>
  );
}
