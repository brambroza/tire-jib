"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Icon } from "@iconify/react";
import { navLinks } from "@/data/home";
import ProfileMenu from "@/components/ProfileMenu";
import CartBadge from "@/components/CartBadge";
import OrdersMenu from "@/components/OrdersMenu";
import CartSnackbar from "@/components/CartSnackbar";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

const BRAND_LOGO_SRC = "/assets/278123688_316201347281149_1831381085571650825_n.jpg";

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const router = useRouter();
  const pathname = usePathname();
  const isSearchPage = pathname?.startsWith("/search");
  const [activeFilterCount, setActiveFilterCount] = useState(0);
  const mobileTabs = [
    { label: "หน้าแรก", href: "/", icon: "solar:home-2-linear" },
    { label: "ค้นหา", href: "/search", icon: "solar:magnifer-linear" },
    { label: "โปรโมชัน", href: "/promotions", icon: "solar:tag-price-linear" },
    { label: "จองคิว", href: "/appointments", icon: "solar:calendar-linear" },
    { label: "บัญชี", href: "/profile", icon: "solar:user-linear" },
  ];

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => null);
    await supabase.auth.signOut().catch(() => null);
    router.push("/");
    window.dispatchEvent(new Event("cart:updated"));
  };

  useEffect(() => {
    if (!isSearchPage) {
      setActiveFilterCount(0);
      return;
    }
    const params = new URLSearchParams(window.location.search || "");
    const normalize = (value) => (value || "").trim();
    const nextCount = [
      normalize(params.get("make")),
      normalize(params.get("model")),
      normalize(params.get("year")),
      normalize(params.get("brand")),
      normalize(params.get("size")),
      normalize(params.get("image_ids")),
    ].filter(Boolean).length;
    setActiveFilterCount(nextCount);
  }, [isSearchPage, pathname]);

  return (
    <>
      <CartSnackbar />
      <nav className="navbar">
        <Link className="logo" href="/">
        <div className="logo-icon">
          <img className="logo-image" src={BRAND_LOGO_SRC} alt="JIBJIB Tire Service" />
        </div>
        <div className="logo-text">
          <div className="logo-name">
            สวัสดี <span>จิ๊บจิ๊บ</span>
          </div>
          <div className="logo-sub">JIBJIB TIRE SERVICE</div>
        </div>
      </Link>

      <div className="nav-links">
        {navLinks.map((link) => (
          <a
            key={link.label}
            className={`nav-link ${link.active ? "active" : ""}`}
            href={link.href || "#"}
          >
            {link.label}
          </a>
        ))}
      </div>

      <div className="nav-right">
        <ProfileMenu />
        <OrdersMenu />
        <button className="nav-btn btn-logout" type="button" onClick={handleLogout}>
          ออกจากระบบ
        </button>
        <a className="nav-btn btn-cart" href="/checkout">
          🛒
          <CartBadge />
        </a>
      </div>

      <div className="nav-mobile-tools">
        {isSearchPage && (
          <button
            type="button"
            className="nav-btn nav-filter-toggle"
            aria-label="แสดงหรือซ่อนตัวค้นหา"
            onClick={() => window.dispatchEvent(new Event("search:hero-toggle"))}
          >
            <Icon icon="solar:filter-bold-duotone" />
            {activeFilterCount > 0 && (
              <span className="nav-filter-badge" aria-label={`มีตัวกรอง ${activeFilterCount} รายการ`}>
                {activeFilterCount}
              </span>
            )}
          </button>
        )}
        <a className="nav-btn btn-cart nav-cart-icon" href="/checkout" aria-label="ตะกร้าสินค้า">
          🛒
          <CartBadge />
        </a>
        <button
          className="nav-toggle"
          type="button"
          aria-expanded={menuOpen}
          aria-label="เปิดเมนู"
          onClick={() => setMenuOpen((prev) => !prev)}
        >
          <span />
          <span />
          <span />
        </button>
      </div>

        {menuOpen && (
          <div className="nav-mobile">
            <div className="nav-mobile-links">
              {navLinks.map((link) => (
                <a
                  key={link.label}
                  className="nav-mobile-link"
                  href={link.href || "#"}
                  onClick={() => setMenuOpen(false)}
                >
                  {link.label}
                </a>
              ))}
            </div>
            <div className="nav-mobile-actions">
              <button
                className="nav-btn btn-logout"
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  handleLogout();
                }}
              >
                ออกจากระบบ
              </button>
              <OrdersMenu />
              <ProfileMenu />
            </div>
          </div>
        )}
      </nav>
      <nav className="mobile-app-nav" aria-label="เมนูแอปมือถือ">
        {mobileTabs.map((tab) => {
          const isActive =
            tab.href === "/" ? pathname === "/" : pathname?.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`mobile-app-nav-item ${isActive ? "active" : ""}`}
              aria-current={isActive ? "page" : undefined}
            >
              <Icon className="mobile-app-nav-icon" icon={tab.icon} aria-hidden="true" />
              <span className="mobile-app-nav-label">{tab.label}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
