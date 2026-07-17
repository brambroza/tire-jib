"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

export default function LineAuthCallback() {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState("");

  useEffect(() => {
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    if (!code || !state) {
      return;
    }

    const storedState =
      sessionStorage.getItem("line_oauth_state") ||
      localStorage.getItem("line_oauth_state");
    const codeVerifier =
      sessionStorage.getItem("line_code_verifier") ||
      localStorage.getItem("line_code_verifier");

    if (!storedState || storedState !== state || !codeVerifier) {
      setStatus("LINE OAuth state ไม่ถูกต้อง");
      cleanupUrl();
      return;
    }

    setStatus("กำลังเข้าสู่ระบบด้วย LINE...");
    fetch("/api/line/exchange", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, codeVerifier }),
    })
      .then(async (res) => {
        if (!res.ok) {
          const payload = await res.json().catch(() => ({}));
          throw new Error(payload?.error || "ไม่สามารถเข้าสู่ระบบด้วย LINE ได้");
        }
        return res.json();
      })
      .then((payload) => {
        setStatus("เข้าสู่ระบบด้วย LINE สำเร็จ กำลังพาไปหน้าแรก...");
        setTimeout(() => {
          window.location.replace("/");
        }, 800);
      })
      .catch((error) => {
        setStatus(error?.message || "ไม่สามารถเข้าสู่ระบบด้วย LINE ได้");
      })
      .finally(() => {
        sessionStorage.removeItem("line_oauth_state");
        sessionStorage.removeItem("line_code_verifier");
        localStorage.removeItem("line_oauth_state");
        localStorage.removeItem("line_code_verifier");
        cleanupUrl();
      });
  }, [searchParams]);

  const cleanupUrl = () => {
    const url = new URL(window.location.href);
    url.searchParams.delete("code");
    url.searchParams.delete("state");
    window.history.replaceState({}, "", `${url.pathname}${url.search}`);
  };

  if (!status) return null;

  return <div className="auth-status">{status}</div>;
}
