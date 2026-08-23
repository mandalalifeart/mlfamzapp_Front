import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

const API_BASE =
  import.meta.env.VITE_API_BASE ||
  "https://us-central1-mlfamzapp.cloudfunctions.net";

const IMAGE_BASE = "https://storage.googleapis.com/mlf-amz-images/";
const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const GROWTH_GREEN = "#1b7a1b";
const GROWTH_RED = "#b00020";
const GROWTH_THRESHOLD_PCT = 10;

const MARKETPLACE_LABELS = { usa: "USA", eu: "EU", uk: "UK" };

function cardStyle() {
  return {
    background: "#fff",
    border: "1px solid #ddd",
    borderRadius: "8px",
    padding: "16px",
  };
}

function blueButtonStyle() {
  return {
    padding: "10px 18px",
    fontSize: "14px",
    cursor: "pointer",
    borderRadius: "8px",
    border: "none",
    background: "#1976d2",
    color: "#fff",
    fontWeight: "600",
    textDecoration: "none",
    display: "inline-block",
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
  return tableCellStyle({ textAlign: "right", whiteSpace: "nowrap", ...extra });
}

function formatUnits(value) {
  return Math.round(value || 0).toLocaleString();
}

function GrowthBadge({ pct }) {
  if (pct === null || pct === undefined) {
    return <span style={{ color: "#999" }}>–</span>;
  }
  const positive = pct >= 0;
  return (
    <span style={{ color: positive ? GROWTH_GREEN : GROWTH_RED, fontWeight: 700 }}>
      {positive ? "▲" : "▼"} {Math.abs(pct).toFixed(1)}%
    </span>
  );
}

function yoyColor(current, previous) {
  if (!previous) return undefined;
  const diffPct = ((current - previous) / previous) * 100;
  if (diffPct > GROWTH_THRESHOLD_PCT) return GROWTH_GREEN;
  if (diffPct < -GROWTH_THRESHOLD_PCT) return GROWTH_RED;
  return undefined;
}

function monthColor({ isCurrentYear, curMonths, prevMonths, monthIndex, currentMonth }) {
  if (!prevMonths) return undefined;
  if (isCurrentYear) {
    const completedMonths = Math.max((currentMonth || 0) - 1, 0);
    if (monthIndex >= completedMonths) return undefined;
  }
  return yoyColor(curMonths[monthIndex] || 0, prevMonths[monthIndex] || 0);
}

// One 4-row (this year .. 3 years ago) Period/Total/Jan-Dec table for a
// single marketplace - same shape as the Sales page's per-item rows.
function MarketplaceTable({ label, years, yearRows, growthPct, currentMonth }) {
  return (
    <div style={cardStyle()}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h3 style={{ margin: 0 }}>{label}</h3>
        <GrowthBadge pct={growthPct} />
      </div>
      <div style={{ overflowX: "auto", marginTop: "12px" }}>
        <table style={{ borderCollapse: "collapse", width: "100%", minWidth: "760px" }}>
          <thead>
            <tr>
              <th style={tableCellStyle({ background: "#f4f4f4" })}>Period</th>
              <th style={numberCellStyle({ background: "#f4f4f4" })}>Total</th>
              {MONTH_LABELS.map((m) => (
                <th key={m} style={numberCellStyle({ background: "#f4f4f4" })}>
                  {m}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {years.map((year, i) => {
              const row = yearRows.find((y) => y.year === year) || { year, months: Array(12).fill(0), total: 0 };
              const prevRow = i + 1 < years.length ? yearRows.find((y) => y.year === years[i + 1]) : null;
              const isCurrentYear = i === 0;
              return (
                <tr key={year}>
                  <td style={tableCellStyle({ fontWeight: isCurrentYear ? 700 : undefined })}>{year}</td>
                  <td style={numberCellStyle({ fontWeight: 700 })}>{formatUnits(row.total)}</td>
                  {MONTH_LABELS.map((_, m) => (
                    <td
                      key={m}
                      style={numberCellStyle({
                        fontWeight: isCurrentYear ? 700 : undefined,
                        color: monthColor({ isCurrentYear, curMonths: row.months, prevMonths: prevRow?.months, monthIndex: m, currentMonth }),
                      })}
                    >
                      {formatUnits(row.months[m] || 0)}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StockCard({ stock }) {
  const rows = [
    { label: "USA", value: stock?.usa_balance },
    { label: "DE", value: stock?.de_balance },
    { label: "UK", value: stock?.uk_balance },
  ];
  return (
    <div style={cardStyle()}>
      <h3 style={{ marginTop: 0 }}>Stock Levels</h3>
      <div style={{ color: "#555", fontSize: "13px", marginBottom: "8px" }}>
        From sku_statistics. Tracked per-country (USA/DE/UK), not the combined EU sales bucket above.
      </div>
      <div style={{ display: "flex", gap: "24px", flexWrap: "wrap" }}>
        {rows.map((r) => (
          <div key={r.label} style={{ textAlign: "center" }}>
            <div style={{ fontSize: "13px", color: "#555" }}>{r.label}</div>
            <div style={{ fontSize: "24px", fontWeight: 700 }}>{formatUnits(r.value)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ProductDetailPage() {
  const [searchParams] = useSearchParams();
  const asin = searchParams.get("asin") || "";
  const skuFromUrl = searchParams.get("sku") || "";

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  async function loadDetail() {
    setLoading(true);
    setError("");

    try {
      const response = await fetch(`${API_BASE}/GetProductDetail`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ asin }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || `HTTP ${response.status}`);
      setResult(data);
    } catch (err) {
      setError(err.message || "Failed to load product detail");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (asin) loadDetail();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [asin]);

  useEffect(() => {
    const root = document.getElementById("root");
    root?.classList.add("full-bleed");
    return () => root?.classList.remove("full-bleed");
  }, []);

  const displaySku = result?.mainSku || skuFromUrl;
  const years = useMemo(() => result?.years || [], [result]);

  return (
    <div style={{ padding: "10px", fontFamily: "Arial, sans-serif", minHeight: "100vh", background: "#fafafa" }}>
      <h2 style={{ textAlign: "center", marginBottom: "20px" }}>Product Detail</h2>

      <div style={{ maxWidth: "1100px", marginInline: "auto", display: "grid", gap: "18px" }}>
        {displaySku && (
          <div style={{ ...cardStyle(), display: "flex", gap: "16px", alignItems: "center" }}>
            <img
              src={`${IMAGE_BASE}${encodeURIComponent(displaySku)}.jpg`}
              alt={displaySku}
              style={{ width: "70px", height: "70px", objectFit: "cover", borderRadius: "6px" }}
            />
            <div>
              <div style={{ fontWeight: 700, fontSize: "18px" }}>{displaySku}</div>
              <div style={{ fontFamily: "monospace", color: "#555" }}>{asin}</div>
              {result?.group && <div style={{ color: "#555", fontSize: "13px" }}>Group: {result.group}</div>}
            </div>
          </div>
        )}

        {(error || !asin) && (
          <div style={{ color: "#b00020", background: "#fff1f1", border: "1px solid #f0caca", padding: "10px", borderRadius: "8px", textAlign: "center" }}>
            {error || "Missing asin parameter"}
          </div>
        )}

        {loading && <div style={{ textAlign: "center" }}>Loading...</div>}

        {!loading && result && (
          <>
            <StockCard stock={result.stock} />
            {Object.entries(MARKETPLACE_LABELS).map(([code, label]) => (
              <MarketplaceTable
                key={code}
                label={label}
                years={years}
                yearRows={result.marketplaces?.[code]?.yearRows || []}
                growthPct={result.marketplaces?.[code]?.growthPct}
                currentMonth={result.currentMonth}
              />
            ))}
          </>
        )}

        <div style={{ display: "flex", justifyContent: "center", gap: "10px", paddingBottom: "16px" }}>
          <Link style={blueButtonStyle()} to="/sales">
            Back to Sales
          </Link>
        </div>
      </div>
    </div>
  );
}
