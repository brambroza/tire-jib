"use client";

import { useEffect, useMemo, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

const AUTO_PLAY_MS = 4500;
const TRUST_ITEMS = [
  { title: "ติดตั้งถึงบ้าน ตามวันเวลาที่นัด", detail: "เลือกคิวสะดวกได้ล่วงหน้า พร้อมทีมงานเข้าบริการตรงเวลา" },
  { title: "ช่างได้รับการรับรอง มาตรฐานงานชัดเจน", detail: "ตรวจเช็กหน้างานและติดตั้งตามขั้นตอน เพื่อความมั่นใจทุกระยะทาง" },
  { title: "แจ้งเตือน LINE ทุกขั้นตอนของออเดอร์", detail: "ตั้งแต่ยืนยันคำสั่งซื้อ ตรวจสอบชำระเงิน จนถึงงานติดตั้งเสร็จ" },
];

function buildPromoTitle(item) {
  const base = String(item?.text || "โปรโมชั่นพิเศษ").trim();
  const highlight = String(item?.highlight || "").trim();
  if (!highlight) return base;
  return `${base} | ${highlight}`.trim();
}

export default function PromoBanner({ promoItems = [] }) {

 
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const slides = useMemo(() => {
    const list = Array.isArray(promoItems) ? promoItems : [];
    return list
      .map((item, index) => ({
        id: `${item?.id || index}`,
        title: buildPromoTitle(item),
        message: String(
          item?.tail ||
            item?.message ||
            "ข้อเสนอที่คัดมาแล้ว พร้อมเงื่อนไขรับประกันและการดูแลหลังการขายชัดเจน"
        ).trim(),
        tag: item?.highlight ? "ข้อเสนอคุ้มค่า" : "ข้อเสนอที่เชื่อถือได้",
        imageUrl: item?.imageUrl ?? "",
      }))
      .filter((slide) => slide.title);
  }, [promoItems]);

  const [activeIndex, setActiveIndex] = useState(0);
  const [bucketImageMap, setBucketImageMap] = useState({});

  useEffect(() => {
    setActiveIndex(0);
  }, [slides.length]);

  useEffect(() => {
    if (slides.length <= 1) return undefined;
    const timer = window.setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % slides.length);
    }, AUTO_PLAY_MS);
    return () => window.clearInterval(timer);
  }, [slides.length]);

  useEffect(() => {
    let cancelled = false;

    const loadBucketImages = async () => {
      const bucket = supabase.storage.from("promotions");
      const entries = await Promise.all(
        slides.map(async (slide) => {


          const publicUrl = slide.imageUrl || "";
          return [slide.id, publicUrl];
        })
      );

      if (cancelled) return;
      const nextMap = {};
      entries.forEach(([id, url]) => {
        if (id && url) nextMap[id] = url;
      });
      setBucketImageMap(nextMap);
    };

    if (slides.length > 0) {
      loadBucketImages();
    } else {
      setBucketImageMap({});
    }

    return () => {
      cancelled = true;
    };
  }, [slides, supabase]);

  if (!slides.length) return null;

  const safeIndex = Math.min(activeIndex, slides.length - 1);
  const active = slides[safeIndex];
  const activeImageUrl = bucketImageMap[active.id] || "";

  const goNext = () => setActiveIndex((prev) => (prev + 1) % slides.length);
  const goPrev = () => setActiveIndex((prev) => (prev - 1 + slides.length) % slides.length);

  return (
    <section className="promo-carousel" aria-label="โปรโมชั่นล่าสุด">
      <div className="promo-carousel-inner">
        <div className="promo-carousel-content">
          <div className="promo-carousel-tag">{active.tag}</div>
          <h3 className="promo-carousel-title">{active.title}</h3>
          <p className="promo-carousel-desc">{active.message}</p>
          {slides.length > 1 && (
            <div className="promo-carousel-dots" role="tablist" aria-label="เลือกโปรโมชั่น">
              {slides.map((slide, index) => (
                <button
                  key={slide.id}
                  type="button"
                  className={`promo-carousel-dot ${index === safeIndex ? "active" : ""}`}
                  aria-label={`โปรโมชั่นลำดับที่ ${index + 1}`}
                  aria-selected={index === safeIndex}
                  onClick={() => setActiveIndex(index)}
                />
              ))}
            </div>
          )}
        </div>
        <div className="promo-carousel-media">
          {activeImageUrl ? (
            <img src={activeImageUrl} alt={active.title} className="promo-carousel-image" />
          ) : (
            <div className="promo-carousel-image promo-carousel-fallback" aria-hidden="true" />
          )}
        </div>

        {slides.length > 1 && (
          <>
            <button className="promo-carousel-nav prev" type="button" onClick={goPrev} aria-label="โปรโมชั่นก่อนหน้า">
              ‹
            </button>
            <button className="promo-carousel-nav next" type="button" onClick={goNext} aria-label="โปรโมชั่นถัดไป">
              ›
            </button>
          </>
        )}
      </div>
      <div className="promo-trust-strip" aria-label="จุดเด่นความน่าเชื่อถือ">
        {TRUST_ITEMS.map((item) => (
          <div key={item.title} className="promo-trust-item">
            <div className="promo-trust-title">{item.title}</div>
            <div className="promo-trust-detail">{item.detail}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
