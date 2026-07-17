import {
  fetchActiveCart,
  fetchActiveCartWithAdmin,
} from "@/lib/supabase/queries";
import { getCustomerAuthContext } from "@/lib/auth/customer";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { formatTHB } from "@/lib/utils/format";
import Topbar from "@/components/Topbar";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

export const metadata = {
  title: "ตะกร้าสินค้า — สวัสดี จิ๊บจิ๊บ",
};

export const dynamic = "force-dynamic";

export default async function CartPage() {
  const auth = await getCustomerAuthContext();
  if (!auth.customerId) {
    return (
      <div className="cart-page">
        <Topbar />
        <Navbar />
        <div className="section">
          <div className="section-title">กรุณาเข้าสู่ระบบเพื่อใช้งานตะกร้า</div>
          <a className="cart-link" href="/auth">
            ไปที่หน้าเข้าสู่ระบบ
          </a>
        </div>
        <Footer />
      </div>
    );
  }

  let cartData = { cart: null, items: [], total: 0 };
  if (auth.mode === "supabase") {
    cartData = await fetchActiveCart(auth.customerId);
  } else if (auth.mode === "line") {
    const admin = createSupabaseAdminClient();
    cartData = await fetchActiveCartWithAdmin(admin, auth.customerId);
  }
  const { cart, items, total } = cartData;

  return (
    <div className="cart-page">
      <Topbar />
      <Navbar />
      <div className="section">
        <div className="section-head">
          <div className="section-title-wrap">
            <div className="section-eyebrow">ตะกร้าสินค้า</div>
            <div className="section-title">ตรวจสอบรายการก่อนชำระเงิน</div>
          </div>
        </div>

        {!cart || items.length === 0 ? (
          <div className="cart-empty">ยังไม่มีสินค้าในตะกร้า</div>
        ) : (
          <div className="cart-grid">
            <div className="cart-items">
              {items.map((item) => (
                <div key={item.id} className="cart-item">
                  <div>
                    <div className="cart-item-title">{item.name}</div>
                    <div className="cart-item-size">ขนาด {item.size}</div>
                  </div>
                  <div className="cart-item-qty">x{item.quantity}</div>
                  <div className="cart-item-price">
                    {formatTHB(item.lineTotal)}
                  </div>
                </div>
              ))}
            </div>
            <div className="cart-summary">
              <div className="cart-summary-row">
                <span>รวมสินค้า</span>
                <strong>{formatTHB(total)}</strong>
              </div>
              <div className="cart-summary-note">
                เลือกรับบริการติดตั้ง/จัดส่ง และจองเวลาในขั้นตอนถัดไป
              </div>
              <a className="cart-checkout" href="/checkout">
                ไปที่ Checkout
              </a>
            </div>
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
}
