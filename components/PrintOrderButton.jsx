"use client";

export default function PrintOrderButton() {
  return (
    <button type="button" className="order-detail-link back" onClick={() => window.print()}>
      พิมพ์ใบสรุปคำสั่งซื้อ
    </button>
  );
}
