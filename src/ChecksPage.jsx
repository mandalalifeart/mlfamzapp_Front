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

// Proposals with checkboxes (per the user 2026-11-02): ticking = approved.
// Approved proposals with an action are applied by the server within ~10 min;
// the others ("by Claude") are done in the chat.
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
  if (!items.length) return null;
  const sections = [...new Set(items.map((p) => p.section || "Proposals"))];
  const approved = items.filter((p) => p.status === "approved").length;
  return (
    <div style={{ marginTop: "14px", borderTop: "2px solid #e3e8f0", paddingTop: "10px" }}>
      <div style={{ fontWeight: 700, marginBottom: "6px" }}>
        Proposals ({items.length}) · tick to approve{approved ? ` · ${approved} approved, applied within ~10 min` : ""}
      </div>
      {err && <div style={{ color: "#b00020" }}>{err}</div>}
      {sections.map((sec) => (
        <div key={sec} style={{ marginBottom: "8px" }}>
          <div style={{ fontSize: "12px", color: "#666", textTransform: "uppercase", margin: "6px 0 2px" }}>{sec}</div>
          {items
            .filter((p) => (p.section || "Proposals") === sec)
            .map((p) => {
              const [label, color] = STATUS_STYLE[p.status] || ["", "#555"];
              const locked = ["applied", "applying"].includes(p.status);
              return (
                <div key={p.id} style={{ display: "flex", gap: "8px", alignItems: "flex-start", padding: "5px 4px", borderBottom: "1px solid #f0f0f0", opacity: p.status === "rejected" ? 0.5 : 1 }}>
                  <input
                    type="checkbox"
                    style={{ marginTop: "3px", width: "16px", height: "16px" }}
                    checked={["approved", "applying", "applied"].includes(p.status)}
                    disabled={locked || busy === p.id}
                    onChange={(e) => setStatus(p, e.target.checked ? "approved" : "proposed")}
                  />
                  <div style={{ flex: 1 }}>
                    <div>
                      <strong>#{p.id}</strong> {p.title}{" "}
                      <span style={{ fontSize: "11px", color: "#888" }}>{p.hasAction ? "(applied automatically)" : "(done by Claude after approval)"}</span>{" "}
                      {label && <span style={{ fontSize: "12px", color, fontWeight: 600 }}>{label}</span>}
                    </div>
                    {p.detail && <div style={{ fontSize: "12px", color: "#555" }}>{p.detail}</div>}
                    {p.result && <div style={{ fontSize: "12px", color }}>{p.result}</div>}
                  </div>
                  {!locked && p.status !== "rejected" && (
                    <button onClick={() => setStatus(p, "rejected")} style={{ fontSize: "12px", cursor: "pointer", padding: "3px 8px", width: "auto", minWidth: 0, height: "auto", background: "#fff", color: "#b03a2e", border: "1px solid #e0b4ae", borderRadius: "6px", flex: "0 0 auto", fontWeight: 600 }} title="Reject - nothing will be done">✕ reject</button>
                  )}
                  {p.status === "rejected" && (
                    <button onClick={() => setStatus(p, "proposed")} style={{ fontSize: "12px", cursor: "pointer", padding: "3px 8px", width: "auto", minWidth: 0, height: "auto", background: "#fff", color: "#1f5fbf", border: "1px solid #b8c8e6", borderRadius: "6px", flex: "0 0 auto", fontWeight: 600 }}>undo</button>
                  )}
                </div>
              );
            })}
        </div>
      ))}
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
      {open && (
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
          <Proposals report={report} />
        </div>
      )}
    </div>
  );
}

export default function ChecksPage() {
  const [params, setParams] = useSearchParams();
  const kind = params.get("kind") || "weekly";
  const period = params.get("period") || "";
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [open, setOpen] = useState({});

  useEffect(() => {
    setData(null);
    const q = new URLSearchParams({ kind, ...(period ? { period } : {}) });
    fetch(`${LOCAL_API_BASE}/GetCheckReports?${q}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) throw new Error(d.error);
        setData(d);
        setOpen(Object.fromEntries((d.reports || []).map((r) => [r.job, Boolean(r.flags?.["🔴"] || r.flags?.["🚨"] || r.proposals?.some((p) => p.status === "proposed"))])));
      })
      .catch((e) => setError(e.message));
  }, [kind, period]);

  const periods = data?.periods?.[kind] || [];
  const tab = (k, label) => (
    <button
      onClick={() => setParams({ kind: k })}
      style={{
        padding: "6px 14px", borderRadius: "14px", border: "1px solid #ccc", cursor: "pointer",
        background: kind === k ? "#1f5fbf" : "#fff", color: kind === k ? "#fff" : "#333",
      }}
    >
      {label}
    </button>
  );

  return (
    <div style={{ padding: "20px 16px", fontFamily: "Arial, sans-serif", background: "#fafafa", minHeight: "100vh", color: "#222", textAlign: "left", maxWidth: "1100px", margin: "0 auto" }}>
      <h2 style={{ textAlign: "center", marginBottom: "8px" }}>Checks</h2>
      <div style={{ display: "flex", gap: "8px", justifyContent: "center", flexWrap: "wrap", marginBottom: "12px" }}>
        {tab("weekly", "Weekly (Monday)")}
        {tab("monthly", "Monthly")}
        <select
          value={data?.period || ""}
          onChange={(e) => setParams({ kind, period: e.target.value })}
          style={{ padding: "5px 8px" }}
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
        <Link to={`/ads-reviews#${kind === "monthly" ? "monthly" : "weekly"}`} style={{ color: "#1f5fbf", alignSelf: "center" }}>
          ✅ {kind === "monthly" ? "Monthly" : "Weekly"} ads checklist
        </Link>
      </div>

      {error && <div style={{ color: "#b00020", textAlign: "center" }}>{error}</div>}
      {!error && !data && <p style={{ textAlign: "center" }}>Loading...</p>}
      {data && data.reports.length === 0 && (
        <p style={{ textAlign: "center", color: "#777" }}>
          {kind === "monthly" ? "Monthly checks run on the 3rd-6th of each month; the first ones will appear here then." : "No checks stored for this week."}
        </p>
      )}
      {data?.reports?.map((r) => (
        <Section key={r.job} report={r} period={data.period} open={!!open[r.job]} onToggle={() => setOpen((o) => ({ ...o, [r.job]: !o[r.job] }))} />
      ))}

      <div style={{ display: "flex", justifyContent: "center", gap: "10px", padding: "16px 0" }}>
        <Link style={buttonStyle()} to="/">Home</Link>
        <Link style={buttonStyle()} to="/ads-reviews">Ads reviews</Link>
      </div>
    </div>
  );
}
