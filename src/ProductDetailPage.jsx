import { useEffect, useMemo, useState } from "react";
import { buildRecoTooltip, daysOfSupplyTooltip, formatDaysOfSupply } from "./recoTooltip";
import { Link, useSearchParams } from "react-router-dom";
import { MoveToGroupControl } from "./SalesPage";
import { buttonStyle } from "./buttonStyle";
import BsrCard from "./BsrCard";
import ProductCostCard from "./ProductCostCard";
import ProfitChart from "./ProfitChart";

// PocketBase-only functions run on the mini PC that already hosts
// PocketBase, instead of GCP - see CLAUDE.md "AmzBot: local job runner".
const API_BASE = "https://amzapi.mandalalifeart.com";

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

const blueButtonStyle = buttonStyle;

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

// needed/missing/EditableCell mirror NextOrderPage's ItemRow exactly, so this
// single row behaves identically (same edits hit the same UpdateNextOrderField
// endpoint) whether the user is on /update-next-order or here.
function computeNeeded(item) {
  return (item.uk_next_shipment || 0) + (item.de_next_shipment || 0) + (item.usa_next_shipment || 0);
}

function computeMissing(item) {
  return computeNeeded(item) - (item.malani_balance || 0) - (item.malani_order || 0);
}

const STOCK_ROW_STATUS_BORDER = {
  idle: "#bbb",
  saving: "#bbb",
  saved: "#2e7d32",
  error: "#b00020",
};

function StockRowEditableCell({ item, field, onSave }) {
  const [value, setValue] = useState(item[field] ?? 0);
  const [status, setStatus] = useState("idle");

  async function commit() {
    const numeric = Number(value);
    const nextValue = Number.isFinite(numeric) && numeric >= 0 ? numeric : 0;
    setValue(nextValue);
    if (nextValue === (item[field] ?? 0)) return;

    setStatus("saving");
    try {
      await onSave(item.sku, field, nextValue);
      setStatus("saved");
      setTimeout(() => setStatus((s) => (s === "saved" ? "idle" : s)), 1200);
    } catch {
      setStatus("error");
    }
  }

  return (
    <input
      type="number"
      min="0"
      className="no-spinner"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.target.blur();
      }}
      style={{
        width: "48px",
        padding: "3px 3px",
        textAlign: "right",
        borderRadius: "4px",
        fontSize: "15px",
        fontWeight: 600,
        colorScheme: "light",
        color: "#111",
        border: `1px solid ${STOCK_ROW_STATUS_BORDER[status]}`,
        background: status === "saving" ? "#fff8e1" : "#fff",
      }}
    />
  );
}

// Per the user (2026-09-22): one row per region (USA/DE/UK) instead of one
// wide row with every region's fields side by side, showing FBA + AWD
// (instead of just a combined "Bal") plus Reco (A/B) - the same fields and
// same Reco engine as the Next Order page's per-region column groups, just
// laid out as rows here since a single product only ever has 3 regions to
// show (vs. many SKUs needing columns on the list page). DE gets an extra
// LG column (the 3rd-party Lagerpark Meiningen UG warehouse balance) that
// USA/UK don't have, shown as "–" for those two rather than a 4th
// region-specific table shape.
const REGION_ROWS = [
  { region: "usa", label: "USA", fbaField: "usa_balance_fba", awdField: "usa_balance_awd", lgField: null, otwField: "usa_on_the_way", nextField: "usa_next_shipment" },
  { region: "de", label: "DE", fbaField: "de_balance_fba", awdField: "de_balance_awd", lgField: "de_balance_lg", otwField: "de_on_the_way", nextField: "de_next_shipment" },
  { region: "uk", label: "UK", fbaField: "uk_balance_fba", awdField: "uk_balance_awd", lgField: null, otwField: "uk_on_the_way", nextField: "uk_next_shipment" },
];

// Reco / Days-of-Supply hover text shared with the Next Order page
// (recoTooltip.js): in-stock-days rates, Reco = demand - Bal - OTW.
function recoTooltip(reco, region, bal, otw) {
  if (!reco) return "";
  return buildRecoTooltip(reco.debug, {
    bal, otw, region,
    recos: [reco.recommended, reco.recommendedSeasonal1yr, reco.recommendedSeasonal2yr],
    sources: [reco.seasonal1yrSource, reco.seasonal2yrSource],
  });
}

function StockCard({ stock, sku, recos, onSave }) {
  const item = { sku, ...stock };
  const needed = computeNeeded(item);
  const missing = computeMissing(item);

  return (
    <div style={cardStyle()}>
      <h3 style={{ marginTop: 0 }}>Stock Levels</h3>
      <div style={{ color: "#555", fontSize: "13px", marginBottom: "8px" }}>
        From sku_statistics — same row and editing as the Next Order page.
      </div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ borderCollapse: "collapse", width: "100%", minWidth: "640px", marginBottom: "16px" }}>
          <thead>
            <tr>
              {["Region", "FBA", "AWD", "LG", "OTW", "Next", "Reco (A/B/C)", "Days of Supply (A/B/C)"].map((label) => (
                <th key={label} style={numberCellStyle({ background: "#f4f4f4" })}>
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {REGION_ROWS.map((row) => {
              const reco = recos?.[row.region];
              const recommended = reco?.recommended ?? 0;
              const recommendedSeasonal1yr = reco?.recommendedSeasonal1yr ?? 0;
              const recommendedSeasonal2yr = reco?.recommendedSeasonal2yr ?? 0;
              const bal = item[`${row.region}_balance`] || 0;
              const otw = item[row.otwField] || 0;
              return (
                <tr key={row.region}>
                  <td style={tableCellStyle({ fontWeight: 700 })}>{row.label}</td>
                  <td style={numberCellStyle({ fontSize: "16px" })}>{formatUnits(item[row.fbaField])}</td>
                  <td style={numberCellStyle({ fontSize: "16px" })}>{formatUnits(item[row.awdField])}</td>
                  <td style={numberCellStyle({ fontSize: "16px" })}>
                    {row.lgField ? formatUnits(item[row.lgField]) : "–"}
                  </td>
                  <td style={numberCellStyle({ fontSize: "16px" })}>{formatUnits(item[row.otwField])}</td>
                  <td style={numberCellStyle()}>
                    <StockRowEditableCell item={item} field={row.nextField} onSave={onSave} />
                  </td>
                  <td
                    style={numberCellStyle({
                      fontSize: "16px",
                      fontWeight: 700,
                      color: recommended > 0 || recommendedSeasonal1yr > 0 || recommendedSeasonal2yr > 0 ? "#b00020" : undefined,
                    })}
                    title={recoTooltip(reco, row.region, bal, otw)}
                  >
                    {formatUnits(recommended)}/{formatUnits(recommendedSeasonal1yr)}/{formatUnits(recommendedSeasonal2yr)}
                  </td>
                  <td style={numberCellStyle({ fontSize: "13px" })} title={daysOfSupplyTooltip(reco?.debug, bal, otw)}>
                    {reco?.debug
                      ? `${formatDaysOfSupply(bal, otw, reco.debug.avgDailyRecent)}/` +
                        `${formatDaysOfSupply(bal, otw, reco.debug.avgDailySeasonal1yr)}/` +
                        `${formatDaysOfSupply(bal, otw, reco.debug.avgDailySeasonal2yr)}`
                      : "–"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <table style={{ borderCollapse: "collapse", width: "100%", minWidth: "500px" }}>
          <thead>
            <tr>
              {["Malani Bal", "Malani Ord", "Needed", "Missing", "Next Order"].map((label) => (
                <th key={label} style={numberCellStyle({ background: "#f4f4f4" })}>
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={numberCellStyle({ fontSize: "16px" })}>{formatUnits(item.malani_balance)}</td>
              <td style={numberCellStyle({ fontSize: "16px" })}>{formatUnits(item.malani_order)}</td>
              <td style={numberCellStyle({ fontSize: "16px", fontWeight: 700 })}>{formatUnits(needed)}</td>
              <td style={numberCellStyle({ fontSize: "16px", fontWeight: 700, color: missing > 0 ? "#b00020" : undefined })}>
                {formatUnits(missing)}
              </td>
              <td style={numberCellStyle()}>
                <StockRowEditableCell item={item} field="next_order" onSave={onSave} />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Toggles asin_group_mapping's end_of_life flag - per the user (2026-09-22),
// a discontinued product should be excluded from the Next Order page
// entirely. Applied server-side to every mapping row sharing this ASIN
// (SetEndOfLife.py), not just this one SKU spelling, so the button's state
// stays correct regardless of which of a product's spellings this page
// happened to resolve to.
function EndOfLifeButton({ sku, endOfLife, onChanged }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function toggle() {
    setSaving(true);
    setError("");
    try {
      const response = await fetch(`${API_BASE}/SetEndOfLife`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sku, endOfLife: !endOfLife }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || `HTTP ${response.status}`);
      onChanged();
    } catch (err) {
      setError(err.message || "Failed to update");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "4px", alignItems: "flex-start" }}>
      <button
        onClick={toggle}
        disabled={saving}
        style={{
          padding: "8px 14px",
          borderRadius: "6px",
          border: `1px solid ${endOfLife ? "#b00020" : "#ccc"}`,
          background: endOfLife ? "#b00020" : "#fff",
          color: endOfLife ? "#fff" : "#333",
          fontWeight: 600,
          cursor: saving ? "default" : "pointer",
          opacity: saving ? 0.6 : 1,
        }}
      >
        {endOfLife ? "✓ EndOfLife List (remove)" : "Add to EndOfLife List"}
      </button>
      {error && <span style={{ color: "#b00020", fontSize: "12px" }}>{error}</span>}
    </div>
  );
}

export default function ProductDetailPage() {
  const [searchParams] = useSearchParams();
  const asinFromUrl = searchParams.get("asin") || "";
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
        // per the user (2026-10-12): SKU alone is enough - the backend resolves the ASIN
        body: JSON.stringify({ sku: skuFromUrl, asin: asinFromUrl }),
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
    if (skuFromUrl || asinFromUrl) loadDetail();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skuFromUrl, asinFromUrl]);

  useEffect(() => {
    const root = document.getElementById("root");
    root?.classList.add("full-bleed");
    return () => root?.classList.remove("full-bleed");
  }, []);

  const displaySku = skuFromUrl || result?.mainSku;
  const asin = result?.asin || asinFromUrl;
  const years = useMemo(() => result?.years || [], [result]);

  async function saveStockField(sku, field, value) {
    const response = await fetch(`${API_BASE}/UpdateNextOrderField`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sku, field, value }),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data?.error || `HTTP ${response.status}`);
    }

    setResult((prev) => (prev ? { ...prev, stock: { ...prev.stock, [field]: value } } : prev));
  }

  return (
    <div style={{ padding: "10px", fontFamily: "Arial, sans-serif", minHeight: "100vh", background: "#fafafa" }}>
      <h2 style={{ textAlign: "center", marginBottom: "20px" }}>Product Detail</h2>

      <div style={{ maxWidth: "1100px", marginInline: "auto", display: "grid", gap: "18px" }}>
        {displaySku && (
          <div style={{ ...cardStyle(), display: "flex", gap: "16px", alignItems: "center", flexWrap: "wrap" }}>
            <img
              src={`${IMAGE_BASE}${encodeURIComponent(displaySku)}.jpg`}
              alt={displaySku}
              style={{ width: "70px", height: "70px", objectFit: "cover", borderRadius: "6px" }}
            />
            <div style={{ flex: "1 1 160px", minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: "18px", wordBreak: "break-word" }}>{displaySku}</div>
              <div style={{ fontFamily: "monospace", color: "#555" }}>{asin}</div>
              {result?.group && <div style={{ color: "#555", fontSize: "13px" }}>Group: {result.group}</div>}
            </div>
            {result?.allGroups?.length > 0 && (
              <MoveToGroupControl
                row={{ sku: displaySku, asin }}
                groupOptions={result.allGroups}
                onAssigned={loadDetail}
              />
            )}
            {displaySku && (
              <EndOfLifeButton sku={displaySku} endOfLife={!!result?.endOfLife} onChanged={loadDetail} />
            )}
          </div>
        )}

        {(error || (!skuFromUrl && !asinFromUrl)) && (
          <div style={{ color: "#b00020", background: "#fff1f1", border: "1px solid #f0caca", padding: "10px", borderRadius: "8px", textAlign: "center" }}>
            {error || "Missing sku parameter"}
          </div>
        )}

        {loading && <div style={{ textAlign: "center" }}>Loading...</div>}

        {!loading && result && (
          <>
            <StockCard stock={result.stock} sku={displaySku} recos={result.recos} onSave={saveStockField} />
            <ProductCostCard sku={displaySku} asin={asin} cardStyle={cardStyle()} />
            <ProfitChart sku={displaySku} asin={asin} cardStyle={cardStyle()} />
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
            <BsrCard sku={displaySku} asin={asin} cardStyle={cardStyle()} />
          </>
        )}

        <div style={{ display: "flex", justifyContent: "center", gap: "10px", paddingBottom: "16px" }}>
          <Link style={blueButtonStyle()} to="/fba-fees">
            FBA fees
          </Link>
          <Link style={blueButtonStyle()} to="/sales">
            Back to Sales
          </Link>
        </div>
      </div>
    </div>
  );
}
