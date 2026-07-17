import { steps } from "@/data/home";

export default function HowItWorks() {
  return (
    <div className="flow-bg">
      <div className="section">
        <div className="flow-title-wrap">
          <div className="section-eyebrow" style={{ textAlign: "center" }}>
            ขั้นตอนการสั่งซื้อ
          </div>
          <div className="section-title flow-title">
            ง่ายแค่ 5 ขั้น เสร็จภายใน 5 นาที
          </div>
        </div>
        <div className="steps">
          {steps.map((step) => (
            <div key={step.num} className="step">
              <div className="step-num">{step.num}</div>
              <div className="step-icon">{step.icon}</div>
              <div className="step-title">{step.title}</div>
              <div className="step-desc">{step.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
