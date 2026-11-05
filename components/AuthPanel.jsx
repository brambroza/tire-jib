"use client";

import { useState } from "react";
import { startLineLogin } from "@/lib/auth/line-login";

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

        <div className="auth-helper">ระบบนี้รองรับการเข้าสู่ระบบด้วย LINE เท่านั้น</div>

        {status && <div className={`auth-status ${statusTone}`}>{status}</div>}
      </div>
    </div>
  );
}
