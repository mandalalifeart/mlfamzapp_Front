import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { buttonStyle } from "./buttonStyle";

// Weekly (Monday) and monthly check reports, stored per week / month
// (GetCheckReports, per the user 2026-11-02 - the Monday .txt file was
// unreadable). One collapsible section per check; sections with 🔴 open.
const LOCAL_API_BASE = "https://amzapi.mandalalifeart.com";
const URL_RE = /(https?:\/\/[^\s)]+)/g;

// "Reply" (per the user 2026-11-02): opens the Telegram chat with Claude
// (@baba_777_bot) with the topic pre-filled - the answer comes in Telegram.
const CLAUDE_BOT = "baba_777_bot";
function replyHref(ctx, topic) {
  const t = `[${ctx}]${topic ? `\n"${topic.slice(0, 300)}"` : ""}\n`;
  return `https://t.me/${CLAUDE_BOT}?text=${encodeURIComponent(t)}`;
}
function ReplyLink({ ctx, topic, label = "💬" }) {
  return (
    <a
      href={replyHref(ctx, topic)}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      title="Ask Claude about this - the answer comes in Telegram"
      style={{ textDecoration: "none", fontSize: "13px", marginLeft: "6px", opacity: 0.75, whiteSpace: "nowrap" }}
    >
      {label}
    </a>
  );
}

// Cells: number, text, or {v, pct} = an earlier value + % change to now
// (green up / red down). Rows: an array, or {cells, children} = a group row
// that expands on click (e.g. EU -> countries, per the user 2026-11-02).
const cellText = (v) => (v && typeof v === "object" ? `${v.v}${v.pct != null ? ` (${v.pct > 0 ? "+" : ""}${v.pct}%)` : ""}` : v);

function Cell({ v, col }) {
  if (v && typeof v === "object") {
    const c = v.pct == null ? "#6b7a90" : v.pct > 0 ? "#1e7a3c" : v.pct < 0 ? "#c0392b" : "#6b7a90";
    return (
      <span>
        {Number(v.v).toLocaleString("en-US")}
        {v.pct != null && (
          <span style={{ marginLeft: "6px", fontSize: "12px", fontWeight: 700, color: c, background: v.pct > 0 ? "#e8f6ee" : v.pct < 0 ? "#fdecea" : undefined, borderRadius: "4px", padding: "1px 4px" }}>
            {v.pct > 0 ? "▲" : v.pct < 0 ? "▼" : ""}{Math.abs(v.pct)}%
          </span>
        )}
      </span>
    );
  }
  if (typeof v === "number") {
    const money = /profit|^net$/i.test(col || "");
    return <span style={{ color: money ? (v < 0 ? "#c0392b" : v > 0 ? "#1e7a3c" : undefined) : undefined, fontWeight: money ? 700 : undefined }}>{v.toLocaleString("en-US")}</span>;
  }
  if (/^margin$/i.test(col || "") && typeof v === "string" && v.endsWith("%")) {
    return <span style={{ color: parseFloat(v) < 0 ? "#c0392b" : undefined }}>{v}</span>;
  }
  return v;
}

function Table({ table, ctx }) {
  const [open, setOpen] = useState({});
  const renderRow = (r, key, { child = false, group = null } = {}) => {
    const cells = Array.isArray(r) ? r : r.cells;
    const red = String(cells[0]).includes("🔴");
    const total = String(cells[0]).startsWith("ALL");
    return (
      <tr
        key={key}
        onClick={group ? () => setOpen((o) => ({ ...o, [group]: !o[group] })) : undefined}
        style={{ background: red ? "#fdecea" : total ? "#f7f9fc" : child ? "#fafbfd" : undefined, fontWeight: total ? 700 : 400, cursor: group ? "pointer" : undefined, fontSize: child ? "12px" : undefined }}
      >
        {cells.map((v, i) => (
          <td key={i} style={{ border: "1px solid #e6eaf0", padding: "4px 8px", paddingLeft: i === 0 && child ? "22px" : "8px", textAlign: i && (typeof v === "number" || (v && typeof v === "object")) ? "right" : "left", whiteSpace: i < 3 || (v && typeof v === "object") ? "nowrap" : "normal" }}>
            {i === 0 && group ? <span style={{ color: "#1f5fbf" }}>{open[group] ? "▾ " : "▸ "}</span> : null}
            <Cell v={v} col={table.columns[i]} />
          </td>
        ))}
        <td style={{ border: "1px solid #e6eaf0", padding: "2px 4px" }}>
          <ReplyLink ctx={`${ctx} › ${table.title}`} topic={table.columns.map((c, i) => `${c}: ${cellText(cells[i])}`).filter((x) => !x.endsWith(": ")).join(", ")} />
        </td>
      </tr>
    );
  };
  return (
    <div style={{ overflowX: "auto", margin: "6px 0 14px" }}>
      <div style={{ fontWeight: 700, margin: "4px 0" }}>{table.title}</div>
      <table style={{ borderCollapse: "collapse", fontSize: "13px", minWidth: "60%" }}>
        <thead>
          <tr>
            {table.columns.map((c, i) => (
              <th key={i} style={{ background: "#f3f5f9", border: "1px solid #dde3ec", padding: "5px 8px", textAlign: i ? "right" : "left", whiteSpace: "nowrap" }}>{c}</th>
            ))}
            <th style={{ background: "#f3f5f9", border: "1px solid #dde3ec" }}></th>
          </tr>
        </thead>
        <tbody>
          {table.rows.flatMap((r, ri) =>
            !Array.isArray(r) && r.children
              ? [renderRow(r, ri, { group: ri }), ...(open[ri] ? r.children.map((c, ci) => renderRow(c, `${ri}-${ci}`, { child: true })) : [])]
              : [renderRow(r, ri)]
          )}
        </tbody>
      </table>
    </div>
  );
}

function Line({ text, ctx }) {
  const t = text.trimStart();
  const indent = text.length - t.length;
  const red = /^(🔴|🚨|❌|🚩)/.test(t);
  const orange = /^(🟠|⚠️)/.test(t);
  const green = /^(🟢|✅)/.test(t);
  const heading = !indent && !red && !orange && /:\s*\d*\s*$/.test(t) && t.length < 140;
  const parts = t.split(URL_RE);
  return (
    <div
      style={{
        padding: "2px 6px",
        marginLeft: `${Math.min(indent, 8) * 6}px`,
        borderRadius: "4px",
        background: red ? "#fdecea" : orange ? "#fff6e5" : undefined,
        color: green ? "#1e6b3a" : undefined,
        fontWeight: heading ? 700 : 400,
        marginTop: heading ? "8px" : 0,
        whiteSpace: "pre-wrap",
        wordBreak: "break-word",
      }}
    >
      {parts.map((p, i) =>
        /^https?:\/\//.test(p) ? (
          <a key={i} href={p} target="_blank" rel="noopener noreferrer" style={{ color: "#1f5fbf" }}>
            {p.replace("https://mlfamzappfire.web.app", "")}
          </a>
        ) : (
          <span key={i}>{p}</span>
        )
      )}
      {ctx && t.length > 3 && <ReplyLink ctx={ctx} topic={t} />}
    </div>
  );
}

const PROPOSAL_KEY = import.meta.env.VITE_PROPOSAL_KEY || "";
const STATUS_STYLE = {
  proposed: ["", "#555"],
  approved: ["approved", "#1f5fbf"],
  applying: ["applying…", "#b9770e"],
  applied: ["✅ applied", "#1e8449"],
  failed: ["❌ failed", "#b03a2e"],
  rejected: ["rejected", "#999"],
};

// Proposals (per the user 2026-11-02, redesigned 2026-11-03: "too much
// information and unreadable ... I want it inline with the recommendation"):
// one card per recommendation with Approve / Reject right next to it, the
// "why" in grey, the item list short (first 4, "+N more" opens the rest).
// Approved proposals with an action are applied by the server within ~10 min;
// the others ("by Claude") are done in the chat.
const smallBtn = (bg, color, border) => ({
  fontSize: "12px", cursor: "pointer", padding: "4px 10px", width: "auto", minWidth: 0, height: "auto",
  background: bg, color, border: `1px solid ${border}`, borderRadius: "6px", flex: "0 0 auto", fontWeight: 600,
});

function splitTitle(t) {
  // "US pareo: lower 307 bid(s), pause 17 – TACOS 26% vs target 17.0%" -> [what, why]
  const m = String(t || "").split(/\s+[–-]\s+(?=[A-Z0-9])/);
  return m.length > 1 ? [m[0], m.slice(1).join(" – ")] : [t, ""];
}

function DetailList({ text }) {
  const [all, setAll] = useState(false);
  const parts = String(text || "").replace(/\s*…$/, "").split(/;\s+/).filter(Boolean);
  if (parts.length <= 1) return text ? <div style={{ fontSize: "12px", color: "#555", marginTop: "2px" }}>{text}</div> : null;
  const shown = all ? parts : parts.slice(0, 4);
  return (
    <div style={{ fontSize: "12px", color: "#555", marginTop: "3px", display: "flex", flexWrap: "wrap", gap: "4px" }}>
      {shown.map((x, i) => (
        <span key={i} style={{ background: "#f3f5f9", borderRadius: "4px", padding: "1px 6px" }}>{x}</span>
      ))}
      {parts.length > 4 && (
        <a href="#" onClick={(e) => { e.preventDefault(); setAll(!all); }} style={{ color: "#1f5fbf" }}>
          {all ? "less" : `+${parts.length - 4} more`}
        </a>
      )}
    </div>
  );
}

// Per-keyword numbers inside a card (per the user 2026-11-03 "give more info
// on bid raises"): first 8 rows, "+N more" shows the rest.
function PctInput({ value, onSave }) {
  const start = String(value ?? "").replace(/[+%]/g, "").replace(/^pause.*/, "");
  const [v, setV] = useState(start);
  const [saving, setSaving] = useState(false);
  useEffect(() => setV(start), [start]);
  async function save() {
    if (v === start || v === "" || isNaN(Number(v))) { setV(start); return; }
    setSaving(true);
    try { await onSave(Number(v)); } catch { setV(start); } finally { setSaving(false); }
  }
  return (
    <span style={{ whiteSpace: "nowrap" }}>
      <input
        value={v} disabled={saving} onChange={(e) => setV(e.target.value)} onBlur={save}
        onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
        style={{ width: "46px", textAlign: "right", fontSize: "12px", fontWeight: 700, padding: "1px 3px", border: "1px solid #b8c8e6", borderRadius: "4px", background: "#fff", color: Number(v) < 0 ? "#b03a2e" : "#1e8449" }}
      />%
    </span>
  );
}

function MiniTable({ columns, rows, rowIds, onEdit }) {
  const [all, setAll] = useState(false);
  const shown = all ? rows : rows.slice(0, 8);
  const num = (v) => typeof v === "number";
  return (
    <div style={{ overflowX: "auto", marginTop: "6px" }}>
      <table style={{ borderCollapse: "collapse", fontSize: "12px", width: "100%" }}>
        <thead>
          <tr>
            {columns.map((c, i) => (
              <th key={i} style={{ background: "#f3f5f9", borderBottom: "1px solid #dde3ec", padding: "3px 6px", textAlign: i ? "right" : "left", whiteSpace: "nowrap", fontWeight: 600 }}>{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {shown.map((r, ri) => (
            <tr key={ri}>
              {r.map((v, i) => {
                const col = columns[i] || "";
                const bold = /^(New bid|Change|Raise)$/.test(col);
                const color = /^(Change|Raise)$/.test(col) ? (String(v).startsWith("-") ? "#b03a2e" : "#1e8449") : String(v).startsWith("pause") ? "#b03a2e" : undefined;
                const rid = rowIds?.[ri];
                if (onEdit && rid && /^(Change|Raise)$/.test(col)) {
                  return (
                    <td key={i} style={{ borderBottom: "1px solid #f0f2f5", padding: "2px 6px", textAlign: "right" }}>
                      <PctInput value={v} onSave={(pct) => onEdit(rid, pct)} />
                    </td>
                  );
                }
                return (
                  <td key={i} style={{ borderBottom: "1px solid #f0f2f5", padding: "3px 6px", textAlign: i && (num(v) || /%$/.test(String(v))) ? "right" : i ? "right" : "left", whiteSpace: /Products/.test(col) ? "normal" : "nowrap", fontWeight: bold ? 700 : 400, color, maxWidth: /Products/.test(col) ? "260px" : undefined }}>
                    {v == null ? "-" : num(v) ? v.toLocaleString("en-US") : v}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length > 8 && (
        <a href="#" onClick={(e) => { e.preventDefault(); setAll(!all); }} style={{ color: "#1f5fbf", fontSize: "12px" }}>
          {all ? "show less" : `+${rows.length - 8} more`}
        </a>
      )}
    </div>
  );
}

function Proposals({ report }) {
  const [items, setItems] = useState(report.proposals || []);
  const [busy, setBusy] = useState(null);
  const [err, setErr] = useState("");
  async function setStatus(p, status) {
    setBusy(p.id);
    setErr("");
    try {
      const r = await fetch(`${LOCAL_API_BASE}/SetCheckProposal?key=${encodeURIComponent(PROPOSAL_KEY)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reportId: report.id, id: p.id, status }),
      });
      const d = await r.json();
      if (!r.ok || d.error) throw new Error(d.error || `HTTP ${r.status}`);
      setItems((xs) => xs.map((x) => (x.id === p.id ? { ...x, status } : x)));
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(null);
    }
  }
  async function editRow(p, rowId, pct) {
    setErr("");
    try {
      const r = await fetch(`${LOCAL_API_BASE}/SetCheckProposal?key=${encodeURIComponent(PROPOSAL_KEY)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reportId: report.id, id: p.id, edit: { rowId, pct } }),
      });
      const d = await r.json();
      if (!r.ok || d.error) throw new Error(d.error || `HTTP ${r.status}`);
      const idx = (p.rowIds || []).indexOf(rowId);
      setItems((xs) => xs.map((x) => (x.id === p.id ? { ...x, rows: x.rows.map((row, i) => (i === idx ? d.row : row)) } : x)));
    } catch (e) {
      setErr(e.message);
      throw e;
    }
  }
  async function setMany(list, status) {
    for (const p of list) await setStatus(p, status);
  }
  if (!items.length) return null;
  const sections = [...new Set(items.map((p) => p.section || "Proposals"))];
  const open = items.filter((p) => p.status === "proposed").length;
  return (
    <div>
      <div style={{ fontSize: "13px", color: "#555", margin: "2px 0 8px" }}>
        {open} to decide · Approve = done automatically within ~10 min (or by Claude where marked)
      </div>
      {err && <div style={{ color: "#b00020" }}>{err}</div>}
      {sections.map((sec) => {
        const list = items.filter((p) => (p.section || "Proposals") === sec);
        const pending = list.filter((p) => p.status === "proposed");
        return (
          <div key={sec} style={{ marginBottom: "14px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", margin: "8px 0 4px" }}>
              <span style={{ fontWeight: 700, fontSize: "14px" }}>{sec}</span>
              <span style={{ fontSize: "12px", color: "#888" }}>{list.length}</span>
              {pending.length > 1 && (
                <button style={smallBtn("#fff", "#1e8449", "#b5dcc3")} disabled={busy != null} onClick={() => setMany(pending, "approved")}>
                  ✓ approve all {pending.length}
                </button>
              )}
            </div>
            {list.map((p) => {
              const [label, color] = STATUS_STYLE[p.status] || ["", "#555"];
              const locked = ["applied", "applying"].includes(p.status);
              const [what, why] = splitTitle(p.title);
              const decided = p.status !== "proposed";
              return (
                <div
                  key={p.id}
                  style={{
                    display: "flex", gap: "10px", alignItems: "flex-start", padding: "8px 10px", marginBottom: "6px",
                    border: "1px solid #e6eaf0", borderRadius: "8px",
                    background: p.status === "approved" || p.status === "applied" ? "#f2faf5" : p.status === "rejected" ? "#fafafa" : "#fff",
                    opacity: p.status === "rejected" ? 0.55 : 1,
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600 }}>
                      {what}
                      {!p.hasAction && <span style={{ fontSize: "11px", color: "#888", fontWeight: 400 }}> · by Claude</span>}
                    </div>
                    {why && <div style={{ fontSize: "12px", color: "#777" }}>{why}</div>}
                    {p.why && <div style={{ fontSize: "11px", color: "#999" }}>{p.why}</div>}
                    {p.rows?.length ? <MiniTable columns={p.columns || []} rows={p.rows} rowIds={p.rowIds}
                      onEdit={!decided && p.hasAction && p.rowIds ? (rid, pct) => editRow(p, rid, pct) : null} /> : <DetailList text={p.detail} />}
                    {p.result && <div style={{ fontSize: "12px", color, marginTop: "3px" }}>{p.result}</div>}
                  </div>
                  <div style={{ display: "flex", gap: "6px", alignItems: "center", flex: "0 0 auto" }}>
                    {decided && label && <span style={{ fontSize: "12px", color, fontWeight: 700 }}>{label}</span>}
                    {!decided && (
                      <>
                        <button style={smallBtn("#1e8449", "#fff", "#1e8449")} disabled={busy === p.id} onClick={() => setStatus(p, "approved")}>✓ Approve</button>
                        <button style={smallBtn("#fff", "#b03a2e", "#e0b4ae")} disabled={busy === p.id} onClick={() => setStatus(p, "rejected")}>✕</button>
                      </>
                    )}
                    {decided && !locked && (
                      <button style={smallBtn("#fff", "#1f5fbf", "#b8c8e6")} disabled={busy === p.id} onClick={() => setStatus(p, "proposed")}>undo</button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

function Section({ report, open, onToggle, period }) {
  const lines = (report.text || "").split("\n");
  const ctx = `Checks ${period} › ${report.label}`;
  const title = lines.find((l) => l.trim()) || "";
  const flags = Object.entries(report.flags || {});
  return (
    <div style={{ background: "#fff", border: "1px solid #ddd", borderRadius: "8px", marginBottom: "10px", overflow: "hidden" }}>
      <div
        onClick={onToggle}
        style={{ display: "flex", gap: "10px", alignItems: "center", padding: "10px 14px", cursor: "pointer", background: open ? "#f3f6fb" : "#fff" }}
      >
        <span style={{ width: "14px" }}>{open ? "▾" : "▸"}</span>
        <strong style={{ flex: "0 0 auto" }}>{report.label}</strong>
        <span style={{ fontSize: "13px" }}>{flags.length ? flags.map(([m, n]) => `${m}${n}`).join(" ") : "✅"}</span>
        {report.proposals?.length > 0 && (
          <span style={{ fontSize: "12px", background: "#e8f0fe", color: "#1f5fbf", borderRadius: "10px", padding: "1px 8px" }}>
            {report.proposals.filter((p) => p.status === "proposed").length} to decide
          </span>
        )}
        <span style={{ flex: "1 1 auto", fontSize: "12px", color: "#777", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {title}
        </span>
        <ReplyLink ctx={ctx} label="💬 Reply" />
      </div>
      {open && report.proposals?.length > 0 && (
        <div style={{ padding: "8px 14px 14px", fontSize: "13px", lineHeight: 1.45, borderTop: "1px solid #eee" }}>
          {/* Recommendations first, the report itself behind "Full report"
              (per the user 2026-11-03). Only the red/orange headline lines show. */}
          {lines.filter((l) => /^\s*(🔴|🚨|❌|🚩)/.test(l)).slice(0, 6).map((l, i) => <Line key={i} text={l} ctx={ctx} />)}
          <Proposals report={report} />
          <details style={{ marginTop: "10px" }}>
            <summary style={{ cursor: "pointer", color: "#555" }}>Full report</summary>
            {report.tables?.length > 0 && report.tables.map((t, i) => <Table key={i} table={t} ctx={ctx} />)}
            {lines.map((l, i) => (l.trim() ? <Line key={i} text={l} ctx={ctx} /> : <div key={i} style={{ height: "6px" }} />))}
          </details>
        </div>
      )}
      {open && !report.proposals?.length && (
        <div style={{ padding: "8px 14px 14px", fontSize: "13px", lineHeight: 1.45, borderTop: "1px solid #eee" }}>
          {report.tables?.length > 0 && report.tables.map((t, i) => <Table key={i} table={t} ctx={ctx} />)}
          {report.tables?.length > 0 ? (
            <details>
              <summary style={{ cursor: "pointer", color: "#555", margin: "6px 0" }}>Full text</summary>
              {lines.map((l, i) => (l.trim() ? <Line key={i} text={l} ctx={ctx} /> : <div key={i} style={{ height: "6px" }} />))}
            </details>
          ) : (
            lines.map((l, i) => (l.trim() ? <Line key={i} text={l} ctx={ctx} /> : <div key={i} style={{ height: "6px" }} />))
          )}
        </div>
      )}
    </div>
  );
}

// The check list itself - also used on /ads-reviews with area="ads" (per the
// user 2026-11-03: ads checks live with the ads reviews, business checks here).
export function ChecksView({ area, kind, period, onKind, onPeriod }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [open, setOpen] = useState({});

  useEffect(() => {
    setData(null);
    const q = new URLSearchParams({ kind, ...(period ? { period } : {}), ...(area ? { area } : {}) });
    fetch(`${LOCAL_API_BASE}/GetCheckReports?${q}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) throw new Error(d.error);
        setData(d);
        setOpen(Object.fromEntries((d.reports || []).map((r) => [r.job, Boolean(r.flags?.["🔴"] || r.flags?.["🚨"] || r.proposals?.some((p) => p.status === "proposed"))])));
      })
      .catch((e) => setError(e.message));
  }, [kind, period, area]);

  const periods = data?.periods?.[kind] || [];
  const tab = (k, label) => (
    <button
      onClick={() => onKind(k)}
      style={{
        padding: "6px 14px", borderRadius: "14px", border: "1px solid #ccc", cursor: "pointer",
        background: kind === k ? "#1f5fbf" : "#fff", color: kind === k ? "#fff" : "#333",
      }}
    >
      {label}
    </button>
  );

  return (
    <>
      <div style={{ display: "flex", gap: "8px", justifyContent: "center", flexWrap: "wrap", marginBottom: "12px" }}>
        {tab("weekly", "Weekly (Monday)")}
        {tab("monthly", "Monthly")}
        <select
          value={data?.period || ""}
          onChange={(e) => onPeriod(e.target.value)}
          style={{ padding: "5px 8px", background: "#fff", color: "#222" }}
        >
          {periods.length === 0 && <option value="">nothing stored yet</option>}
          {periods.map((p) => (
            <option key={p} value={p}>{kind === "weekly" ? `Week of ${p}` : p}</option>
          ))}
        </select>
      </div>
      <div style={{ display: "flex", gap: "8px", justifyContent: "center", marginBottom: "12px", fontSize: "13px" }}>
        <button style={{ cursor: "pointer" }} onClick={() => setOpen(Object.fromEntries((data?.reports || []).map((r) => [r.job, true])))}>Open all</button>
        <button style={{ cursor: "pointer" }} onClick={() => setOpen({})}>Close all</button>
      </div>

      {error && <div style={{ color: "#b00020", textAlign: "center" }}>{error}</div>}
      {!error && !data && <p style={{ textAlign: "center" }}>Loading...</p>}
      {data && data.reports.length === 0 && (
        <p style={{ textAlign: "center", color: "#777" }}>
          {kind === "monthly" ? "Monthly checks run on the 2nd of each month; they will appear here then." : "No checks stored for this week."}
        </p>
      )}
      {data?.reports?.map((r) => (
        <Section key={r.job} report={r} period={data.period} open={!!open[r.job]} onToggle={() => setOpen((o) => ({ ...o, [r.job]: !o[r.job] }))} />
      ))}
    </>
  );
}

export default function ChecksPage() {
  const [params, setParams] = useSearchParams();
  const kind = params.get("kind") || "weekly";
  const period = params.get("period") || "";
  return (
    <div style={{ padding: "20px 16px", fontFamily: "Arial, sans-serif", background: "#fafafa", minHeight: "100vh", color: "#222", textAlign: "left", maxWidth: "1100px", margin: "0 auto" }}>
      <h2 style={{ textAlign: "center", marginBottom: "4px" }}>Checks</h2>
      <p style={{ textAlign: "center", fontSize: "13px", color: "#666", marginTop: 0 }}>
        Business checks. The ads checks (reviews, bid rules, harvest, TACOS) are on <Link to="/ads-reviews" style={{ color: "#1f5fbf" }}>Ads reviews</Link>.
      </p>
      <ChecksView area="business" kind={kind} period={period}
        onKind={(k) => setParams({ kind: k })} onPeriod={(p) => setParams({ kind, period: p })} />
      <div style={{ display: "flex", justifyContent: "center", gap: "10px", padding: "16px 0" }}>
        <Link style={buttonStyle()} to="/">Home</Link>
        <Link style={buttonStyle()} to="/ads-reviews">Ads reviews</Link>
      </div>
    </div>
  );
}
