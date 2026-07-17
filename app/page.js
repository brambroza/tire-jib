import Topbar from "@/components/Topbar";
import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import StatsBar from "@/components/StatsBar";
import PromoBanner from "@/components/PromoBanner";
import ProductSection from "@/components/ProductSection";
import SearchBySize from "@/components/SearchBySize";
import ZeroStrip from "@/components/ZeroStrip";
import Services from "@/components/Services";
import HowItWorks from "@/components/HowItWorks";
import Brands from "@/components/Brands";
import Footer from "@/components/Footer";
import LineFloat from "@/components/LineFloat";
import {
  products as fallbackProducts,
  promoItems as fallbackPromos,
  brands as fallbackBrands,
} from "@/data/home";
import {
  fetchFeaturedProducts,
  fetchProductBrands,
  fetchPromotions,
  fetchSiteHeroAds,
} from "@/lib/supabase/queries";

export default async function Home({ searchParams }) {
  const params = await searchParams;
  const normalize = (value) => (Array.isArray(value) ? value[0] : value);
  const make = normalize(params?.make);
  const model = normalize(params?.model);
  const year = normalize(params?.year);
  const brand = normalize(params?.brand);
  const size = normalize(params?.size);
  const [fetchedProducts, fetchedPromos, fetchedBrands, heroAds] =
    await Promise.all([
      fetchFeaturedProducts({
        brand,
        size,
        carMake: make,
        carModel: model,
        year,
      }),
      fetchPromotions(),
      fetchProductBrands(),
      fetchSiteHeroAds(),
    ]);

  const safePromos = Array.isArray(fetchedPromos) ? fetchedPromos : [];
  const safeFetched = Array.isArray(fetchedProducts) ? fetchedProducts : [];
  const hasSearch = Boolean(make || model || year || brand || size);

  const products = hasSearch
    ? safeFetched
    : safeFetched.length > 0
      ? safeFetched
      : fallbackProducts;
  const emptyText = hasSearch ? "ไม่พบสินค้าที่ตรงกับการค้นหา" : "";
  const promos = safePromos.length > 0 ? safePromos : fallbackPromos;
  const safeBrands = Array.isArray(fetchedBrands) ? fetchedBrands : [];
  const brands = safeBrands.length > 0 ? safeBrands : fallbackBrands;
  const heroSubtitle =
    brands.length > 0
      ? `คัดแบรนด์มาตรฐาน ${brands.slice(0, 4).join(" · ")} พร้อมรับประกันและบริการหลังการขายชัดเจน`
      : "คัดแบรนด์มาตรฐาน Bridgestone · Michelin · Maxxis · Austone พร้อมรับประกันชัดเจน";

  
  return (
    <div className="page">
      <Topbar />
      <Navbar />
      <Hero
        subtitle={heroSubtitle}
        heroAds={heroAds}
        promotions={promos.filter((e) => e.is_banner === true)}
      />
      <StatsBar />
      <PromoBanner promoItems={promos.filter((e) => e.is_banner === false)} />
   {/*    <ProductSection
        products={products}
        emptyText={emptyText}
        isSearchResult={hasSearch}
      /> */}
     {/*  <SearchBySize /> */}
   {/*    <ZeroStrip />
      <Services /> */}
      <HowItWorks />
    {/*   <Brands brands={brands} /> */}
      <Footer />
      <LineFloat />
    </div>
  );
}
