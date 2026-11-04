import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";

// App-wide menu (per the user 2026-11-02: "the home page links are a full mess").
// Footer shortcuts on every page, in one line with the Menu button (per the user 2026-11-02).
const SHORTCUTS = [["🏠", "Home", "/"], ["📈", "Sales", "/sales"], ["📦", "Next order", "/next-order"], ["📣", "Ads campaigns", "/ads-campaigns"]];

export const MENU = [
  {
    label: "📈 Sales",
    items: [
      ["Sales overview", "/sales"],
      ["Product analytics", "/asin-analytics"],
      ["Returns", "/returns"],
      ["Profit simulation", "/price-simulation"],
      ["Monthly sales report", "/"],
    ],
  },
  {
    label: "📦 Inventory",
    items: [
      ["Next order", "/next-order"],
      ["FBA shipments", "/fba-shipments"],
      ["Import shipments", "/shipments"],
      ["FBA fees", "/fba-fees"],
    ],
  },
  {
    label: "📣 Ads",
    items: [
      ["Campaigns", "/ads-campaigns"],
      ["Keywords", "/ads-keywords"],
      ["Search terms", "/ads-search-terms"],
      ["Advertised products", "/ads-advertised-products"],
      ["Bid optimizer", "/ads-bid-optimizer"],
      ["Bid change results", "/bid-change-performance"],
      ["Archer affiliates", "/archer"],
      ["Ads accounts", "/ads"],
    ],
  },
  {
    label: "✅ Reviews",
    items: [
      ["📈 Sales & profit growth", "/growth"],
      ["Checks (weekly + monthly)", "/checks"],
      ["To-do list", "/todo"],
      ["Ads reviews + checklists", "/ads-reviews"],
    ],
  },
  {
    label: "💶 Finance",
    items: [
      ["Payments", "/payments"],
      ["Wise", "/wise"],
      ["VAT", "/vat"],
    ],
  },
  {
    label: "⚙️ More",
    items: [
      ["Etsy", "/etsy"],
      ["Product research", "/product-research"],
      ["Ops dashboard", "/ops"],
    ],
  },
];

// One "☰ Menu" button at the end of every page (per the user 2026-11-02: a
// single menu item, each item on its own line, at the bottom of the page -
// not floating on the screen). The list opens upward.
export default function NavBar() {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const { pathname } = useLocation();

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    const close = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, []);

  return (
    <footer
      style={{
        display: "flex", justifyContent: "center", alignItems: "center", gap: "8px", padding: "16px 8px 24px",
        fontFamily: "Arial, sans-serif", borderTop: "1px solid #e3e8f0", marginTop: "24px", flexWrap: "nowrap",
        maxWidth: "460px", marginLeft: "auto", marginRight: "auto", boxSizing: "border-box", width: "100%",
      }}
    >
    {SHORTCUTS.map(([icon, label, to]) => (
      <Link
        key={to}
        to={to}
        title={label}
        aria-label={label}
        style={{
          flex: "1 1 0", minWidth: 0, display: "flex", alignItems: "center", justifyContent: "center", padding: "10px 0",
          background: pathname === to ? "#eef3fb" : "#fff", border: "1px solid #d6dde8", borderRadius: "12px",
          textDecoration: "none", fontSize: "22px", lineHeight: 1, boxShadow: "0 2px 6px rgba(0,0,0,0.06)",
        }}
      >
        {icon}
      </Link>
    ))}
    <div ref={ref} style={{ position: "relative", zIndex: 1000, flex: "1 1 0", minWidth: 0, display: "flex" }}>
      {open && (
        <div
          style={{
            position: "absolute", right: 0, bottom: "calc(100% + 8px)", background: "#fff", border: "1px solid #ccd3df",
            borderRadius: "10px", boxShadow: "0 8px 24px rgba(0,0,0,0.22)", padding: "8px 6px", width: "250px",
            maxHeight: "75vh", overflowY: "auto", textAlign: "left",
          }}
        >
          <Link to="/" style={{ display: "block", padding: "7px 10px", fontWeight: 700, color: "#1f2d45", textDecoration: "none", borderRadius: "6px", background: pathname === "/" ? "#eef3fb" : undefined }}>
            🏠 Home
          </Link>
          {MENU.map((g) => (
            <div key={g.label} style={{ marginTop: "6px" }}>
              <div style={{ padding: "4px 10px", fontSize: "12px", fontWeight: 700, color: "#6b7a90", textTransform: "uppercase" }}>{g.label}</div>
              {g.items.filter(([, to]) => to !== "/").map(([label, to]) => (
                <Link
                  key={to + label}
                  to={to}
                  style={{
                    display: "block", padding: "6px 10px 6px 22px", borderRadius: "6px", textDecoration: "none", fontSize: "14px",
                    color: pathname === to ? "#1f5fbf" : "#222", fontWeight: pathname === to ? 700 : 400,
                    background: pathname === to ? "#eef3fb" : undefined,
                  }}
                >
                  {label}
                </Link>
              ))}
            </div>
          ))}
        </div>
      )}
      <button
        onClick={() => setOpen((v) => !v)}
        title="Menu"
        aria-label="Menu"
        style={{
          flex: 1, background: "#1f2d45", color: "#fff", border: "none", borderRadius: "12px", padding: "10px 0",
          fontSize: "22px", lineHeight: 1, fontWeight: 700, cursor: "pointer", boxShadow: "0 4px 12px rgba(0,0,0,0.25)",
        }}
      >
        {open ? "✕" : "☰"}
      </button>
    </div>
    </footer>
  );
}
