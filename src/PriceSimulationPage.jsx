import { Fragment, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

// Profit simulation per landed cost (per the user 2026-11-03: "prepare profit
// simulation page for each landing price"). Products are grouped by landed
// cost; set a price for a whole tier or per product and see profit per unit,
// margin and the period's total profit at the same units.
// profit/unit = P/(1+VAT) - referral% x P - FBA fee - landed - ads/unit - other/unit
// (ads + returns/storage per unit kept at the period's level).
const LOCAL_API_BASE = "https://amzapi.mandalalifeart.com";
const KEY = import.meta.env.VITE_PROPOSAL_KEY || "";
const PAGE = "price-simulation";
const MPS = ["US", "UK", "DE", "FR", "IT", "ES"];
const SYM = { USD: "$", EUR: "€", GBP: "£" };

const th = { padding: "6px 8px", borderBottom: "2px solid #d6dde8", textAlign: "right", fontSize: "12px", color: "#4a5870", whiteSpace: "nowrap", background: "#f6f8fb", position: "sticky", top: 0 };
const td = { padding: "5px 8px", borderBottom: "1px solid #eef1f5", textAlign: "right", fontSize: "13px", whiteSpace: "nowrap" };
const inp = { width: "64px", padding: "3px 4px", fontSize: "13px", border: "1px solid #ccd3df", borderRadius: "5px", textAlign: "right" };

function profitAt(r, P, vat, opt) {
  if (r.landed == null || !P) return null;
  const net = P / (1 + vat);
  const p = net - r.referralPct * P - r.fba - r.landed - (opt.ads ? r.adsPerUnit : 0) - (opt.other ? r.otherPerUnit : 0);
  return { profit: p, margin: net ? (p / net) * 100 : null };
}

// Price that gives the target margin m (on price w/o VAT):
// P/(1+v) - ref*P - costs = m*P/(1+v)  =>  P = costs / ((1-m)/(1+v) - ref)
function priceForMargin(r, m, vat, opt) {
  if (r.landed == null) return null;
  const costs = r.fba + r.landed + (opt.ads ? r.adsPerUnit : 0) + (opt.other ? r.otherPerUnit : 0);
  const k = (1 - m / 100) / (1 + vat) - r.referralPct;
  return k > 0 ? costs / k : null;
}

// Notes the user leaves for themself (per the user 2026-11-03), stored in
// PocketBase page_notes: "general" + one per product and marketplace.
function NoteBox({ value, onSave, rows = 2, placeholder }) {
  const [text, setText] = useState(value || "");
  const [state, setState] = useState("");
  useEffect(() => setText(value || ""), [value]);
  const save = () => {
    if (text.trim() === (value || "").trim()) return;
    setState("saving…");
    onSave(text).then(() => setState("saved ✓")).catch((e) => setState("not saved: " + e.message));
  };
  return (
    <div>
      <textarea value={text} rows={rows} placeholder={placeholder} onChange={(e) => setText(e.target.value)} onBlur={save}
        style={{ width: "100%", boxSizing: "border-box", fontSize: "13px", padding: "6px", border: "1px solid #ccd3df", borderRadius: "6px", fontFamily: "inherit", background: "#fffdf3", color: "#222" }} />
      {state && <div style={{ fontSize: "11px", color: "#7a8699" }}>{state}</div>}
    </div>
  );
}

// Price plan (per the user 2026-11-05, rules A-E agreed in chat). Thresholds are
// relative to the price without VAT so they work in every currency
// (US $69.99 → ads > ~$20/unit = B, ads < ~$8/unit = C).
//   B fix ads first   ads/unit > 28% of net price → keep the price, cut ads (TACOS rule)
//   C test +7%        ads/unit < 12% of net, margin after ads > 30%, >= 3 units/month → price x1.07 (x.99), 4 weeks
//   D coupon 10%      < 5 units/month and >= 15 in stock → 10% coupon for a month (no price cut)
//   E wait            price changed in the last 14 days → no new change yet
//   A keep            everything else
const PLAN_INFO = {
  B: { label: "Fix ads first", color: "#c0392b", bg: "#fdecea" },
  C: { label: "Test higher price", color: "#1e8449", bg: "#e8f6ee" },
  D: { label: "10% coupon, 1 month", color: "#8a5a00", bg: "#fff4dc" },
  E: { label: "Wait (price just changed)", color: "#5a6780", bg: "#eef1f5" },
  A: { label: "Keep price", color: "#5a6780", bg: "#f6f8fb" },
};

const up99 = (x) => Math.ceil(x) - 0.01;

function planFor(r, vat, days) {
  if (r.landed == null || !r.price) return null;
  const net = r.price / (1 + vat);
  const perMonth = (r.units || 0) / (days / 30);
  const p = profitAt(r, r.price, vat, { ads: true, other: true });
  const changedDays = r.priceSince ? (Date.now() - new Date(r.priceSince)) / 86400000 : 999;
  if (r.units && r.adsPerUnit > 0.28 * net) return { action: "B", why: `ads ${r.adsPerUnit.toFixed(2)}/unit = ${(r.adsPerUnit / net * 100).toFixed(0)}% of the price w/o VAT`, target: r.price };
  if (changedDays < 14) return { action: "E", why: `price changed ${r.priceSince}`, target: r.price };
  if (perMonth >= 3 && r.adsPerUnit < 0.12 * net && p && p.margin > 30)
    return { action: "C", why: `margin ${p.margin.toFixed(0)}%, ads only ${(r.adsPerUnit / net * 100).toFixed(0)}% of price, ${perMonth.toFixed(1)}/month`, target: up99(r.price * 1.07) };
  if (perMonth < 5 && (r.stock || 0) >= 15 && !r.endOfLife)
    return { action: "D", why: `${perMonth.toFixed(1)} sold/month, ${r.stock} in stock`, target: +(r.price * 0.9).toFixed(2) };
  return { action: "A", why: p ? `margin ${p.margin.toFixed(0)}%` : "", target: r.price };
}

function PricePlan({ data, days, mp, notes, saveNote, fmt }) {
  const [show, setShow] = useState({ A: false, E: false });
  const [edit, setEdit] = useState({});
  const rows = data.rows.map((r) => ({ r, plan: planFor(r, data.vat || 0, days) })).filter((x) => x.plan);
  const groups = ["B", "C", "D", "E", "A"].map((a) => ({ a, items: rows.filter((x) => x.plan.action === a) }));
  const keyOf = (r) => `plan|${mp}|${r.asin}`;
  const approved = (r) => (notes[keyOf(r)] || "").startsWith("approved");
  // The suggested target can be overridden (per the user 2026-11-05): the typed
  // value is what gets approved; editing an approved row re-saves it on blur.
  const storedTarget = (r) => { const p = (notes[keyOf(r)] || "").split("|"); return p[0] === "approved" && p[2] ? p[2] : null; };
  const targetOf = (r, plan) => { const v = parseFloat(edit[r.asin] ?? storedTarget(r) ?? plan.target); return v > 0 ? v : plan.target; };
  const approveText = (r, plan) => `approved|${plan.action}|${targetOf(r, plan).toFixed(2)}|${new Date().toISOString().slice(0, 10)}`;
  const toggle = (r, plan) => saveNote(keyOf(r), approved(r) ? "" : approveText(r, plan));
  const resave = (r, plan) => { if (approved(r) && edit[r.asin] != null && storedTarget(r) !== targetOf(r, plan).toFixed(2)) saveNote(keyOf(r), approveText(r, plan)); };
  const nApproved = rows.filter((x) => approved(x.r)).length;
  return (
    <div style={{ border: "1px solid #d6dde8", borderRadius: "8px", padding: "10px 12px", marginBottom: "14px", background: "#fff" }}>
      <div style={{ fontWeight: 700, fontSize: "15px", marginBottom: "4px" }}>📋 Price plan · {mp} · last {days} days</div>
      {["DE", "FR", "IT", "ES"].includes(mp) && (
        <div style={{ fontSize: "12px", background: "#fff4dc", color: "#6b4a00", padding: "6px 8px", borderRadius: "5px", marginBottom: "6px" }}>
          ⚠️ {mp} prices come from Build International Listings (BIL), copied from Germany. Claude never changes them by API. A new price is set by you in Seller Central on the <b>DE</b> listing, and BIL copies it to FR/IT/ES/NL/BE. FR/IT/ES must stay equal to DE.
        </div>
      )}
      <div style={{ fontSize: "12px", color: "#5a6780", lineHeight: 1.5, marginBottom: "8px" }}>
        <b>B</b> ads per unit above 28% of the price (w/o VAT) → fix ads, keep the price ·
        <b> C</b> ads under 12%, margin after ads above 30%, 3+ sold a month → test +7% for 4 weeks (keep it if units drop less than 10%) ·
        <b> D</b> under 5 a month with 15+ in stock → 10% coupon for a month, not a price cut ·
        <b> E</b> price changed in the last 14 days → wait · <b>A</b> keep. Never change price and bids of one product in the same 2 weeks.
        For C and D you can type your own price instead of the suggested one (yellow = changed; it is saved with the tick, and re-saved if you change it after ticking). Tick ✓ the ones to do; Claude applies them when you say "do the price plan" ({nApproved} ticked).
      </div>
      {groups.map(({ a, items }) => {
        if (!items.length) return null;
        const info = PLAN_INFO[a];
        const collapsed = (a === "A" || a === "E") && !show[a];
        return (
          <div key={a} style={{ marginBottom: "8px" }}>
            <div onClick={() => setShow((s) => ({ ...s, [a]: !s[a] }))} style={{ cursor: "pointer", fontWeight: 700, fontSize: "13px", color: info.color, background: info.bg, padding: "4px 8px", borderRadius: "5px" }}>
              {a} · {info.label} ({items.length}){(a === "A" || a === "E") ? (collapsed ? " ▸" : " ▾") : ""}
            </div>
            {!collapsed && (
              <div style={{ overflowX: "auto" }}>
                <table style={{ borderCollapse: "collapse", width: "100%" }}>
                  <tbody>
                    {items.sort((x, y) => (y.r.units || 0) - (x.r.units || 0)).map(({ r, plan }) => {
                      const now = profitAt(r, r.price, data.vat || 0, { ads: true, other: true });
                      const before = profitAt(r, r.price, data.vat || 0, { ads: false, other: true });
                      const ok = approved(r);
                      return (
                        <tr key={r.asin} style={{ background: ok ? "#eaf7ee" : undefined }}>
                          <td style={{ ...td, textAlign: "left" }}>
                            <Link to={`/product?sku=${encodeURIComponent(r.sku)}`} target="_blank" rel="noopener noreferrer" style={{ color: "#1f2d45", textDecoration: "none" }}>{r.sku}</Link>
                            <div style={{ fontSize: "11px", color: "#7a8699" }}>{plan.why}</div>
                          </td>
                          <td style={td} title="units in the period">{r.units} sold</td>
                          <td style={td}>{fmt(r.price)}</td>
                          <td style={td} title="profit per unit before ads">before ads <b style={{ color: col(before?.profit) }}>{fmt(before?.profit)}</b></td>
                          <td style={td} title="ads per unit">ads {fmt(r.adsPerUnit)}</td>
                          <td style={td} title="profit per unit after ads">after <b style={{ color: col(now?.profit) }}>{fmt(now?.profit)}</b></td>
                          <td style={td}>
                            {(a === "C" || a === "D") ? (
                              <>{a === "D" ? "coupon → " : "→ "}<input title={`Suggested ${plan.target.toFixed(2)} – type your own price`}
                                style={{ ...inp, background: (edit[r.asin] ?? storedTarget(r)) != null && parseFloat(edit[r.asin] ?? storedTarget(r)) !== plan.target ? "#fff3c4" : "#fff", color: "#222" }}
                                value={edit[r.asin] ?? storedTarget(r) ?? plan.target.toFixed(2)} onChange={(e) => setEdit((s) => ({ ...s, [r.asin]: e.target.value }))} onBlur={() => resave(r, plan)} />
                                {a === "C" && (() => { const t = profitAt(r, targetOf(r, plan), data.vat || 0, { ads: true, other: true }); return t ? <span style={{ marginLeft: "6px", fontSize: "12px", color: col(t.profit) }} title="profit per unit after ads at this price">{fmt(t.profit)}</span> : null; })()}
                                {parseFloat(edit[r.asin] ?? storedTarget(r) ?? plan.target) !== plan.target && <span style={{ marginLeft: "4px", fontSize: "11px", color: "#7a8699" }}>(suggested {plan.target.toFixed(2)})</span>}</>
                            ) : "–"}
                          </td>
                          <td style={td}>
                            {(a === "B" || a === "C" || a === "D") && (
                              <label style={{ cursor: "pointer", fontSize: "12px" }}>
                                <input type="checkbox" checked={ok} onChange={() => toggle(r, plan)} /> {ok ? "approved" : "approve"}
                              </label>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

const col = (v) => (v == null ? "#999" : v < 0 ? "#c0392b" : "#1e8449");

export default function PriceSimulationPage() {
  const [mp, setMp] = useState("US");
  const [segment, setSegment] = useState("home");
  const [days, setDays] = useState(90);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [opt, setOpt] = useState({ ads: true, other: true });
  const [target, setTarget] = useState(25);
  const [tierPrice, setTierPrice] = useState({});
  const [rowPrice, setRowPrice] = useState({});
  const [open, setOpen] = useState({});
  const [notes, setNotes] = useState({});
  const [noteOpen, setNoteOpen] = useState({});

  useEffect(() => {
    fetch(`${LOCAL_API_BASE}/GetPageNotes?page=${PAGE}`)
      .then((r) => r.json())
      .then((d) => d.notes && setNotes(Object.fromEntries(Object.entries(d.notes).map(([k, v]) => [k, v.text]))))
      .catch(() => {});
  }, []);

  const saveNote = (noteKey, text) =>
    fetch(`${LOCAL_API_BASE}/SetPageNote?key=${encodeURIComponent(KEY)}`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ page: PAGE, noteKey, text }),
    }).then((r) => r.json()).then((d) => {
      if (d.error) throw new Error(d.error);
      setNotes((n) => ({ ...n, [noteKey]: text.trim() }));
    });

  useEffect(() => {
    setData(null);
    setError("");
    setTierPrice({});
    setRowPrice({});
    fetch(`${LOCAL_API_BASE}/GetPriceSimulation?mp=${mp}&segment=${segment}&days=${days}`)
      .then((r) => r.json())
      .then((d) => (d.error ? setError(d.error) : setData(d)))
      .catch((e) => setError(e.message));
  }, [mp, segment, days]);

  const sym = data ? SYM[data.currency] || data.currency + " " : "";
  const vat = data?.vat || 0;
  const fmt = (v, d = 2) => (v == null ? "–" : `${v < 0 ? "-" : ""}${sym}${Math.abs(v).toFixed(d)}`);

  const tiers = useMemo(() => {
    if (!data) return [];
    const m = new Map();
    for (const r of data.rows) {
      const k = r.landed == null ? "none" : r.landed.toFixed(2);
      if (!m.has(k)) m.set(k, []);
      m.get(k).push(r);
    }
    return [...m.entries()].map(([k, rows]) => ({ key: k, landed: rows[0].landed, rows }));
  }, [data]);

  const newPriceOf = (r, tkey) => {
    const v = rowPrice[r.asin] ?? tierPrice[tkey];
    const n = parseFloat(v);
    return n > 0 ? n : r.price;
  };

  let gNow = 0, gNew = 0;
  const tierCalc = tiers.map((t) => {
    let units = 0, now = 0, nw = 0, revNow = 0, revNew = 0;
    for (const r of t.rows) {
      const a = profitAt(r, r.price, vat, opt);
      const b = profitAt(r, newPriceOf(r, t.key), vat, opt);
      units += r.units;
      if (a) { now += a.profit * r.units; revNow += (r.price / (1 + vat)) * r.units; }
      if (b) { nw += b.profit * r.units; revNew += (newPriceOf(r, t.key) / (1 + vat)) * r.units; }
    }
    gNow += now;
    gNew += nw;
    return { units, now, nw, mNow: revNow ? (now / revNow) * 100 : null, mNew: revNew ? (nw / revNew) * 100 : null };
  });

  return (
    <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "16px", fontFamily: "Arial, sans-serif" }}>
      <h2 style={{ margin: "4px 0 6px" }}>💲 Profit simulation by landed cost</h2>
      <div style={{ fontSize: "13px", color: "#5a6780", marginBottom: "12px", lineHeight: 1.5 }}>
        Profit / unit = price w/o VAT − referral fee − FBA fee − landed cost − ads per unit − returns/storage per unit.
        Ads and returns per unit are the real ones of the period, kept the same at the new price; units are kept the same too
        (a higher price may sell less).
        <br /><b>Prices:</b> the <span style={{ background: "#dbe7fb", padding: "0 4px", borderRadius: "3px" }}>blue box</span> in a
        tier line sets the price for every product in that tier; it fills each product's box below (white, grey text = the price now
        when empty). Typing in a product's box makes it <span style={{ background: "#fff3c4", padding: "0 4px", borderRadius: "3px" }}>yellow</span>:
        that product keeps its own price even when the tier price changes. "Reset prices" clears everything. Nothing is sent to Amazon.
      </div>
      <div style={{ marginBottom: "12px" }}>
        <div style={{ fontSize: "12px", fontWeight: 700, color: "#4a5870", marginBottom: "3px" }}>📝 My notes</div>
        <NoteBox value={notes.general} rows={3} placeholder="Notes for yourself – saved when you click outside the box" onSave={(t) => saveNote("general", t)} />
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", alignItems: "center", marginBottom: "12px", fontSize: "14px" }}>
        <select value={mp} onChange={(e) => setMp(e.target.value)} style={{ padding: "5px" }}>
          {MPS.map((m) => <option key={m}>{m}</option>)}
        </select>
        <select value={segment} onChange={(e) => setSegment(e.target.value)} style={{ padding: "5px" }}>
          <option value="home">Home decor</option>
          <option value="pareo">Pareo</option>
        </select>
        <select value={days} onChange={(e) => setDays(+e.target.value)} style={{ padding: "5px" }}>
          {[30, 90, 180, 365].map((d) => <option key={d} value={d}>last {d} days</option>)}
        </select>
        <label><input type="checkbox" checked={opt.ads} onChange={() => setOpt((o) => ({ ...o, ads: !o.ads }))} /> ads</label>
        <label><input type="checkbox" checked={opt.other} onChange={() => setOpt((o) => ({ ...o, other: !o.other }))} /> returns + storage</label>
        <label>target margin <input type="number" value={target} onChange={(e) => setTarget(+e.target.value)} style={{ ...inp, width: "48px" }} />%</label>
        {(Object.keys(tierPrice).length > 0 || Object.keys(rowPrice).length > 0) && (
          <button onClick={() => { setTierPrice({}); setRowPrice({}); }} style={{ padding: "4px 10px", fontSize: "13px", width: "auto", margin: 0 }}>Reset prices</button>
        )}
      </div>

      {error && <div style={{ color: "#c0392b" }}>{error}</div>}
      {!data && !error && <div>Loading… (first load can take ~20 s)</div>}

      {data && (
        <>
          <PricePlan data={data} days={days} mp={mp} notes={notes} saveNote={saveNote} fmt={fmt} />
          <div style={{ display: "flex", gap: "16px", flexWrap: "wrap", marginBottom: "10px", fontSize: "14px" }}>
            <div>Period {data.start} → {data.end}</div>
            <div>Total profit now: <b style={{ color: col(gNow) }}>{fmt(gNow, 0)}</b></div>
            <div>With new prices: <b style={{ color: col(gNew) }}>{fmt(gNew, 0)}</b> ({gNew - gNow >= 0 ? "+" : ""}{fmt(gNew - gNow, 0)})</div>
          </div>
          <div style={{ overflowX: "auto", border: "1px solid #e3e8f0", borderRadius: "8px" }}>
            <table style={{ borderCollapse: "collapse", width: "100%" }}>
              <thead>
                <tr>
                  <th style={{ ...th, textAlign: "left" }}>Landed / product</th>
                  <th style={th}>Units</th>
                  <th style={th}>Price now</th>
                  <th style={th}>Fees</th>
                  <th style={th}>Ads/u</th>
                  <th style={th}>Ret+stor/u</th>
                  <th style={th}>Profit/u now</th>
                  <th style={th}>Margin now</th>
                  <th style={th}>New price</th>
                  <th style={th}>Profit/u new</th>
                  <th style={th}>Margin new</th>
                  <th style={th}>Total now → new</th>
                  <th style={th} title="Price that gives the target margin">Price @ {target}%</th>
                  <th style={th} title="Price where profit per unit = 0">Break-even</th>
                </tr>
              </thead>
              <tbody>
                {tiers.map((t, i) => {
                  const c = tierCalc[i];
                  const isOpen = open[t.key] ?? true;
                  return (
                    <Fragment key={t.key}>
                      <tr style={{ background: "#eef3fb" }}>
                        <td style={{ ...td, textAlign: "left", fontWeight: 700, cursor: "pointer" }} onClick={() => setOpen((o) => ({ ...o, [t.key]: !isOpen }))}>
                          {isOpen ? "▾" : "▸"} {t.landed == null ? "No landed cost" : `Landed ${fmt(t.landed)}`} <span style={{ fontWeight: 400, color: "#5a6780" }}>({t.rows.length})</span>
                        </td>
                        <td style={{ ...td, fontWeight: 700 }}>{c.units}</td>
                        <td style={td} colSpan={5}></td>
                        <td style={{ ...td, fontWeight: 700, color: col(c.mNow) }}>{c.mNow == null ? "–" : `${c.mNow.toFixed(0)}%`}</td>
                        <td style={td}>
                          {t.landed != null && (
                            <input style={{ ...inp, background: "#dbe7fb", color: "#1f2d45" }} placeholder="tier" value={tierPrice[t.key] ?? ""} onChange={(e) => setTierPrice((p) => ({ ...p, [t.key]: e.target.value }))} />
                          )}
                        </td>
                        <td style={td}></td>
                        <td style={{ ...td, fontWeight: 700, color: col(c.mNew) }}>{c.mNew == null ? "–" : `${c.mNew.toFixed(0)}%`}</td>
                        <td style={{ ...td, fontWeight: 700 }}>
                          <span style={{ color: col(c.now) }}>{fmt(c.now, 0)}</span> → <span style={{ color: col(c.nw) }}>{fmt(c.nw, 0)}</span>
                        </td>
                        <td style={td} colSpan={2}></td>
                      </tr>
                      {isOpen && t.rows.map((r) => {
                        const P = newPriceOf(r, t.key);
                        const a = profitAt(r, r.price, vat, opt);
                        const b = profitAt(r, P, vat, opt);
                        const fees = r.referralPct * r.price + r.fba;
                        const pt = priceForMargin(r, target, vat, opt);
                        const be = priceForMargin(r, 0, vat, opt);
                        const nk = `${mp}|${r.asin}`;
                        return (
                          <Fragment key={r.asin}>
                          <tr>
                            <td style={{ ...td, textAlign: "left", paddingLeft: "22px" }}>
                              <Link to={`/product?sku=${encodeURIComponent(r.sku)}`} target="_blank" rel="noopener noreferrer" style={{ color: "#1f2d45", textDecoration: "none" }}>{r.sku}</Link>
                              {r.endOfLife && <span style={{ marginLeft: "4px", fontSize: "9px", color: "#b03a2e", fontWeight: 700 }}>EOL</span>}
                              <span onClick={() => setNoteOpen((o) => ({ ...o, [nk]: !o[nk] }))} title={notes[nk] || "Add a note"}
                                style={{ marginLeft: "6px", cursor: "pointer", fontSize: "12px", opacity: notes[nk] ? 1 : 0.35 }}>💬</span>
                              {r.purchase != null && <span style={{ marginLeft: "6px", fontSize: "11px", color: "#7a8699" }} title={`Invoice ${r.invoice || ""}`}>buy ${r.purchase}</span>}
                            </td>
                            <td style={td}>{r.units}</td>
                            <td style={td}>{fmt(r.price)}</td>
                            <td style={td} title={`Referral ${(r.referralPct * 100).toFixed(1)}% + FBA ${fmt(r.fba)}${r.feesEstimated ? "" : " (no estimate - 15% assumed)"}`}>{fmt(fees)}</td>
                            <td style={{ ...td, color: opt.ads ? undefined : "#bbb" }}>{fmt(r.adsPerUnit)}</td>
                            <td style={{ ...td, color: opt.other ? undefined : "#bbb" }}>{fmt(r.otherPerUnit)}</td>
                            <td style={{ ...td, color: col(a?.profit) }}>{fmt(a?.profit)}</td>
                            <td style={{ ...td, color: col(a?.margin) }}>{a?.margin == null ? "–" : `${a.margin.toFixed(0)}%`}</td>
                            <td style={td}>
                              <input style={{ ...inp, background: rowPrice[r.asin] != null ? "#fff3c4" : "#fff", color: "#222" }} value={rowPrice[r.asin] ?? (tierPrice[t.key] || "")} placeholder={r.price.toFixed(2)}
                                onChange={(e) => setRowPrice((p) => ({ ...p, [r.asin]: e.target.value }))} />
                            </td>
                            <td style={{ ...td, color: col(b?.profit), fontWeight: 600 }}>{fmt(b?.profit)}</td>
                            <td style={{ ...td, color: col(b?.margin) }}>{b?.margin == null ? "–" : `${b.margin.toFixed(0)}%`}</td>
                            <td style={td}>
                              {a && b ? <><span style={{ color: col(a.profit) }}>{fmt(a.profit * r.units, 0)}</span> → <span style={{ color: col(b.profit) }}>{fmt(b.profit * r.units, 0)}</span></> : "–"}
                            </td>
                            <td style={td}>{fmt(pt)}</td>
                            <td style={td}>{fmt(be)}</td>
                          </tr>
                          {(noteOpen[nk] || notes[nk]) && (
                            <tr>
                              <td colSpan={14} style={{ ...td, textAlign: "left", paddingLeft: "22px", whiteSpace: "normal" }}>
                                {noteOpen[nk]
                                  ? <NoteBox value={notes[nk]} placeholder={`Note for ${r.sku} (${mp})`} onSave={(t) => saveNote(nk, t)} />
                                  : <span onClick={() => setNoteOpen((o) => ({ ...o, [nk]: true }))} style={{ cursor: "pointer", fontSize: "12px", color: "#6b5a1e", whiteSpace: "pre-wrap" }}>💬 {notes[nk]}</span>}
                              </td>
                            </tr>
                          )}
                          </Fragment>
                        );
                      })}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div style={{ fontSize: "12px", color: "#7a8699", marginTop: "8px", lineHeight: 1.5 }}>
            Landed cost = latest Malani/Acacia invoice + duty + freight for this marketplace's region. Fees = today's Amazon estimate
            (referral % of the price incl. VAT + FBA fee). Ads/u = SP+SD + share of SB spend ÷ units sold in the period.
            Ret+stor/u = returns cost + FBA storage + AWD ÷ units. Products without sales in the period show 0 ads.
          </div>
        </>
      )}
    </div>
  );
}
