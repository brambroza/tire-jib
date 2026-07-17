import Link from "next/link";
import { footerBrands as fallbackFooterBrands, topbarInfo } from "@/data/home";
import { fetchProductBrands } from "@/lib/supabase/queries";

const footerLinks = {
  services: [
    { label: "เปลี่ยนยางถึงบ้าน", href: "/services" },
    { label: "ตรวจเช็ค 27 รายการ", href: "/services" },
    { label: "จองคิวช่าง", href: "/appointments" },
    { label: "ประกันภัย & พ.ร.บ.", href: "/services" },
    { label: "เคลมประกันยาง", href: "/contact" },
  ],
  customers: [
    { label: "สมัครสมาชิก", href: "/auth" },
    { label: "ตรวจสอบออร์เดอร์", href: "/orders" },
    { label: "ประวัติการสั่งซื้อ", href: "/orders" },
    { label: "ตรวจสอบการรับประกัน", href: "/contact" },
    { label: "ติดต่อเรา", href: "/contact" },
  ],
};

function buildLineChatUrl() {
  const direct = process.env.NEXT_PUBLIC_LINE_CHAT_URL?.trim();
  if (direct) return direct;
  const rawId = process.env.NEXT_PUBLIC_LINE_ID?.trim() || topbarInfo.line?.trim();
  if (!rawId) return "https://line.me";
  const id = rawId.startsWith("@") ? rawId : `@${rawId}`;
  return `https://line.me/R/ti/p/${id}`;
}

function buildFacebookUrl() {
  return (
    process.env.NEXT_PUBLIC_FACEBOOK_PAGE_URL?.trim() ||
    topbarInfo.facebook ||
    "https://www.facebook.com/HiJIBJIB"
  );
}

function buildPhoneHref() {
  const normalized = (topbarInfo.phone || "").replace(/[^\d+]/g, "");
  return normalized ? `tel:${normalized}` : "tel:";
}

function toProductLinkItems(brands) {
  return (brands || []).slice(0, 6).map((brand) => ({
    label: `ยาง ${brand}`,
    href: `/search?brand=${encodeURIComponent(brand)}`,
  }));
}

export default async function Footer() {
  const dbBrands = await fetchProductBrands({ limit: 8 });
  const footerBrandTags = dbBrands.length > 0 ? dbBrands : fallbackFooterBrands;
  const productLinks = toProductLinkItems(footerBrandTags);
  const lineChatUrl = buildLineChatUrl();
  const facebookUrl = buildFacebookUrl();
  const phoneHref = buildPhoneHref();

  return (
    <footer>
      <div className="footer-inner">
        <div className="footer-top">
          <div className="footer-brand">
            <div className="footer-logo-name">
              สวัสดี <span>จิ๊บจิ๊บ</span>
            </div>
            <p className="footer-brand-desc">
              บริการเปลี่ยนยางรถยนต์ครบวงจร ถึงบ้านคุณ ฟรีค่าบริการ รับประกัน 365 วัน ทุกกรณี
            </p>
            <div className="footer-contact">
              <a className="footer-contact-item" href={phoneHref}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013 10.79" />
                </svg>
                {topbarInfo.phone}
              </a>
              <a className="footer-contact-item" href={lineChatUrl} target="_blank" rel="noreferrer">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
                </svg>
                LINE: {topbarInfo.line}
              </a>
              <a className="footer-contact-item" href={facebookUrl} target="_blank" rel="noreferrer">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 2h-3a5 5 0 00-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 011-1h3z" />
                </svg>
                สวัสดี จิ๊บจิ๊บ
              </a>
            </div>
          </div>
          <div>
            <div className="footer-col-title">บริการ</div>
            <div className="footer-links">
              {footerLinks.services.map((link) => (
                <Link key={link.label} className="footer-link" href={link.href}>
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
          <div>
            <div className="footer-col-title">สินค้า</div>
            <div className="footer-links">
              {productLinks.map((link) => (
                <Link key={link.label} className="footer-link" href={link.href}>
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
          <div>
            <div className="footer-col-title">ลูกค้า</div>
            <div className="footer-links">
              {footerLinks.customers.map((link) => (
                <Link key={link.label} className="footer-link" href={link.href}>
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
        <div className="footer-bottom">
          <div className="footer-copy">
            © 2026 สวัสดี จิ๊บจิ๊บ · JibJib Tire Service · โทร. {topbarInfo.phone}
          </div>
          <div className="footer-bottom-brands">
            {footerBrandTags.map((brand) => (
              <Link
                key={brand}
                className="footer-brand-tag"
                href={`/search?brand=${encodeURIComponent(brand)}`}
              >
                {brand}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
