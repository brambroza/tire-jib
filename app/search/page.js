import Topbar from "@/components/Topbar";
import Navbar from "@/components/Navbar";
import SearchHeroSection from "@/components/SearchHeroSection";
import ProductSection from "@/components/ProductSection";
import Footer from "@/components/Footer";
import { products as fallbackProducts } from "@/data/home";
import { fetchFeaturedProducts, fetchProductsBySkuIds } from "@/lib/supabase/queries";

export const metadata = {
  title: "ค้นหายาง — สวัสดี จิ๊บจิ๊บ",
};

export default async function SearchPage({ searchParams }) {
  const params = await searchParams;
  const normalize = (value) => (Array.isArray(value) ? value[0] : value);
  const make = normalize(params?.make);
  const model = normalize(params?.model);
  const year = normalize(params?.year);
  const brand = normalize(params?.brand);
  const size = normalize(params?.size);
  const imageIdsRaw = normalize(params?.image_ids);
  const imageIds = String(imageIdsRaw || "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);

  const fetchedProducts =
    imageIds.length > 0
      ? await fetchProductsBySkuIds(imageIds)
      : await fetchFeaturedProducts({
          brand,
          size,
          carMake: make,
          carModel: model,
          year,
        });

  const safeFetched = Array.isArray(fetchedProducts) ? fetchedProducts : [];
  const hasSearch = Boolean(make || model || brand || size || imageIds.length > 0);
  const products = hasSearch
    ? safeFetched
    : safeFetched.length > 0
      ? safeFetched
      : fallbackProducts;
  const emptyText =
    hasSearch && imageIds.length > 0
      ? "ไม่พบสินค้าที่คล้ายจากภาพนี้"
      : hasSearch
        ? "ไม่พบสินค้าที่ตรงกับการค้นหา"
        : "";

  return (
    <div className="search-page">
      <Topbar />
      <Navbar />
      <SearchHeroSection initiallyCollapsed={hasSearch} />
      <ProductSection products={products} emptyText={emptyText} isSearchResult={hasSearch} />
      <Footer />
    </div>
  );
}
