import { useEffect, useState } from "react";

// Weekly / monthly ads review check lists (2026-11-02, per the user). The
// items live in AdsReviews.CHECKLISTS; ticks + notes per period are stored
// in PocketBase (job_state ads_checklists) so they show on every device.
const API_BASE = import.meta.env.VITE_API_BASE || "https://amzapi.mandalalifeart.com";

const card = { background: "#fff", color: "#222", border: "1px solid #ddd", borderRadius: "8px", padding: "14px", marginBottom: "14px" };
const muted = { color: "#666", fontSize: "12px" };
const TITLES = { weekly: "Weekly ads review (Monday)", monthly: "Monthly ads review (first week)" };

function shiftPeriod(kind, period, step) {
  if (kind === "weekly") {
    const d = new Date(`${period}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() + 7 * step);
    return d.toISOString().slice(0, 10);
  }
  const [y, m] = period.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + step, 1));
  return d.toISOString().slice(0, 7);
}

function periodLabel(kind, period) {
  if (kind === "weekly") return `Week of ${period}`;
  const [y, m] = period.split("-").map(Number);
  return `Review of ${new Date(Date.UTC(y, m - 1, 1)).toLocaleString(undefined, { month: "long", year: "numeric", timeZone: "UTC" })}`;
}

export default function AdsChecklist() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [kind, setKind] = useState(() => (window.location.hash === "#monthly" ? "monthly" : "weekly"));
  const [periods, setPeriods] = useState({});

  useEffect(() => {
    fetch(`${API_BASE}/GetAdsChecklist`)
      .then((r) => r.json())
      .then((j) => {
        if (j.error) throw new Error(j.error);
        setData(j);
        setPeriods(j.current);
      })
      .catch((e) => setError(String(e.message || e)));
  }, []);

  if (error) return <div style={{ ...card, color: "#b3261e" }}>Checklist: {error}</div>;
  if (!data) return <div style={card}>Loading checklist…</div>;

  const period = periods[kind];
  const key = `${kind}|${period}`;
  const entry = data.state[key] || { done: [], notes: {} };
  const items = data.items[kind] || [];
  const doneCount = items.filter((_, i) => entry.done.includes(i)).length;

  async function save(index, change) {
    const next = { ...entry, done: [...entry.done], notes: { ...(entry.notes || {}) } };
    if (change.done !== undefined) next.done = change.done ? [...next.done, index] : next.done.filter((i) => i !== index);
    if (change.note !== undefined) next.notes[String(index)] = change.note;
    setData((d) => ({ ...d, state: { ...d.state, [key]: next } }));
    try {
      const r = await fetch(`${API_BASE}/SetAdsChecklistItem`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, period, index, ...change }),
      });
      const j = await r.json();
      if (j.error) throw new Error(j.error);
      setData((d) => ({ ...d, state: { ...d.state, [key]: j.entry } }));
    } catch (e) {
      setError(String(e.message || e));
    }
  }

  const tab = (k) => ({
    padding: "6px 14px", borderRadius: "999px", border: `1px solid ${kind === k ? "#1565c0" : "#bbb"}`,
    background: kind === k ? "#1565c0" : "#fff", color: kind === k ? "#fff" : "#333", fontWeight: 600, fontSize: "13px", cursor: "pointer",
  });

  return (
    <div style={card} id="checklist">
      <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", alignItems: "center", marginBottom: "8px" }}>
        <h3 style={{ margin: 0, marginRight: "8px" }}>Review checklist</h3>
        {["weekly", "monthly"].map((k) => (
          <button key={k} style={tab(k)} onClick={() => { setKind(k); window.history.replaceState(null, "", `#${k}`); }}>
            {k === "weekly" ? "Weekly" : "Monthly"}
          </button>
        ))}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", alignItems: "center", marginBottom: "8px" }}>
        <button style={tab("")} onClick={() => setPeriods((p) => ({ ...p, [kind]: shiftPeriod(kind, period, -1) }))}>◀</button>
        <b>{TITLES[kind]} · {periodLabel(kind, period)}</b>
        <button style={tab("")} onClick={() => setPeriods((p) => ({ ...p, [kind]: shiftPeriod(kind, period, 1) }))}>▶</button>
        <span style={{ ...muted, fontWeight: 600, color: doneCount === items.length ? "#1e7b34" : "#666" }}>
          {doneCount}/{items.length} done
        </span>
      </div>
      {items.map((text, i) => {
        const done = entry.done.includes(i);
        return (
          <div key={i} style={{ padding: "7px 0", borderTop: "1px solid #eee" }}>
            <label style={{ display: "flex", gap: "10px", alignItems: "flex-start", cursor: "pointer" }}>
              <input type="checkbox" checked={done} onChange={(e) => save(i, { done: e.target.checked })} style={{ width: "20px", height: "20px", flex: "0 0 auto" }} />
              <span style={{ fontSize: "14px", textDecoration: done ? "line-through" : "none", color: done ? "#888" : "#222" }}>
                {i + 1}. {text}
              </span>
            </label>
            <input
              key={`${key}-${i}`}
              defaultValue={(entry.notes || {})[String(i)] || ""}
              placeholder="note (optional)"
              onBlur={(e) => {
                if (e.target.value !== ((entry.notes || {})[String(i)] || "")) save(i, { note: e.target.value });
              }}
              style={{ marginLeft: "30px", marginTop: "4px", width: "calc(100% - 30px)", maxWidth: "600px", padding: "4px 6px", fontSize: "12px", border: "1px solid #ddd", borderRadius: "4px", background: "#fff", color: "#222", boxSizing: "border-box" }}
            />
          </div>
        );
      })}
    </div>
  );
}
