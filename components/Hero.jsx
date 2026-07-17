/* import Link from "next/link";
import { heroContent } from "@/data/home";
import HeroSearchCard from "@/components/HeroSearchCard";

export default function Hero({ subtitle }) {
const resolvedSubtitle = subtitle || heroContent.subtitle;

return (
 <section className="hero">
   <div className="hero-inner">
     <div className="hero-left">
       <div className="hero-eyebrow">{heroContent.eyebrow}</div>
       <h1 className="hero-title">
         {heroContent.titleLines[0]}
         <br />
         <span className="accent">{heroContent.titleLines[1]}</span>
         <br />
         <span className="free">{heroContent.titleLines[2]}</span>
       </h1>
       <p className="hero-subtitle">
         {resolvedSubtitle}
         <br />
         <strong>{heroContent.subtitleHighlight}</strong>
       </p>
       <div className="hero-badges">
         {heroContent.badges.map((badge) => (
           <div key={badge.text} className="hero-badge">
             <span className="hero-badge-icon">{badge.icon}</span>
             <span>{badge.text}</span>
           </div>
         ))}
       </div>
       <div className="hero-cta">
         {heroContent.ctas.map((cta) => (
           <Link
             key={cta.label}
             href={cta.href || "/"}
             className={cta.variant === "main" ? "cta-main" : "cta-sec"}
           >
             {cta.label}
           </Link>
         ))}
       </div>
     </div>

     <div className="hero-right">
       <HeroSearchCard />
     </div>
   </div>
 </section>
);
}     */


"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { heroContent, heroMock } from "@/data/home";
import HeroSearchCard from "@/components/HeroSearchCard";

export default function Hero({ subtitle, heroAds = [], promotions = [] }) {
  const resolvedSubtitle = subtitle || heroContent.subtitle;
  const [activeBg, setActiveBg] = useState(0);
  const [mounted, setMounted] = useState(false);

  const safeAds = Array.isArray(heroAds) ? heroAds : [];
  const leftBgImages =
    safeAds.length > 0 ? promotions.map((item) => item.imageUrl).filter(Boolean) : heroMock.leftImages;

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!leftBgImages.length) return undefined;
    const timer = window.setInterval(() => {
      setActiveBg((prev) => (prev + 1) % leftBgImages.length);
    }, 15000);

    return () => window.clearInterval(timer);
  }, [leftBgImages.length]);

  const ctas =
    mounted && heroContent.ctaLabel
      ? [
        {
          label: safeAds[activeBg].ctaLabel,
          href: safeAds[activeBg].ctaHref || "/search",
          variant: "main",
        },
      ]
      : heroContent.ctas;

  return (
    <section className="hero-premium">
      <div className="hero-premium-grid">
        {leftBgImages.map((src, index) => (
          <div
            key={src}
            className={`hero-bg-slide ${index === activeBg ? "active" : ""}`}
            style={{ backgroundImage: `url("${src}")` }}
          />
        ))}
 {/*   <div className="hero-left-overlay" /> */}
       <div className="  hero-panel-left">
       

          <div className="hero-content">


          {/*   <h1 className="hero-title">
              {heroContent.titleLines[0]}
              <br />
              <span className="accent">{heroContent.titleLines[1]}</span>
              <br />
              <span className="free">{heroContent.titleLines[2]}</span>
            </h1> */}

            <div className="hero-cta">
              {ctas.map((cta) => (
                <Link
                  key={`${cta.label}-${cta.href || "/"}`}
                  href={cta.href || "/"}
                  className={cta.variant === "main" ? "cta-main" : "cta-sec"}
                >
                  {cta.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
 
        <div className=" hero-panel-right">


          <div className="hero-search-wrap">
            <HeroSearchCard />
          </div>
        </div>
      </div>
    </section>
  );
}  
