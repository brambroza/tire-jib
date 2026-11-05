import { Suspense } from "react";
import LineQuickOrder from "@/components/LineQuickOrder";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "กำลังเพิ่มสินค้าลงตะกร้า — สวัสดี จิ๊บจิ๊บ",
  robots: { index: false, follow: false },
};

/**
 * Landing page for the "สั่งซื้อสินค้า" button on LINE product cards:
 * /line/order?sku=<uuid>&qty=<n>&n=<nonce>
 * Adds the SKU to the cart (logging in with LINE first if needed) then opens /cart.
 */
export default function LineOrderPage() {
  return (
    <div className="auth-page">
      <Suspense fallback={<div className="auth-status info">กำลังเตรียมรายการ...</div>}>
        <LineQuickOrder />
      </Suspense>
    </div>
  );
}
