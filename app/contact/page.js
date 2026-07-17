import Topbar from "@/components/Topbar";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { topbarInfo } from "@/data/home";

export const metadata = {
  title: "ติดต่อเรา — สวัสดี จิ๊บจิ๊บ",
};

export default function ContactPage() {
  const phoneHref = `tel:${(topbarInfo.phone || "").replace(/[^\d+]/g, "")}`;
  const lineId = String(topbarInfo.line || "@HIJIB").trim();
  const lineHref = `line://ti/p/${lineId}`;
  const lineWebHref = `https://line.me/R/ti/p/${lineId}`;
  const facebookHref =
    process.env.NEXT_PUBLIC_FACEBOOK_PAGE_URL?.trim() ||
    topbarInfo.facebook ||
    "https://www.facebook.com/HiJIBJIB";
  const trustItems = [
    {
      title: "ติดตั้งถึงบ้านตามเวลานัด",
      desc: "ทีมช่างเข้าบริการตามช่วงเวลาที่ลูกค้าเลือก พร้อมแจ้งสถานะทุกขั้นตอน",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3 10.5L12 4l9 6.5V20a1 1 0 01-1 1h-5v-6H9v6H4a1 1 0 01-1-1v-9.5z" />
        </svg>
      ),
    },
    {
      title: "ช่างผ่านการรับรอง",
      desc: "ติดตั้งตามมาตรฐานงานยางและตรวจเช็กก่อนส่งมอบทุกออเดอร์",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 3l7 3v5c0 5-3.2 9.3-7 10-3.8-.7-7-5-7-10V6l7-3z" />
          <path d="M9 12l2 2 4-4" />
        </svg>
      ),
    },
    {
      title: "ชำระเงินปลอดภัย ตรวจสอบได้",
      desc: "มีสรุปรายการชัดเจน พร้อมประวัติคำสั่งซื้อและใบยืนยันในระบบ",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <path d="M3 10h18" />
          <path d="M7 15h3" />
        </svg>
      ),
    },
  ];

  return (
    <div className="contact-page">
      <Topbar />
      <Navbar />
      <div className="contact-hero">
        <div className="contact-eyebrow">Support & Service</div>
        <div className="contact-title">ติดต่อเรา</div>
        <div className="contact-sub">
          ทีมงานพร้อมช่วยเหลือเรื่องสินค้า นัดติดตั้ง และติดตามสถานะออเดอร์ผ่าน LINE
          ให้ลูกค้าได้สะดวกและมั่นใจทุกขั้นตอน
        </div>
      </div>
      <div className="contact-layout">
        <div className="contact-card">
          <div className="contact-company">สวัสดี จิ๊บจิ๊บ</div>
          <div className="contact-note">
            ช่องทางติดต่อหลักของร้าน สำหรับสอบถามสินค้า นัดติดตั้ง และติดตามสถานะคำสั่งซื้อ
          </div>
          <div className="contact-actions">
            <a className="contact-btn contact-call" href={phoneHref}>
              โทรทันที
            </a>
            <a className="contact-btn contact-line" href={lineWebHref} target="_blank" rel="noreferrer">
              เปิด LINE
            </a>
            <a className="contact-btn contact-facebook" href={facebookHref} target="_blank" rel="noreferrer">
              เปิด Facebook
            </a>
          </div>
          <div className="contact-row">
            <div className="contact-label">โทร</div>
            <a className="contact-value" href={phoneHref}>
              {topbarInfo.phone}
            </a>
          </div>
          <div className="contact-row">
            <div className="contact-label">LINE</div>
            <a className="contact-value" href={lineWebHref} target="_blank" rel="noreferrer">
              {topbarInfo.line}
            </a>
          </div>
          <div className="contact-row">
            <div className="contact-label">Facebook</div>
            <a className="contact-value" href={facebookHref} target="_blank" rel="noreferrer">
              facebook.com/HiJIBJIB
            </a>
          </div>
        </div>
        <div className="contact-card contact-trust-card">
          <div className="contact-company">ทำไมลูกค้าถึงมั่นใจเรา</div>
          <div className="contact-trust-list">
            {trustItems.map((item) => (
              <div key={item.title} className="contact-trust-item">
                <div className="contact-trust-head">
                  <div className="contact-trust-icon" aria-hidden="true">
                    {item.icon}
                  </div>
                  <strong>{item.title}</strong>
                </div>
                <span>{item.desc}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="contact-mobile-cta" role="region" aria-label="ติดต่อด่วน">
        <a className="contact-mobile-cta-btn call" href={phoneHref}>
          โทรทันที
        </a>
        <a className="contact-mobile-cta-btn line" href={lineHref}>
          เปิด LINE
        </a>
      </div>
      <Footer />
    </div>
  );
}
