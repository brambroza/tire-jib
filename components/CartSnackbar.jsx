"use client";

import { useEffect, useRef, useState } from "react";

const DEFAULT_MESSAGE = "เพิ่มสินค้าแล้ว";
const DEFAULT_TITLE = "สำเร็จ";
const AUTO_CLOSE_MS = 2200;

export default function CartSnackbar() {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState(DEFAULT_MESSAGE);
  const [title, setTitle] = useState(DEFAULT_TITLE);
  const [tone, setTone] = useState("success");
  const [toastKey, setToastKey] = useState(0);
  const timerRef = useRef(null);

  useEffect(() => {
    const onShow = (event) => {
      const nextMessage =
        typeof event?.detail?.message === "string" && event.detail.message.trim()
          ? event.detail.message.trim()
          : DEFAULT_MESSAGE;
      const nextTone = event?.detail?.tone === "error" ? "error" : "success";
      const nextTitle =
        typeof event?.detail?.title === "string" && event.detail.title.trim()
          ? event.detail.title.trim()
          : nextTone === "error"
            ? "ไม่สำเร็จ"
            : DEFAULT_TITLE;
      setMessage(nextMessage);
      setTone(nextTone);
      setTitle(nextTitle);
      setToastKey((prev) => prev + 1);
      setOpen(true);
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      timerRef.current = setTimeout(() => {
        setOpen(false);
      }, AUTO_CLOSE_MS);
    };

    window.addEventListener("cart:snackbar", onShow);
    return () => {
      window.removeEventListener("cart:snackbar", onShow);
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  return (
    <div className={`cart-snackbar ${open ? "show" : ""} ${tone}`} role="status" aria-live="polite">
      <div className="cart-snackbar-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24">
          {tone === "error" ? <path d="M12 7v6m0 4h.01M12 2a10 10 0 100 20 10 10 0 000-20z" /> : <path d="M20 7L9 18l-5-5" />}
        </svg>
      </div>
      <div className="cart-snackbar-content">
        <div className="cart-snackbar-title">{title}</div>
        <div className="cart-snackbar-message">{message}</div>
      </div>
      <button
        className="cart-snackbar-close"
        type="button"
        aria-label="ปิดการแจ้งเตือน"
        onClick={() => setOpen(false)}
      >
        <svg viewBox="0 0 24 24">
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>
      <div key={toastKey} className="cart-snackbar-progress" aria-hidden="true" />
    </div>
  );
}
