import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { buttonStyle } from "./buttonStyle";

// Archer Affiliates (Amazon creator/affiliate network) - per the user
// 2026-10-03. Data comes from Archer's brand portal API via
// GetArcherDashboard (ArcherAffiliates.py); one Archer "brand" per Amazon
// marketplace (US, then UK/EU added 2026-10-03).
const API_BASE = import.meta.env.VITE_API_BASE || "https://amzapi.mandalalifeart.com";

const page = { padding: "16px", background: "#f6f7f9", color: "#222", minHeight: "100vh", fontFamily: "system-ui, sans-serif" };
const card = { background: "#fff", color: "#222", border: "1px solid #ddd", borderRadius: "8px", padding: "14px", marginBottom: "14px" };
const th = { border: "1px solid #ccc", padding: "6px 8px", background: "#eef1f5", color: "#222", fontSize: "12px", textAlign: "left", whiteSpace: "nowrap", cursor: "pointer" };
const td = { border: "1px solid #ddd", padding: "5px 8px", fontSize: "13px", color: "#222" };
const num = { ...td, textAlign: "right", whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" };
const muted = { color: "#666", fontSize: "12px" };
const input = { padding: "6px", borderRadius: "6px", border: "1px solid #bbb", background: "#fff", color: "#222" };

const METRICS = [
  ["clicks", "Clicks", 0],
  ["detail_page_views", "Page views", 0],
  ["add_to_carts", "Add to carts", 0],
  ["attributed_purchases", "Purchases", 0],
  ["sales", "Sales", 2],
  ["commission", "Commission", 2],
  ["brb_bonus", "Brand referral bonus", 2],
];

function fmt(v, digits = 0) {
  return Number(v || 0).toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits });
}
function isoDaysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

function useSort(rows, initial) {
  const [sort, setSort] = useState({ key: initial, dir: "desc" });
  const sorted = useMemo(
    () =>
      [...(rows || [])].sort((a, b) => {
        const va = a[sort.key] ?? 0;
        const vb = b[sort.key] ?? 0;
        const c = typeof va === "string" ? String(va).localeCompare(String(vb)) : va - vb;
        return sort.dir === "asc" ? c : -c;
      }),
    [rows, sort]
  );
  const header = (label, key, right = true) => (
    <th
      style={{ ...th, textAlign: right ? "right" : "left" }}
      onClick={() => setSort((s) => ({ key, dir: s.key === key && s.dir === "desc" ? "asc" : "desc" }))}
    >
      {label}
      {sort.key === key ? (sort.dir === "desc" ? " ▼" : " ▲") : ""}
    </th>
  );
  return [sorted, header];
}

// Small dependency-free bar chart (daily values).
function Bars({ series, color, label, digits }) {
  const max = Math.max(1, ...(series?.y || []));
  const n = series?.x?.length || 0;
  if (!n) return null;
  const w = 100 / n;
  return (
    <div style={{ marginBottom: "10px" }}>
      <div style={muted}>
        {label} per day (max {fmt(max, digits)})
      </div>
      <svg viewBox="0 0 100 30" preserveAspectRatio="none" style={{ width: "100%", height: "80px", background: "#fafbfc" }}>
        {series.y.map((v, i) => (
          <rect key={i} x={i * w + w * 0.1} width={w * 0.8} y={30 - (30 * v) / max} height={(30 * v) / max} fill={color}>
            <title>{`${series.x[i]}: ${fmt(v, digits)}`}</title>
          </rect>
        ))}
      </svg>
      <div style={{ display: "flex", justifyContent: "space-between", ...muted }}>
        <span>{series.x[0]}</span>
        <span>{series.x[n - 1]}</span>
      </div>
    </div>
  );
}

export default function ArcherPage() {
  const [start, setStart] = useState(isoDaysAgo(30));
  const [end, setEnd] = useState(isoDaysAgo(1));
  const [brandId, setBrandId] = useState("");
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function load(range = {}) {
    const from = range.start || start;
    const to = range.end || end;
    setLoading(true);
    setError("");
    try {
      const qs = new URLSearchParams({ start: from, end: to, ...(brandId ? { brand_id: brandId } : {}) });
      const r = await fetch(`${API_BASE}/GetArcherDashboard?${qs}`);
      const res = await r.json();
      if (res.error) throw new Error(res.error);
      setData(res);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brandId]);

  const [creators, creatorHeader] = useSort(data?.creators, "sales");
  const [products, productHeader] = useSort(data?.products, "sales");
  const activeProducts = useMemo(() => (products || []).filter((p) => p.clicks || p.sales || p.detail_page_views), [products]);
  const [showAll, setShowAll] = useState(false);

  // Quick ranges load right away (no extra Apply click).
  function setRange(days) {
    const range = { start: isoDaysAgo(days), end: isoDaysAgo(1) };
    setStart(range.start);
    setEnd(range.end);
    load(range);
  }

  return (
    <div style={page}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
        <h2 style={{ margin: 0 }}>Archer Affiliates</h2>
        <Link to="/" style={{ color: "#1a4fa0" }}>Home</Link>
      </div>

      <div style={{ ...card, display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center" }}>
        <select style={input} value={brandId} onChange={(e) => setBrandId(e.target.value)}>
          <option value="">All marketplaces</option>
          {(data?.brands || []).map((b) => (
            <option key={b.brand_id} value={b.brand_id}>{b.brand_country}</option>
          ))}
        </select>
        <input style={input} type="date" value={start} onChange={(e) => setStart(e.target.value)} />
        <span>–</span>
        <input style={input} type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
        <span style={muted}>(pick dates, then Apply)</span>
        {[7, 30, 90, 365].map((d) => (
          <button
            key={d}
            style={{ ...buttonStyle(), minWidth: "56px", width: "auto", padding: "6px 10px" }}
            onClick={() => setRange(d)}
            disabled={loading}
          >
            {d}d
          </button>
        ))}
        <button style={{ ...buttonStyle(), minWidth: "90px", width: "auto", padding: "6px 12px" }} onClick={() => load()} disabled={loading}>
          {loading ? "Loading…" : "Apply"}
        </button>
        {error && <span style={{ color: "#b00020" }}>{error}</span>}
      </div>

      {data && (
        <>
          <div style={card}>
            <h3 style={{ marginTop: 0 }}>Marketplaces</h3>
            <table style={{ borderCollapse: "collapse", width: "100%" }}>
              <thead>
                <tr>
                  {["Marketplace", "Status", "Active products", "Inactive products", "Joined", "Min commission"].map((h) => (
                    <th key={h} style={{ ...th, cursor: "default" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.brands.map((b) => (
                  <tr key={b.brand_id}>
                    <td style={{ ...td, fontWeight: 700 }}>{b.brand_country}</td>
                    <td style={{ ...td, color: b.is_brand_active ? "#2e7d32" : "#b00020", fontWeight: 600 }}>
                      {b.is_brand_active ? "Active" : "Inactive"}
                      {b.is_failing ? " (failing)" : ""}
                      {b.inactive_reason ? <div style={muted}>{b.inactive_reason}</div> : null}
                    </td>
                    <td style={num}>{fmt(b.active_products)}</td>
                    <td style={num}>{fmt(b.inactive_products)}</td>
                    <td style={td}>{(b.created_at || "").slice(0, 10)}</td>
                    <td style={num}>{b.min_commission ? `${b.min_commission}%` : "–"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={card}>
            <h3 style={{ marginTop: 0 }}>
              {data.start} – {data.end}
              <span style={{ ...muted, marginLeft: "8px" }}>
                vs previous {data.previousRange[0]} – {data.previousRange[1]}
              </span>
            </h3>
            <div style={{ display: "flex", gap: "22px", flexWrap: "wrap" }}>
              {METRICS.map(([k, label, digits]) => {
                const cur = data.summary[k] || 0;
                const prev = data.previous[k] || 0;
                const diff = prev ? Math.round((100 * (cur - prev)) / prev) : null;
                return (
                  <div key={k} style={{ minWidth: "110px" }}>
                    <div style={muted}>{label}</div>
                    <div style={{ fontSize: "20px", fontWeight: 700 }}>{fmt(cur, digits)}</div>
                    <div style={{ ...muted, color: diff === null ? "#666" : diff >= 0 ? "#2e7d32" : "#b00020" }}>
                      prev {fmt(prev, digits)}{diff !== null ? ` (${diff >= 0 ? "+" : ""}${diff}%)` : ""}
                    </div>
                  </div>
                );
              })}
            </div>
            <div style={{ ...muted, marginTop: "8px" }}>
              Purchases/sales are Amazon Attribution numbers reported by Archer (can take up to ~48 hours to appear).
            </div>
          </div>

          <div style={card}>
            <Bars series={data.series.clicks} color="#5b8def" label="Clicks" digits={0} />
            <Bars series={data.series.sales} color="#2e9e5b" label="Sales" digits={2} />
          </div>

          <div style={card}>
            <h3 style={{ marginTop: 0 }}>Creators</h3>
            <table style={{ borderCollapse: "collapse", width: "100%" }}>
              <thead>
                <tr>
                  {creatorHeader("Creator", "creator", false)}
                  {creatorHeader("Clicks", "clicks")}
                  {creatorHeader("Page views", "detail_page_views")}
                  {creatorHeader("Add to carts", "add_to_carts")}
                  {creatorHeader("Purchases", "attributed_purchases")}
                  {creatorHeader("Sales", "sales")}
                  {creatorHeader("Commission", "commission")}
                </tr>
              </thead>
              <tbody>
                {creators.map((c) => (
                  <tr key={`${c.creator}-${c.user_name}`}>
                    <td style={td}>
                      {c.creator}
                      <span style={{ ...muted, marginLeft: "6px" }}>{c.user_name}</span>
                    </td>
                    <td style={num}>{fmt(c.clicks)}</td>
                    <td style={num}>{fmt(c.detail_page_views)}</td>
                    <td style={num}>{fmt(c.add_to_carts)}</td>
                    <td style={num}>{fmt(c.attributed_purchases)}</td>
                    <td style={num}>{fmt(c.sales, 2)}</td>
                    <td style={num}>{fmt(c.commission, 2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={card}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ marginTop: 0 }}>Products</h3>
              <label style={muted}>
                <input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} /> show products
                without activity ({(products || []).length} total)
              </label>
            </div>
            <table style={{ borderCollapse: "collapse", width: "100%" }}>
              <thead>
                <tr>
                  {productHeader("Product", "title", false)}
                  {productHeader("Mkt", "country_code", false)}
                  {productHeader("Clicks", "clicks")}
                  {productHeader("Page views", "detail_page_views")}
                  {productHeader("Add to carts", "add_to_carts")}
                  {productHeader("Purchases", "attributed_purchases")}
                  {productHeader("Sales", "sales")}
                  {productHeader("Commission", "commission")}
                </tr>
              </thead>
              <tbody>
                {(showAll ? products : activeProducts).map((p) => (
                  <tr key={`${p.asin}-${p.country_code}`}>
                    <td style={td}>
                      <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                        {p.product_photo && <img src={p.product_photo} alt="" style={{ width: "32px", height: "32px", objectFit: "cover", borderRadius: "4px" }} />}
                        <div>
                          <div style={{ fontWeight: 600 }}>{p.asin}</div>
                          <div style={{ ...muted, maxWidth: "520px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.title}</div>
                        </div>
                      </div>
                    </td>
                    <td style={td}>{p.country_code}</td>
                    <td style={num}>{fmt(p.clicks)}</td>
                    <td style={num}>{fmt(p.detail_page_views)}</td>
                    <td style={num}>{fmt(p.add_to_carts)}</td>
                    <td style={num}>{fmt(p.attributed_purchases)}</td>
                    <td style={num}>{fmt(p.sales, 2)}</td>
                    <td style={num}>{fmt(p.commission, 2)}</td>
                  </tr>
                ))}
                {!showAll && activeProducts.length === 0 && (
                  <tr>
                    <td style={{ ...td, ...muted }} colSpan={8}>No product had clicks or sales in this period.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
