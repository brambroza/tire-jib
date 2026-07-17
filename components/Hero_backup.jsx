import Link from "next/link";
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
}
