import { fetchActiveCart, fetchActiveCartWithAdmin } from "@/lib/supabase/queries";
import CheckoutFlow from "@/components/CheckoutFlow";
import CheckoutOrderSummary from "@/components/CheckoutOrderSummary";
import { getCustomerAuthContext } from "@/lib/auth/customer";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { CHECKOUT_SITE_ID } from "@/lib/payments/site-payment-account";

export const metadata = {
  title: "Checkout — สวัสดี จิ๊บจิ๊บ",
};

/**
 * Load active shipping provinces and their fees for the checkout site.
 * @param {string} siteId
 * @returns {Promise<Array<{province: string, shippingFee: number}>>}
 */
async function fetchSiteShippingProvinces(siteId) {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("site_shipping_provinces")
    .select("province, shipping_fee")
    .eq("site_id", siteId)
    .eq("active", true)
    .order("province", { ascending: true });

  if (error) {
    console.error("fetchSiteShippingProvinces error:", error);
    return [];
  }

  return (Array.isArray(data) ? data : []).map((row) => ({
    province: typeof row?.province === "string" ? row.province.trim() : "",
    shippingFee: Number(row?.shipping_fee || 0),
  }));
}

export default async function CheckoutPage() {
  const auth = await getCustomerAuthContext();

  if (!auth.customerId) {
    return (
      <div className="checkout-page">
        <div className="section">
          <div className="section-title">กรุณาเข้าสู่ระบบก่อนทำรายการ</div>
          <a className="cart-link" href="/auth">
            ไปที่หน้าเข้าสู่ระบบ
          </a>
        </div>
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

  const shippingProvinces = await fetchSiteShippingProvinces(CHECKOUT_SITE_ID);

  return (
    <div className="checkout-page">
      <div className="section">
        <div className="section-head">
          <div className="section-title-wrap">
            <div className="section-eyebrow">Checkout</div>
            <div className="section-title">ยืนยันรายการและจองคิวช่าง</div>
          </div>
          <a className="btn-see-all" href="/search">
            เลือกสินค้าเพิ่ม
          </a>
        </div>
        <div className="checkout-grid">
          <div className="checkout-card">
            <CheckoutOrderSummary initialCart={cartData} />
          </div>
          <div className="checkout-card">
            <div className="checkout-title checkout-title-mobile-hidden">ขั้นตอนการสั่งซื้อ</div>
            <CheckoutFlow initialCart={{ ...cartData, shippingProvinces }} />
          </div>
        </div>
      </div>
    </div>
  );
}
