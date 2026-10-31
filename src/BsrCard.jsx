import { useEffect, useMemo, useState } from "react";

// BSR history per marketplace (bsr_daily, written daily by UpdateBsrDaily).
// Lower rank = better, so the chart's y axis is inverted (best at the top)
// and log-scaled, since ranks can move between 50 and 500,000.
const API_BASE = "https://amzapi.mandalalifeart.com";
const MP_ORDER = ["US", "CA", "UK", "DE", "FR", "IT", "ES"];
const MP_COLORS = { US: "#1f5fbf", CA: "#c0392b", UK: "#7d3c98", DE: "#222222", FR: "#2e86c1", IT: "#239b56", ES: "#d68910" };
const PERIODS = [30, 90, 365];

function fmt(n) {
  return n == null ? "—" : Number(n).toLocaleString("en-US");
}

function change(points, key, days) {
  if (points.length < 2) return null;
  const last = points[points.length - 1];
  const cutoff = new Date(last.date);
  cutoff.setDate(cutoff.getDate() - days);
  const iso = cutoff.toISOString().slice(0, 10);
  const prev = [...points].reverse().find((p) => p.date <= iso && p[key]);
  if (!prev || !last[key]) return null;
  return ((last[key] - prev[key]) / prev[key]) * 100;
}

function ChangeBadge({ pct }) {
  if (pct == null) return <span style={{ color: "#999" }}>—</span>;
  // rank going down = better
  const better = pct < 0;
  return (
    <span style={{ color: better ? "#1e8449" : pct > 0 ? "#b03a2e" : "#555", fontWeight: 600 }}>
      {better ? "▲" : pct > 0 ? "▼" : ""} {Math.abs(pct).toFixed(0)}%
    </span>
  );
}

function Chart({ series, mps, metric, days }) {
  const W = 1000, H = 260, L = 70, R = 15, T = 12, B = 28;
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - days);
  const lines = mps
    .map((mp) => ({ mp, pts: (series[mp] || []).filter((p) => p[metric] > 0) }))
    .filter((l) => l.pts.length);
  const values = lines.flatMap((l) => l.pts.map((p) => p[metric]));
  if (!values.length) return <div style={{ color: "#777", padding: "20px", textAlign: "center" }}>No rank data</div>;
  let lo = Math.log10(Math.min(...values));
  let hi = Math.log10(Math.max(...values));
  if (hi - lo < 0.3) { lo -= 0.15; hi += 0.15; }
  const x = (d) => L + ((new Date(d) - start) / (end - start)) * (W - L - R);
  const y = (v) => T + ((Math.log10(v) - lo) / (hi - lo)) * (H - T - B); // best (low rank) at top
  const ticks = [];
  for (let e = Math.floor(lo); e <= Math.ceil(hi); e++) {
    for (const m of [1, 2, 5]) {
      const v = m * 10 ** e;
      if (Math.log10(v) >= lo && Math.log10(v) <= hi) ticks.push(v);
    }
  }
  const dateTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => new Date(start.getTime() + f * (end - start)));
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", display: "block" }}>
      {ticks.map((v) => (
        <g key={v}>
          <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} stroke="#eee" />
          <text x={L - 6} y={y(v) + 4} fontSize="11" textAnchor="end" fill="#777">{fmt(v)}</text>
        </g>
      ))}
      {dateTicks.map((d) => (
        <text key={d.getTime()} x={x(d)} y={H - 8} fontSize="11" textAnchor="middle" fill="#777">
          {d.toISOString().slice(5, 10)}
        </text>
      ))}
      {lines.map(({ mp, pts }) => (
        <g key={mp}>
          {pts.length > 1 && (
            <polyline
              fill="none"
              stroke={MP_COLORS[mp]}
              strokeWidth="2"
              points={pts.map((p) => `${x(p.date)},${y(p[metric])}`).join(" ")}
            />
          )}
          {pts.map((p) => (
            <circle key={p.date} cx={x(p.date)} cy={y(p[metric])} r={pts.length > 40 ? 1.5 : 3} fill={MP_COLORS[mp]}>
              <title>{`${mp} ${p.date}: #${fmt(p[metric])} ${metric === "rank" ? p.category : p.sub_category}`}</title>
            </circle>
          ))}
        </g>
      ))}
    </svg>
  );
}

export default function BsrCard({ sku, asin, cardStyle }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [days, setDays] = useState(90);
  const [metric, setMetric] = useState("sub_rank");
  const [hidden, setHidden] = useState({});

  useEffect(() => {
    if (!sku && !asin) return;
    const q = sku ? `sku=${encodeURIComponent(sku)}` : `asin=${encodeURIComponent(asin)}`;
    fetch(`${API_BASE}/GetBsrHistory?${q}&days=365`)
      .then((r) => r.json())
      .then((d) => (d.error ? setError(d.error) : setData(d)))
      .catch((e) => setError(e.message));
  }, [sku, asin]);

  const series = useMemo(() => {
    const since = new Date();
    since.setDate(since.getDate() - days);
    const iso = since.toISOString().slice(0, 10);
    const out = {};
    for (const [mp, pts] of Object.entries(data?.series || {})) out[mp] = pts.filter((p) => p.date >= iso);
    return out;
  }, [data, days]);

  const mps = MP_ORDER.filter((mp) => data?.series?.[mp]?.length);
  const shown = mps.filter((mp) => !hidden[mp]);
  const btn = (active) => ({
    padding: "3px 10px", borderRadius: "12px", border: "1px solid #ccc", cursor: "pointer", fontSize: "12px",
    background: active ? "#1f5fbf" : "#fff", color: active ? "#fff" : "#333",
  });

  return (
    <div style={cardStyle}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", alignItems: "center", marginBottom: "10px" }}>
        <h3 style={{ margin: 0, flex: "1 1 auto" }}>Best Seller Rank</h3>
        <button style={btn(metric === "sub_rank")} onClick={() => setMetric("sub_rank")}>Sub-category</button>
        <button style={btn(metric === "rank")} onClick={() => setMetric("rank")}>Main category</button>
        <span style={{ width: "8px" }} />
        {PERIODS.map((d) => (
          <button key={d} style={btn(days === d)} onClick={() => setDays(d)}>{d}d</button>
        ))}
      </div>
      {error && <div style={{ color: "#b00020" }}>{error}</div>}
      {!error && !data && <div style={{ color: "#777" }}>Loading...</div>}
      {data && !mps.length && <div style={{ color: "#777" }}>No BSR recorded yet (tracked daily since 2026-10-31).</div>}
      {mps.length > 0 && (
        <>
          <Chart series={series} mps={shown} metric={metric} days={days} />
          <div style={{ fontSize: "11px", color: "#888", textAlign: "right" }}>Lower rank = better (top of chart). Log scale.</div>
          <div style={{ overflowX: "auto", marginTop: "8px" }}>
            <table style={{ borderCollapse: "collapse", width: "100%", fontSize: "13px" }}>
              <thead>
                <tr style={{ background: "#f3f3f3" }}>
                  {["", "Sub-category", "Sub rank", "7d", "30d", "Main category", "Rank", "7d", "30d"].map((h, i) => (
                    <th key={i} style={{ padding: "5px 8px", textAlign: i === 0 || i === 1 || i === 5 ? "left" : "right", whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {mps.map((mp) => {
                  const pts = data.series[mp];
                  const last = pts[pts.length - 1];
                  const td = { padding: "5px 8px", borderTop: "1px solid #eee", textAlign: "right" };
                  return (
                    <tr key={mp} style={{ opacity: hidden[mp] ? 0.4 : 1 }}>
                      <td style={{ ...td, textAlign: "left", whiteSpace: "nowrap" }}>
                        <label style={{ cursor: "pointer" }}>
                          <input type="checkbox" checked={!hidden[mp]} onChange={() => setHidden((h) => ({ ...h, [mp]: !h[mp] }))} />
                          <span style={{ color: MP_COLORS[mp], fontWeight: 700, marginLeft: "4px" }}>● {mp}</span>
                        </label>
                      </td>
                      <td style={{ ...td, textAlign: "left" }}>{last.sub_category || "—"}</td>
                      <td style={{ ...td, fontWeight: 700 }}>#{fmt(last.sub_rank)}</td>
                      <td style={td}><ChangeBadge pct={change(pts, "sub_rank", 7)} /></td>
                      <td style={td}><ChangeBadge pct={change(pts, "sub_rank", 30)} /></td>
                      <td style={{ ...td, textAlign: "left" }}>{last.category || "—"}</td>
                      <td style={td}>#{fmt(last.rank)}</td>
                      <td style={td}><ChangeBadge pct={change(pts, "rank", 7)} /></td>
                      <td style={td}><ChangeBadge pct={change(pts, "rank", 30)} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div style={{ fontSize: "11px", color: "#888", marginTop: "4px" }}>
            Last update {mps.map((mp) => data.series[mp].at(-1).date).sort().at(-1)}. Variations of one product share one rank. ▲ green = rank improved.
          </div>
        </>
      )}
    </div>
  );
}
