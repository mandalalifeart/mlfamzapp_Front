import { useEffect, useMemo, useState } from "react";

// Sales & profit growth (per the user 2026-11-04: "make a page for sales and
// profit grow so i can follow up"). Data: GetGrowthData = per month (order
// date) x marketplace x department totals from the product profit formula
// (same as the product page / Best & Worst / monthly profit on /checks), USD.
const LOCAL_API_BASE = "https://amzapi.mandalalifeart.com";

const MP_GROUPS = [
  ["all", "All marketplaces", null],
  ["usa", "USA", ["usa"]],
  ["ca", "Canada", ["ca"]],
  ["mex", "Mexico", ["mex"]],
  ["uk", "UK", ["uk"]],
  ["eu", "EU (EUR)", ["de", "fr", "it", "es", "nl", "be", "ie"]],
  ["de", "Germany", ["de"]],
  ["fr", "France", ["fr"]],
  ["it", "Italy", ["it"]],
  ["es", "Spain", ["es"]],
  ["nl", "Netherlands", ["nl"]],
  ["be", "Belgium", ["be"]],
  ["ie", "Ireland", ["ie"]],
  ["pl", "Poland", ["pl"]],
  ["se", "Sweden", ["se"]],
];
const TABLE_MPS = ["usa", "ca", "mex", "uk", "de", "fr", "it", "es", "nl", "be", "ie", "pl", "se"];
const MP_NAME = Object.fromEntries(MP_GROUPS.map(([k, n]) => [k, n]));
const DEPTS = [
  ["all", "All products"],
  ["pareo", "Pareo"],
  ["home", "Home decor"],
];
const COST_KEYS = ["fees", "productCost", "ads", "sbAds", "returns", "storage", "awd"];

const money = (v) => (v == null ? "—" : `${v < 0 ? "-" : ""}$${Math.abs(Math.round(v)).toLocaleString("en-US")}`);
const pct = (now, before) => (before ? ((now - before) / Math.abs(before)) * 100 : null);
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function empty() {
  return { units: 0, sales: 0, netSales: 0, fees: 0, productCost: 0, ads: 0, sbAds: 0, returns: 0, storage: 0, awd: 0, noCostUnits: 0 };
}

function add(t, x) {
  for (const k of Object.keys(t)) t[k] += x?.[k] || 0;
  return t;
}

function finish(t) {
  const profit = t.netSales - COST_KEYS.reduce((s, k) => s + t[k], 0);
  return {
    ...t,
    profit,
    margin: t.netSales ? (profit / t.netSales) * 100 : null,
    adsAll: t.ads + t.sbAds,
    tacos: t.sales ? ((t.ads + t.sbAds) / t.sales) * 100 : null,
  };
}

// totals for one month, filtered by marketplaces + department
function monthTotal(monthData, mps, dept) {
  const t = empty();
  for (const [mp, byDept] of Object.entries(monthData || {})) {
    if (mps && !mps.includes(mp)) continue;
    for (const [d, x] of Object.entries(byDept)) {
      if (dept !== "all" && d !== dept) continue;
      add(t, x);
    }
  }
  return t;
}

// "All products" uses the marketplaces' total ad spend (country_sales) in every
// month, so both years are measured the same way. Per department the product
// ad cost is used; before productAdsFrom (2026-01) there is none, so those
// months are profit BEFORE ads.
let PPC = {}, ADS_FROM = "2026-01";

function sumMonths(months, keys, mps, dept) {
  const t = empty();
  let beforeAds = false;
  for (const k of keys) {
    const m = monthTotal(months[k], mps, dept);
    if (months[k] && (dept === "all" || k < ADS_FROM)) {
      if (dept === "all" && PPC[k]) {
        m.ads = Object.entries(PPC[k] || {}).reduce((s, [mp, v]) => (mps && !mps.includes(mp) ? s : s + v), 0);
        m.sbAds = 0;
      } else beforeAds = true;
    }
    add(t, m);
  }
  return { ...finish(t), beforeAds };
}

function Change({ now, before, invert }) {
  const p = pct(now, before);
  if (p == null) return <span style={{ color: "#999" }}>—</span>;
  const good = invert ? p < 0 : p > 0;
  return (
    <span style={{ color: good ? "#1e8449" : "#b03a2e", fontWeight: 600 }}>
      {p > 0 ? "▲" : "▼"} {Math.abs(p).toFixed(0)}%
    </span>
  );
}

function Kpi({ title, now, before, sub, fmt = money, invert, beforeAds }) {
  return (
    <div style={{ flex: "1 1 180px", border: "1px solid #e3e8f0", borderRadius: 10, padding: "10px 12px", background: "#fff", textAlign: "left" }}>
      <div style={{ fontSize: 12, color: "#7a8699" }}>{title}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: now < 0 ? "#b03a2e" : "#1f2d45" }}>{fmt(now)}</div>
      <div style={{ fontSize: 12 }}>
        {beforeAds ? null : <Change now={now} before={before} invert={invert} />}{" "}
        <span style={{ color: "#7a8699" }}>vs {fmt(before)} {sub}{beforeAds ? " (before ads)" : ""}</span>
      </div>
    </div>
  );
}

function Bars({ title, rows, field, partialIdx }) {
  // rows: [{label, now, before}] - this year (dark) vs last year (light)
  const W = 1000, H = 240, L = 64, R = 10, T = 12, B = 30;
  const vals = rows.flatMap((r) => [r.now?.[field], r.before?.[field]]).filter((v) => v != null);
  const max = Math.max(1, ...vals), min = Math.min(0, ...vals);
  const y = (v) => T + ((max - v) / (max - min)) * (H - T - B);
  const slot = (W - L - R) / rows.length, bw = slot * 0.36;
  const [hover, setHover] = useState(null);
  const h = hover != null ? rows[hover] : null;
  return (
    <div style={{ position: "relative", marginBottom: 14 }}>
      <div style={{ fontWeight: 600, fontSize: 14, margin: "4px 0" }}>
        {title}{" "}
        <span style={{ fontWeight: 400, fontSize: 12, color: "#7a8699" }}>
          <span style={{ display: "inline-block", width: 10, height: 10, background: "#c9d6e8", margin: "0 4px 0 8px" }} />last year
          <span style={{ display: "inline-block", width: 10, height: 10, background: "#1f5fbf", margin: "0 4px 0 10px" }} />this year
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", display: "block" }} onMouseLeave={() => setHover(null)}>
        {Array.from({ length: 5 }, (_, i) => min + ((max - min) * i) / 4).map((v) => (
          <g key={v}>
            <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} stroke="#eee" />
            <text x={L - 6} y={y(v) + 4} textAnchor="end" fontSize="11" fill="#777">{money(v)}</text>
          </g>
        ))}
        <line x1={L} x2={W - R} y1={y(0)} y2={y(0)} stroke="#999" />
        {rows.map((r, i) => {
          const x = L + slot * i + slot / 2;
          const b = r.before?.[field], n = r.now?.[field];
          const bar = (v, x0, color) =>
            v == null ? null : <rect x={x0} y={v >= 0 ? y(v) : y(0)} width={bw} height={Math.abs(y(v) - y(0))} fill={v < 0 ? "#e6a39b" : color} />;
          return (
            <g key={r.label} onMouseEnter={() => setHover(i)} opacity={i === partialIdx ? 0.55 : 1}>
              <rect x={L + slot * i} y={T} width={slot} height={H - T - B} fill={hover === i ? "#f4f7fb" : "transparent"} />
              {bar(b, x - bw - 1, "#c9d6e8")}
              {bar(n, x + 1, n < 0 ? "#b03a2e" : "#1f5fbf")}
              <text x={x} y={H - B + 14} textAnchor="middle" fontSize="11" fill="#555">{r.label}{i === partialIdx ? "*" : ""}</text>
            </g>
          );
        })}
      </svg>
      {h && (
        <div style={{ position: "absolute", top: 24, left: hover < rows.length / 2 ? "55%" : "10%", background: "#fff", border: "1px solid #ccc", borderRadius: 6, padding: "6px 10px", fontSize: 12, pointerEvents: "none" }}>
          <b>{h.label}</b>: {money(h.now?.[field])} this year · {money(h.before?.[field])} last year{" "}
          <Change now={h.now?.[field] || 0} before={h.before?.[field] || 0} />
        </div>
      )}
    </div>
  );
}

const th = { textAlign: "right", padding: "5px 8px", borderBottom: "2px solid #dfe5ee", fontSize: 12, color: "#4a5870", whiteSpace: "nowrap" };
const td = { textAlign: "right", padding: "4px 8px", borderBottom: "1px solid #eef1f5", fontSize: 13, whiteSpace: "nowrap" };

function CompareTable({ title, rows, firstCol }) {
  return (
    <div style={{ overflowX: "auto", marginBottom: 18 }}>
      <div style={{ fontWeight: 600, fontSize: 14, margin: "4px 0", textAlign: "left" }}>{title}</div>
      <table style={{ borderCollapse: "collapse", width: "100%" }}>
        <thead>
          <tr>
            <th style={{ ...th, textAlign: "left" }}>{firstCol}</th>
            <th style={th}>Units</th>
            <th style={th}>Sales</th>
            <th style={th}>Last year</th>
            <th style={th}>Growth</th>
            <th style={th}>Profit</th>
            <th style={th}>Last year</th>
            <th style={th}>Growth</th>
            <th style={th}>Margin</th>
            <th style={th}>Ads</th>
            <th style={th}>TACOS</th>
            <th style={th}>TACOS LY</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label} style={r.bold ? { fontWeight: 700, background: "#f6f8fb" } : r.partial ? { color: "#7a8699" } : null}>
              <td style={{ ...td, textAlign: "left" }}>{r.label}{r.partial ? " *" : ""}</td>
              <td style={td}>{Math.round(r.now.units).toLocaleString("en-US")}</td>
              <td style={td}>{money(r.now.sales)}</td>
              <td style={{ ...td, color: "#7a8699" }}>{r.before.sales ? money(r.before.sales) : "—"}</td>
              <td style={td}><Change now={r.now.sales} before={r.before.sales} /></td>
              <td style={{ ...td, color: r.now.profit < 0 ? "#b03a2e" : undefined }}>{money(r.now.profit)}</td>
              <td style={{ ...td, color: "#7a8699" }} title={r.before.beforeAds ? "before ads - no ad data per product before 2026" : undefined}>
                {r.before.sales ? money(r.before.profit) + (r.before.beforeAds ? " †" : "") : "—"}
              </td>
              <td style={td}>{r.before.sales && !r.before.beforeAds ? <Change now={r.now.profit} before={r.before.profit} /> : "—"}</td>
              <td style={td}>{r.now.margin == null ? "—" : `${r.now.margin.toFixed(0)}%`}</td>
              <td style={td}>{money(r.now.adsAll)}</td>
              <td style={td}>{r.now.tacos == null ? "—" : `${r.now.tacos.toFixed(0)}%`}</td>
              <td style={{ ...td, color: "#7a8699" }}>{r.before.tacos == null ? "—" : `${r.before.tacos.toFixed(0)}%`}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function GrowthPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [mp, setMp] = useState("all");
  const [dept, setDept] = useState("all");

  useEffect(() => {
    fetch(`${LOCAL_API_BASE}/GetGrowthData`)
      .then((r) => r.json())
      .then((d) => (d.error ? setError(d.error) : setData(d)))
      .catch((e) => setError(e.message));
  }, []);

  const view = useMemo(() => {
    if (!data) return null;
    const months = data.months || {};
    PPC = data.ppc || {};
    ADS_FROM = data.productAdsFrom || "2026-01";
    const today = data.today || new Date().toISOString().slice(0, 10);
    const Y = +today.slice(0, 4), M = +today.slice(5, 7), D = +today.slice(8, 10);
    const mps = MP_GROUPS.find((g) => g[0] === mp)[2];
    const key = (y, m) => `${y}-${String(m).padStart(2, "0")}`;
    // current month vs the same days last year would need daily data; the
    // current month is shown greyed (partial) and left out of YTD comparisons
    const fullMonths = Array.from({ length: M - 1 }, (_, i) => i + 1);
    const ytd = sumMonths(months, fullMonths.map((m) => key(Y, m)), mps, dept);
    const ytdLy = sumMonths(months, fullMonths.map((m) => key(Y - 1, m)), mps, dept);
    const lastM = M === 1 ? [Y - 1, 12] : [Y, M - 1];
    const lm = sumMonths(months, [key(...lastM)], mps, dept);
    const lmLy = sumMonths(months, [key(lastM[0] - 1, lastM[1])], mps, dept);
    const rows12 = [];
    for (let i = 11; i >= 0; i--) {
      let y = Y, m = M - i;
      if (m <= 0) { m += 12; y -= 1; }
      const now = months[key(y, m)] ? sumMonths(months, [key(y, m)], mps, dept) : null;
      const before = months[key(y - 1, m)] ? sumMonths(months, [key(y - 1, m)], mps, dept) : null;
      rows12.push({ label: `${MONTHS[m - 1]} ${String(y).slice(2)}`, now, before, partial: y === Y && m === M });
    }
    const monthRows = rows12
      .filter((r) => r.now)
      .map((r) => ({ ...r, before: r.before || finish(empty()) }))
      .reverse();
    const fullKeys = fullMonths.map((m) => key(Y, m)), lyKeys = fullMonths.map((m) => key(Y - 1, m));
    const mpRows = TABLE_MPS.map((x) => ({
      label: MP_NAME[x],
      now: sumMonths(months, fullKeys, [x], dept),
      before: sumMonths(months, lyKeys, [x], dept),
    })).filter((r) => r.now.units || r.before.units);
    mpRows.sort((a, b) => b.now.sales - a.now.sales);
    mpRows.push({ label: "All", now: sumMonths(months, fullKeys, null, dept), before: sumMonths(months, lyKeys, null, dept), bold: true });
    const deptRows = [["pareo", "Pareo"], ["home", "Home decor"], ["other", "Not mapped"]].map(([d, n]) => ({
      label: n,
      now: sumMonths(months, fullKeys, mps, d),
      before: sumMonths(months, lyKeys, mps, d),
    })).filter((r) => r.now.units || r.before.units);
    const yearRows = [Y - 1, Y].map((y) => {
      const ks = Object.keys(months).filter((k) => k.startsWith(`${y}-`) && !(y === Y && k === key(Y, M)));
      return { label: `${y}${y === Y ? ` (Jan–${MONTHS[M - 2] || "Dec"})` : ""}`, t: sumMonths(months, ks, mps, dept) };
    });
    return { Y, M, D, ytd, ytdLy, lm, lmLy, lastM, rows12, monthRows, mpRows, deptRows, yearRows, noCost: ytd.noCostUnits };
  }, [data, mp, dept]);

  const card = { background: "#fff", border: "1px solid #e3e8f0", borderRadius: 12, padding: "14px 16px", marginBottom: 16 };
  const sel = { padding: "5px 8px", borderRadius: 6, border: "1px solid #ccd3df", fontSize: 14, width: "auto", margin: 0 };

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: "16px", boxSizing: "border-box" }}>
      <h2 style={{ marginTop: 0, textAlign: "left" }}>📈 Sales & profit growth</h2>
      {error && <div style={{ color: "#b00020" }}>{error}</div>}
      {!error && !data && <div style={{ color: "#777" }}>Loading...</div>}
      {view && (
        <>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 14 }}>
            <select style={sel} value={mp} onChange={(e) => setMp(e.target.value)}>
              {MP_GROUPS.map(([k, n]) => <option key={k} value={k}>{n}</option>)}
            </select>
            <select style={sel} value={dept} onChange={(e) => setDept(e.target.value)}>
              {DEPTS.map(([k, n]) => <option key={k} value={k}>{n}</option>)}
            </select>
            {data.planUrl && (
              <a href={data.planUrl} target="_blank" rel="noreferrer" style={{ fontSize: 14 }}>📄 Sales Growth Plan 2026-27</a>
            )}
            <span style={{ fontSize: 12, color: "#7a8699" }}>updated {data.updated}</span>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
            <Kpi title={`Sales ${view.Y} (Jan–${MONTHS[view.M - 2] || "Dec"})`} now={view.ytd.sales} before={view.ytdLy.sales} sub={view.Y - 1} />
            <Kpi title={`Profit ${view.Y} (Jan–${MONTHS[view.M - 2] || "Dec"})`} now={view.ytd.profit} before={view.ytdLy.profit} sub={view.Y - 1} beforeAds={view.ytdLy.beforeAds} />
            <Kpi title={`Sales ${MONTHS[view.lastM[1] - 1]} ${view.lastM[0]}`} now={view.lm.sales} before={view.lmLy.sales} sub={view.lastM[0] - 1} />
            <Kpi title={`Profit ${MONTHS[view.lastM[1] - 1]} ${view.lastM[0]}`} now={view.lm.profit} before={view.lmLy.profit} sub={view.lastM[0] - 1} beforeAds={view.lmLy.beforeAds} />
            <Kpi title={`TACOS ${view.Y} (Jan–${MONTHS[view.M - 2] || "Dec"})`} now={view.ytd.tacos} before={view.ytdLy.beforeAds ? null : view.ytdLy.tacos} sub={view.Y - 1}
              fmt={(v) => (v == null ? "—" : `${v.toFixed(1)}%`)} invert />
          </div>

          <div style={card}>
            <Bars title="Sales per month (USD)" rows={view.rows12} field="sales" partialIdx={11} />
            <Bars title="Profit per month (USD, after product cost, fees, ads, returns, storage)" rows={view.rows12} field="profit" partialIdx={11} />
          </div>

          <div style={card}>
            <CompareTable title="Per month vs the same month last year" rows={view.monthRows} firstCol="Month" />
          </div>
          <div style={card}>
            <CompareTable title={`Per marketplace, ${view.Y} Jan–${MONTHS[view.M - 2] || "Dec"} vs the same months of ${view.Y - 1}`} rows={view.mpRows} firstCol="Marketplace" />
            <CompareTable title={`Per department, ${view.Y} Jan–${MONTHS[view.M - 2] || "Dec"} vs ${view.Y - 1}`} rows={view.deptRows} firstCol="Department" />
          </div>

          <div style={{ fontSize: 12, color: "#7a8699", textAlign: "left", lineHeight: 1.5 }}>
            Amazon orders by order date (Los Angeles time), cancelled orders left out, all amounts in USD at today's rates.
            Profit = sales without VAT − Amazon fees − product cost (landed) − SP/SD ads − SB share − returns − FBA storage − AWD,
            the same formula as the product page and the monthly profit on /checks. Data starts January 2025, so growth % starts in 2026.
            * = current month, not finished (left out of the year totals). FBA storage for a month arrives on the 10th of the next month.
            {view.noCost > 0 && ` ${Math.round(view.noCost)} units this year have no product cost (not mapped / no supplier invoice), so their profit is too high.`}
            {" "}Ads: with "All products" the marketplaces' total ad spend per month (all ad types) is used, the same way in both years;
            per department the product ad cost (SP/SD + SB share) is used, which only exists from 2026 - so 2025 department profit is before ads (marked †, no growth % shown).
            {" "}Etsy and new platforms are not in here yet.
          </div>
        </>
      )}
    </div>
  );
}
