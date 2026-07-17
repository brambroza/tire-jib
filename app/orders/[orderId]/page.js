import Link from "next/link";
import { notFound } from "next/navigation";
import { formatTHB } from "@/lib/utils/format";
import Topbar from "@/components/Topbar";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { getCustomerAuthContext } from "@/lib/auth/customer";
import {
  fetchOrderDetailsForCustomer,
  formatOrderStatus,
  formatPaymentStatus,
  isUuid,
} from "@/lib/orders/details";
import PrintOrderButton from "@/components/PrintOrderButton";

export const metadata = {
  title: "รายละเอียดคำสั่งซื้อ — สวัสดี จิ๊บจิ๊บ",
};

export default async function OrderDetailPage({ params }) {
  const resolvedParams = await params;
  const orderId = resolvedParams?.orderId;

  if (!isUuid(orderId)) {
    notFound();
  }

  const auth = await getCustomerAuthContext();
  const customerId = auth.customerId;

  if (!customerId) {
    return (
      <div className="orders-page">
        <div className="no-print">
          <Topbar />
          <Navbar />
        </div>
        <div className="section">
          <div className="section-title">กรุณาเข้าสู่ระบบก่อนดูรายละเอียดคำสั่งซื้อ</div>
          <a className="cart-link" href="/auth">
            ไปที่หน้าเข้าสู่ระบบ
          </a>
        </div>
        <div className="no-print">
          <Footer />
        </div>
      </div>
    );
  }

  const orderDetail = await fetchOrderDetailsForCustomer({ auth, orderId });
  if (!orderDetail) {
    notFound();
  }

  const { order, appointment, items, totals, timeline, slipPreviewUrl } = orderDetail;

  return (
    <div className="orders-page">
      <div className="no-print">
        <Topbar />
        <Navbar />
      </div>
      <div className="section">
        <div className="section-head">
          <div className="section-title-wrap">
            <div className="section-eyebrow">Order Detail</div>
            <div className="section-title">คำสั่งซื้อ #{order.order_no || String(order.id).slice(0, 8)}</div>
          </div>
          <div className="order-detail-head-actions no-print">
            <PrintOrderButton />
            <Link className="order-detail-link back" href="/orders">
              กลับไปหน้ารายการคำสั่งซื้อ
            </Link>
            <Link className="order-detail-link back" href={`/orders/${order.id}/invoice`}>
              เปิดใบสรุปสำหรับพิมพ์
            </Link>
          </div>
        </div>

        <div className="order-detail-grid">
          <div className="order-card">
            <div className="order-title">สรุปสถานะ</div>
            <div className="order-summary-lines">
              <div className="order-summary-line">
                <span>สถานะออเดอร์</span>
                <strong>{formatOrderStatus(order.status)}</strong>
              </div>
              <div className="order-summary-line">
                <span>สถานะการชำระเงิน</span>
                <strong>{formatPaymentStatus(order.payment_status)}</strong>
              </div>
              <div className="order-summary-line">
                <span>สร้างเมื่อ</span>
                <strong>
                  {new Date(order.created_at).toLocaleString("th-TH", {
                    dateStyle: "medium",
                    timeStyle: "short",
                    hour12: false,
                    timeZone: "Asia/Bangkok",
                  })}
                </strong>
              </div>
              {appointment?.scheduled_at && (
                <div className="order-summary-line">
                  <span>วันนัดติดตั้ง</span>
                  <strong>
                    {new Date(appointment.scheduled_at).toLocaleString("th-TH", {
                      dateStyle: "medium",
                      timeStyle: "short",
                      hour12: false,
                      timeZone: "Asia/Bangkok",
                    })}
                  </strong>
                </div>
              )}
            </div>
          </div>

          <div className="order-card">
            <div className="order-title">Timeline</div>
            <div className="order-timeline">
              {timeline.map((step) => (
                <div key={step.key} className={`order-timeline-item ${step.tone}`}>
                  <div className="order-timeline-dot" />
                  <div>
                    <div className="order-timeline-title">{step.title}</div>
                    {step.time && (
                      <div className="order-meta">
                        {new Date(step.time).toLocaleString("th-TH", {
                          dateStyle: "medium",
                          timeStyle: "short",
                          hour12: false,
                          timeZone: "Asia/Bangkok",
                        })}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="order-card">
          <div className="order-title">รายการสินค้า</div>
          {items.length > 0 ? (
            <div className="order-detail-items">
              {items.map((item) => (
                <div key={item.id} className="order-detail-item">
                  <div>
                    <div className="order-item-name">{item.name}</div>
                    <div className="order-meta">ขนาด {item.size}</div>
                  </div>
                  <div className="order-item-right">
                    <div className="order-meta">x{item.quantity}</div>
                    <div className="order-item-price">{formatTHB(item.lineTotal)}</div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="order-empty">ไม่พบรายการสินค้าในคำสั่งซื้อนี้</div>
          )}

          <div className="order-totals">
            <div className="order-summary-line">
              <span>รวมสินค้า</span>
              <strong>{formatTHB(totals.itemSubTotal)}</strong>
            </div>
            <div className="order-summary-line">
              <span>ค่าบริการ</span>
              <strong>{formatTHB(totals.serviceFee)}</strong>
            </div>
            <div className="order-summary-line">
              <span>ค่าจัดส่ง</span>
              <strong>{formatTHB(totals.shippingFee)}</strong>
            </div>
            <div className="order-summary-line total">
              <span>รวมสุทธิ</span>
              <strong>{formatTHB(totals.grandTotal)}</strong>
            </div>
          </div>
        </div>

        {slipPreviewUrl && (
          <div className="order-card">
            <div className="order-title">หลักฐานการชำระเงิน</div>
            <a href={slipPreviewUrl} target="_blank" rel="noreferrer" className="order-detail-link">
              เปิดสลิปการโอนเงิน
            </a>
          </div>
        )}
      </div>
      <div className="no-print">
        <Footer />
      </div>
    </div>
  );
}
