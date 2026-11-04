import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { buttonStyle } from "./buttonStyle";

const API_BASE = import.meta.env.VITE_API_BASE || "https://amzapi.mandalalifeart.com";

const MP_LABEL = {
  all: "All marketplaces", us: "USA", ca: "Canada", mx: "Mexico", uk: "UK", de: "Germany", fr: "France",
  it: "Italy", es: "Spain", nl: "Netherlands", se: "Sweden", pl: "Poland", be: "Belgium", ie: "Ireland",
};
const CUR_SYMBOL = { USD: "$", EUR: "€", GBP: "£", CAD: "C$", MXN: "MX$", SEK: "kr ", PLN: "zł " };

const page = { padding: "16px", background: "#f6f7f9", color: "#222", minHeight: "100vh", fontFamily: "system-ui, sans-serif" };
const card = { background: "#fff", color: "#222", border: "1px solid #ddd", borderRadius: "8px", padding: "14px", marginBottom: "14px" };
const th = { border: "1px solid #ccc", padding: "6px 8px", background: "#eef1f5", color: "#222", fontSize: "12px", textAlign: "left", cursor: "pointer", whiteSpace: "nowrap", position: "sticky", top: 0 };
const td = { border: "1px solid #ddd", padding: "5px 8px", fontSize: "13px", color: "#222" };
const num = { ...td, textAlign: "right", whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" };
const muted = { color: "#666", fontSize: "12px" };
const select = { padding: "6px", borderRadius: "6px", border: "1px solid #bbb", background: "#fff", color: "#222" };

function fmt(n, digits = 0) {
  if (n === null || n === undefined || Number.isNaN(n)) return "–";
  return Number(n).toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits });
}
function money(amount, cur) {
  if (amount === null || amount === undefined) return "–";
  return `${CUR_SYMBOL[cur] ?? (cur ? cur + " " : "")}${fmt(amount, 2)}`;
}
function moneyMap(m) {
  const entries = Object.entries(m || {}).filter(([, v]) => v);
  if (!entries.length) return "–";
  return entries.map(([c, v]) => money(v, c)).join(" + ");
}
function pct(a, b, digits = 1) {
  return b ? `${fmt((100 * a) / b, digits)}%` : "–";
}
function ymLabel(ym) {
  const [y, m] = ym.split("-");
  return new Date(Number(y), Number(m) - 1, 1).toLocaleString("en", { month: "short", year: "numeric" });
}

function useSort(rows, initialKey, initialDir = "desc") {
  const [sort, setSort] = useState({ key: initialKey, dir: initialDir });
  const sorted = useMemo(() => {
    const val = (r) => {
      const v = typeof sort.key === "function" ? sort.key(r) : r[sort.key];
      if (v && typeof v === "object") return Object.values(v).reduce((s, x) => s + (x || 0), 0);
      return v ?? -Infinity;
    };
    return [...(rows || [])].sort((a, b) => {
      const va = val(a), vb = val(b);
      const c = typeof va === "string" ? va.localeCompare(vb) : va - vb;
      return sort.dir === "asc" ? c : -c;
    });
  }, [rows, sort]);
  const header = (label, key, style = {}) => (
    <th
      style={{ ...th, ...style }}
      onClick={() => setSort((s) => ({ key, dir: s.key === key && s.dir === "desc" ? "asc" : "desc" }))}
    >
      {label}
      {sort.key === key ? (sort.dir === "desc" ? " ▼" : " ▲") : ""}
    </th>
  );
  return [sorted, header];
}

const PERIODS = [
  { value: "1", label: "This month (so far)" },
  { value: "prev", label: "Last month" },
  { value: "3", label: "Last 3 months" },
  { value: "6", label: "Last 6 months" },
  { value: "12", label: "Last 12 months" },
];

function prevMonth() {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

// ------------------------------------------------------------------ list

function AsinList({ onOpen }) {
  const [marketplace, setMarketplace] = useState(() => localStorage.getItem("asinAnalytics.mp") || "us");
  const [period, setPeriod] = useState(() => localStorage.getItem("asinAnalytics.period") || "prev");
  const [search, setSearch] = useState("");
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem("asinAnalytics.mp", marketplace);
      localStorage.setItem("asinAnalytics.period", period);
    } catch {
      /* storage unavailable */
    }
    const qs = period === "prev" ? `month=${prevMonth()}` : `months=${period}`;
    setLoading(true);
    setError("");
    fetch(`${API_BASE}/GetAsinAnalyticsList?marketplace=${marketplace}&${qs}`)
      .then((r) => r.json())
      .then((res) => {
        if (res.error) throw new Error(res.error);
        setData(res);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [marketplace, period]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return data?.rows || [];
    return (data?.rows || []).filter((r) =>
      [r.asin, r.group, r.desc, ...(r.skus || [])].some((v) => (v || "").toLowerCase().includes(q))
    );
  }, [data, search]);
  const [rows, header] = useSort(filtered, "units");

  const totals = useMemo(() => {
    const t = { sessions: 0, pageViews: 0, units: 0, adUnits: 0, adClicks: 0 };
    filtered.forEach((r) => Object.keys(t).forEach((k) => (t[k] += r[k] || 0)));
    return t;
  }, [filtered]);

  return (
    <div style={card}>
      <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center", marginBottom: "10px" }}>
        <select style={select} value={marketplace} onChange={(e) => setMarketplace(e.target.value)}>
          {["us", "uk", "de", "fr", "it", "es", "nl", "se", "pl", "be", "ie", "ca", "mx", "all"].map((m) => (
            <option key={m} value={m}>{MP_LABEL[m]}</option>
          ))}
        </select>
        <select style={select} value={period} onChange={(e) => setPeriod(e.target.value)}>
          {PERIODS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
        </select>
        <input
          style={{ ...select, minWidth: "220px" }}
          placeholder="Search ASIN / SKU / group"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {loading && <span style={muted}>Loading…</span>}
        {data && (
          <span style={muted}>
            {data.months.map(ymLabel).join(", ")} · {filtered.length} products · {fmt(totals.sessions)} sessions ·{" "}
            {fmt(totals.units)} units · conversion {pct(totals.units, totals.sessions, 2)} · via ads{" "}
            {fmt(totals.adUnits)}
          </span>
        )}
      </div>
      {error && <div style={{ color: "#b00020" }}>{error}</div>}
      <div style={{ overflow: "auto", maxHeight: "75vh" }}>
        <table style={{ borderCollapse: "collapse", width: "100%" }}>
          <thead>
            <tr>
              {header("Product", "group")}
              {header("Sessions", "sessions", { textAlign: "right" })}
              {header("Page views", "pageViews", { textAlign: "right" })}
              {header("Units", "units", { textAlign: "right" })}
              {header("Conv. %", "conversionPct", { textAlign: "right" })}
              {header("Sales", "sales", { textAlign: "right" })}
              {header("Ad clicks", "adClicks", { textAlign: "right" })}
              {header("Units via ads", "adUnits", { textAlign: "right" })}
              {header("Other products via its ads", "haloOrders", { textAlign: "right" })}
              {header("Ad spend", "adSpend", { textAlign: "right" })}
              {header("Organic units (est.)", "organicUnitsEst", { textAlign: "right" })}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.asin} style={{ cursor: "pointer" }} onClick={() => onOpen(r.asin)}>
                <td style={td}>
                  <div style={{ fontWeight: 600, color: "#1a4fa0" }}>{(r.skus || []).join(", ") || r.asin}</div>
                  <div style={muted}>
                    {r.asin}
                    {r.group ? ` · ${r.group}` : ""}
                    {r.desc ? ` · ${r.desc}` : ""}
                    {marketplace === "all" && r.marketplaces?.length ? ` · ${r.marketplaces.join(" ").toUpperCase()}` : ""}
                  </div>
                </td>
                <td style={num}>{fmt(r.sessions)}</td>
                <td style={num}>{fmt(r.pageViews)}</td>
                <td style={num}>{fmt(r.units)}</td>
                <td style={num}>{r.conversionPct === null ? "–" : `${fmt(r.conversionPct, 2)}%`}</td>
                <td style={num}>{moneyMap(r.sales)}</td>
                <td style={num}>{fmt(r.adClicks)}</td>
                <td style={num}>{fmt(r.adUnits)}</td>
                <td style={num}>{fmt(r.haloOrders)}</td>
                <td style={num}>{moneyMap(r.adSpend)}</td>
                <td style={num}>{fmt(r.organicUnitsEst)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ ...muted, marginTop: "8px" }}>
        Sessions, page views, units, conversion and sales come from Amazon Business Reports (Sales &amp; Traffic).
        Units via ads = units of this product bought within 7 days of an ad click (exact SKU; before Sep 2026 Amazon's
        total ad orders are used, which can include other products). Other products via its ads = orders of different
        products after clicking this product's ad. Organic units (est.) = units − units via ads. Click a product for
        keywords and the monthly breakdown.
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- detail

function MonthlyTable({ data, mp }) {
  const rows = useMemo(() => {
    const byYm = {};
    const ensure = (ym) =>
      (byYm[ym] ||= { ym, sessions: 0, pageViews: 0, units: 0, sales: {}, buyBox: null, unitsOrders: null,
        adImpr: 0, adClicks: 0, adUnits: 0, halo: 0, adSpend: {}, adSales: {}, refunded: 0 });
    data.traffic.filter((t) => mp === "all" || t.marketplace === mp).forEach((t) => {
      const r = ensure(`${t.year}-${String(t.month).padStart(2, "0")}`);
      r.sessions += t.sessions; r.pageViews += t.page_views; r.units += t.units; r.refunded += t.units_refunded;
      r.sales[t.currency] = (r.sales[t.currency] || 0) + t.sales;
      if (mp !== "all") r.buyBox = t.buy_box_pct;
    });
    Object.entries(data.unitsHistory).forEach(([m, months]) => {
      if (mp !== "all" && m !== mp) return;
      Object.entries(months).forEach(([ym, q]) => {
        const r = ensure(ym);
        r.unitsOrders = (r.unitsOrders || 0) + q;
      });
    });
    data.adsMonthly.filter((a) => mp === "all" || a.marketplace === mp).forEach((a) => {
      const r = ensure(a.ym);
      r.adImpr += a.impressions; r.adClicks += a.clicks; r.adUnits += a.adUnits; r.halo += a.haloOrders;
      r.adSpend[a.currency] = (r.adSpend[a.currency] || 0) + a.spend;
      r.adSales[a.currency] = (r.adSales[a.currency] || 0) + a.sales;
    });
    return Object.values(byYm).filter((r) => data.months.includes(r.ym)).sort((a, b) => b.ym.localeCompare(a.ym));
  }, [data, mp]);

  const sum = (obj) => Object.values(obj).reduce((s, v) => s + v, 0);
  return (
    <div style={{ overflow: "auto" }}>
      <table style={{ borderCollapse: "collapse", width: "100%" }}>
        <thead>
          <tr>
            {["Month", "Sessions", "Page views", "Units", "Conv. %", "Buy box", "Sales", "Ad impr.", "Ad clicks",
              "Ad CTR", "Units via ads", "Other products via ads", "Ad spend", "ACOS", "Organic units (est.)", "Units (orders report)"].map((h) => (
              <th key={h} style={{ ...th, cursor: "default", textAlign: h === "Month" ? "left" : "right" }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.ym}>
              <td style={td}>{ymLabel(r.ym)}</td>
              <td style={num}>{fmt(r.sessions)}</td>
              <td style={num}>{fmt(r.pageViews)}</td>
              <td style={num}>{fmt(r.units)}</td>
              <td style={num}>{pct(r.units, r.sessions, 2)}</td>
              <td style={num}>{r.buyBox === null ? "–" : `${fmt(r.buyBox, 0)}%`}</td>
              <td style={num}>{moneyMap(r.sales)}</td>
              <td style={num}>{fmt(r.adImpr)}</td>
              <td style={num}>{fmt(r.adClicks)}</td>
              <td style={num}>{pct(r.adClicks, r.adImpr, 2)}</td>
              <td style={num}>{fmt(r.adUnits)}</td>
              <td style={num}>{fmt(r.halo)}</td>
              <td style={num}>{moneyMap(r.adSpend)}</td>
              <td style={num}>{pct(sum(r.adSpend), sum(r.adSales))}</td>
              <td style={num}>{r.sessions || r.units ? fmt(Math.max(r.units - r.adUnits, 0)) : "–"}</td>
              <td style={num}>{r.unitsOrders === null ? "–" : fmt(r.unitsOrders)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ ...muted, marginTop: "6px" }}>
        "Units" = Business Report units ordered (only from 2025). "Units (orders report)" = the same SKUs in the
        sales database (longer history, includes cancelled orders differently, so small differences are normal).
      </div>
    </div>
  );
}

function SearchQueryTable({ data, mp }) {
  const periods = useMemo(
    () => data.searchQueryPeriods.filter((p) => data.searchQueries.some((q) => q.start_date === p.start && q.period === p.period && (mp === "all" || q.marketplace === mp))),
    [data, mp]
  );
  const [sel, setSel] = useState("");
  const current = periods.find((p) => `${p.period}|${p.start}` === sel) || periods[0];
  const rows = useMemo(
    () => (current ? data.searchQueries.filter((q) => q.period === current.period && q.start_date === current.start && (mp === "all" || q.marketplace === mp)) : []),
    [data, current, mp]
  );
  const [sorted, header] = useSort(rows, "asin_impressions");
  if (!periods.length) {
    return <div style={muted}>No Brand Analytics keyword data for this product/marketplace yet (it fills in weekly and monthly; products with under 10 sessions a month are skipped).</div>;
  }
  const tot = rows.reduce((t, r) => ({ imp: t.imp + r.asin_impressions, clk: t.clk + r.asin_clicks, cart: t.cart + r.asin_cart_adds, pur: t.pur + r.asin_purchases }), { imp: 0, clk: 0, cart: 0, pur: 0 });
  return (
    <div>
      <div style={{ display: "flex", gap: "10px", alignItems: "center", marginBottom: "8px", flexWrap: "wrap" }}>
        <select style={select} value={current ? `${current.period}|${current.start}` : ""} onChange={(e) => setSel(e.target.value)}>
          {periods.map((p) => (
            <option key={`${p.period}|${p.start}`} value={`${p.period}|${p.start}`}>
              {p.period === "MONTH" ? `Month ${ymLabel(p.start.slice(0, 7))}` : `Week ${p.start} – ${p.end}`}
            </option>
          ))}
        </select>
        <span style={muted}>
          Your totals across these searches: {fmt(tot.imp)} impressions · {fmt(tot.clk)} clicks · {fmt(tot.cart)} cart adds · {fmt(tot.pur)} purchases
        </span>
      </div>
      <div style={{ overflow: "auto", maxHeight: "60vh" }}>
        <table style={{ borderCollapse: "collapse", width: "100%" }}>
          <thead>
            <tr>
              {mp === "all" && header("Mkt", "marketplace")}
              {header("Customer search", "search_query")}
              {header("Search volume", "query_volume", { textAlign: "right" })}
              {header("Your impr.", "asin_impressions", { textAlign: "right" })}
              {header("Impr. share", "impression_share", { textAlign: "right" })}
              {header("Your clicks", "asin_clicks", { textAlign: "right" })}
              {header("Click share", "click_share", { textAlign: "right" })}
              {header("Your cart adds", "asin_cart_adds", { textAlign: "right" })}
              {header("Your purchases", "asin_purchases", { textAlign: "right" })}
              {header("Purchase share", "purchase_share", { textAlign: "right" })}
              {header("Market purchases", "total_purchases", { textAlign: "right" })}
              {header("Your price / market median", "asin_median_click_price", { textAlign: "right" })}
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => (
              <tr key={r.id}>
                {mp === "all" && <td style={td}>{r.marketplace.toUpperCase()}</td>}
                <td style={td}>{r.search_query}</td>
                <td style={num}>{fmt(r.query_volume)}</td>
                <td style={num}>{fmt(r.asin_impressions)}</td>
                <td style={num}>{fmt(r.impression_share, 2)}%</td>
                <td style={num}>{fmt(r.asin_clicks)}</td>
                <td style={num}>{fmt(r.click_share, 2)}%</td>
                <td style={num}>{fmt(r.asin_cart_adds)}</td>
                <td style={{ ...num, fontWeight: r.asin_purchases ? 700 : 400 }}>{fmt(r.asin_purchases)}</td>
                <td style={num}>{fmt(r.purchase_share, 2)}%</td>
                <td style={num}>{fmt(r.total_purchases)}</td>
                <td style={num}>
                  {r.asin_median_click_price ? money(r.asin_median_click_price, r.currency) : "–"} /{" "}
                  {r.total_median_click_price ? money(r.total_median_click_price, r.currency) : "–"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ ...muted, marginTop: "6px" }}>
        Amazon Brand Analytics (Search Query Performance): every customer search where this product was shown,
        organic and sponsored together. Share = your part of all impressions/clicks/purchases for that search.
      </div>
    </div>
  );
}

function AdTermsTable({ data, mp }) {
  const [showShared, setShowShared] = useState(false);
  const all = useMemo(() => data.adSearchTerms.filter((t) => mp === "all" || t.marketplace === mp), [data, mp]);
  const sharedCount = all.filter((t) => t.sharedAdGroup).length;
  const rows = useMemo(() => all.filter((t) => showShared || !t.sharedAdGroup), [all, showShared]);
  const [sorted, header] = useSort(rows, "orders");
  const toggle = sharedCount > 0 && (
    <label style={{ ...muted, display: "block", marginBottom: "6px" }}>
      <input type="checkbox" checked={showShared} onChange={(e) => setShowShared(e.target.checked)} /> Also show{" "}
      {sharedCount} terms from ad groups that advertise other products too (their orders may be for those products)
    </label>
  );
  if (!rows.length)
    return (
      <div>
        {toggle}
        <div style={muted}>
          {sharedCount
            ? "This product is only advertised inside shared ad groups, so Amazon doesn't tell which search terms were for it. A dedicated ad group/campaign fixes that."
            : "No ad search terms in this period (the product isn't advertised here, or has no clicks)."}
        </div>
      </div>
    );
  return (
    <div style={{ overflow: "auto", maxHeight: "50vh" }}>
      {toggle}
      <table style={{ borderCollapse: "collapse", width: "100%" }}>
        <thead>
          <tr>
            {mp === "all" && header("Mkt", "marketplace")}
            {header("Customer search term", "searchTerm")}
            {header("Impr.", "impressions", { textAlign: "right" })}
            {header("Clicks", "clicks", { textAlign: "right" })}
            {header("Orders", "orders", { textAlign: "right" })}
            {header("Spend", "spend", { textAlign: "right" })}
            {header("Sales", "sales", { textAlign: "right" })}
            {header("ACOS", (r) => (r.sales ? r.spend / r.sales : r.spend ? 99 : 0), { textAlign: "right" })}
            <th style={{ ...th, cursor: "default" }}>Matched by</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((t) => (
            <tr key={`${t.marketplace}|${t.searchTerm}|${t.sharedAdGroup}`}>
              {mp === "all" && <td style={td}>{t.marketplace.toUpperCase()}</td>}
              <td style={td}>
                {t.searchTerm}
                {t.sharedAdGroup && <span title="This ad group advertises other products too - the order may be for one of them" style={{ ...muted, marginLeft: "6px" }}>(shared)</span>}
              </td>
              <td style={num}>{fmt(t.impressions)}</td>
              <td style={num}>{fmt(t.clicks)}</td>
              <td style={{ ...num, fontWeight: t.orders ? 700 : 400 }}>{fmt(t.orders)}</td>
              <td style={num}>{money(t.spend, t.currency)}</td>
              <td style={num}>{money(t.sales, t.currency)}</td>
              <td style={num}>{pct(t.spend, t.sales)}</td>
              <td style={{ ...td, ...muted }}>{t.targets.join(", ")}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AsinDetail({ asin, onBack }) {
  const [months, setMonths] = useState("12");
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [mp, setMp] = useState("");

  useEffect(() => {
    setData(null);
    setError("");
    fetch(`${API_BASE}/GetAsinAnalytics?asin=${encodeURIComponent(asin)}&months=${months}`)
      .then((r) => r.json())
      .then((res) => {
        if (res.error) throw new Error(res.error);
        setData(res);
      })
      .catch((e) => setError(e.message));
  }, [asin, months]);

  const mps = useMemo(() => {
    if (!data) return [];
    const s = {};
    data.traffic.forEach((t) => (s[t.marketplace] = (s[t.marketplace] || 0) + t.sessions + t.units * 50));
    data.adsMonthly.forEach((a) => (s[a.marketplace] = (s[a.marketplace] || 0) + a.clicks));
    data.searchQueries.forEach((q) => (s[q.marketplace] = (s[q.marketplace] || 0)));
    return Object.keys(s).sort((a, b) => s[b] - s[a]);
  }, [data]);
  const activeMp = mp || mps[0] || "all";

  const kpi = useMemo(() => {
    if (!data) return null;
    const t = data.traffic.filter((r) => activeMp === "all" || r.marketplace === activeMp);
    const a = data.adsMonthly.filter((r) => activeMp === "all" || r.marketplace === activeMp);
    const sessions = t.reduce((s, r) => s + r.sessions, 0);
    const units = t.reduce((s, r) => s + r.units, 0);
    const adUnits = a.reduce((s, r) => s + r.adUnits, 0);
    const adClicks = a.reduce((s, r) => s + r.clicks, 0);
    const spend = {};
    a.forEach((r) => (spend[r.currency] = (spend[r.currency] || 0) + r.spend));
    const sales = {};
    t.forEach((r) => (sales[r.currency] = (sales[r.currency] || 0) + r.sales));
    return { sessions, units, adUnits, adClicks, spend, sales, organic: Math.max(units - adUnits, 0) };
  }, [data, activeMp]);

  return (
    <div>
      <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap", marginBottom: "10px" }}>
        <button style={buttonStyle()} onClick={onBack}>← All products</button>
        <select style={select} value={months} onChange={(e) => setMonths(e.target.value)}>
          {["3", "6", "12", "24"].map((m) => <option key={m} value={m}>Last {m} months</option>)}
        </select>
      </div>
      {error && <div style={{ ...card, color: "#b00020" }}>{error}</div>}
      {!data && !error && <div style={card}>Loading…</div>}
      {data && (
        <>
          <div style={card}>
            <div style={{ fontSize: "18px", fontWeight: 700 }}>{data.skus.join(", ") || data.asin}</div>
            <div style={muted}>
              ASIN {data.asin}
              {data.parentAsin && data.parentAsin !== data.asin ? ` · parent ${data.parentAsin}` : ""}
              {data.group ? ` · group ${data.group}` : ""}
              {data.desc ? ` · ${data.desc}` : ""}
            </div>
            <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginTop: "10px" }}>
              {[...mps, "all"].map((m) => (
                <button
                  key={m}
                  onClick={() => setMp(m)}
                  style={{
                    ...buttonStyle(),
                    background: m === activeMp ? "#1a4fa0" : "#fff",
                    color: m === activeMp ? "#fff" : "#1a4fa0",
                    border: "1px solid #1a4fa0",
                    minWidth: "70px",
                    padding: "6px 12px",
                  }}
                >
                  {MP_LABEL[m] || m.toUpperCase()}
                </button>
              ))}
            </div>
            {kpi && (
              <div style={{ display: "flex", gap: "18px", flexWrap: "wrap", marginTop: "12px" }}>
                {[
                  ["Sessions", fmt(kpi.sessions)],
                  ["Units", fmt(kpi.units)],
                  ["Conversion", pct(kpi.units, kpi.sessions, 2)],
                  ["Sales", moneyMap(kpi.sales)],
                  ["Ad clicks", fmt(kpi.adClicks)],
                  ["Units via ads", fmt(kpi.adUnits)],
                  ["Ad spend", moneyMap(kpi.spend)],
                  ["Organic units (est.)", fmt(kpi.organic)],
                ].map(([label, value]) => (
                  <div key={label} style={{ minWidth: "110px" }}>
                    <div style={muted}>{label}</div>
                    <div style={{ fontSize: "18px", fontWeight: 600 }}>{value}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={card}>
            <h3 style={{ marginTop: 0 }}>Month by month – {MP_LABEL[activeMp] || activeMp}</h3>
            <MonthlyTable data={data} mp={activeMp} />
          </div>

          <div style={card}>
            <h3 style={{ marginTop: 0 }}>Keywords customers searched (organic + sponsored, Brand Analytics)</h3>
            <SearchQueryTable key={activeMp} data={data} mp={activeMp} />
          </div>

          <div style={card}>
            <h3 style={{ marginTop: 0 }}>Ad search terms (since {data.adSearchTermsSince})</h3>
            <AdTermsTable data={data} mp={activeMp} />
          </div>

          <div style={card}>
            <h3 style={{ marginTop: 0 }}>Campaigns advertising this product</h3>
            {data.campaigns.filter((c) => activeMp === "all" || c.marketplace === activeMp).length ? (
              <table style={{ borderCollapse: "collapse", width: "100%" }}>
                <thead>
                  <tr>
                    {["Mkt", "Campaign / ad group", "Impr.", "Clicks", "Units via ads", "Other products", "Spend", "Sales", "ACOS", "Last activity"].map((h) => (
                      <th key={h} style={{ ...th, cursor: "default" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.campaigns.filter((c) => activeMp === "all" || c.marketplace === activeMp).map((c) => (
                    <tr key={`${c.marketplace}|${c.campaignId}|${c.adGroupId}`}>
                      <td style={td}>{c.marketplace.toUpperCase()}</td>
                      <td style={td}>
                        {c.campaignName}
                        <div style={muted}>
                          {c.adGroupName}
                          {c.asinsInAdGroup > 1 ? ` · ad group has ${c.asinsInAdGroup} products` : ""}
                        </div>
                      </td>
                      <td style={num}>{fmt(c.impressions)}</td>
                      <td style={num}>{fmt(c.clicks)}</td>
                      <td style={num}>{fmt(c.adUnits)}</td>
                      <td style={num}>{fmt(c.haloOrders)}</td>
                      <td style={num}>{money(c.spend, c.currency)}</td>
                      <td style={num}>{money(c.sales, c.currency)}</td>
                      <td style={num}>{pct(c.spend, c.sales)}</td>
                      <td style={td}>{c.lastDate}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div style={muted}>Not advertised in this marketplace during the period.</div>
            )}
          </div>

          <div style={card}>
            <h3 style={{ marginTop: 0 }}>Returns (all marketplaces)</h3>
            {Object.keys(data.returns.reasons).length ? (
              <>
                <div style={{ marginBottom: "8px" }}>
                  {Object.entries(data.returns.reasons)
                    .sort((a, b) => b[1] - a[1])
                    .map(([reason, q]) => `${reason.replaceAll("_", " ").toLowerCase()}: ${q}`)
                    .join(" · ")}
                </div>
                {data.returns.comments.map((c, i) => (
                  <div key={i} style={{ ...muted, marginBottom: "4px" }}>
                    {c.date} – {c.comment}
                  </div>
                ))}
              </>
            ) : (
              <div style={muted}>No returns in this period.</div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default function AsinAnalyticsPage() {
  const [params, setParams] = useSearchParams();
  const asin = params.get("asin") || "";
  return (
    <div style={page}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
        <h2 style={{ margin: 0 }}>Product analytics</h2>
        <Link to="/" style={{ color: "#1a4fa0" }}>Home</Link>
      </div>
      {asin ? (
        <AsinDetail asin={asin} onBack={() => setParams({})} />
      ) : (
        <AsinList onOpen={(a) => setParams({ asin: a })} />
      )}
    </div>
  );
}
