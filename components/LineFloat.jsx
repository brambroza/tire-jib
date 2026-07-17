"use client";

import { useEffect, useMemo, useState } from "react";
import { topbarInfo } from "@/data/home";

function buildLineChatUrl() {
  const direct = process.env.NEXT_PUBLIC_LINE_CHAT_URL?.trim();
  if (direct) return direct;

  const rawId = process.env.NEXT_PUBLIC_LINE_ID?.trim() || topbarInfo.line?.trim();
  if (!rawId) return "https://line.me";
  const id = rawId.startsWith("@") ? rawId : `@${rawId}`;
  return `https://line.me/R/ti/p/${id}`;
}

function buildTelHref() {
  const rawPhone = topbarInfo.phone || "";
  const normalized = rawPhone.replace(/[^\d+]/g, "");
  return normalized ? `tel:${normalized}` : "tel:";
}

export default function LineFloat() {
  const [open, setOpen] = useState(false);
  const lineChatUrl = useMemo(() => buildLineChatUrl(), []);
  const telHref = useMemo(() => buildTelHref(), []);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <div className={`line-float ${open ? "open" : ""}`} title="ติดต่อผ่าน LINE">
      {open && (
        <div className="line-float-panel" role="dialog" aria-label="LINE Chat">
          <div className="line-float-panel-head">
            <div>
              <div className="line-float-title">แชทกับทีมงาน สวัสดีจิ๊บจิ๊บ</div>
              <div className="line-float-sub">{topbarInfo.hours}</div>
            </div>
            <button
              type="button"
              className="line-float-close"
              aria-label="ปิดแชท"
              onClick={() => setOpen(false)}
            >
              ×
            </button>
          </div>

          <div className="line-float-status">
            <span className="line-float-dot" />
            ทีมงานออนไลน์ พร้อมตอบกลับไว
          </div>

          <div className="line-float-actions">
            <a
              className="line-float-primary"
              href={lineChatUrl}
              target="_blank"
              rel="noreferrer"
            >
              เปิดแชท LINE
            </a>
            <a className="line-float-secondary" href={telHref}>
              โทร {topbarInfo.phone}
            </a>
            <a className="line-float-link" href="/orders">
              ตรวจสอบสถานะคำสั่งซื้อ
            </a>
          </div>
        </div>
      )}

      <button
        type="button"
        className="line-float-trigger"
        aria-expanded={open}
        aria-label={open ? "ปิด LINE Chat" : "เปิด LINE Chat"}
        onClick={() => setOpen((prev) => !prev)}
      >
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path d="M12.004 0C5.374 0 0 4.774 0 10.67c0 3.697 2.186 6.956 5.516 8.902-.242.898-.775 2.892-.888 3.342-.141.558.203.55.427.4.175-.12 2.79-1.899 3.916-2.666a14.4 14.4 0 002.033.147c6.63 0 12.004-4.773 12.004-10.67C24.008 4.774 18.634 0 12.004 0z" />
        </svg>
      </button>
    </div>
  );
}
