import Link from "next/link";
import { notFound } from "next/navigation";
import Topbar from "@/components/Topbar";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import TaxInvoiceRequestForm from "@/components/TaxInvoiceRequestForm";
import { getCustomerAuthContext } from "@/lib/auth/customer";
import { isUuid } from "@/lib/orders/details";

export const metadata = {
  title: "ขอใบกำกับภาษีเต็มรูป — สวัสดี จิ๊บจิ๊บ",
};

export default async function TaxInvoiceRequestPage({ params }) {
  const resolvedParams = await params;
  const orderId = resolvedParams?.orderId;

  if (!isUuid(orderId)) {
    notFound();
  }

  const auth = await getCustomerAuthContext();
  if (!auth.customerId) {
    return (
      <div className="orders-page">
        <Topbar />
        <Navbar />
        <div className="section">
          <div className="section-title">กรุณาเข้าสู่ระบบก่อนยื่นคำขอใบกำกับภาษี</div>
          <a className="cart-link" href="/auth">
            ไปที่หน้าเข้าสู่ระบบ
          </a>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="orders-page">
      <Topbar />
      <Navbar />
      <div className="section">
        <div className="section-head">
          <div className="section-title-wrap">
            <div className="section-eyebrow">Tax Invoice</div>
            <div className="section-title">ขอใบกำกับภาษีเต็มรูป</div>
          </div>
          <Link className="order-detail-link back" href="/orders">
            กลับไปหน้าสถานะคำสั่งซื้อ
          </Link>
        </div>

        <TaxInvoiceRequestForm orderId={orderId} />
      </div>
      <Footer />
    </div>
  );
}
