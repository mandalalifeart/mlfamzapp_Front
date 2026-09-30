import { useState } from "react";

// Shared collapsible-section header, used consistently across pages so
// every collapsible block in the app looks/behaves the same. Deliberately a
// <div role="button"> with explicit color/visibility overrides, not a
// native <button> - this app's global styles previously caused a native
// button's text to render invisible, which this pattern works around.
export function collapsibleHeaderStyle() {
  return {
    width: "100%",
    boxSizing: "border-box",
    border: "1px solid #ddd",
    backgroundColor: "#ffffff",
    color: "#222222",
    borderRadius: "8px",
    padding: "10px 12px",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "12px",
    fontFamily: "Arial, sans-serif",
    fontSize: "16px",
  };
}

export default function CollapsibleSection({ title, defaultOpen = true, children }) {
  const safeTitle = title || "Section";
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div style={{ marginTop: 20 }}>
      <div
        role="button"
        tabIndex={0}
        onClick={() => setIsOpen((current) => !current)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setIsOpen((current) => !current);
          }
        }}
        style={collapsibleHeaderStyle()}
        aria-expanded={isOpen}
        title={safeTitle}
      >
        <div
          style={{
            color: "#222222",
            fontFamily: "Arial, sans-serif",
            fontSize: "16px",
            fontWeight: 700,
            lineHeight: 1.3,
            whiteSpace: "normal",
            wordBreak: "break-word",
            overflowWrap: "anywhere",
            overflow: "visible",
            opacity: 1,
            visibility: "visible",
            flex: "1 1 auto",
            minWidth: 0,
          }}
        >
          {safeTitle}
        </div>

        <div
          aria-hidden="true"
          style={{
            color: "#222222",
            fontFamily: "Arial, sans-serif",
            fontSize: "16px",
            fontWeight: 700,
            lineHeight: 1.3,
            opacity: 1,
            visibility: "visible",
            flex: "0 0 auto",
          }}
        >
          {isOpen ? "▲" : "▼"}
        </div>
      </div>

      {isOpen && <div style={{ marginTop: 12 }}>{children}</div>}
    </div>
  );
}
