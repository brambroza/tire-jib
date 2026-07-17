import Link from "next/link";
import { notFound } from "next/navigation";
import { formatTHB } from "@/lib/utils/format";
import { getCustomerAuthContext } from "@/lib/auth/customer";
import {
  fetchOrderDetailsForCustomer,
  formatOrderStatus,
  formatPaymentStatus,
  isUuid,
} from "@/lib/orders/details";
import PrintOrderButton from "@/components/PrintOrderButton";
import AutoPrintOnLoad from "@/components/AutoPrintOnLoad";

export const metadata = {
  title: "ใบสรุปคำสั่งซื้อ — สวัสดี จิ๊บจิ๊บ",
};

export default async function OrderInvoicePage({ params, searchParams }) {
  const resolvedParams = await params;
  const resolvedSearch = (await searchParams) || {};
  const orderId = resolvedParams?.orderId;

  if (!isUuid(orderId)) {
    notFound();
  }

  const auth = await getCustomerAuthContext();
  if (!auth.customerId) {
    return (
      <div className="section">
        <div className="section-title">กรุณาเข้าสู่ระบบก่อนดูใบสรุปคำสั่งซื้อ</div>
        <a className="cart-link" href="/auth">
          ไปที่หน้าเข้าสู่ระบบ
        </a>
      </div>
    );
  }

  const orderDetail = await fetchOrderDetailsForCustomer({
    auth,
    orderId,
    includeSlipPreview: true,
  });

  if (!orderDetail) {
    notFound();
  }

  const autoPrint =
    resolvedSearch?.print === "1" ||
    resolvedSearch?.print === "true" ||
    resolvedSearch?.autoprint === "1";

  const { order, items, appointment, totals, slipPreviewUrl } = orderDetail;

  return (
    <div className="invoice-page">
      <AutoPrintOnLoad enabled={Boolean(autoPrint)} />

      <div className="invoice-toolbar no-print">
        <PrintOrderButton />
        <Link className="order-detail-link back" href={`/orders/${order.id}`}>
          กลับไปหน้ารายละเอียดออเดอร์
        </Link>
      </div>

      <div className="invoice-sheet">
        <div className="invoice-head">
          <div>
            <div className="invoice-title">ใบสรุปคำสั่งซื้อ / ORDER SUMMARY</div>
            <div className="invoice-sub">สวัสดี จิ๊บจิ๊บ · JibJib Tire Service</div>
            <div className="invoice-sub">โทร 063-342-1111 · LINE: @HIJIB</div>
          </div>
          <div className="invoice-meta">
            <div>
              <span>เลขที่ออเดอร์</span>
              <strong>{order.order_no || String(order.id).slice(0, 8)}</strong>
            </div>
            <div>
              <span>วันที่ออกเอกสาร</span>
              <strong>
                {new Date(order.created_at).toLocaleString("th-TH", {
                  dateStyle: "medium",
                  timeStyle: "short",
                  hour12: false,
                  timeZone: "Asia/Bangkok",
                })}
              </strong>
            </div>
          </div>
        </div>

        <div className="invoice-block-grid">
          <div className="invoice-block">
            <div className="invoice-block-title">ข้อมูลคำสั่งซื้อ</div>
            <div className="invoice-line">
              <span>สถานะออเดอร์</span>
              <strong>{formatOrderStatus(order.status)}</strong>
            </div>
            <div className="invoice-line">
              <span>สถานะการชำระเงิน</span>
              <strong>{formatPaymentStatus(order.payment_status)}</strong>
            </div>
            {appointment?.scheduled_at && (
              <div className="invoice-line">
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

          <div className="invoice-block">
            <div className="invoice-block-title">ที่อยู่จัดส่ง/ติดตั้ง</div>
            <div className="invoice-address">{order.address || "-"}</div>
          </div>
        </div>

        <div className="invoice-table-wrap">
          <table className="invoice-table">
            <thead>
              <tr>
                <th>รายการ</th>
                <th>ขนาด</th>
                <th>จำนวน</th>
                <th>ราคา/หน่วย</th>
                <th>รวม</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td>{item.name}</td>
                  <td>{item.size}</td>
                  <td>{item.quantity}</td>
                  <td>{formatTHB(item.unitPrice)}</td>
                  <td>{formatTHB(item.lineTotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="invoice-total-box">
          <div className="invoice-line">
            <span>รวมสินค้า</span>
            <strong>{formatTHB(totals.itemSubTotal)}</strong>
          </div>
          <div className="invoice-line">
            <span>ค่าบริการ</span>
            <strong>{formatTHB(totals.serviceFee)}</strong>
          </div>
          <div className="invoice-line">
            <span>ค่าจัดส่ง</span>
            <strong>{formatTHB(totals.shippingFee)}</strong>
          </div>
          <div className="invoice-line grand">
            <span>ยอดสุทธิ</span>
            <strong>{formatTHB(totals.grandTotal)}</strong>
          </div>
        </div>

        {slipPreviewUrl && (
          <div className="invoice-foot-note">
            หลักฐานการชำระเงิน: <a href={slipPreviewUrl}>เปิดลิงก์สลิป</a>
          </div>
        )}
      </div>
    </div>
  );
}
