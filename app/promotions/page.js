import Topbar from "@/components/Topbar";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { fetchPromotions } from "@/lib/supabase/queries";

export const metadata = {
  title: "โปรโมชัน — สวัสดี จิ๊บจิ๊บ",
};

export default async function PromotionsPage() {
  const promos = await fetchPromotions();
  const list = Array.isArray(promos) ? promos : [];

  return (
    <div className="promotions-page">
      <Topbar />
      <Navbar />
      <div className="promotions-hero">
        <div className="promotions-title">โปรโมชันล่าสุด</div>
        <div className="promotions-sub">
          ดีลพิเศษเฉพาะช่วงนี้ อัปเดตจากระบบแบบเรียลไทม์
        </div>
      </div>
      {list.length === 0 ? (
        <div className="promotions-empty">ยังไม่มีโปรโมชันในขณะนี้</div>
      ) : (
        <div className="promotions-grid">
          {list.map((promo) => (
            <div key={promo.id} className="promotion-card">
              {promo.imageUrl ? (
                <div className="promotion-media">
                  <img className="promotion-img" src={promo.imageUrl} alt={promo.text} />
                </div>
              ) : (
                <div className="promotion-media placeholder">
                  <svg className="promotion-wheel" viewBox="0 0 120 120" aria-hidden="true">
                    <circle cx="60" cy="60" r="50" stroke="currentColor" strokeWidth="8" fill="none" />
                    <circle cx="60" cy="60" r="24" stroke="currentColor" strokeWidth="8" fill="none" />
                    <circle cx="60" cy="60" r="6" fill="currentColor" />
                    <line x1="60" y1="10" x2="60" y2="32" stroke="currentColor" strokeWidth="8" />
                    <line x1="60" y1="88" x2="60" y2="110" stroke="currentColor" strokeWidth="8" />
                    <line x1="10" y1="60" x2="32" y2="60" stroke="currentColor" strokeWidth="8" />
                    <line x1="88" y1="60" x2="110" y2="60" stroke="currentColor" strokeWidth="8" />
                  </svg>
                </div>
              )}
              <div className="promotion-body">
                <div className="promotion-title">{promo.text}</div>
                <div className="promotion-message">{promo.highlight}</div>
                <div className="promotion-tag">โปรโมชัน</div>
              </div>
            </div>
          ))}
        </div>
      )}
      <Footer />
    </div>
  );
}
