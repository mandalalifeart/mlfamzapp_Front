import { useEffect, useState } from "react";
import CollapsibleSection from "./CollapsibleSection";

// Collapsed-by-default section on /sales and /report-view: a single table
// of this month's organic sales vs PPC performance per marketplace. USA and
// EU are expandable parent rows (USA -> Canada/Mexico, EU -> its individual
// EU countries); UK stays a standalone row (not part of the "eu" bucket).
// Each row is its own GetMarketplaceSalesSummary call, fetched lazily only
// when a parent is expanded.
const LOCAL_API_BASE = "https://amzapi.mandalalifeart.com";

const TOP_LEVEL = [
  {
    code: "usa",
    label: "USA",
    children: [
      { code: "ca", label: "Canada" },
      { code: "mex", label: "Mexico" },
    ],
  },
  {
    code: "eu",
    label: "EU",
    children: [
      { code: "de", label: "Germany" },
      { code: "fr", label: "France" },
      { code: "it", label: "Italy" },
      { code: "es", label: "Spain" },
      { code: "nl", label: "Netherlands" },
      { code: "se", label: "Sweden" },
      { code: "pl", label: "Poland" },
      { code: "be", label: "Belgium" },
      { code: "ie", label: "Ireland" },
    ],
  },
  { code: "uk", label: "UK", children: [] },
];

const CURRENCY_SYMBOLS = { USD: "$", EUR: "€", GBP: "£", CAD: "C$", MXN: "MX$", SEK: "kr", PLN: "zł" };

function formatMoney(value, currency) {
  const symbol = CURRENCY_SYMBOLS[currency] || currency || "";
  return `${symbol}${Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatPercent(value) {
  return value === null || value === undefined ? "n/a" : `${value.toFixed(1)}%`;
}

function currentMonthValue(metric, currentMonth) {
  if (!metric || !metric.yearRows || !metric.yearRows[0]) return null;
  return metric.yearRows[0].months[(currentMonth || 1) - 1];
}

async function fetchMarketplaceRow(code) {
  const response = await fetch(`${LOCAL_API_BASE}/GetMarketplaceSalesSummary`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ marketplaces: [code] }),
  });
  const json = await response.json();
  if (!response.ok || json.status !== "success") throw new Error(json.error || "Failed to load");
  const currentMonth = json.currentMonth;
  return {
    currency: json.salesCurrency,
    sales: currentMonthValue(json.sales, currentMonth),
    ppcSales: currentMonthValue(json.ppcSales, currentMonth),
    ppcSpend: currentMonthValue(json.ppcSpend, currentMonth),
    acos: currentMonthValue(json.acos, currentMonth),
    tacos: currentMonthValue(json.tacos, currentMonth),
  };
}

function DataCells({ row }) {
  if (!row) {
    return (
      <>
        <td style={cellStyle("right")}>-</td>
        <td style={cellStyle("right")}>-</td>
        <td style={cellStyle("right")}>-</td>
        <td style={cellStyle("right")}>-</td>
        <td style={cellStyle("right")}>-</td>
      </>
    );
  }
  return (
    <>
      <td style={cellStyle("right")}>{formatMoney(row.sales, row.currency)}</td>
      <td style={cellStyle("right")}>{formatMoney(row.ppcSales, row.currency)}</td>
      <td style={cellStyle("right")}>{formatMoney(row.ppcSpend, row.currency)}</td>
      <td style={cellStyle("right")}>{formatPercent(row.acos)}</td>
      <td style={cellStyle("right")}>{formatPercent(row.tacos)}</td>
    </>
  );
}

function cellStyle(align = "left", extra = {}) {
  return { border: "1px solid #eee", padding: "8px 10px", textAlign: align, fontSize: "13px", ...extra };
}

function MarketplaceRows({ entry }) {
  const [expanded, setExpanded] = useState(false);
  const [rowData, setRowData] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState(false);

  const hasChildren = entry.children.length > 0;

  async function loadAll() {
    if (loaded || loading) return;
    setLoading(true);
    setError("");
    try {
      const codes = [entry.code, ...entry.children.map((c) => c.code)];
      const results = await Promise.all(codes.map((code) => fetchMarketplaceRow(code)));
      const next = {};
      codes.forEach((code, i) => {
        next[code] = results[i];
      });
      setRowData(next);
      setLoaded(true);
    } catch (err) {
      setError(err.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  function toggleExpand() {
    if (!hasChildren) return;
    setExpanded((e) => !e);
    if (!expanded) loadAll();
  }

  // Every row (expandable or not) needs its own top-level totals loaded
  // once, regardless of whether it's expanded - children only fetch when
  // the same loadAll() call runs on expand.
  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <tr>
        <td
          style={cellStyle("left", { fontWeight: 700, cursor: hasChildren ? "pointer" : "default" })}
          onClick={toggleExpand}
        >
          {hasChildren && <span style={{ display: "inline-block", width: "14px" }}>{expanded ? "▾" : "▸"}</span>}
          {entry.label}
        </td>
        <DataCells row={rowData[entry.code]} />
      </tr>
      {error && (
        <tr>
          <td colSpan={6} style={{ ...cellStyle("left"), color: "#b00020" }}>
            {error}
          </td>
        </tr>
      )}
      {expanded &&
        entry.children.map((child) => (
          <tr key={child.code}>
            <td style={cellStyle("left", { paddingLeft: "34px", color: "#555" })}>{child.label}</td>
            <DataCells row={rowData[child.code]} />
          </tr>
        ))}
    </>
  );
}

export default function AdsCountryBreakdown() {
  return (
    <CollapsibleSection title="Ads Status by Marketplace" defaultOpen={false}>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={{ ...cellStyle("left"), background: "#f4f4f4" }}>Marketplace</th>
              <th style={{ ...cellStyle("right"), background: "#f4f4f4" }}>Monthly Sales</th>
              <th style={{ ...cellStyle("right"), background: "#f4f4f4" }}>Monthly PPC Sales</th>
              <th style={{ ...cellStyle("right"), background: "#f4f4f4" }}>Monthly PPC Cost</th>
              <th style={{ ...cellStyle("right"), background: "#f4f4f4" }}>ACOS</th>
              <th style={{ ...cellStyle("right"), background: "#f4f4f4" }}>PPC Cost / Sales (TACoS)</th>
            </tr>
          </thead>
          <tbody>
            {TOP_LEVEL.map((entry) => (
              <MarketplaceRows key={entry.code} entry={entry} />
            ))}
          </tbody>
        </table>
      </div>
    </CollapsibleSection>
  );
}
