import { Fragment, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { buttonStyle } from "./buttonStyle";

// New products research (2026-10-31, per the user): fabric product ideas for
// the Indian supplier (min $20, bundles), mainly extending the mushroom
// collection. Data = Amazon US catalog search per idea (Best Seller Rank +
// price of the top results) vs our own poufs' rank - see ProductResearch.py.
const API_BASE = import.meta.env.VITE_API_BASE || "https://amzapi.mandalalifeart.com";

const cell = { border: "1px solid #ddd", padding: "6px 8px", fontSize: "13px", verticalAlign: "top" };
const num = { ...cell, textAlign: "right", whiteSpace: "nowrap" };
const head = { ...cell, background: "#f4f4f4", fontWeight: 700, textAlign: "center", whiteSpace: "normal" };

function fmtRank(r) {
  return r ? `#${r.toLocaleString()}` : "–";
}
function fmtUsd(v) {
  return v === null || v === undefined ? "–" : `$${Number(v).toFixed(2)}`;
}

// Profit calculator per marked idea (2026-11-20, per the user). Same shape as
// ProductCost.py: landed = cost + freight + duty% x (cost + freight); per unit
// profit = price - landed - referral% x price - FBA fee - ads% x price - returns% x price.
// Inputs are saved per idea (SetProductResearchStatus calc).
const FBA_DEFAULT = { bag: 6.5, lamp: 7.5 };
const CALC_FIELDS = [
  ["price", "Sale price ($)"],
  ["cost", "Unit cost ($, supplier)"],
  ["freight", "Freight / unit ($)"],
  ["dutyPct", "Import duty %"],
  ["referralPct", "Amazon referral %"],
  ["fba", "FBA fee ($)"],
  ["adsPct", "Ads % of price"],
  ["returnsPct", "Returns % of price"],
];
function priceGuess(idea) {
  const r = idea.research || {};
  if (r.onThemeMedianPrice) return r.onThemeMedianPrice;
  const m = String(idea.price || "").match(/\$?(\d+(?:\.\d+)?)\s*-\s*\$?(\d+(?:\.\d+)?)/);
  return m ? Math.round(((+m[1] + +m[2]) / 2) * 100) / 100 : 29.99;
}
function calcDefaults(idea) {
  return { price: priceGuess(idea), cost: "", freight: idea.kind === "lamp" ? 2 : 1, dutyPct: 10, referralPct: 15,
    fba: FBA_DEFAULT[idea.kind] ?? 6.5, adsPct: 20, returnsPct: 5 };
}
function ProfitCalc({ idea }) {
  const [v, setV] = useState({ ...calcDefaults(idea), ...(idea.calc || {}) });
  const [saved, setSaved] = useState("");
  const n = (k) => Number(v[k]) || 0;
  const landed = n("cost") + n("freight") + (n("dutyPct") / 100) * (n("cost") + n("freight"));
  const referral = (n("referralPct") / 100) * n("price");
  const ads = (n("adsPct") / 100) * n("price");
  const returns = (n("returnsPct") / 100) * n("price");
  const profit = n("price") - landed - referral - n("fba") - ads - returns;
  const margin = n("price") ? (profit / n("price")) * 100 : 0;
  const pctOfPrice = n("referralPct") + n("adsPct") + n("returnsPct");
  const breakEven = pctOfPrice < 100 ? (landed + n("fba")) / (1 - pctOfPrice / 100) : null;
  async function save() {
    try {
      const calc = Object.fromEntries(CALC_FIELDS.map(([k]) => [k, v[k]]).filter(([, x]) => x !== "" && x !== null));
      await fetch(`${API_BASE}/SetProductResearchStatus`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: idea.id, calc }) });
      setSaved("saved");
      setTimeout(() => setSaved(""), 1500);
    } catch {
      setSaved("not saved");
    }
  }
  const box = { border: "1px solid #ddd", borderRadius: "6px", padding: "6px 8px", background: "#fff" };
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", alignItems: "flex-end", fontSize: "12px" }}>
      <b style={{ alignSelf: "center", fontSize: "13px" }}>💰 Profit calculator</b>
      {CALC_FIELDS.map(([k, label]) => (
        <label key={k} style={{ display: "flex", flexDirection: "column", gap: "2px", color: "#555" }}>
          {label}
          <input type="number" step="0.01" value={v[k]} onChange={(e) => setV((o) => ({ ...o, [k]: e.target.value }))} onBlur={save}
            style={{ width: "80px", padding: "3px 5px", border: k === "cost" && !v.cost ? "1px solid #e53935" : "1px solid #ccc", borderRadius: "4px" }} />
        </label>
      ))}
      <div style={box} title={`Landed = cost + freight + duty: ${fmtUsd(landed)}\nReferral ${fmtUsd(referral)} · FBA ${fmtUsd(n("fba"))} · Ads ${fmtUsd(ads)} · Returns ${fmtUsd(returns)}`}>
        Landed <b>{fmtUsd(landed)}</b> · Amazon+ads+returns <b>{fmtUsd(referral + n("fba") + ads + returns)}</b>
        <div style={{ fontSize: "15px", marginTop: "2px" }}>
          Profit <b style={{ color: profit > 0 ? "#2e7d32" : "#c62828" }}>{fmtUsd(profit)}</b> / unit · margin <b>{margin.toFixed(0)}%</b>
        </div>
        <div style={{ color: "#666" }}>Break-even price {breakEven ? fmtUsd(breakEven) : "–"}{!v.cost && " · enter the unit cost"}</div>
      </div>
      {saved && <span style={{ color: saved === "saved" ? "#2e7d32" : "#c62828" }}>{saved}</span>}
    </div>
  );
}

const POOL_LABELS = { main: "Main list", option: "Bundle pool: option", addon: "Bundle pool: add-on", ready: "Bundle pool: ready bundle" };

function MarkStar({ idea, onSaved }) {
  const [marked, setMarked] = useState(!!idea.marked);
  async function toggle(e) {
    e.stopPropagation();
    const next = !marked;
    setMarked(next);
    try {
      const r = await fetch(`${API_BASE}/SetProductResearchStatus`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: idea.id, marked: next }),
      });
      if (!r.ok) throw new Error();
      onSaved(idea.id, next);
    } catch {
      setMarked(!next);
    }
  }
  return (
    <span
      onClick={toggle}
      title={marked ? "Marked - click to unmark" : "Mark this idea (we go for it)"}
      style={{ cursor: "pointer", fontSize: "20px", color: marked ? "#f5a623" : "#ccc", marginRight: "6px", userSelect: "none" }}
    >
      {marked ? "★" : "☆"}
    </span>
  );
}

function StatusCell({ idea, statuses, onSaved }) {
  const [status, setStatus] = useState(idea.status);
  const [notes, setNotes] = useState(idea.userNotes || "");
  const [state, setState] = useState("");
  async function save(next) {
    setState("saving");
    try {
      const r = await fetch(`${API_BASE}/SetProductResearchStatus`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: idea.id, ...next }),
      });
      if (!r.ok) throw new Error();
      setState("saved");
    } catch {
      setState("error");
    }
  }
  return (
    <td style={cell}>
      <select
        value={status}
        onChange={(e) => {
          setStatus(e.target.value);
          save({ status: e.target.value });
        }}
        style={{ fontSize: "13px", padding: "2px 4px", marginBottom: "4px" }}
      >
        {statuses.map((s) => (
          <option key={s} value={s}>{s}</option>
        ))}
      </select>
      <textarea
        value={notes}
        placeholder="notes"
        onChange={(e) => setNotes(e.target.value)}
        onBlur={() => notes !== (idea.userNotes || "") && save({ notes })}
        rows={2}
        style={{ width: "100%", fontSize: "12px", boxSizing: "border-box" }}
      />
      <select
        value={idea.pool}
        title="Move this product to the bundles pool"
        onChange={(e) => save({ pool: e.target.value }).then(onSaved)}
        style={{ fontSize: "12px", padding: "2px 4px", marginTop: "4px", width: "100%" }}
      >
        {Object.entries(POOL_LABELS).map(([k, label]) => (
          <option key={k} value={k}>{k === "main" ? "Move to: main list" : label}</option>
        ))}
      </select>
      {state && <div style={{ fontSize: "11px", color: state === "error" ? "#b00020" : "#2e7d32" }}>{state}</div>}
    </td>
  );
}

export default function ProductResearchPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [open, setOpen] = useState({});
  const [running, setRunning] = useState(false);
  const [sortKey, setSortKey] = useState("score");
  const [kind, setKind] = useState("marked");

  async function load() {
    try {
      const r = await fetch(`${API_BASE}/GetProductResearch`);
      const j = await r.json();
      if (j.error) throw new Error(j.error);
      setData(j);
    } catch (e) {
      setError(String(e.message || e));
    }
  }
  useEffect(() => {
    load();
  }, []);

  async function refresh() {
    setRunning(true);
    try {
      await fetch(`${API_BASE}/RunProductResearch`, { method: "POST" });
    } catch {
      // the server keeps working after a timeout; reload below
    }
    await load();
    setRunning(false);
  }

  const ideas = useMemo(() => {
    const kindOf = (i) => (i.kind === "bundle" ? "bundle" : i.kind === "lamp" ? "lamp" : i.id.startsWith("mushroom") || i.id.startsWith("groovy") || i.id.startsWith("cottagecore") ? "mushroom" : "other");
    const val = (i) => (sortKey === "score" ? i.score?.score : (i.research || {})[sortKey]) ?? -1;
    const sorted = (l) => l.sort((a, b) => val(b) - val(a));
    const all = data?.ideas || [];
    if (kind === "bundle") {
      return { ready: sorted(all.filter((i) => i.pool === "ready")), option: sorted(all.filter((i) => i.pool === "option")), addon: sorted(all.filter((i) => i.pool === "addon")) };
    }
    if (kind === "marked") {
      return { main: sorted(all.filter((i) => i.marked)) };
    }
    return { main: sorted(all.filter((i) => i.pool === "main" && (kind === "all" || kindOf(i) === kind))) };
  }, [data, sortKey, kind]);

  const bench = data?.benchmark || {};
  const sortHead = (key, label, title) => (
    <th style={{ ...head, cursor: "pointer", background: sortKey === key ? "#d6e4f5" : head.background }} title={title} onClick={() => setSortKey(key)}>
      {label}
      {sortKey === key ? " ▼" : ""}
    </th>
  );

  function renderTable(list) {
    return (
        <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
          <table style={{ borderCollapse: "collapse", width: "100%", minWidth: "1100px" }}>
            <thead>
              <tr>
                <th style={head}>#</th>
                {sortHead("score", "Score (0-100)", "Demand 35 (on-theme competitors outselling our best pouf, 20+ = full) + strong sellers 20 (on-theme under #100k, 10+ = full) + price 25 (share of results priced $20+) + our proof 20 (our ad orders on these searches, 90 days, 20+ = full)")}
                <th style={{ ...head, width: "24%" }}>Idea</th>
                <th style={head}>Our price / bundle</th>
                {sortHead("onThemeBetterThanOurBest", "On-theme selling more than our best pouf", "Of the top 20 results: on-theme competitors with a better Home & Kitchen rank than our best pouf family")}
                {sortHead("onThemeUnder100k", "On-theme under #100k", "On-theme competitors ranked under #100,000 in Home & Kitchen (strong sellers)")}
                {sortHead("betterThanOurBest", "All results selling more than our best pouf", "Any result of the search (themed or not)")}
                <th style={head}>Best on-theme rank</th>
                <th style={head}>Competitor price (on-theme / all, median)</th>
                {sortHead("pricedAtLeast20", "Results priced $20+", "How many priced results sell at $20 or more")}
                <th style={head}>Our ads: searches with these words (90 days)</th>
                <th style={{ ...head, width: "14%" }}>Status / notes</th>
              </tr>
            </thead>
            <tbody>
              {list.map((idea) => {
                const r = idea.research || {};
                const s = r.ourSearches || {};
                const isOpen = !!open[idea.id];
                return (
                  <Fragment key={idea.id}>
                    <tr style={{ cursor: "pointer", background: isOpen ? "#f5f9ff" : undefined }}>
                      <td style={{ ...num, fontWeight: 700 }}>
                        <MarkStar key={`${idea.id}-${idea.marked}`} idea={idea} onSaved={(id, v) => setData((d) => ({ ...d, ideas: d.ideas.map((x) => (x.id === id ? { ...x, marked: v } : x)) }))} />
                        {idea.rank ?? "–"}
                      </td>
                      <td
                        style={{ ...num, fontWeight: 700, fontSize: "16px", color: (idea.score?.score ?? 0) >= 60 ? "#2e7d32" : (idea.score?.score ?? 0) >= 35 ? "#b26a00" : "#888" }}
                        title={idea.score ? `Demand ${idea.score.demand}/35\nStrong sellers ${idea.score.strong}/20\nPrice ${idea.score.price}/25\nOur ads proof ${idea.score.ours}/20` : ""}
                      >
                        {idea.score?.score ?? "–"}
                      </td>
                      <td style={cell} onClick={() => setOpen((o) => ({ ...o, [idea.id]: !o[idea.id] }))}>
                        {idea.images?.[0] && <img src={idea.images[0]} alt="" style={{ width: "48px", height: "48px", objectFit: "cover", borderRadius: "4px", float: "right", marginLeft: "6px" }} />}
                        <b>{isOpen ? "▾" : "▸"} {idea.name}</b>
                        {idea.kind === "bundle" && <span style={{ marginLeft: "6px", fontSize: "11px", background: "#fff3cd", border: "1px solid #e0c46c", borderRadius: "4px", padding: "0 4px" }}>BUNDLE</span>}
                        <div style={{ color: "#555", fontSize: "12px", marginTop: "3px" }}>{idea.notes}</div>
                        <div style={{ color: "#888", fontSize: "11px", marginTop: "3px" }}>Searches: {idea.keywords.join(" · ")}</div>
                      </td>
                      <td style={cell}>
                        {idea.price}
                        <div style={{ color: "#555", fontSize: "12px", marginTop: "3px" }}>{idea.bundle}</div>
                      </td>
                      <td style={{ ...num, fontWeight: 700, fontSize: "15px" }}>{r.onThemeBetterThanOurBest ?? "–"}<span style={{ fontWeight: 400, color: "#888", fontSize: "12px" }}> / {r.onTheme ?? "–"}</span></td>
                      <td style={num}>{r.onThemeUnder100k ?? "–"}</td>
                      <td style={num}>{r.betterThanOurBest ?? "–"}<span style={{ color: "#888", fontSize: "12px" }}> / {r.results ?? "–"}</span></td>
                      <td style={num}>{fmtRank(r.onThemeBestRank)}</td>
                      <td style={num}>
                        {fmtUsd(r.onThemeMedianPrice)} / {fmtUsd(r.medianPrice)}
                        <div style={{ color: "#888", fontSize: "11px" }}>{fmtUsd(r.minPrice)}–{fmtUsd(r.maxPrice)}</div>
                      </td>
                      <td style={num}>{r.pricedAtLeast20 ?? "–"}<span style={{ color: "#888", fontSize: "12px" }}> / {r.priced ?? "–"}</span></td>
                      <td style={num} title={(s.terms || []).map((t) => `${t.term}: ${t.impressions} impr, ${t.clicks} clicks, ${t.orders} orders`).join("\n")}>
                        {s.impressions ? `${s.impressions.toLocaleString()} impr · ${s.clicks} clicks · ${s.orders} orders` : "none"}
                      </td>
                      <StatusCell key={idea.pool} idea={idea} statuses={data.statuses || []} onSaved={load} />
                    </tr>
                    {idea.marked && (
                      <tr>
                        <td colSpan={12} style={{ ...cell, background: "#fffdf3" }}>
                          <ProfitCalc key={idea.id} idea={idea} />
                        </td>
                      </tr>
                    )}
                    {isOpen && (
                      <tr>
                        <td colSpan={12} style={{ ...cell, background: "#fafafa" }}>
                          {(idea.images || []).length > 0 && (
                            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "8px" }}>
                              {idea.images.map((src) => (
                                <a key={src} href={src} target="_blank" rel="noreferrer">
                                  <img src={src} alt={idea.name} style={{ width: "160px", height: "160px", objectFit: "cover", borderRadius: "6px", border: "1px solid #ddd" }} />
                                </a>
                              ))}
                            </div>
                          )}
                          {(idea.links || []).length > 0 && (
                            <div style={{ marginBottom: "8px", fontSize: "13px" }}>
                              {idea.links.map((l) => (
                                <div key={l.url}>
                                  🔗 <a href={l.url} target="_blank" rel="noreferrer">{l.label || l.url}</a>
                                </div>
                              ))}
                            </div>
                          )}
                          {(idea.findings || []).length > 0 && (
                            <ul style={{ margin: "0 0 10px", paddingLeft: "18px", fontSize: "13px", color: "#333" }}>
                              {idea.findings.map((f, k) => (
                                <li key={k} style={{ marginBottom: "3px" }}>{f}</li>
                              ))}
                            </ul>
                          )}
                          <table style={{ borderCollapse: "collapse", width: "100%" }}>
                            <thead>
                              <tr>
                                <th style={head}>{idea.kind === "lamp" ? "Category rank" : "H&K rank"}</th>
                                <th style={head}>Sub-category rank</th>
                                <th style={head}>Price</th>
                                <th style={head}>Brand</th>
                                <th style={head}>Title</th>
                                <th style={head}>On-theme</th>
                              </tr>
                            </thead>
                            <tbody>
                              {(r.competitors || []).map((c) => (
                                <tr key={c.asin} style={{ background: c.ours ? "#eef7ee" : undefined }}>
                                  <td style={num}>{c.rankCategory === "Home & Kitchen" && idea.kind !== "lamp" ? fmtRank(c.rank) : c.rank ? `${fmtRank(c.rank)} ${c.rankCategory}` : "–"}</td>
                                  <td style={num}>{c.subRank ? `${fmtRank(c.subRank)} ${c.subCategory}` : "–"}</td>
                                  <td style={num}>{fmtUsd(c.price)}</td>
                                  <td style={cell}>{c.brand}</td>
                                  <td style={cell}>
                                    <a href={`https://www.amazon.com/dp/${c.asin}`} target="_blank" rel="noreferrer">{c.title}</a>
                                  </td>
                                  <td style={{ ...cell, textAlign: "center" }}>{c.onTheme ? "✓" : ""}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
    );
  }

  return (
    <div style={{ padding: "16px 12px", maxWidth: "1400px", margin: "0 auto", fontFamily: "system-ui, sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
        <Link to="/">← Home</Link>
        <h2 style={{ margin: 0 }}>New Products Research</h2>
        <button style={buttonStyle(running)} disabled={running} onClick={refresh}>
          {running ? "Researching… (2-4 min)" : "Refresh from Amazon"}
        </button>
        {data?.ranAt && <span style={{ color: "#666", fontSize: "13px" }}>Last run {new Date(data.ranAt).toLocaleString()} · Amazon US</span>}
      </div>
      <p style={{ fontSize: "13px", color: "#444", maxWidth: "1100px" }}>
        Fabric products our Indian supplier can make, priced $20 or more, also as bundles - mainly to extend the mushroom
        collection. For each idea we search Amazon US and read the Best Seller Rank (Home &amp; Kitchen) and price of the
        top 20 results. <b>Benchmark = our own poufs</b>: best pouf family ranks {fmtRank(bench.best)} in Home &amp; Kitchen
        (median of our pouf families {fmtRank(bench.median)}). A lower number sells more, so a competitor ranked better than{" "}
        {fmtRank(bench.best)} sells more than our best pouf. <b>On-theme</b> = the title really is mushroom / woodland /
        retro themed ("mushroom brown" colour products are left out). Click a row for the competitors.
      </p>
      <div style={{ display: "flex", gap: "8px", marginBottom: "10px", flexWrap: "wrap" }}>
        {[["marked", `★ Marked (${(data?.ideas || []).filter((i) => i.marked).length})`], ["all", "All ideas"], ["mushroom", "Mushroom / retro"], ["lamp", "Lamps"], ["other", "Other fabric products"], ["bundle", `Bundles pool (${(data?.ideas || []).filter((i) => i.pool !== "main").length})`]].map(([k, label]) => (
          <button
            key={k}
            onClick={() => setKind(k)}
            style={{ padding: "6px 14px", borderRadius: "999px", border: `1px solid ${kind === k ? "#1565c0" : "#bbb"}`, background: kind === k ? "#1565c0" : "#fff", color: kind === k ? "#fff" : "#333", fontWeight: 600, fontSize: "13px", cursor: "pointer" }}
          >
            {label}
          </button>
        ))}
      </div>
      {error && <div style={{ color: "#b00020" }}>{error}</div>}
      {!data && !error && <div>Loading…</div>}
      {data && kind !== "bundle" && renderTable(ideas.main)}
      {data && kind === "bundle" && (
        <>
          <h3 style={{ margin: "14px 0 6px" }}>Ready bundles ({ideas.ready.length})</h3>
          <p style={{ fontSize: "12px", color: "#555", margin: "0 0 6px" }}>Bundles we would sell as they are.</p>
          {renderTable(ideas.ready)}
          <h3 style={{ margin: "22px 0 6px" }}>Options for bundles ({ideas.option.length})</h3>
          <p style={{ fontSize: "12px", color: "#555", margin: "0 0 6px" }}>
            Products to combine into bundles. Move any product here with the "Move to" menu in its Status column.
          </p>
          {ideas.option.length ? renderTable(ideas.option) : <div style={{ color: "#888", fontSize: "13px" }}>Nothing here yet.</div>}
          <h3 style={{ margin: "22px 0 6px" }}>Bundle add-ons ({ideas.addon.length})</h3>
          <p style={{ fontSize: "12px", color: "#555", margin: "0 0 6px" }}>
            Cheap extras added to another product's bundle (they don't sell at $20+ alone).
          </p>
          {ideas.addon.length ? renderTable(ideas.addon) : <div style={{ color: "#888", fontSize: "13px" }}>Nothing here yet.</div>}
        </>
      )}
    </div>
  );
}
