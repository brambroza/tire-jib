"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { startLineLogin } from "@/lib/auth/line-login";
import {
  QUICK_ORDER_DESTINATION,
  parseQuickOrderParams,
  quickOrderErrorMessage,
  rememberNonce,
} from "@/lib/line/quick-order.mjs";

const DONE_KEY = "line_quick_order_done";
const LOGIN_TRIED_PREFIX = "line_quick_order_login:";

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
 * Handles /line/order: add SKU to cart, log in with LINE first when needed,
 * then replace the page with /checkout so Back does not re-add the item.
 */
export default function LineQuickOrder() {
  const searchParams = useSearchParams();
  const startedRef = useRef(false);
  const [state, setState] = useState({ phase: "working", message: "กำลังเพิ่มสินค้าลงตะกร้า..." });
  const [order, setOrder] = useState(null);

  const goToCheckout = () => window.location.replace(QUICK_ORDER_DESTINATION);

  const login = async (parsed) => {
    setState({ phase: "working", message: "กำลังเข้าสู่ระบบด้วย LINE..." });
    try {
      sessionStorage.setItem(LOGIN_TRIED_PREFIX + (parsed.nonce || parsed.skuId), "1");
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

    // Same LINE card tapped again (or page restored): item is already in the cart.
    if (parsed.nonce && readDoneList().includes(parsed.nonce)) {
      goToCheckout();
      return;
    }

    (async () => {
      try {
        const response = await fetch("/api/cart/add", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sku_id: parsed.skuId, quantity: parsed.quantity }),
        });

        const loginKey = LOGIN_TRIED_PREFIX + (parsed.nonce || parsed.skuId);
        if (response.status === 401) {
          // Auto-start login once; if we are back here still logged out, ask instead of looping.
          if (sessionStorage.getItem(loginKey)) {
            setState({ phase: "login", message: "กรุณาเข้าสู่ระบบด้วย LINE เพื่อเพิ่มสินค้าลงตะกร้า" });
            return;
          }
          await login(parsed);
          return;
        }

        if (response.ok) {
          sessionStorage.removeItem(loginKey);
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
    })();
    // Run once per page load; searchParams is stable for this landing page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="auth-card auth-card-clean">
      <div className="auth-header auth-header-line auth-header-clean">
        <div className="auth-title">สั่งซื้อจาก LINE</div>
        {order ? (
          <div className="auth-subtitle">จำนวน {order.quantity} เส้น</div>
        ) : null}
      </div>
      <div className="auth-body">
        <div className={`auth-status ${state.phase === "error" ? "error" : "info"}`} role="status">
          {state.message}
        </div>

        {state.phase === "login" && order ? (
          <button
            className="auth-line auth-line-big auth-line-clean"
            type="button"
            onClick={() => login(order)}
          >
            เข้าสู่ระบบด้วย LINE
          </button>
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
