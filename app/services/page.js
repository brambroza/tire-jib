import Topbar from "@/components/Topbar";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

export const metadata = {
  title: "บริการ — สวัสดี จิ๊บจิ๊บ",
};

const services = [
  {
    title: "ตรวจเช็คสภาพรถ",
    desc: "ตรวจสภาพยาง เบรก ช่วงล่าง และระบบพื้นฐานก่อนออกเดินทาง",
    tag: "ตรวจเช็ค",
  },
  {
    title: "ประกันภัย",
    desc: "เลือกแผนประกันที่เหมาะกับรถของคุณ พร้อมให้คำปรึกษาโดยผู้เชี่ยวชาญ",
    tag: "ประกัน",
  },
  {
    title: "พรบ",
    desc: "ต่ออายุ พ.ร.บ. รวดเร็ว พร้อมแจ้งเตือนวันครบกำหนด",
    tag: "พรบ",
  },
];

export default function ServicesPage() {
  return (
    <div className="services-page">
      <Topbar />
      <Navbar />
      <div className="services-hero">
        <div className="services-title">บริการของเรา</div>
        <div className="services-sub">
          ดูแลรถครบวงจร ตั้งแต่ตรวจเช็คสภาพ ไปจนถึงประกันภัยและ พ.ร.บ.
        </div>
      </div>
      <div className="services-grid">
        {services.map((service) => (
          <div key={service.title} className="services-card">
            <div className="services-tag">{service.tag}</div>
            <div className="services-card-title">{service.title}</div>
            <div className="services-card-desc">{service.desc}</div>
            <a className="services-cta" href="/auth">
              ติดต่อเพื่อใช้บริการ
            </a>
          </div>
        ))}
      </div>
      <Footer />
    </div>
  );
}
