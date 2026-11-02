import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { buttonStyle } from "./buttonStyle";

// Weekly (Monday) and monthly check reports, stored per week / month
// (GetCheckReports, per the user 2026-11-02 - the Monday .txt file was
// unreadable). One collapsible section per check; sections with 🔴 open.
const LOCAL_API_BASE = "https://amzapi.mandalalifeart.com";
const URL_RE = /(https?:\/\/[^\s)]+)/g;

function Line({ text }) {
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
    </div>
  );
}

function Section({ report, open, onToggle }) {
  const lines = (report.text || "").split("\n");
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
        <span style={{ flex: "1 1 auto", fontSize: "12px", color: "#777", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {title}
        </span>
      </div>
      {open && (
        <div style={{ padding: "8px 14px 14px", fontSize: "13px", lineHeight: 1.45, borderTop: "1px solid #eee" }}>
          {lines.map((l, i) => (l.trim() ? <Line key={i} text={l} /> : <div key={i} style={{ height: "6px" }} />))}
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
        setOpen(Object.fromEntries((d.reports || []).map((r) => [r.job, Boolean(r.flags?.["🔴"] || r.flags?.["🚨"])])));
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
        <Section key={r.job} report={r} open={!!open[r.job]} onToggle={() => setOpen((o) => ({ ...o, [r.job]: !o[r.job] }))} />
      ))}

      <div style={{ display: "flex", justifyContent: "center", gap: "10px", padding: "16px 0" }}>
        <Link style={buttonStyle()} to="/">Home</Link>
        <Link style={buttonStyle()} to="/ads-reviews">Ads reviews</Link>
      </div>
    </div>
  );
}
