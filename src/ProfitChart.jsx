import { useEffect, useState } from "react";

// Profitability per month on the product page (GetProductProfitMonthly, per the
// user 2026-11-02): profit bars (green / red) next to net sales, margin line.
// Same formula as "Totals per period" (incl. the SB share). All marketplaces, USD.
const API_BASE = "https://amzapi.mandalalifeart.com";
const money = (v) => (v == null ? "—" : `$${Math.round(v).toLocaleString("en-US")}`);
const COSTS = [
  ["fees", "Amazon fees"],
  ["productCost", "Product cost"],
  ["ads", "SP+SD ads"],
  ["sbAds", "SB share"],
  ["returns", "Returns"],
  ["storage", "FBA storage"],
  ["awd", "AWD"],
];

export default function ProfitChart({ sku, asin, cardStyle }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [hover, setHover] = useState(null);

  useEffect(() => {
    if (!sku && !asin) return;
    const q = sku ? `sku=${encodeURIComponent(sku)}` : `asin=${encodeURIComponent(asin)}`;
    fetch(`${API_BASE}/GetProductProfitMonthly?${q}&months=12`)
      .then((r) => r.json())
      .then((d) => (d.error ? setError(d.error) : setData(d)))
      .catch((e) => setError(e.message));
  }, [sku, asin]);

  const months = data?.months || [];
  const W = 1000, H = 280, L = 64, R = 50, T = 14, B = 34;
  const max = Math.max(1, ...months.map((m) => m.netSales), ...months.map((m) => m.profit));
  const min = Math.min(0, ...months.map((m) => m.profit));
  const y = (v) => T + ((max - v) / (max - min)) * (H - T - B);
  const slot = (W - L - R) / Math.max(months.length, 1);
  const bw = slot * 0.32;
  const margins = months.map((m) => m.margin).filter((v) => v != null);
  const mMax = Math.max(40, ...margins), mMin = Math.min(-20, ...margins);
  const ym = (v) => T + ((mMax - v) / (mMax - mMin)) * (H - T - B);
  const ticks = 5;
  const h = hover != null ? months[hover] : null;
  const totals = months.reduce(
    (t, m) => (m.adsData && !m.partial ? { profit: t.profit + m.profit, net: t.net + m.netSales } : t),
    { profit: 0, net: 0 }
  );

  return (
    <div style={cardStyle}>
      <h3 style={{ marginTop: 0 }}>Profitability per month (USD, all marketplaces)</h3>
      {error && <div style={{ color: "#b00020" }}>{error}</div>}
      {!error && !data && <div style={{ color: "#777" }}>Loading...</div>}
      {months.length > 0 && (
        <>
          <div style={{ fontSize: "13px", marginBottom: "6px" }}>
            {totals.net > 0 && (
              <span>
                Full months with ad data: profit <b style={{ color: totals.profit < 0 ? "#b03a2e" : "#1e8449" }}>{money(totals.profit)}</b> on{" "}
                {money(totals.net)} net sales ({((totals.profit / totals.net) * 100).toFixed(1)}%)
              </span>
            )}
            <span style={{ marginLeft: "14px" }}>
              <span style={{ display: "inline-block", width: 10, height: 10, background: "#d6e4f5", marginRight: 4 }} />Net sales
              <span style={{ display: "inline-block", width: 10, height: 10, background: "#1e8449", margin: "0 4px 0 12px" }} />Profit
              <span style={{ display: "inline-block", width: 14, height: 2, background: "#d68910", margin: "0 4px 3px 12px" }} />Margin %
            </span>
          </div>
          <div style={{ position: "relative" }}>
            <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", display: "block" }} onMouseLeave={() => setHover(null)}>
              {Array.from({ length: ticks + 1 }, (_, i) => min + ((max - min) * i) / ticks).map((v) => (
                <g key={v}>
                  <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} stroke="#eee" />
                  <text x={L - 6} y={y(v) + 4} textAnchor="end" fontSize="11" fill="#777">{money(v)}</text>
                </g>
              ))}
              <line x1={L} x2={W - R} y1={y(0)} y2={y(0)} stroke="#999" />
              {[mMin, 0, mMax].map((v) => (
                <text key={v} x={W - R + 6} y={ym(v) + 4} fontSize="11" fill="#d68910">{v.toFixed(0)}%</text>
              ))}
              {months.map((m, i) => {
                const x = L + slot * i + slot / 2;
                const faded = !m.adsData || m.partial;
                return (
                  <g key={m.month} opacity={faded ? 0.45 : 1} onMouseEnter={() => setHover(i)}>
                    <rect x={L + slot * i} y={T} width={slot} height={H - T - B} fill={hover === i ? "#f4f7fb" : "transparent"} />
                    <rect x={x - bw - 1} y={y(m.netSales)} width={bw} height={Math.max(0, y(0) - y(m.netSales))} fill="#d6e4f5" />
                    <rect
                      x={x + 1}
                      y={m.profit >= 0 ? y(m.profit) : y(0)}
                      width={bw}
                      height={Math.abs(y(m.profit) - y(0))}
                      fill={m.profit >= 0 ? "#1e8449" : "#b03a2e"}
                    />
                    <text x={x} y={H - B + 14} textAnchor="middle" fontSize="11" fill="#555">
                      {m.month.slice(2)}{m.partial ? "*" : ""}
                    </text>
                  </g>
                );
              })}
              <polyline
                fill="none"
                stroke="#d68910"
                strokeWidth="2"
                points={months
                  .map((m, i) => (m.margin == null ? null : `${L + slot * i + slot / 2},${ym(m.margin)}`))
                  .filter(Boolean)
                  .join(" ")}
              />
              {months.map((m, i) =>
                m.margin == null ? null : <circle key={m.month} cx={L + slot * i + slot / 2} cy={ym(m.margin)} r="3" fill="#d68910" />
              )}
            </svg>
            {h && (
              <div
                style={{
                  position: "absolute", top: 8, left: hover < months.length / 2 ? "55%" : "8%", background: "#fff",
                  border: "1px solid #ccc", borderRadius: 6, padding: "8px 10px", fontSize: "12px", boxShadow: "0 2px 6px rgba(0,0,0,.12)",
                  pointerEvents: "none", minWidth: 200,
                }}
              >
                <b>{h.month}</b>{h.partial ? " (so far)" : ""} · {h.units} units
                <div>Sales {money(h.sales)} · net {money(h.netSales)}</div>
                {COSTS.map(([k, label]) => (h[k] ? <div key={k} style={{ color: "#555" }}>− {label} {money(h[k])}</div> : null))}
                <div style={{ fontWeight: 700, color: h.profit < 0 ? "#b03a2e" : "#1e8449" }}>
                  Profit {money(h.profit)} {h.margin != null ? `(${h.margin}%)` : ""}
                </div>
                {h.tacos != null && <div style={{ color: "#555" }}>TACOS {h.tacos}%</div>}
                {!h.adsData && <div style={{ color: "#b9770e" }}>No ad spend data for this month - profit too high</div>}
              </div>
            )}
          </div>
          <div style={{ fontSize: "11px", color: "#888", marginTop: "4px" }}>
            Profit = net sales − Amazon fees − product cost − SP+SD ads − SB share − returns − FBA storage − AWD (same as Totals per period).
            Faded = month without ad data (before 2026) or the current month (*). Hover a month for the breakdown.
          </div>
        </>
      )}
    </div>
  );
}
