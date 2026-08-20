import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

const API_BASE =
  import.meta.env.VITE_API_BASE ||
  "https://us-central1-mlfamzapp.cloudfunctions.net";

const IMAGE_BASE = "https://storage.googleapis.com/mlf-amz-images/";

const MARKETPLACE_OPTIONS = [
  { value: "usa", label: "USA" },
  { value: "eu", label: "EU" },
  { value: "uk", label: "UK" },
  { value: "de", label: "DE" },
  { value: "fr", label: "FR" },
  { value: "es", label: "ES" },
  { value: "it", label: "IT" },
  { value: "se", label: "SE" },
  { value: "nl", label: "NL" },
  { value: "be", label: "BE" },
  { value: "ie", label: "IE" },
  { value: "pl", label: "PL" },
  { value: "jp", label: "JP" },
  { value: "au", label: "AU" },
];

const ALL_MARKETPLACE_VALUES = MARKETPLACE_OPTIONS.map((o) => o.value);
const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function cardStyle() {
  return {
    background: "#fff",
    border: "1px solid #ddd",
    borderRadius: "8px",
    padding: "16px",
  };
}

function blueButtonStyle(disabled = false) {
  return {
    padding: "10px 18px",
    fontSize: "14px",
    cursor: disabled ? "not-allowed" : "pointer",
    borderRadius: "8px",
    border: "none",
    background: disabled ? "#9bbcf7" : "#1976d2",
    color: "#ffffff",
    fontWeight: "600",
    opacity: disabled ? 0.6 : 1,
  };
}

function ghostButtonStyle() {
  return {
    padding: "8px 14px",
    fontSize: "13px",
    cursor: "pointer",
    borderRadius: "8px",
    border: "1px solid #1976d2",
    background: "#fff",
    color: "#1976d2",
    fontWeight: "600",
  };
}

function tableCellStyle(extra = {}) {
  return {
    border: "1px solid #ccc",
    padding: "6px 8px",
    textAlign: "left",
    ...extra,
  };
}

function numberCellStyle(extra = {}) {
  return tableCellStyle({
    textAlign: "right",
    whiteSpace: "nowrap",
    ...extra,
  });
}

function bottomNavStyle() {
  return {
    display: "flex",
    justifyContent: "center",
    gap: "10px",
    marginTop: "28px",
    paddingBottom: "16px",
    flexWrap: "wrap",
  };
}

function GrowthBadge({ pct }) {
  if (pct === null || pct === undefined) {
    return <span style={{ color: "#999" }}>–</span>;
  }
  const positive = pct >= 0;
  return (
    <span style={{ color: positive ? "#1b7a1b" : "#b00020", fontWeight: 700, whiteSpace: "nowrap" }}>
      {positive ? "▲" : "▼"} {Math.abs(pct).toFixed(1)}%
    </span>
  );
}

function ProductRows({ item, showAsin, years }) {
  const rowCount = years.length;

  return years.map((year, yIndex) => {
    const yearRow = item.years.find((y) => y.year === year) || { months: Array(12).fill(0), total: 0 };
    const isFirst = yIndex === 0;

    return (
      <tr key={`${item.asin}-${year}`} style={isFirst ? { fontWeight: 700 } : undefined}>
        {isFirst && (
          <td rowSpan={rowCount} style={tableCellStyle({ verticalAlign: "top", width: "70px" })}>
            <img
              src={`${IMAGE_BASE}${encodeURIComponent(item.mainSku)}.jpg`}
              alt={item.mainSku}
              style={{ width: "60px", height: "60px", objectFit: "cover", borderRadius: "6px" }}
            />
          </td>
        )}

        {isFirst && (
          <td rowSpan={rowCount} style={tableCellStyle({ verticalAlign: "top", fontWeight: 600 })}>
            {item.mainSku}
            <div style={{ marginTop: "6px" }}>
              <GrowthBadge pct={item.growthPct} />
            </div>
          </td>
        )}

        {showAsin && isFirst && (
          <td rowSpan={rowCount} style={tableCellStyle({ verticalAlign: "top", fontFamily: "monospace" })}>
            {item.asin}
          </td>
        )}

        <td style={tableCellStyle({ color: isFirst ? "#000" : "#555" })}>{year}</td>

        {MONTH_LABELS.map((_, i) => (
          <td key={i} style={numberCellStyle({ minWidth: "48px" })}>
            {yearRow.months[i] || 0}
          </td>
        ))}

        <td style={numberCellStyle({ fontWeight: 700 })}>{yearRow.total}</td>
      </tr>
    );
  });
}

function GroupSection({ group, years, showAsin, expanded, onToggle }) {
  return (
    <div style={cardStyle()}>
      <div
        onClick={onToggle}
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          cursor: "pointer",
        }}
      >
        <h3 style={{ margin: 0 }}>
          {expanded ? "▾" : "▸"} {group.group}
        </h3>
        <div style={{ color: "#555", fontSize: "13px" }}>
          {group.items.length} product{group.items.length === 1 ? "" : "s"} · {group.totalThisYear} units this year
        </div>
      </div>

      {expanded && (
        <div style={{ overflowX: "auto", marginTop: "12px" }}>
          <table style={{ borderCollapse: "collapse", width: "100%", minWidth: "1100px" }}>
            <thead>
              <tr>
                <th style={tableCellStyle({ background: "#f4f4f4" })}>Image</th>
                <th style={tableCellStyle({ background: "#f4f4f4" })}>Main SKU</th>
                {showAsin && <th style={tableCellStyle({ background: "#f4f4f4" })}>ASIN</th>}
                <th style={tableCellStyle({ background: "#f4f4f4" })}>Period</th>
                {MONTH_LABELS.map((m) => (
                  <th key={m} style={numberCellStyle({ background: "#f4f4f4" })}>
                    {m}
                  </th>
                ))}
                <th style={numberCellStyle({ background: "#f4f4f4" })}>Total</th>
              </tr>
            </thead>
            <tbody>
              {group.items.map((item) => (
                <ProductRows key={item.asin} item={item} showAsin={showAsin} years={years} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function SalesPage() {
  const navigate = useNavigate();

  const [selectedMarketplaces, setSelectedMarketplaces] = useState(ALL_MARKETPLACE_VALUES);
  const [showAsin, setShowAsin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [collapsedGroups, setCollapsedGroups] = useState({});

  async function loadReport(marketplaces) {
    setLoading(true);
    setError("");

    try {
      const response = await fetch(`${API_BASE}/GetSalesDepartmentReport`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ marketplaces }),
      });

      const text = await response.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        data = { raw: text };
      }

      if (!response.ok) {
        throw new Error(data?.error || `HTTP ${response.status}`);
      }

      setResult(data);
    } catch (err) {
      setError(err.message || "Failed to load sales report");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadReport(ALL_MARKETPLACE_VALUES);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggleMarketplace(value) {
    setSelectedMarketplaces((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]
    );
  }

  function toggleGroup(name) {
    setCollapsedGroups((prev) => ({ ...prev, [name]: !prev[name] }));
  }

  function expandAll() {
    setCollapsedGroups({});
  }

  function collapseAll() {
    if (!result?.groups) return;
    const next = {};
    result.groups.forEach((g) => {
      next[g.group] = true;
    });
    setCollapsedGroups(next);
  }

  const years = useMemo(() => result?.years || [], [result]);

  useEffect(() => {
    const root = document.getElementById("root");
    root?.classList.add("full-bleed");
    return () => root?.classList.remove("full-bleed");
  }, []);

  return (
    <div
      style={{
        padding: "10px",
        fontFamily: "Arial, sans-serif",
        minHeight: "100vh",
        background: "#fafafa",
      }}
    >
      <h2 style={{ textAlign: "center", marginBottom: "20px" }}>Sales by Product Group</h2>

      <div
        style={{
          ...cardStyle(),
          marginBottom: "20px",
        }}
      >
        <h3 style={{ marginTop: 0 }}>Marketplaces</h3>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", marginBottom: "12px" }}>
          {MARKETPLACE_OPTIONS.map((option) => (
            <label
              key={option.value}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                border: "1px solid #ddd",
                borderRadius: "6px",
                padding: "6px 10px",
                cursor: "pointer",
                background: selectedMarketplaces.includes(option.value) ? "#eaf2ff" : "#fff",
              }}
            >
              <input
                type="checkbox"
                checked={selectedMarketplaces.includes(option.value)}
                onChange={() => toggleMarketplace(option.value)}
              />
              {option.label}
            </label>
          ))}
        </div>

        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center" }}>
          <button style={ghostButtonStyle()} onClick={() => setSelectedMarketplaces(ALL_MARKETPLACE_VALUES)}>
            Select All
          </button>
          <button style={ghostButtonStyle()} onClick={() => setSelectedMarketplaces([])}>
            Clear
          </button>
          <button
            style={blueButtonStyle(loading || selectedMarketplaces.length === 0)}
            onClick={() => loadReport(selectedMarketplaces)}
            disabled={loading || selectedMarketplaces.length === 0}
          >
            {loading ? "Loading..." : "Apply / Reload"}
          </button>

          <label style={{ display: "flex", alignItems: "center", gap: "6px", marginLeft: "auto" }}>
            <input type="checkbox" checked={showAsin} onChange={() => setShowAsin((v) => !v)} />
            Show ASIN column
          </label>
        </div>
      </div>

      {error && (
        <div
          style={{
            maxWidth: "1400px",
            marginInline: "auto",
            marginBottom: "20px",
            color: "#b00020",
            background: "#fff1f1",
            border: "1px solid #f0caca",
            padding: "10px",
            borderRadius: "8px",
            textAlign: "center",
          }}
        >
          {error}
        </div>
      )}

      {loading && (
        <div style={{ marginBottom: "20px", textAlign: "center" }}>
          Loading sales report...
        </div>
      )}

      {!loading && result && (
        <div style={{ display: "grid", gap: "18px" }}>
          <div style={{ display: "flex", gap: "10px" }}>
            <button style={ghostButtonStyle()} onClick={expandAll}>
              Expand All Groups
            </button>
            <button style={ghostButtonStyle()} onClick={collapseAll}>
              Collapse All Groups
            </button>
          </div>

          {(result.groups || []).map((group) => (
            <GroupSection
              key={group.group}
              group={group}
              years={years}
              showAsin={showAsin}
              expanded={!collapsedGroups[group.group]}
              onToggle={() => toggleGroup(group.group)}
            />
          ))}

          {Array.isArray(result.unmapped) && result.unmapped.length > 0 && (
            <div style={cardStyle()}>
              <h3 style={{ marginTop: 0 }}>Unmapped SKUs</h3>
              <div style={{ color: "#555", fontSize: "13px", marginBottom: "8px" }}>
                Sales rows whose SKU isn't in asin_group_mapping.csv (not counted in any group above).
              </div>
              <div style={{ overflowX: "auto" }}>
                <table style={{ borderCollapse: "collapse", width: "100%" }}>
                  <thead>
                    <tr>
                      <th style={tableCellStyle({ background: "#f4f4f4" })}>SKU</th>
                      <th style={numberCellStyle({ background: "#f4f4f4" })}>Total Quantity</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.unmapped.map((row) => (
                      <tr key={row.sku}>
                        <td style={tableCellStyle()}>{row.sku}</td>
                        <td style={numberCellStyle()}>{row.totalQuantity}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      <div style={bottomNavStyle()}>
        <button style={blueButtonStyle()} onClick={() => navigate("/")}>
          Home
        </button>
        <button style={blueButtonStyle()} onClick={() => navigate("/update")}>
          Update
        </button>
      </div>
    </div>
  );
}
