import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";

// One menu bar on top of every page (per the user 2026-11-02: "the home page
// links are a full mess"): 6 dropdown groups. Click a group to open it; a
// click anywhere else or a page change closes it.
export const MENU = [
  {
    label: "📈 Sales",
    items: [
      ["Sales overview", "/sales"],
      ["Product analytics", "/asin-analytics"],
      ["Returns", "/returns"],
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
      ["Checks (weekly + monthly)", "/checks"],
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

export default function NavBar() {
  const [open, setOpen] = useState(null);
  const ref = useRef(null);
  const { pathname } = useLocation();

  useEffect(() => setOpen(null), [pathname]);
  useEffect(() => {
    const close = (e) => ref.current && !ref.current.contains(e.target) && setOpen(null);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, []);

  const activeGroup = MENU.findIndex((g) => g.items.some(([, to]) => to !== "/" && pathname.startsWith(to)));

  return (
    <nav
      ref={ref}
      style={{
        position: "sticky", top: 0, zIndex: 50, background: "#1f2d45", padding: "6px 12px",
        display: "flex", flexWrap: "wrap", gap: "4px", alignItems: "center", fontFamily: "Arial, sans-serif",
        boxShadow: "0 2px 6px rgba(0,0,0,0.15)",
      }}
    >
      <Link to="/" style={{ color: "#fff", fontWeight: 700, textDecoration: "none", marginRight: "10px", fontSize: "15px" }}>
        🏠 AmzBot
      </Link>
      {MENU.map((g, i) => (
        <div key={g.label} style={{ position: "relative" }}>
          <button
            onClick={() => setOpen(open === i ? null : i)}
            style={{
              background: open === i || activeGroup === i ? "#3b5683" : "transparent", color: "#fff", border: "none",
              padding: "7px 10px", borderRadius: "6px", cursor: "pointer", fontSize: "14px", fontWeight: 600,
            }}
          >
            {g.label} ▾
          </button>
          {open === i && (
            <div
              style={{
                position: "absolute", top: "calc(100% + 4px)", left: 0, background: "#fff", border: "1px solid #ddd",
                borderRadius: "8px", boxShadow: "0 6px 16px rgba(0,0,0,0.18)", padding: "6px", minWidth: "210px",
                display: "flex", flexDirection: "column",
              }}
            >
              {g.items.map(([label, to]) => (
                <Link
                  key={to + label}
                  to={to}
                  style={{
                    padding: "8px 10px", borderRadius: "6px", textDecoration: "none", fontSize: "14px",
                    color: pathname === to ? "#1f5fbf" : "#222", fontWeight: pathname === to ? 700 : 400,
                    background: pathname === to ? "#eef3fb" : undefined,
                  }}
                >
                  {label}
                </Link>
              ))}
            </div>
          )}
        </div>
      ))}
    </nav>
  );
}
