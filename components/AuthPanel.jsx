"use client";

import { useState } from "react";

export default function AuthPanel() {
  const [status, setStatus] = useState("");
  const [statusTone, setStatusTone] = useState("info");
  const [loading, setLoading] = useState(false);

  const handleLineAuth = async () => {
    setLoading(true);
    setStatus("");
    setStatusTone("info");
    try {
      const channelId = process.env.NEXT_PUBLIC_LINE_CHANNEL_ID;
      if (!channelId) {
        throw new Error("ยังไม่ได้ตั้งค่า NEXT_PUBLIC_LINE_CHANNEL_ID");
      }
      if (!window?.crypto?.subtle) {
        throw new Error("เบราว์เซอร์ไม่รองรับการเข้ารหัสที่จำเป็นสำหรับ LINE PKCE");
      }

      const siteUrl =
        process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || window.location.origin;
      const redirectTo = `${siteUrl}/line/callback`;
      const codeVerifier = generateCodeVerifier();
      const codeChallenge = await generateCodeChallenge(codeVerifier);
      const state = generateState();

      sessionStorage.setItem("line_code_verifier", codeVerifier);
      sessionStorage.setItem("line_oauth_state", state);
      localStorage.setItem("line_code_verifier", codeVerifier);
      localStorage.setItem("line_oauth_state", state);

      const authUrl = new URL("https://access.line.me/oauth2/v2.1/authorize");
      authUrl.searchParams.set("response_type", "code");
      authUrl.searchParams.set("client_id", channelId);
      authUrl.searchParams.set("redirect_uri", redirectTo);
      authUrl.searchParams.set("state", state);
      authUrl.searchParams.set("scope", "openid profile friendship_status");
      authUrl.searchParams.set("code_challenge", codeChallenge);
      authUrl.searchParams.set("code_challenge_method", "S256");

      setStatus("กำลังพาไปที่ LINE...");
      setStatusTone("info");
      window.location.href = authUrl.toString();
    } catch (error) {
      const message = error?.message || "";
      setStatus(message || "ไม่สามารถเชื่อมต่อ LINE ได้");
      setStatusTone("error");
    } finally {
      setLoading(false);
    }
  };

  const generateState = () => {
    const bytes = new Uint8Array(16);
    window.crypto.getRandomValues(bytes);
    return toBase64Url(bytes);
  };

  const generateCodeVerifier = () => {
    const bytes = new Uint8Array(32);
    window.crypto.getRandomValues(bytes);
    return toBase64Url(bytes);
  };

  const generateCodeChallenge = async (verifier) => {
    const data = new TextEncoder().encode(verifier);
    const hash = await window.crypto.subtle.digest("SHA-256", data);
    return toBase64Url(new Uint8Array(hash));
  };

  const toBase64Url = (bytes) => {
    const base64 = btoa(String.fromCharCode(...bytes));
    return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
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
