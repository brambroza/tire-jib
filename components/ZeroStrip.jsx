export default function ZeroStrip() {
  return (
    <div className="zero-strip">
      <div className="zero-inner">
        <div className="zero-left">
          <div className="zero-pct">0%</div>
          <div className="zero-text">
            <div className="zero-title">ผ่อน 0% นาน 6 เดือน</div>
            <div className="zero-sub">รองรับทุกธนาคารชั้นนำ · ไม่มีค่าธรรมเนียม</div>
          </div>
        </div>
        <div className="zero-banks">
          {[
            "KBA",
            "SCB",
            "KTB",
            "BAY",
            "BBL",
          ].map((bank) => (
            <div key={bank} className="bank-icon">
              {bank}
            </div>
          ))}
        </div>
        <button className="zero-cta" type="button">
          ดูเงื่อนไข →
        </button>
      </div>
    </div>
  );
}
