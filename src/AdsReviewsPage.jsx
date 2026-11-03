import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { buttonStyle } from "./buttonStyle";
import AdsChecklist from "./AdsChecklist";
import { ChecksView } from "./ChecksPage";

// Ads reviews (2026-10-18, per the user: "update the reviews to dedicated
// page"). Every Monday review (weekly changes review with TACOS + home decor
// vs pareo split and lost-exposure keywords, weekly bid-change results) is saved to PocketBase
// ads_reviews by its job and shown here; "Preview now" builds the changes
// review live (dry run - nothing is sent or saved).
const API_BASE = import.meta.env.VITE_API_BASE || "https://amzapi.mandalalifeart.com";

const page = { padding: "16px", background: "#f6f7f9", color: "#222", minHeight: "100vh", fontFamily: "system-ui, sans-serif" };
const card = { background: "#fff", color: "#222", border: "1px solid #ddd", borderRadius: "8px", padding: "14px", marginBottom: "14px" };
const th = { border: "1px solid #ccc", padding: "6px 8px", background: "#eef1f5", color: "#222", fontSize: "12px", textAlign: "right", whiteSpace: "nowrap" };
const td = { border: "1px solid #ddd", padding: "5px 8px", fontSize: "13px", color: "#222" };
const num = { ...td, textAlign: "right", whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" };
const muted = { color: "#666", fontSize: "12px" };
const pre = { whiteSpace: "pre-wrap", fontFamily: "system-ui, sans-serif", fontSize: "13px", lineHeight: 1.45, margin: 0 };

const JOBS = {
  "weekly-changes-review": "Weekly changes review",
  "weekly-bid-change-summary": "Bid-change results",
};

const pct = (v) => (v === null || v === undefined ? "–" : `${Math.round(v)}%`);
const money = (v) => Number(v || 0).toLocaleString(undefined, { maximumFractionDigits: 0 });

function tacosColor(v, target) {
  if (v === null || v === undefined) return "#222";
  if (v > target + 3) return "#b3261e";
  if (v > target) return "#b26a00";
  return "#1e7b34";
}

function TacosTable({ rows }) {
  if (!rows?.length) return null;
  return (
    <div style={card}>
      <h3 style={{ marginTop: 0 }}>TACOS per marketplace</h3>
      <div style={muted}>Ad spend / all sales (own currency). Target = 10% profit (marketplace departments weighted by sales). Green = on target, orange = up to 3 points above, red = more.</div>
      <table style={{ borderCollapse: "collapse", marginTop: "8px" }}>
        <thead>
          <tr>
            <th style={{ ...th, textAlign: "left" }}>Market</th>
            <th style={th}>Last month</th>
            <th style={th}>This month to date</th>
            <th style={th}>Target</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.market}>
              <td style={td}>{r.market}</td>
              <td style={{ ...num, color: tacosColor(r.prev, r.target) }}>{pct(r.prev)}</td>
              <td style={{ ...num, color: tacosColor(r.cur, r.target), fontWeight: 600 }}>{pct(r.cur)}</td>
              <td style={num}>{r.target}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SegmentTable({ rows, tacosRows }) {
  if (!rows?.length) return null;
  const target = (m, r) => r?.target ?? (tacosRows || []).find((t) => t.market === m)?.target ?? 20;
  return (
    <div style={card}>
      <h3 style={{ marginTop: 0 }}>Home decor vs pareo</h3>
      <div style={muted}>
        Ad spend by campaign portfolio/name, all sales per ASIN from Business Reports. This month's ACOS drops as late ad sales arrive; TACOS has no delay.
      </div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ borderCollapse: "collapse", marginTop: "8px" }}>
          <thead>
            <tr>
              <th style={{ ...th, textAlign: "left" }} rowSpan={2}>Market</th>
              <th style={{ ...th, textAlign: "left" }} rowSpan={2}>Segment</th>
              <th style={th} rowSpan={2}>Target TACOS</th>
              <th style={{ ...th, textAlign: "center" }} colSpan={4}>Last month</th>
              <th style={{ ...th, textAlign: "center" }} colSpan={4}>This month to date</th>
            </tr>
            <tr>
              {["Spend", "Sales", "ACOS", "TACOS", "Spend", "Sales", "ACOS", "TACOS"].map((h, i) => (
                <th key={i} style={th}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={`${r.market}-${r.segment}`} style={{ background: r.segment === "pareo" ? "#fafbfc" : "#fff" }}>
                <td style={td}>{r.market}</td>
                <td style={td}>{r.status ? `${r.status} ` : ""}{r.segment}</td>
                <td style={num}>{r.target == null ? "–" : `${r.target}%`}</td>
                {["prev", "cur"].map((k) => [
                  <td key={`${k}s`} style={num}>{money(r[k].spend)}</td>,
                  <td key={`${k}t`} style={num}>{money(r[k].sales)}</td>,
                  <td key={`${k}a`} style={num}>{pct(r[k].acos)}</td>,
                  <td key={`${k}c`} style={{ ...num, color: tacosColor(r[k].tacos, target(r.market, r)), fontWeight: 600 }}>{pct(r[k].tacos)}</td>,
                ])}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function LostExposureTable({ rows }) {
  if (!rows) return null;
  return (
    <div style={card}>
      <h3 style={{ marginTop: 0 }}>Lost exposure ({rows.length})</h3>
      <div style={muted}>
        Keywords/targets with 3+ orders in the 60 days ending 2 weeks ago that now get under 25% of their usual weekly impressions. Keywords we paused ourselves, paused campaigns and pareo (winter mode) are left out.
      </div>
      {rows.length === 0 ? (
        <div style={{ marginTop: "8px" }}>None 👍</div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ borderCollapse: "collapse", marginTop: "8px" }}>
            <thead>
              <tr>
                {["Country", "Campaign", "Keyword / target", "Match"].map((h) => <th key={h} style={{ ...th, textAlign: "left" }}>{h}</th>)}
                {["Orders before", "Sales before", "ACOS before", "Usual impr/week", "Last week impr", "Bid then", "Bid now"].map((h) => <th key={h} style={th}>{h}</th>)}
                <th style={{ ...th, textAlign: "left" }}>Our changes</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i}>
                  <td style={td}>{r.country}</td>
                  <td style={td}>{r.campaign}</td>
                  <td style={td}>{r.target}</td>
                  <td style={td}>{(r.match || "").toLowerCase()}</td>
                  <td style={num}>{r.orders}</td>
                  <td style={num}>{money(r.sales)}</td>
                  <td style={num}>{pct(r.acos)}</td>
                  <td style={num}>{money(r.weeklyImpr)}</td>
                  <td style={{ ...num, color: "#b3261e", fontWeight: 600 }}>{money(r.lastWeekImpr)}</td>
                  <td style={num}>{r.bidThen == null ? "–" : r.bidThen.toFixed(2)}</td>
                  <td style={num}>{r.bidNow == null ? "paused/none" : r.bidNow.toFixed(2)}</td>
                  <td style={{ ...td, fontSize: "12px" }}>{r.changes?.length ? r.changes.join(", ") : "none"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function TextCard({ title, text, open = false }) {
  const [shown, setShown] = useState(open);
  if (!text) return null;
  return (
    <div style={card}>
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        <h3 style={{ margin: 0 }}>{title}</h3>
        <button style={buttonStyle()} onClick={() => setShown((s) => !s)}>{shown ? "Hide" : "Show"}</button>
      </div>
      {shown && <pre style={{ ...pre, marginTop: "10px" }}>{text}</pre>}
    </div>
  );
}


const PROPOSAL_KEY = import.meta.env.VITE_PROPOSAL_KEY || "";
// Every number of the TACOS framework (per the user 2026-11-03: "lets make all
// the numbers configurable") + the TACOS targets it produces.
const RULE_LABELS = {
  profitPct: ["Profit wanted after everything", "% of sales without VAT"],
  gapPct: ["Overheads + real costs beyond the model", "% of sales"],
  smallSales: ["Small market: under", "USD sales in 12 months → uses the EU/US target"],
  minUnits: ["Units sold in the month for a raise / cut", "units"],
  capAtMinUnits: ["Max bid change at that many units", "%"],
  fullUnits: ["Units for the full cap", "units"],
  capAtFullUnits: ["Max bid change at full units", "%"],
  noSaleSpend: ["Ad spend with too few units → cut", "own currency"],
  noSaleCut: ["That cut", "%"],
  skipChangedDays: ["Don't touch bids changed in the last", "days"],
  historyDays: ["History before a pause", "days"],
  historyOrders: ["Orders in that history → pause is temporary", "orders"],
  orangeBand: ["Orange up to target +", "points (above = red, only cuts)"],
  growBand: ["Room to grow at target −", "points"],
  pareoSeasonRestart: ["No pareo raises before", "date"],
};

function RulesCard() {
  const [cfg, setCfg] = useState(null);
  const [draft, setDraft] = useState({});
  const [targets, setTargets] = useState(null);
  const [msg, setMsg] = useState("");
  const [open, setOpen] = useState(false);
  const load = () => {
    fetch(`${API_BASE}/GetAdsRulesConfig`).then((r) => r.json()).then((d) => { setCfg(d.config); setDraft(d.config); });
    fetch(`${API_BASE}/GetTacosTargets`).then((r) => r.json()).then((d) => !d.error && setTargets(d));
  };
  useEffect(load, []);
  async function save() {
    setMsg("Saving…");
    const r = await fetch(`${API_BASE}/SetAdsRulesConfig?key=${encodeURIComponent(PROPOSAL_KEY)}`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(draft),
    });
    const d = await r.json();
    if (d.error) return setMsg(d.error);
    setCfg(d.config);
    setMsg("Saved. Recalculating the targets (about 5 minutes) – reload the page after that.");
    fetch(`${API_BASE}/UpdateTacosTargets`).catch(() => {});
  }
  const rows = Object.entries(targets?.targets || {}).sort(([a], [b]) => a.localeCompare(b));
  return (
    <div style={card}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }} onClick={() => setOpen((o) => !o)}>
        <h3 style={{ margin: 0 }}>{open ? "▾" : "▸"} ⚙️ Rules & TACOS targets</h3>
        {targets && <span style={muted}>targets from {targets.from} – {targets.to} · {targets.profitPct}% profit</span>}
      </div>
      {open && (
        <>
          <div style={{ ...muted, margin: "8px 0" }}>
            Target TACOS = (profit before ads − profit% × sales without VAT − overheads% × sales) ÷ sales, per marketplace × department, last 12 months.
            Keyword ACOS limit (used by bid raises, harvest, bid optimizer) = target TACOS ÷ the share of sales that comes through ads.
            Monthly bid rule: new bid = bid × target ÷ item TACOS, capped by units sold.
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ borderCollapse: "collapse", marginBottom: "10px" }}>
              <thead>
                <tr>{["Market", "Dept", "Sales 12m", "Before ads", "Target TACOS", "TACOS 12m", "Ad share", "ACOS limit", "Source"].map((h) => <th key={h} style={th}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {rows.map(([k, t]) => {
                  const [mkt, dept] = k.split("|");
                  return (
                    <tr key={k}>
                      <td style={td}>{mkt}</td>
                      <td style={td}>{dept === "home" ? "home decor" : dept}</td>
                      <td style={num}>${money(t.sales)}</td>
                      <td style={num}>{pct(t.beforeAdsPct)}</td>
                      <td style={{ ...num, fontWeight: 700 }}>{t.targetTacos}%</td>
                      <td style={{ ...num, color: tacosColor(t.tacos, t.targetTacos) }}>{t.tacos}%</td>
                      <td style={num}>{t.adShare == null ? "–" : `${t.adShare}%`}</td>
                      <td style={num}>{t.acosLimit == null ? "–" : `${t.acosLimit}%`}</td>
                      <td style={td}>{t.source === "own" ? "own" : `${t.source} value`}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {cfg && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "6px 16px" }}>
              {Object.entries(RULE_LABELS).map(([k, [label, unit]]) => (
                <label key={k} style={{ fontSize: "13px", display: "flex", alignItems: "center", gap: "6px" }}>
                  <span style={{ flex: 1 }}>{label}</span>
                  <input value={draft[k] ?? ""} onChange={(e) => setDraft((d) => ({ ...d, [k]: e.target.value }))}
                    style={{ width: k === "pareoSeasonRestart" ? "100px" : "60px", padding: "3px", textAlign: "right", background: "#fff", color: "#222", border: "1px solid #bbb", borderRadius: "4px" }} />
                  <span style={{ ...muted, width: "120px" }}>{unit}</span>
                </label>
              ))}
            </div>
          )}
          <div style={{ marginTop: "10px", display: "flex", gap: "10px", alignItems: "center" }}>
            <button style={buttonStyle()} onClick={save}>Save & recalculate</button>
            <span style={muted}>{msg}</span>
          </div>
        </>
      )}
    </div>
  );
}

function AdsChecks() {
  const [kind, setKind] = useState("monthly");
  const [period, setPeriod] = useState("");
  return (
    <div style={card}>
      <h3 style={{ marginTop: 0 }}>Ads checks & proposals</h3>
      <div style={muted}>Weekly and monthly ads checks with their proposals – tick to approve, applied within 10 minutes.</div>
      <ChecksView area="ads" kind={kind} period={period} onKind={(k) => { setKind(k); setPeriod(""); }} onPeriod={setPeriod} />
    </div>
  );
}

export default function AdsReviewsPage() {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [date, setDate] = useState("");
  const [preview, setPreview] = useState(null);
  const [previewing, setPreviewing] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`${API_BASE}/GetAdsReviews`);
        const j = await r.json();
        if (j.error) throw new Error(j.error);
        setReviews(j.reviews || []);
        if (j.reviews?.length) setDate(j.reviews[0].run_date);
      } catch (e) {
        setError(String(e.message || e));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const dates = useMemo(() => [...new Set(reviews.map((r) => r.run_date))], [reviews]);
  const forDate = (job) => reviews.find((r) => r.run_date === date && r.job === job);
  const changes = preview || forDate("weekly-changes-review");
  const bids = preview ? null : forDate("weekly-bid-change-summary");

  async function runPreview() {
    setPreviewing(true);
    setError("");
    try {
      const r = await fetch(`${API_BASE}/SendWeeklyChangesReview?dry=1`);
      const j = await r.json();
      if (j.error) throw new Error(j.error);
      if (j.acceptedInBackground) throw new Error("The preview took too long - try again in a minute.");
      setPreview({ job: "weekly-changes-review", run_date: "preview", text: j.text, data: j.data });
    } catch (e) {
      setError(String(e.message || e));
    } finally {
      setPreviewing(false);
    }
  }

  return (
    <div style={page}>
      <div style={{ marginBottom: "10px" }}>
        <Link to="/" style={{ color: "#1a4fa0" }}>Home</Link> · <Link to="/ads-campaigns" style={{ color: "#1a4fa0" }}>Ads</Link>
      </div>
      <h2 style={{ marginTop: 0 }}>Ads reviews</h2>
      <RulesCard />
      <AdsChecks />
      <AdsChecklist />
      <div style={{ ...card, display: "flex", flexWrap: "wrap", gap: "10px", alignItems: "center" }}>
        <label>
          Review of{" "}
          <select
            value={preview ? "preview" : date}
            onChange={(e) => { setPreview(null); setDate(e.target.value); }}
            style={{ padding: "6px", borderRadius: "6px", border: "1px solid #bbb", background: "#fff", color: "#222" }}
          >
            {preview && <option value="preview">Live preview</option>}
            {dates.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        </label>
        <button style={buttonStyle()} onClick={runPreview} disabled={previewing}>
          {previewing ? "Building…" : "Preview now"}
        </button>
        <span style={muted}>Saved every Monday after the Telegram review is sent. Preview builds today's review without sending it (about a minute).</span>
      </div>
      {loading && <div style={card}>Loading…</div>}
      {error && <div style={{ ...card, color: "#b3261e" }}>{error}</div>}
      {!loading && !changes && !bids && !error && <div style={card}>No saved reviews yet - the first one is saved on Monday, or use Preview now.</div>}
      {changes?.data && (
        <div style={muted}>
          Period {changes.data.from} – {changes.data.to} · flags on watched changes: {changes.data.flags ?? "–"}
        </div>
      )}
      <TacosTable rows={changes?.data?.tacos} />
      <SegmentTable rows={changes?.data?.segments} tacosRows={changes?.data?.tacos} />
      <LostExposureTable rows={changes?.data?.lostExposure} />
      <TextCard title={JOBS["weekly-changes-review"]} text={changes?.text} open />
      <TextCard title={JOBS["weekly-bid-change-summary"]} text={bids?.text} />
    </div>
  );
}
