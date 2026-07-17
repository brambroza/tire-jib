import { topbarInfo } from "@/data/home";

export default function Topbar() {
  const facebookUrl = String(topbarInfo.facebook || "").trim();
  const facebookLabel = facebookUrl
    ? facebookUrl
        .replace(/^https?:\/\//i, "")
        .replace(/^www\./i, "")
        .replace(/\/+$/, "")
    : "";

  return (
    <div className="topbar">
      <div className="topbar-left">
        <div className="topbar-item">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013 10.79a19.79 19.79 0 01-3.07-8.67A2 2 0 011.92 0h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.09 7.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 14.92z" />
          </svg>
          <strong>{topbarInfo.phone}</strong>
        </div>
        <div className="topbar-item">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
          </svg>
          LINE: <strong>{topbarInfo.line}</strong>
        </div>

        <div className="topbar-item">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 2h-3a5 5 0 00-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 011-1h3z" />
          </svg>
          Facebook:{" "}
          <a className="topbar-link" href={facebookUrl} target="_blank" rel="noreferrer">
            <strong>HiJIBJIB</strong>
          </a>
        </div>

        <div className="topbar-item">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
          {topbarInfo.hours}
        </div>
      </div>
      <span className="topbar-promo">{topbarInfo.promo}</span>
    </div>
  );
}
