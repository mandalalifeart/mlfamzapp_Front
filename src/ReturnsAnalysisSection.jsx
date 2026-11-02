import { Fragment, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

// Why do products come back (GetReturnsAnalysis, per the user 2026-11-02):
// return rate per product per region vs its product type, "why" themes read
// from the customer comments (keywords) or Amazon's reason code, themes per
// month, reason × product type matrix. Click a product for all its returns.
const LOCAL_API_BASE = "https://amzapi.mandalalifeart.com";
const THEME_COLORS = {
  "Thought it was stuffed / cover only": "#c0392b",
  Size: "#d68910",
  "Colour / looks different from photo": "#8e44ad",
  "Quality / defect": "#7b241c",
  "Fabric / feel": "#2e86c1",
  "Delivery / arrived late or damaged": "#7f8c8d",
  "Changed mind / not needed": "#a9cce3",
  "Not as described (no detail)": "#f5b7b1",
  "No reason given": "#d5d8dc",
  Other: "#eaeded",
};
const PERIODS = [
  ["90", "Last 90 days"],
  ["180", "Last 180 days"],
  ["365", "Last 12 months"],
];

const card = (extra = {}) => ({ background: "#fff", border: "1px solid #ddd", borderRadius: "8px", padding: "16px", margin: "0 16px 20px", ...extra });
const cell = (extra = {}) => ({ border: "1px solid #ddd", padding: "5px 8px", textAlign: "left", fontSize: "13px", ...extra });
const num = (extra = {}) => cell({ textAlign: "right", whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums", ...extra });
const TH = { background: "#f4f4f4" };

function rateColor(rate, typeRate) {
  if (rate == null) return undefined;
  if (typeRate && rate >= 2 * typeRate) return "#b03a2e";
  if (typeRate && rate >= 1.3 * typeRate) return "#b9770e";
  return undefined;
}

function ProductReturns({ asin, region, start, end }) {
  const [rows, setRows] = useState(null);
  useEffect(() => {
    fetch(`${LOCAL_API_BASE}/GetReturnsForProduct?asin=${asin}&region=${region}&start=${start}&end=${end}`)
      .then((r) => r.json())
      .then((d) => setRows(d.returns || []))
      .catch(() => setRows([]));
  }, [asin, region, start, end]);
  if (!rows) return <div style={{ padding: "6px 16px", color: "#777" }}>Loading...</div>;
  return (
    <table style={{ borderCollapse: "collapse", margin: "6px 0 6px 16px", width: "calc(100% - 16px)" }}>
      <thead>
        <tr>
          <th style={cell(TH)}>Date</th>
          <th style={cell(TH)}>Reason</th>
          <th style={cell(TH)}>Why (theme)</th>
          <th style={cell(TH)}>Customer comment</th>
          <th style={cell(TH)}>Came back as</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i}>
            <td style={cell({ whiteSpace: "nowrap" })}>{r.return_date?.slice(0, 10)}</td>
            <td style={cell({ fontSize: "12px" })}>{r.reason}</td>
            <td style={cell({ fontSize: "12px" })}>
              <span style={{ display: "inline-block", width: 9, height: 9, background: THEME_COLORS[r.theme] || "#ccc", marginRight: 4 }} />
              {r.theme}
            </td>
            <td style={cell({ fontSize: "12px", maxWidth: "460px" })}>{(r.customer_comments || "").replaceAll("|", " · ")}</td>
            <td style={cell({ fontSize: "12px" })}>{r.detailed_disposition}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function ThemesChart({ byMonth }) {
  const months = Object.keys(byMonth || {});
  const themes = Object.keys(THEME_COLORS).filter((t) => months.some((m) => byMonth[m][t]));
  if (!months.length) return null;
  const W = 1000, H = 240, L = 40, R = 10, T = 10, B = 26;
  const totals = months.map((m) => Object.values(byMonth[m]).reduce((s, v) => s + v, 0));
  const max = Math.max(1, ...totals);
  const slot = (W - L - R) / months.length;
  const y = (v) => T + (1 - v / max) * (H - T - B);
  return (
    <>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", display: "block" }}>
        {[0, 0.5, 1].map((f) => (
          <g key={f}>
            <line x1={L} x2={W - R} y1={y(max * f)} y2={y(max * f)} stroke="#eee" />
            <text x={L - 4} y={y(max * f) + 4} textAnchor="end" fontSize="11" fill="#777">{Math.round(max * f)}</text>
          </g>
        ))}
        {months.map((m, i) => {
          let acc = 0;
          return (
            <g key={m}>
              {themes.map((t) => {
                const v = byMonth[m][t] || 0;
                if (!v) return null;
                const y0 = y(acc), y1 = y(acc + v);
                acc += v;
                return (
                  <rect key={t} x={L + slot * i + slot * 0.15} width={slot * 0.7} y={y1} height={y0 - y1} fill={THEME_COLORS[t]}>
                    <title>{`${m} · ${t}: ${v}`}</title>
                  </rect>
                );
              })}
              <text x={L + slot * i + slot / 2} y={H - 8} textAnchor="middle" fontSize="11" fill="#555">{m.slice(2)}</text>
            </g>
          );
        })}
      </svg>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", fontSize: "12px", marginTop: "4px" }}>
        {themes.map((t) => (
          <span key={t}>
            <span style={{ display: "inline-block", width: 10, height: 10, background: THEME_COLORS[t], marginRight: 4 }} />
            {t}
          </span>
        ))}
      </div>
    </>
  );
}

export default function ReturnsAnalysisSection() {
  const [days, setDays] = useState("90");
  const [region, setRegion] = useState("");
  const [type, setType] = useState("");
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(null);
  const [minReturns, setMinReturns] = useState(3);

  const end = useMemo(() => new Date(Date.now() - 86400000).toISOString().slice(0, 10), []);
  const start = useMemo(() => new Date(Date.now() - 86400000 * (Number(days) + 1) + 86400000).toISOString().slice(0, 10), [days]);

  useEffect(() => {
    setLoading(true);
    const q = new URLSearchParams({ start, end, region, type });
    fetch(`${LOCAL_API_BASE}/GetReturnsAnalysis?${q}`)
      .then((r) => r.json())
      .then((d) => (d.error ? setError(d.error) : (setData(d), setError(""))))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [start, end, region, type]);

  const products = (data?.products || []).filter((p) => p.returned >= minReturns);
  const matrixTypes = useMemo(() => [...new Set(Object.values(data?.matrix || {}).flatMap((o) => Object.keys(o)))].sort(), [data]);
  const matrixRows = Object.entries(data?.matrix || {}).sort((a, b) => Object.values(b[1]).reduce((s, v) => s + v, 0) - Object.values(a[1]).reduce((s, v) => s + v, 0));

  return (
    <>
      <div style={card()}>
        <h3 style={{ marginTop: 0 }}>Why do products come back?</h3>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "12px", alignItems: "center", fontSize: "13px", marginBottom: "10px" }}>
          <select value={days} onChange={(e) => setDays(e.target.value)}>
            {PERIODS.map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
          <select value={region} onChange={(e) => setRegion(e.target.value)}>
            <option value="">All regions</option>
            <option value="USA">USA</option>
            <option value="EU">EU</option>
            <option value="UK">UK</option>
          </select>
          <select value={type} onChange={(e) => setType(e.target.value)}>
            <option value="">All product types</option>
            {(data?.types || []).map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          <span style={{ color: "#666" }}>{start} → {end}</span>
        </div>
        {error && <div style={{ color: "#b00020" }}>{error}</div>}
        {loading && <div style={{ color: "#777" }}>Loading...</div>}
        {!loading && data && (
          <div style={{ display: "flex", gap: "24px", flexWrap: "wrap" }}>
            {Object.entries(data.overall || {}).map(([reg, o]) => (
              <div key={reg}>
                <div style={{ fontSize: "22px", fontWeight: 700, color: o.rate > data.goalPct ? "#b03a2e" : "#1e8449" }}>{o.rate ?? "–"}%</div>
                <div style={{ fontSize: "11px", color: "#888" }}>
                  {reg}: {o.returned} of {o.sold} sold (goal {data.goalPct}%)
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {!loading && data && (
        <>
          <div style={card()}>
            <h3 style={{ marginTop: 0, fontSize: "15px" }}>Why - themes per month (units)</h3>
            <ThemesChart byMonth={data.themesByMonth} />
            <div style={{ fontSize: "11px", color: "#888", marginTop: "6px" }}>
              Theme = keywords in the customer&apos;s comment (EN/DE/FR/IT/ES), otherwise Amazon&apos;s reason code. If a theme drops after a listing fix, the fix worked.
            </div>
          </div>

          <div style={card()}>
            <div style={{ display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap", marginBottom: "8px" }}>
              <h3 style={{ margin: 0, fontSize: "15px", flex: "1 1 auto" }}>Products</h3>
              <label style={{ fontSize: "13px" }}>
                min. returns{" "}
                <input type="number" min="0" value={minReturns} onChange={(e) => setMinReturns(Number(e.target.value) || 0)} style={{ width: "50px" }} />
              </label>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ borderCollapse: "collapse", width: "100%", minWidth: "900px" }}>
                <thead>
                  <tr>
                    <th style={cell(TH)}>Product</th>
                    <th style={cell(TH)}>Type</th>
                    <th style={cell(TH)}>Region</th>
                    <th style={num(TH)}>Sold</th>
                    <th style={num(TH)}>Returned</th>
                    <th style={num(TH)} title="Returned ÷ sold in the same period">Rate</th>
                    <th style={num(TH)} title="Average rate of this product type in this region">Type rate</th>
                    <th style={num(TH)} title="Came back sellable">Sellable</th>
                    <th style={cell(TH)}>Top reason</th>
                    <th style={cell(TH)}>Why (top themes)</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((p) => {
                    const k = `${p.asin}|${p.region}`;
                    const themes = Object.entries(p.themes || {}).sort((a, b) => b[1] - a[1]).slice(0, 3);
                    return (
                      <Fragment key={k}>
                        <tr onClick={() => setOpen(open === k ? null : k)} style={{ cursor: "pointer", background: open === k ? "#eef3fb" : undefined }}>
                          <td style={cell({ fontWeight: 600 })}>
                            <Link to={`/product?sku=${encodeURIComponent(p.sku)}`} onClick={(e) => e.stopPropagation()} style={{ color: "inherit" }}>
                              {p.sku}
                            </Link>
                          </td>
                          <td style={cell({ fontSize: "12px" })}>{p.type}</td>
                          <td style={cell()}>{p.region}</td>
                          <td style={num()}>{p.sold || "—"}</td>
                          <td style={num({ fontWeight: 700 })}>{p.returned}</td>
                          <td style={num({ fontWeight: 700, color: rateColor(p.rate, p.typeRate) })}>{p.rate != null ? `${p.rate}%` : "—"}</td>
                          <td style={num({ color: "#666" })}>{p.typeRate != null ? `${p.typeRate}%` : "—"}</td>
                          <td style={num()}>{p.sellable || "—"}</td>
                          <td style={cell({ fontSize: "12px" })}>{p.topReason}</td>
                          <td style={cell({ fontSize: "12px" })}>
                            {themes.map(([t, n]) => (
                              <div key={t}>
                                <span style={{ display: "inline-block", width: 9, height: 9, background: THEME_COLORS[t] || "#ccc", marginRight: 4 }} />
                                {t} {n}
                              </div>
                            ))}
                          </td>
                        </tr>
                        {open === k && (
                          <tr>
                            <td colSpan={10} style={{ padding: 0 }}>
                              <ProductReturns asin={p.asin} region={p.region} start={start} end={end} />
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div style={{ fontSize: "11px", color: "#888", marginTop: "6px" }}>
              Rate red = 2× its type or more, orange = 1.3× or more. Region from the order&apos;s marketplace. Click a product for every return with the customer&apos;s comment.
            </div>
          </div>

          <div style={card()}>
            <h3 style={{ marginTop: 0, fontSize: "15px" }}>Reason × product type (units)</h3>
            <div style={{ overflowX: "auto" }}>
              <table style={{ borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={cell(TH)}>Amazon reason</th>
                    {matrixTypes.map((t) => (
                      <th key={t} style={num(TH)}>{t}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {matrixRows.map(([reason, byType]) => (
                    <tr key={reason}>
                      <td style={cell({ fontSize: "12px" })}>{reason}</td>
                      {matrixTypes.map((t) => (
                        <td key={t} style={num()}>{byType[t] || ""}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </>
  );
}
