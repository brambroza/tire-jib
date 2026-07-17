"use client";

import { useEffect, useMemo, useState } from "react";

const OA_URL = "https://line.me/R/ti/p/@Hijib";

function formatTime(dateLike) {
  if (!dateLike) return "-";
  const date = new Date(dateLike);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("th-TH", {
    dateStyle: "short",
    timeStyle: "short",
    hour12: false,
    timeZone: "Asia/Bangkok",
  }).format(date);
}

export default function LineMsgLinkPage() {
  const [status, setStatus] = useState("กำลังสร้างโค้ดยืนยัน...");
  const [code, setCode] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [linked, setLinked] = useState(false);

  const expiresLabel = useMemo(() => formatTime(expiresAt), [expiresAt]);

  useEffect(() => {
    let stopped = false;
    let pollTimer = null;

    const pollStatus = async () => {
      const response = await fetch("/api/line/link-code", { method: "GET" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.error || "link_code_status_failed");
      }

      if (payload.linked || payload?.line_msg_user_id) {
        setLinked(true);
        setStatus("เชื่อมต่อ LINE OA สำเร็จ กำลังพาไปหน้าแรก...");
        setTimeout(() => {
          window.location.replace("/");
        }, 800);
        return;
      }

      const pendingCode = payload?.code;
      if (pendingCode?.code) {
        setCode(pendingCode.code);
        setExpiresAt(pendingCode.expires_at || "");
      }

      if (!stopped) {
        pollTimer = setTimeout(pollStatus, 3000);
      }
    };

    const createCode = async () => {
      try {
        const response = await fetch("/api/line/link-code", { method: "POST" });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || !payload?.ok) {
          throw new Error(payload?.error || "create_link_code_failed");
        }

        if (payload.already_linked) {
          setLinked(true);
          setStatus("บัญชีเชื่อมต่อแล้ว กำลังพาไปหน้าแรก...");
          setTimeout(() => {
            window.location.replace("/");
          }, 600);
          return;
        }

        setCode(payload?.code?.code || "");
        setExpiresAt(payload?.code?.expires_at || "");
        setStatus("ส่งโค้ดนี้เข้าแชท LINE OA เพื่อยืนยันการเชื่อมต่อ");

        await pollStatus();
      } catch (error) {
        setStatus(error?.message || "ไม่สามารถสร้างโค้ดยืนยันได้");
      }
    };

    createCode();

    return () => {
      stopped = true;
      if (pollTimer) clearTimeout(pollTimer);
    };
  }, []);

  return (
    <div className="auth-page">
      <div className="auth-card auth-card-clean">
        <div className="auth-header auth-header-line auth-header-clean">
          <div className="auth-badge">LINE OA Link</div>
          <div className="auth-title">ยืนยันการเชื่อมต่อ LINE OA</div>
          <div className="auth-subtitle">ใช้สำหรับผูกบัญชีแชทกับบัญชีลูกค้าในระบบ</div>
        </div>

        <div className="auth-body">
          <div className="auth-helper">{status}</div>
          {code && !linked && (
            <>
              <div className="auth-status info">โค้ดยืนยัน: {code}</div>
              <div className="auth-helper">หมดอายุ: {expiresLabel}</div>
              <a className="auth-line auth-line-big auth-line-clean" href={OA_URL} target="_blank" rel="noreferrer">
                เปิดแชท LINE OA
              </a>
              <div className="auth-helper">คัดลอกโค้ดด้านบน แล้วส่งเข้าแชท OA 1 ข้อความ</div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
