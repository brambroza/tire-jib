import { notFound } from "next/navigation";
import Topbar from "@/components/Topbar";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import ProductDetailAddToCartButton from "@/components/ProductDetailAddToCartButton";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatTHB } from "@/lib/utils/format";
import { getSiteAndGroupId, getProductBadges } from "@/lib/supabase/queries";

export const metadata = {
  title: "รายละเอียดสินค้า — สวัสดี จิ๊บจิ๊บ",
};

function formatSize(row) {
  if (!row) return "";
  if (row.width_mm && row.aspect_ratio && row.rim_inch) {
    return `${row.width_mm}/${row.aspect_ratio}R${row.rim_inch}`;
  }
  return row.size_label ?? "";
}
/* 
export default async function ProductDetailPage({ params }) {
  const resolvedParams = await params;
  const id = resolvedParams?.id;
  const supabase = await createSupabaseServerClient();
  const { data: sku } = await supabase
    .from("skus")
    .select(
      `
      id,
      size_label,
      width_mm,
      aspect_ratio,
      rim_inch,
      product:products(
        brand,
        name,
        description,
        remark
      ),
      inventory:inventory(qty_on_hand)
    `,
    )
    .eq("id", id)
    .maybeSingle();

  if (!sku) {
    notFound();
  }

  const { data: prices } = await supabase
    .from("prices")
    .select("price, group_id")
    .eq("sku_id", sku.id);

  const price = prices?.[0]?.price ?? 0;
  const qty = sku.inventory?.qty_on_hand ?? 0;

  let imageSrc = "";
  try {
    const { data: files } = await supabase.storage
      .from("tires")
      .list(sku.id, { limit: 1 });
    const file = files?.[0]?.name;
    if (file && process.env.NEXT_PUBLIC_SUPABASE_URL) {
      imageSrc = `${process.env.NEXT_PUBLIC_SUPABASE_URL.replace(/\/$/, "")}/storage/v1/object/public/tires/${sku.id}/${file}`;
    }
  } catch {
    imageSrc = "";
  }

  return (
    <div className="product-detail-page">
      <Topbar />
      <Navbar />
      <div className="product-detail">
        <div className="product-detail-media">
          {imageSrc ? (
            <img
              className="product-detail-img"
              src={imageSrc}
              alt={`${sku.product?.brand} ${sku.product?.name}`}
            />
          ) : (
            <div className="product-detail-placeholder">ไม่มีรูปสินค้า</div>
          )}
        </div>
        <div className="product-detail-info">
          <div className="product-detail-brand">{sku.product?.brand}</div>
          <div className="product-detail-name">{formatSize(sku)} </div>
          <div className="product-detail-size">{sku.product?.name}</div>
          <div className="product-detail-price-wrap">
            <div className="product-detail-price">{formatTHB(price)}</div>
            <div
              className={`product-detail-stock ${qty > 0 ? "in-stock" : ""}`}
            >
              {qty > 0 ? `พร้อมส่งในสต็อก ${qty} เส้น` : "สินค้าหมดชั่วคราว"}
            </div>
          </div>
          <div className="product-detail-desc">
            {sku.product?.description ||
              "ยางคุณภาพดี พร้อมรายละเอียดเพิ่มเติมเร็วๆ นี้"}
          </div>
          {sku.product?.remark ? (
            <div className="product-detail-desc">{sku.product.remark}</div>
          ) : (
            <div className="product-detail-desc">
              ยังไม่มีรายละเอียดเพิ่มเติมสำหรับสินค้านี้
            </div>
          )}
          <ProductDetailAddToCartButton
            skuId={sku.id}
            disabled={qty <= 0}
            maxQuantity={qty}
          />
        </div>
      </div>
      <Footer />
    </div>
  );
} */

export default async function ProductDetailPage({ params }) {
  const resolvedParams = await params;
  const id = resolvedParams?.id;

  const supabase = await createSupabaseServerClient();
  const { siteId, groupId } = await getSiteAndGroupId(supabase);

  if (!id || !siteId || !groupId) {
    notFound();
  }

  const { data: sku, error } = await supabase
    .rpc("get_product_detail", {
      p_sku_id: id,
      p_site_id: siteId,
      p_group_id: groupId,
    })
    .maybeSingle();

  if (error) {
    console.error("get_product_detail error:", error);
    notFound();
  }

  if (!sku) {
    notFound();
  }

  const price = Number(sku.price ?? 0);
  const oldPrice = Number(sku.old_price ?? 0);
  const qty = Number(sku.qty_on_hand ?? 0);

  const badge = getProductBadges({
    qty_on_hand: qty,
    price,
    old_price: oldPrice,
    is_hot: sku.is_hot,
    is_new: sku.is_new,
    is_promotion: sku.is_promotion,
    total_sold: sku.total_sold,
  });

  let imageSrc = "";

  try {
    const { data: files } = await supabase.storage
      .from("tires")
      .list(sku.id, { limit: 1 });

    const file = files?.[0]?.name;

    if (file && process.env.NEXT_PUBLIC_SUPABASE_URL) {
      imageSrc = `${process.env.NEXT_PUBLIC_SUPABASE_URL.replace(
        /\/$/,
        "",
      )}/storage/v1/object/public/tires/${sku.id}/${file}`;
    }
  } catch {
    imageSrc = "";
  }

  return (
    <div className="product-detail-page">
      <Topbar />
      <Navbar />

      <div className="product-detail">
        <div className="product-detail-media">
          {imageSrc ? (
            <img
              className="product-detail-img"
              src={imageSrc}
              alt={`${sku.brand} ${sku.product_name}`}
            />
          ) : (
            <div className="product-detail-placeholder">ไม่มีรูปสินค้า</div>
          )}
        </div>

        <div className="product-detail-info">
          <div className="product-detail-brand">{sku.brand}</div>

          <div className="product-detail-name">{formatSize(sku)}</div>

          <div className="product-detail-size">{sku.product_name}</div>

          <div className="product-detail-price-wrap">
            {oldPrice > price ? (
              <div className="product-detail-old-price">
                {formatTHB(oldPrice)}
              </div>
            ) : null}

            <div className="product-detail-price">{formatTHB(price)}</div>

            <div
              className={`product-detail-stock ${qty > 0 ? "in-stock" : ""}`}
            >
              {qty > 0 ? `พร้อมส่งในสต็อก ${qty} เส้น` : "สินค้าหมดชั่วคราว"}
            </div>
            {badge ? (
              <div className={`product-detail-stock product-badge-${badge.variant}`}>
                {badge.label}
              </div>
            ) : null}
          </div>

          <div className="product-detail-desc">
            {sku.description || "ยางคุณภาพดี พร้อมรายละเอียดเพิ่มเติมเร็วๆ นี้"}
          </div>

          {sku.remark ? (
            <div className="product-detail-desc">{sku.remark}</div>
          ) : (
            <div className="product-detail-desc">
              ยังไม่มีรายละเอียดเพิ่มเติมสำหรับสินค้านี้
            </div>
          )}

          <ProductDetailAddToCartButton skuId={sku.id} disabled={qty <= 0} />
        </div>
      </div>

      <Footer />
    </div>
  );
}
