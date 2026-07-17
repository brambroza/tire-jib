import { services } from "@/data/home";

export default function Services() {
  return (
    <div className="services-bg">
      <div className="section services-section">
        <div className="section-head">
          <div className="section-title-wrap">
            <div className="section-eyebrow">บริการของเรา</div>
            <div className="section-title">ครบจบในที่เดียว</div>
          </div>
        </div>
        <div className="service-cards">
          {services.map((service) => (
            <div key={service.title} className="service-card">
              <div className="service-icon-wrap">{service.icon}</div>
              <div className="service-title">{service.title}</div>
              <div className="service-desc">{service.desc}</div>
              <div className="service-link">{service.link}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
