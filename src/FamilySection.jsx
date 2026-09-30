// Collapsible wrapper around every group belonging to one family.
export default function FamilySection({ label, summary, expanded, onToggle, children }) {
  return (
    <div
      style={{
        background: "#f3f6fb",
        border: "1px solid #c9d6ea",
        borderRadius: "8px",
        padding: "16px",
      }}
    >
      <div
        onClick={onToggle}
        style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "6px", cursor: "pointer" }}
      >
        <h2 style={{ margin: 0, fontSize: "20px" }}>
          {expanded ? "▾" : "▸"} {label}
        </h2>
        <div style={{ color: "#555", fontSize: "13px" }}>{summary}</div>
      </div>
      {expanded && <div style={{ display: "grid", gap: "18px", marginTop: "14px" }}>{children}</div>}
    </div>
  );
}
