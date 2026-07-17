import { fetchActiveCart, fetchActiveCartWithAdmin } from "@/lib/supabase/queries";
import CheckoutFlow from "@/components/CheckoutFlow";
import CheckoutOrderSummary from "@/components/CheckoutOrderSummary";
import { getCustomerAuthContext } from "@/lib/auth/customer";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const metadata = {
  title: "Checkout — สวัสดี จิ๊บจิ๊บ",
};

const CHECKOUT_SITE_ID = "1df52c4e-2178-400f-9cd6-cb38cf8549a7";

function mapQrCodePath(rawPath, siteId) {
  if (!rawPath) return "";
  const trimmed = String(rawPath).trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;

  const sanitized = trimmed.replace(/^\/+/, "").replace(/^websitebank\/+/, "");
  if (!sanitized) return "";
  if (sanitized.includes("/")) return sanitized;
  return `${siteId}/${sanitized}`;
}

async function resolveSiteQrImageUrl(admin, siteId, qrCodeUrl) {
  const mappedPath = mapQrCodePath(qrCodeUrl, siteId);
  if (/^https?:\/\//i.test(mappedPath)) return mappedPath;

  if (mappedPath) {
    const { data } = admin.storage.from("websitebank").getPublicUrl(mappedPath);
    if (data?.publicUrl) return data.publicUrl;
  }

  const { data: files } = await admin.storage.from("websitebank").list(siteId, {
    limit: 1,
    sortBy: { column: "name", order: "asc" },
  });
  const file = files?.[0];
  if (!file?.name) return "";
  const { data } = admin.storage.from("websitebank").getPublicUrl(`${siteId}/${file.name}`);
  return data?.publicUrl || "";
}

async function fetchSitePaymentAccount(siteId) {
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from("site_payment_accounts")
    .select("account_name, account_number, bank_name, qr_code_url")
    .eq("site_id", siteId)
    .maybeSingle();

  if (!data) return null;

  const qrImageUrl = await resolveSiteQrImageUrl(admin, siteId, data.qr_code_url);
  return {
    accountName: data.account_name || "",
    accountNumber: data.account_number || "",
    bankName: data.bank_name || "",
    qrImageUrl,
  };
}

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

  const [paymentAccount, shippingProvinces] = await Promise.all([
    fetchSitePaymentAccount(CHECKOUT_SITE_ID),
    fetchSiteShippingProvinces(CHECKOUT_SITE_ID),
  ]);

  
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
            <div className="checkout-title">สรุปคำสั่งซื้อ</div>
            <CheckoutOrderSummary initialCart={cartData} />
          </div>
          <div className="checkout-card">
            <div className="checkout-title checkout-title-mobile-hidden">ขั้นตอนการสั่งซื้อ</div>
            <CheckoutFlow
              initialCart={{ ...cartData, shippingProvinces }}
              initialPaymentAccount={paymentAccount}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
