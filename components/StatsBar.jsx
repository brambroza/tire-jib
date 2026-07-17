import { stats } from "@/data/home";

export default function StatsBar() {
  return (
    <div className="stats-bar">
      <div className="stats-inner">
        {stats.map((stat) => (
          <div key={stat.label} className="stat">
            <div className="stat-val">{stat.value}</div>
            <div className="stat-label">{stat.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
