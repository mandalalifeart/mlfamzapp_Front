import { useEffect, useState } from "react";

// To-do list (per the user 2026-11-02). Claude adds items from Telegram
// ("add to the todo list"); here you add, tick done, reopen and keep notes.
const LOCAL_API_BASE = "https://amzapi.mandalalifeart.com";
const KEY = import.meta.env.VITE_PROPOSAL_KEY || "";
const CLAUDE_BOT = "baba_777_bot";

async function setTodo(body) {
  const r = await fetch(`${LOCAL_API_BASE}/SetTodo?key=${encodeURIComponent(KEY)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const d = await r.json();
  if (!r.ok || d.error) throw new Error(d.error || `HTTP ${r.status}`);
}

const small = { fontSize: "12px", padding: "3px 8px", borderRadius: "6px", border: "1px solid #ccd3df", background: "#fff", cursor: "pointer", width: "auto", margin: 0, color: "#1f2d45" };

function Item({ it, reload }) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState(it.note || "");
  const [busy, setBusy] = useState(false);
  const done = it.status === "done";
  const act = async (body) => {
    setBusy(true);
    try {
      await setTodo({ id: it.id, ...body });
      await reload();
    } catch (e) {
      alert(e.message);
    }
    setBusy(false);
  };
  const reply = `https://t.me/${CLAUDE_BOT}?text=${encodeURIComponent(`[To-do] ${it.title}\n`)}`;
  return (
    <div style={{ border: "1px solid #e3e8f0", borderRadius: "10px", padding: "10px 12px", marginBottom: "8px", background: done ? "#f6f8fb" : "#fff", textAlign: "left" }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
        <input type="checkbox" checked={done} disabled={busy} onChange={() => act({ status: done ? "open" : "done" })} style={{ marginTop: "3px", width: "18px", height: "18px", flex: "none" }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div onClick={() => setOpen((v) => !v)} style={{ cursor: "pointer", fontWeight: 600, textDecoration: done ? "line-through" : "none", color: done ? "#7a8699" : "#1f2d45" }}>
            {it.marketplace ? <span style={{ fontSize: "11px", background: "#eef3fb", color: "#1f5fbf", borderRadius: "4px", padding: "1px 5px", marginRight: "6px" }}>{it.marketplace}</span> : null}
            {it.area ? <span style={{ fontSize: "11px", background: "#f3f0fb", color: "#5b3fa6", borderRadius: "4px", padding: "1px 5px", marginRight: "6px" }}>{it.area}</span> : null}
            {it.title}
          </div>
          <div style={{ fontSize: "12px", color: "#7a8699", marginTop: "2px" }}>
            added {String(it.created || "").slice(0, 10)}{done && it.done_at ? ` · done ${it.done_at.slice(0, 10)}` : ""}
          </div>
          {open && (
            <div style={{ marginTop: "8px" }}>
              {it.detail && <div style={{ whiteSpace: "pre-wrap", fontSize: "14px", marginBottom: "8px" }}>{it.detail}</div>}
              <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Notes…" rows={3} style={{ width: "100%", boxSizing: "border-box", fontSize: "14px", padding: "6px", borderRadius: "6px", border: "1px solid #ccd3df" }} />
              <div style={{ display: "flex", gap: "8px", marginTop: "6px", flexWrap: "wrap" }}>
                <button style={small} disabled={busy} onClick={() => act({ note })}>Save note</button>
                <button style={{ ...small, color: "#c0392b" }} disabled={busy} onClick={() => window.confirm("Delete this item?") && act({ delete: true })}>Delete</button>
              </div>
            </div>
          )}
        </div>
        <a href={reply} target="_blank" rel="noopener noreferrer" title="Ask Claude about this - the answer comes in Telegram" style={{ textDecoration: "none", fontSize: "15px", flex: "none" }}>💬</a>
      </div>
    </div>
  );
}

export default function TodoPage() {
  const [items, setItems] = useState(null);
  const [error, setError] = useState("");
  const [title, setTitle] = useState("");
  const [mp, setMp] = useState("");
  const [showDone, setShowDone] = useState(false);

  const load = async () => {
    try {
      const r = await fetch(`${LOCAL_API_BASE}/GetTodos`);
      const d = await r.json();
      if (d.error) throw new Error(d.error);
      setItems(d.items || []);
    } catch (e) {
      setError(e.message);
    }
  };
  useEffect(() => {
    load();
  }, []);

  const add = async () => {
    if (!title.trim()) return;
    try {
      await setTodo({ title: title.trim(), marketplace: mp.trim().toUpperCase() });
      setTitle("");
      setMp("");
      await load();
    } catch (e) {
      alert(e.message);
    }
  };

  const open = (items || []).filter((i) => i.status !== "done");
  const done = (items || []).filter((i) => i.status === "done").sort((a, b) => String(b.done_at).localeCompare(String(a.done_at)));

  return (
    <div style={{ maxWidth: "760px", margin: "0 auto", padding: "16px", fontFamily: "Arial, sans-serif" }}>
      <h2 style={{ margin: "4px 0 12px" }}>📝 To-do</h2>
      <div style={{ display: "flex", gap: "6px", marginBottom: "14px" }}>
        <input value={mp} onChange={(e) => setMp(e.target.value)} placeholder="MP" style={{ width: "54px", padding: "8px", borderRadius: "8px", border: "1px solid #ccd3df", fontSize: "14px" }} />
        <input value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} placeholder="New to-do…" style={{ flex: 1, minWidth: 0, padding: "8px", borderRadius: "8px", border: "1px solid #ccd3df", fontSize: "14px" }} />
        <button onClick={add} style={{ ...small, padding: "8px 14px", background: "#1f2d45", color: "#fff", border: "none", fontSize: "14px" }}>Add</button>
      </div>
      {error && <div style={{ color: "#c0392b" }}>{error}</div>}
      {!items && !error && <div>Loading…</div>}
      {items && (
        <>
          <div style={{ fontWeight: 700, margin: "6px 0" }}>Open ({open.length})</div>
          {open.length ? open.map((it) => <Item key={it.id} it={it} reload={load} />) : <div style={{ color: "#7a8699" }}>Nothing open 🎉</div>}
          <div onClick={() => setShowDone((v) => !v)} style={{ fontWeight: 700, margin: "16px 0 6px", cursor: "pointer", color: "#1f5fbf" }}>
            {showDone ? "▾" : "▸"} Done ({done.length})
          </div>
          {showDone && done.map((it) => <Item key={it.id} it={it} reload={load} />)}
        </>
      )}
    </div>
  );
}
