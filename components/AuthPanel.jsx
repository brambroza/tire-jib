"use client";

import { useState } from "react";
import { startLineLogin } from "@/lib/auth/line-login";
import { sanitizeReturnTo } from "@/lib/line/quick-order.mjs";

export default function AuthPanel() {
  const [status, setStatus] = useState("");
  const [statusTone, setStatusTone] = useState("info");
  const [loading, setLoading] = useState(false);

  const handleLineAuth = async () => {
    setLoading(true);
    setStatus("กำลังพาไปที่ LINE...");
    setStatusTone("info");
    try {
      // /auth?next=/some/path → come back there after login (validated in startLineLogin).
      const returnTo = new URLSearchParams(window.location.search).get("next");
      await startLineLogin({ returnTo });
    } catch (error) {
      const message = error?.message || "";
      setStatus(message || "ไม่สามารถเชื่อมต่อ LINE ได้");
      setStatusTone("error");
    } finally {
      setLoading(false);
    }
  };

  /** Order without an account: start a guest session, then go back to ?next (or the cart). */
  const handleGuest = async () => {
    setLoading(true);
    setStatus("กำลังเตรียมการสั่งซื้อ...");
    setStatusTone("info");
    try {
      const response = await fetch("/api/auth/guest", { method: "POST" });
      if (!response.ok) throw new Error("guest_failed");
      const next = sanitizeReturnTo(new URLSearchParams(window.location.search).get("next"));
      window.location.replace(next || "/checkout");
    } catch {
      setStatus("เริ่มการสั่งซื้อไม่สำเร็จ กรุณาลองอีกครั้ง");
      setStatusTone("error");
      setLoading(false);
    }
  };

  return (
    <div className="auth-card auth-card-clean">
      <div className="auth-header auth-header-line auth-header-clean">
        <div className="auth-badge">Secure Login</div>
        <div className="auth-title">เข้าสู่ระบบด้วย LINE</div>
        <div className="auth-subtitle">ล็อกอินครั้งเดียวเพื่อสั่งซื้อ ติดตามคำสั่งซื้อ และดูประวัติย้อนหลัง</div>
      </div>

      <div className="auth-body">
        <button
          className="auth-line auth-line-big auth-line-clean"
          type="button"
          onClick={handleLineAuth}
          disabled={loading}
        >
          {loading ? "กำลังเชื่อมต่อ..." : "เชื่อมต่อด้วย LINE"}
        </button>

        <div className="auth-trust-list">
          <div className="auth-trust-item">เข้ารหัสแบบ PKCE เพื่อความปลอดภัย</div>
          <div className="auth-trust-item">เชื่อมต่อบัญชีลูกค้าอัตโนมัติ</div>
          <div className="auth-trust-item">ใช้งานได้กับระบบสั่งซื้อทันที</div>
        </div>

        <div className="auth-divider-text">หรือ</div>
        <button
          className="auth-line auth-line-big auth-guest"
          type="button"
          onClick={handleGuest}
          disabled={loading}
        >
          สั่งซื้อโดยไม่สมัครสมาชิก
        </button>
        <div className="auth-helper">ไม่ต้องล็อกอิน กรอกชื่อ ที่อยู่ และเบอร์โทรตอนชำระเงิน</div>

        {status && <div className={`auth-status ${statusTone}`}>{status}</div>}
      </div>
    </div>
  );
}
