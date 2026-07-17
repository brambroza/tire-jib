"use client";

import { useEffect, useState } from "react";
import { Icon } from "@iconify/react";
import HeroSearchCard from "@/components/HeroSearchCard";

export default function SearchHeroSection({ initiallyCollapsed = false }) {
  const [open, setOpen] = useState(!initiallyCollapsed);

  useEffect(() => {
    const onToggle = () => setOpen((prev) => !prev);
    const onHideMobile = () => setOpen(false);
    window.addEventListener("search:hero-toggle", onToggle);
    window.addEventListener("search:hero-hide-mobile", onHideMobile);
    return () => {
      window.removeEventListener("search:hero-toggle", onToggle);
      window.removeEventListener("search:hero-hide-mobile", onHideMobile);
    };
  }, []);

  useEffect(() => {
    const ua = navigator.userAgent || "";
    const isLineInApp = /Line/i.test(ua);
    if (!isLineInApp) return undefined;
    document.body.setAttribute("data-line-inapp-search", "1");
    return () => {
      document.body.removeAttribute("data-line-inapp-search");
    };
  }, []);

  return (
    <div className={`search-hero ${open ? "" : "collapsed"}`}>
      <button
        type="button"
        className="search-hero-toggle"
        aria-expanded={open}
        aria-controls="search-hero-card"
        aria-label={open ? "ย่อตัวค้นหา" : "เปิดตัวค้นหา"}
        onClick={() => setOpen((prev) => !prev)}
      >
        <Icon icon={open ? "solar:close-circle-linear" : "solar:magnifer-bold-duotone"} />
        <span>{open ? "ย่อตัวค้นหา" : "ค้นหาใหม่"}</span>
      </button>
      <div className="search-hero-head">
        <div>
          <div className="search-hero-title">ค้นหายางให้เหมาะกับรถของคุณ</div>
          <div className="search-hero-sub">
            เลือกได้ทั้งตามรุ่นรถและตามขนาดยาง พร้อมผลลัพธ์แบบเรียลไทม์
          </div>
        </div>
      </div>
      <div className="search-hero-card-wrap" id="search-hero-card">
        <HeroSearchCard />
      </div>
    </div>
  );
}
