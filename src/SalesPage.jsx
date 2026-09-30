import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { buttonStyle, ghostButtonStyle } from "./buttonStyle";
import AdsCountryBreakdown from "./AdsCountryBreakdown";

// PocketBase-only functions run on the mini PC that already hosts
// PocketBase, instead of GCP - see CLAUDE.md "AmzBot: local job runner".
const LOCAL_API_BASE = "https://amzapi.mandalalifeart.com";

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

// "All marketplaces" stays Amazon-only - Etsy is a distinctly different
// sales channel, not folded into that combined total (deliberate choice:
// blending them would silently change what "All marketplaces" has always
// meant). Etsy is only ever visible by selecting one of its options below.
const ALL_MARKETPLACE_VALUES = MARKETPLACE_OPTIONS.map((o) => o.value);

const ETSY_MARKETPLACE_OPTIONS = [
  { value: "etsy_usa", label: "Etsy USA" },
  { value: "etsy_eu", label: "Etsy EU" },
  { value: "etsy_uk", label: "Etsy UK" },
];
const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const MAIN_SKU_WIDTH = "144px";
// Narrowed + smaller font per the user (2026-09-24) - was unset/full-width.
const ASIN_WIDTH = "78px";
const GROWTH_GREEN = "#1b7a1b";
const GROWTH_RED = "#b00020";
const GROWTH_THRESHOLD_PCT = 10;

const CHART_MUTED = "#898781";
const CHART_GRIDLINE = "#e1e0d9";
const CHART_BASELINE = "#c3c2b7";
const CHART_INK = "#0b0b0b";

// Backend shows a single marketplace (or several sharing a currency) in its
// own native currency, and only converts to USD (live rate) when the
// selection genuinely mixes currencies (e.g. "All marketplaces").
const CURRENCY_SYMBOLS = {
  USD: "$",
  EUR: "€",
  GBP: "£",
  JPY: "¥",
  AUD: "A$",
  SEK: "kr",
  PLN: "zł",
};
const SUFFIX_CURRENCIES = new Set(["SEK", "PLN"]);

function formatMoney(value, currency = "USD") {
  const symbol = CURRENCY_SYMBOLS[currency] || `${currency} `;
  const amount = Math.round(value).toLocaleString();
  return SUFFIX_CURRENCIES.has(currency) ? `${amount} ${symbol}` : `${symbol}${amount}`;
}

function formatUnits(value) {
  return Math.round(value).toLocaleString();
}

function cardStyle() {
  return {
    background: "#fff",
    border: "1px solid #ddd",
    borderRadius: "8px",
    padding: "16px",
  };
}

const blueButtonStyle = buttonStyle;

function selectorStyle() {
  return {
    padding: "8px 12px",
    fontSize: "14px",
    borderRadius: "8px",
    minWidth: "220px",
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
    <span style={{ color: positive ? GROWTH_GREEN : GROWTH_RED, fontWeight: 700, whiteSpace: "nowrap" }}>
      {positive ? "▲" : "▼"} {Math.abs(pct).toFixed(1)}%
    </span>
  );
}

// Colors a number green/red only when it swings more than GROWTH_THRESHOLD_PCT
// against the same period a year earlier - a flat/small move stays neutral.
function yoyColor(current, previous) {
  if (!previous) return undefined;
  const diffPct = ((current - previous) / previous) * 100;
  if (diffPct > GROWTH_THRESHOLD_PCT) return GROWTH_GREEN;
  if (diffPct < -GROWTH_THRESHOLD_PCT) return GROWTH_RED;
  return undefined;
}

function yoyColorFromPct(pct) {
  if (pct === null || pct === undefined) return undefined;
  if (pct > GROWTH_THRESHOLD_PCT) return GROWTH_GREEN;
  if (pct < -GROWTH_THRESHOLD_PCT) return GROWTH_RED;
  return undefined;
}

function monthColor({ isCurrentYear, curMonths, prevMonths, monthIndex, currentMonth }) {
  if (!prevMonths) return undefined;
  if (isCurrentYear) {
    // The current month (and any month after it) has no complete data yet,
    // so it can't be fairly compared to the same month last year.
    const completedMonths = Math.max((currentMonth || 0) - 1, 0);
    if (monthIndex >= completedMonths) return undefined;
  }
  return yoyColor(curMonths[monthIndex] || 0, prevMonths[monthIndex] || 0);
}

function totalColor({ isCurrentYear, growthPct, curTotal, prevRow }) {
  if (isCurrentYear) return yoyColorFromPct(growthPct);
  if (!prevRow) return undefined;
  return yoyColor(curTotal, prevRow.total);
}

// Shared column layout so the group-summary row and the per-SKU rows line up
// under the exact same header, in the exact same order.
function TableHeader({ showAsin }) {
  return (
    <thead>
      <tr>
        <th style={tableCellStyle({ background: "#f4f4f4" })}>Image</th>
        <th style={tableCellStyle({ background: "#f4f4f4", width: MAIN_SKU_WIDTH })}>Main SKU</th>
        {showAsin && (
          <th style={tableCellStyle({ background: "#f4f4f4", width: ASIN_WIDTH, fontSize: "11px" })}>ASIN</th>
        )}
        <th style={tableCellStyle({ background: "#f4f4f4" })}>Period</th>
        <th style={numberCellStyle({ background: "#f4f4f4" })}>Total</th>
        {MONTH_LABELS.map((m) => (
          <th key={m} style={numberCellStyle({ background: "#f4f4f4" })}>
            {m}
          </th>
        ))}
      </tr>
    </thead>
  );
}

// Renders one row per year (Period, Total, Jan..Dec), coloring/bolding as needed.
// `renderLeading` supplies the row-spanning leading cells (image/SKU/ASIN).
// returnsYearRows is optional ({year, months, total} per year, unit counts,
// no currency formatting) - when present, each cell shows the sales value
// with a small "↩ N" line underneath, gated by SalesPage's "Show Returns"
// checkbox (2026-09-10, per the user).
function YearRows({ rowKeyPrefix, years, yearRows, currentMonth, growthPct, renderLeading, formatValue = (v) => v, returnsYearRows }) {
  const rowCount = years.length;

  const returnsFor = (year) => returnsYearRows?.find((y) => y.year === year);

  return years.map((year, i) => {
    const row = yearRows.find((y) => y.year === year) || { year, months: Array(12).fill(0), total: 0 };
    const prevRow = i + 1 < years.length ? yearRows.find((y) => y.year === years[i + 1]) : null;
    const isCurrentYear = i === 0;
    const returnsRow = returnsFor(year);

    return (
      <tr key={`${rowKeyPrefix}-${year}`}>
        {i === 0 && renderLeading && renderLeading(rowCount)}

        <td style={tableCellStyle({ color: isCurrentYear ? "#000" : "#555", fontWeight: isCurrentYear ? 700 : undefined })}>
          {year}
        </td>

        <td
          style={numberCellStyle({
            fontWeight: 700,
            color: totalColor({ isCurrentYear, growthPct, curTotal: row.total, prevRow }),
          })}
        >
          {formatValue(row.total)}
          {returnsRow && (
            <div style={{ fontWeight: 400, fontSize: "11px", color: "#b00020" }}>↩ {returnsRow.total}</div>
          )}
        </td>

        {MONTH_LABELS.map((_, m) => (
          <td
            key={m}
            style={numberCellStyle({
              minWidth: "48px",
              fontWeight: isCurrentYear ? 700 : undefined,
              color: monthColor({
                isCurrentYear,
                curMonths: row.months,
                prevMonths: prevRow?.months,
                monthIndex: m,
                currentMonth,
              }),
            })}
          >
            {formatValue(row.months[m] || 0)}
            {returnsRow && (
              <div style={{ fontWeight: 400, fontSize: "11px", color: "#b00020" }}>↩ {returnsRow.months[m] || 0}</div>
            )}
          </td>
        ))}
      </tr>
    );
  });
}

// Sums a set of items' per-ASIN return yearRows (see returnsByAsin) into one
// group-level {year, months, total}[] - lets the group's own summary row
// show total returns for all its products combined, without the backend
// needing to know anything about asin_group_mapping's groups.
function sumReturnsForItems(years, items, returnsByAsin) {
  if (!returnsByAsin) return undefined;
  return years.map((year) => {
    const months = Array(12).fill(0);
    for (const item of items) {
      const itemRow = returnsByAsin[item.asin]?.find((y) => y.year === year);
      if (!itemRow) continue;
      itemRow.months.forEach((v, i) => { months[i] += v; });
    }
    return { year, months, total: months.reduce((a, b) => a + b, 0) };
  });
}

// Blue = fallback (no 1-year-ago history for a pareo SKU yet, so this is
// really the recent-rate number, not the true seasonal one) - reuses the
// same blue already used for "this year" in the trend chart's YEAR_RAMP,
// rather than picking a new color.
const DAYS_OF_SUPPLY_FALLBACK_COLOR = "#2a78d6";
const DAYS_OF_SUPPLY_REGIONS = ["usa", "de", "uk"];

function daysOfSupplyLabel(days) {
  return days === null || days === undefined ? "∞" : days.toLocaleString();
}

// Per the user (2026-09-24): pouf (and everything else) uses the "recent"
// rate, pareo uses the "same season 1 year ago" rate (falls back to recent,
// shown in blue, if that SKU has no history from 1 year ago yet) - computed
// server-side in GetDaysOfSupplyBySku using the exact same Reco engine as
// the Next Order/product pages. When "All marketplaces" is selected, shows
// all 3 stock-tracked regions (USA/DE/UK) stacked (see memory
// table-multi-value-cell-preference); a single non-stock-tracked
// marketplace (FR/IT/ES/etc.) has no Bal/OTW to compute from, so it shows
// nothing. Originally its own column - moved inline under the Main SKU/
// growth-badge (2026-09-24, per the user) rather than a separate column.
function DaysOfSupplyInline({ sku, selectedMarketplace, daysOfSupplyBySku }) {
  const data = daysOfSupplyBySku?.[sku];
  if (!data) return null;
  if (selectedMarketplace && !DAYS_OF_SUPPLY_REGIONS.includes(selectedMarketplace)) return null;

  const regions = selectedMarketplace ? [selectedMarketplace] : DAYS_OF_SUPPLY_REGIONS;

  return (
    <div style={{ marginTop: "4px", fontSize: "11px", lineHeight: 1.5 }}>
      {regions.map((region) => {
        const r = data[region];
        return (
          <div key={region} style={{ color: r?.isFallback ? DAYS_OF_SUPPLY_FALLBACK_COLOR : "#555", fontWeight: 600 }}>
            {selectedMarketplace ? "" : `${region.toUpperCase()}: `}
            {daysOfSupplyLabel(r?.days)} days
          </div>
        );
      })}
    </div>
  );
}

function ItemRows({ item, showAsin, years, currentMonth, returnsByAsin, selectedMarketplace, daysOfSupplyBySku }) {
  return (
    <YearRows
      rowKeyPrefix={item.asin}
      years={years}
      yearRows={item.years}
      currentMonth={currentMonth}
      growthPct={item.growthPct}
      returnsYearRows={returnsByAsin?.[item.asin]}
      renderLeading={(rowCount) => (
        <>
          <td rowSpan={rowCount} style={tableCellStyle({ verticalAlign: "top", width: "70px" })}>
            <Link to={`/product?asin=${encodeURIComponent(item.asin)}&sku=${encodeURIComponent(item.mainSku)}`} target="_blank" rel="noopener noreferrer">
              <img
                src={`${IMAGE_BASE}${encodeURIComponent(item.mainSku)}.jpg`}
                alt={item.mainSku}
                style={{ width: "60px", height: "60px", objectFit: "cover", borderRadius: "6px" }}
              />
            </Link>
          </td>

          <td rowSpan={rowCount} style={tableCellStyle({ verticalAlign: "top", fontWeight: 600, width: MAIN_SKU_WIDTH })}>
            <Link
              to={`/product?asin=${encodeURIComponent(item.asin)}&sku=${encodeURIComponent(item.mainSku)}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: "inherit", textDecoration: "none" }}
            >
              {item.mainSku}
            </Link>
            <div style={{ marginTop: "6px" }}>
              <GrowthBadge pct={item.growthPct} />
            </div>
            <DaysOfSupplyInline sku={item.mainSku} selectedMarketplace={selectedMarketplace} daysOfSupplyBySku={daysOfSupplyBySku} />
          </td>

          {showAsin && (
            <td rowSpan={rowCount} style={tableCellStyle({ verticalAlign: "top", fontFamily: "monospace", fontSize: "11px", width: ASIN_WIDTH, wordBreak: "break-all" })}>
              {item.asin}
            </td>
          )}
        </>
      )}
    />
  );
}

export function MoveToGroupControl({ row, groupOptions, onAssigned }) {
  const [selected, setSelected] = useState(groupOptions[0] || "");
  const [status, setStatus] = useState("idle"); // idle | saving | error
  const [errorMsg, setErrorMsg] = useState("");

  async function handleMove() {
    if (!selected) return;
    setStatus("saving");
    setErrorMsg("");

    try {
      const response = await fetch(`${LOCAL_API_BASE}/AssignSkuGroup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sku: row.sku, asin: row.asin, group: selected }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || `HTTP ${response.status}`);
      }
      await onAssigned();
    } catch (err) {
      setStatus("error");
      setErrorMsg(err.message || "Failed to assign group");
      return;
    }
    setStatus("idle");
  }

  return (
    <div style={{ display: "flex", gap: "6px", alignItems: "center", justifyContent: "flex-end", flexWrap: "wrap" }}>
      <select
        value={selected}
        onChange={(e) => setSelected(e.target.value)}
        disabled={status === "saving"}
        style={{ padding: "4px 6px", borderRadius: "6px", fontSize: "13px" }}
      >
        {groupOptions.map((g) => (
          <option key={g} value={g}>
            {g}
          </option>
        ))}
      </select>
      <button
        style={{
          ...ghostButtonStyle(),
          padding: "4px 10px",
          fontSize: "13px",
          cursor: status === "saving" ? "not-allowed" : "pointer",
          opacity: status === "saving" ? 0.6 : 1,
        }}
        onClick={handleMove}
        disabled={status === "saving"}
      >
        {status === "saving" ? "Moving..." : "Move to Group"}
      </button>
      {status === "error" && <span style={{ color: GROWTH_RED, fontSize: "12px" }}>{errorMsg}</span>}
    </div>
  );
}

function GroupSection({ group, years, currentMonth, showAsin, expanded, onToggle, returnsByAsin, selectedMarketplace, daysOfSupplyBySku }) {
  const groupReturnsYearRows = useMemo(
    () => sumReturnsForItems(years, group.items, returnsByAsin),
    [years, group.items, returnsByAsin]
  );
  return (
    <div style={cardStyle()}>
      <div
        onClick={onToggle}
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "6px",
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

      <div style={{ overflowX: "auto", marginTop: "12px" }}>
        <table style={{ borderCollapse: "collapse", width: "100%", minWidth: "1100px" }}>
          <TableHeader showAsin={showAsin} />
          <tbody>
            <YearRows
              rowKeyPrefix={`${group.group}-summary`}
              years={years}
              yearRows={group.yearRows}
              currentMonth={currentMonth}
              growthPct={group.growthPct}
              returnsYearRows={groupReturnsYearRows}
              renderLeading={(rowCount) => (
                <>
                  <td rowSpan={rowCount} style={tableCellStyle({ width: "70px" })} />
                  <td rowSpan={rowCount} style={tableCellStyle({ verticalAlign: "top", fontWeight: 700, width: MAIN_SKU_WIDTH })}>
                    Group Total
                    <div style={{ marginTop: "6px" }}>
                      <GrowthBadge pct={group.growthPct} />
                    </div>
                  </td>
                  {showAsin && <td rowSpan={rowCount} style={tableCellStyle({ width: ASIN_WIDTH })} />}
                </>
              )}
            />
          </tbody>
        </table>
      </div>

      {expanded && (
        <div style={{ overflowX: "auto", marginTop: "12px" }}>
          <table style={{ borderCollapse: "collapse", width: "100%", minWidth: "1100px" }}>
            <TableHeader showAsin={showAsin} />
            <tbody>
              {group.items.map((item) => (
                <ItemRows
                  key={item.asin}
                  item={item}
                  showAsin={showAsin}
                  years={years}
                  currentMonth={currentMonth}
                  returnsByAsin={returnsByAsin}
                  selectedMarketplace={selectedMarketplace}
                  daysOfSupplyBySku={daysOfSupplyBySku}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// Product families (2026-09-30, per the user): Pareo and Pouf Covers groups
// each live in their own collapsible section (collapsed by default), and
// get their own separate Best/Worst Sellers ranking. Matched on the
// asin_group_mapping group name prefix, so a new PAREO_*/COVER_* group joins
// its family automatically. "Home Decor" (named by the user) = pouf covers
// plus VELVET (velvet pouf covers + stools) and STUFFED (stuffed poufs).
const FAMILIES = [
  { key: "pareo", label: "Pareo", match: (name) => /^pareo/i.test(name) },
  { key: "pouf", label: "Home Decor", match: (name) => /^(cover_|velvet|stuffed)/i.test(name) },
];

function familyOf(groupName) {
  return FAMILIES.find((f) => f.match(groupName || ""))?.key || null;
}

const RANKING_TOP_N = 20;
const RANKING_PERIODS = [
  { key: "last12", label: "Last 12 full months" },
  { key: "last3", label: "Last 3 full months" },
  { key: "ytd", label: "This year (incl. current month)" },
];

// Units for one item over the chosen ranking period. "Full months" never
// include the current in-progress month, so a ranking doesn't shift just
// because it's early in the month; they reach back into last year's row
// when needed (e.g. last 12 months in March = Mar-Dec last year + Jan-Feb).
function unitsInPeriod(item, period, years, currentMonth) {
  const thisYear = item.years.find((y) => y.year === years[0])?.months || [];
  if (period === "ytd") {
    return thisYear.slice(0, currentMonth).reduce((a, b) => a + (b || 0), 0);
  }
  const lastYear = item.years.find((y) => y.year === years[1])?.months || [];
  const completed = [...lastYear.slice(0, 12), ...thisYear.slice(0, Math.max((currentMonth || 1) - 1, 0))];
  const n = period === "last3" ? 3 : 12;
  return completed.slice(-n).reduce((a, b) => a + (b || 0), 0);
}

function RankingTable({ title, rows, periodLabel, selectedMarketplace, daysOfSupplyBySku, emptyText }) {
  return (
    <div style={{ minWidth: 0 }}>
      <h4 style={{ margin: "0 0 8px" }}>{title}</h4>
      {rows.length === 0 ? (
        <div style={{ color: "#888", fontSize: "13px" }}>{emptyText}</div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ borderCollapse: "collapse", width: "100%" }}>
            <thead>
              <tr>
                <th style={numberCellStyle({ background: "#f4f4f4" })}>#</th>
                <th style={tableCellStyle({ background: "#f4f4f4" })}>Image</th>
                <th style={tableCellStyle({ background: "#f4f4f4" })}>Main SKU</th>
                <th style={tableCellStyle({ background: "#f4f4f4" })}>Group</th>
                <th style={numberCellStyle({ background: "#f4f4f4" })} title={periodLabel}>Units</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => {
                const href = `/product?asin=${encodeURIComponent(row.item.asin)}&sku=${encodeURIComponent(row.item.mainSku)}`;
                return (
                  <tr key={row.item.asin}>
                    <td style={numberCellStyle({ color: "#555" })}>{i + 1}</td>
                    <td style={tableCellStyle({ width: "52px" })}>
                      <Link to={href} target="_blank" rel="noopener noreferrer">
                        <img
                          src={`${IMAGE_BASE}${encodeURIComponent(row.item.mainSku)}.jpg`}
                          alt={row.item.mainSku}
                          style={{ width: "44px", height: "44px", objectFit: "cover", borderRadius: "6px" }}
                        />
                      </Link>
                    </td>
                    <td style={tableCellStyle({ fontWeight: 600 })}>
                      <Link to={href} target="_blank" rel="noopener noreferrer" style={{ color: "inherit", textDecoration: "none" }}>
                        {row.item.mainSku}
                      </Link>
                      <div style={{ marginTop: "4px", fontSize: "12px" }}>
                        <GrowthBadge pct={row.item.growthPct} />
                      </div>
                      <DaysOfSupplyInline sku={row.item.mainSku} selectedMarketplace={selectedMarketplace} daysOfSupplyBySku={daysOfSupplyBySku} />
                    </td>
                    <td style={tableCellStyle({ fontSize: "12px", color: "#555" })}>{row.group}</td>
                    <td style={numberCellStyle({ fontWeight: 700 })}>{formatUnits(row.units)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// Best / worst RANKING_TOP_N sellers per family, from the already-loaded
// GetSalesDepartmentReport groups (so it follows the marketplace selector,
// no extra backend call). Worst sellers skip products with 0 units in the
// period by default - those are mostly retired/relisted catalog ASINs - with
// a checkbox to include them.
function BestWorstSellersCard({ groups, years, currentMonth, selectedMarketplace, daysOfSupplyBySku }) {
  const [open, setOpen] = useState(false);
  const [period, setPeriod] = useState("last12");
  const [includeZero, setIncludeZero] = useState(false);
  const periodLabel = RANKING_PERIODS.find((p) => p.key === period)?.label || "";

  const rankings = useMemo(() => {
    return FAMILIES.map((family) => {
      const rows = [];
      for (const group of groups || []) {
        if (group.group === "IGNORE" || familyOf(group.group) !== family.key) continue;
        for (const item of group.items) {
          rows.push({ item, group: group.group, units: unitsInPeriod(item, period, years, currentMonth) });
        }
      }
      const best = [...rows].filter((r) => r.units > 0).sort((a, b) => b.units - a.units).slice(0, RANKING_TOP_N);
      const worstPool = includeZero ? rows : rows.filter((r) => r.units > 0);
      const worst = [...worstPool].sort((a, b) => a.units - b.units).slice(0, RANKING_TOP_N);
      const zeroCount = rows.filter((r) => r.units === 0).length;
      return { family, best, worst, total: rows.length, zeroCount };
    });
  }, [groups, years, currentMonth, period, includeZero]);

  return (
    <div style={{ ...cardStyle(), marginBottom: "20px" }}>
      <div
        onClick={() => setOpen((v) => !v)}
        style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "6px", cursor: "pointer" }}
      >
        <h3 style={{ margin: 0 }}>
          {open ? "▾" : "▸"} Best &amp; Worst Sellers (top {RANKING_TOP_N})
        </h3>
        <div style={{ color: "#555", fontSize: "13px" }}>Pareo and Home Decor, ranked by units</div>
      </div>

      {open && (
        <div style={{ marginTop: "12px" }}>
          <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", alignItems: "center", marginBottom: "12px" }}>
            <select value={period} onChange={(e) => setPeriod(e.target.value)} style={selectorStyle()}>
              {RANKING_PERIODS.map((p) => (
                <option key={p.key} value={p.key}>
                  {p.label}
                </option>
              ))}
            </select>
            <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "13px" }}>
              <input type="checkbox" checked={includeZero} onChange={() => setIncludeZero((v) => !v)} />
              Include products with 0 sales in worst sellers
            </label>
          </div>

          <div style={{ display: "grid", gap: "24px" }}>
            {rankings.map(({ family, best, worst, total, zeroCount }) => (
              <div key={family.key}>
                <h3 style={{ margin: "0 0 4px" }}>{family.label}</h3>
                <div style={{ color: "#555", fontSize: "12px", marginBottom: "10px" }}>
                  {total} products · {zeroCount} with 0 sales in {periodLabel.toLowerCase()}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: "16px" }}>
                  <RankingTable
                    title={`🏆 Best ${RANKING_TOP_N}`}
                    rows={best}
                    periodLabel={periodLabel}
                    selectedMarketplace={selectedMarketplace}
                    daysOfSupplyBySku={daysOfSupplyBySku}
                    emptyText="No sales in this period."
                  />
                  <RankingTable
                    title={`🐢 Worst ${RANKING_TOP_N}`}
                    rows={worst}
                    periodLabel={periodLabel}
                    selectedMarketplace={selectedMarketplace}
                    daysOfSupplyBySku={daysOfSupplyBySku}
                    emptyText="No products to rank."
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Collapsible wrapper around every group belonging to one family.
function FamilySection({ label, groups, expanded, onToggle, children }) {
  const totalThisYear = groups.reduce((sum, g) => sum + (g.totalThisYear || 0), 0);
  const productCount = groups.reduce((sum, g) => sum + g.items.length, 0);
  return (
    <div style={{ ...cardStyle(), background: "#f3f6fb", border: "1px solid #c9d6ea" }}>
      <div
        onClick={onToggle}
        style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "6px", cursor: "pointer" }}
      >
        <h2 style={{ margin: 0, fontSize: "20px" }}>
          {expanded ? "▾" : "▸"} {label}
        </h2>
        <div style={{ color: "#555", fontSize: "13px" }}>
          {groups.length} group{groups.length === 1 ? "" : "s"} · {productCount} products · {totalThisYear.toLocaleString()} units this year
        </div>
      </div>
      {expanded && <div style={{ display: "grid", gap: "18px", marginTop: "14px" }}>{children}</div>}
    </div>
  );
}

const CHART_WIDTH = 720;
const CHART_HEIGHT = 240;
const CHART_PAD = { left: 56, right: 20, top: 20, bottom: 30 };

// Rounds up to a "clean" axis step (1/2/5 * 10^n), same idea as d3's tick step.
function niceNumber(value) {
  if (value <= 0) return 1;
  const exponent = Math.floor(Math.log10(value));
  const fraction = value / 10 ** exponent;
  let niceFraction;
  if (fraction <= 1) niceFraction = 1;
  else if (fraction <= 2) niceFraction = 2;
  else if (fraction <= 5) niceFraction = 5;
  else niceFraction = 10;
  return niceFraction * 10 ** exponent;
}

// Requested explicitly as blue/green/red/yellow (this year -> 3 years ago).
// Hex values are the dataviz palette's slots for those hues, not eyeballed;
// validated with --pairs all (all 4 lines are visible together) - passes
// with two WARNs (red/green CVD in the 6-8 floor band, yellow under 3:1
// contrast) that are already mitigated by this chart's direct end-labels,
// legend, and the data table rendered right below it.
const YEAR_RAMP = ["#2a78d6", "#008300", "#e34948", "#eda100"];
const YEAR_AGE_LABEL = ["this year", "last year", "2 years ago", "3 years ago"];
const LABEL_MIN_GAP = 14;

// Up to 4 years' monthly trend for the currently selected marketplace(s),
// stepped darkest (this year) to lightest (oldest) on one hue.
function TrendChart({ years, yearRows, currentMonth, formatValue, ariaLabel }) {
  const monthsElapsed = Math.min(Math.max(currentMonth || 0, 1), 12);

  const series = years.map((year, i) => {
    const row = yearRows.find((y) => y.year === year);
    const allMonths = row?.months || [];
    const points = i === 0 ? allMonths.slice(0, monthsElapsed) : allMonths;
    return { year, color: YEAR_RAMP[i] || YEAR_RAMP[YEAR_RAMP.length - 1], points, endIndex: points.length - 1 };
  });

  const [hoverIndex, setHoverIndex] = useState(null);

  const plotWidth = CHART_WIDTH - CHART_PAD.left - CHART_PAD.right;
  const plotHeight = CHART_HEIGHT - CHART_PAD.top - CHART_PAD.bottom;
  const xFor = (i) => CHART_PAD.left + (i / 11) * plotWidth;

  const allPoints = series.flatMap((s) => s.points);
  const maxValue = Math.max(1, ...allPoints);
  const step = niceNumber(maxValue / 4);
  let yMax = step * 4;
  while (yMax < maxValue) yMax += step;
  const yFor = (v) => CHART_PAD.top + plotHeight - (v / yMax) * plotHeight;
  const ticks = [0, step, step * 2, step * 3, yMax];

  function linePath(points) {
    return points.map((v, i) => `${i === 0 ? "M" : "L"} ${xFor(i)} ${yFor(v)}`).join(" ");
  }

  // Direct end-labels can collide when lines finish near the same value -
  // sort by vertical position and push any that are too close apart.
  const labelPositions = series
    .map((s, i) => (s.endIndex >= 0 ? { i, y: yFor(s.points[s.endIndex]) } : null))
    .filter(Boolean)
    .sort((a, b) => a.y - b.y);
  for (let k = 1; k < labelPositions.length; k += 1) {
    if (labelPositions[k].y - labelPositions[k - 1].y < LABEL_MIN_GAP) {
      labelPositions[k].y = labelPositions[k - 1].y + LABEL_MIN_GAP;
    }
  }
  const labelYByIndex = new Map(labelPositions.map((p) => [p.i, p.y]));

  return (
    <div>
      <div style={{ overflowX: "auto" }}>
        <svg
          viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
          style={{ width: "80%", display: "block" }}
          role="img"
          aria-label={`Monthly ${ariaLabel} trend, ${years.join(" vs ")}`}
        >
          {ticks.map((t) => (
            <g key={t}>
              <line
                x1={CHART_PAD.left}
                x2={CHART_WIDTH - CHART_PAD.right}
                y1={yFor(t)}
                y2={yFor(t)}
                stroke={t === 0 ? CHART_BASELINE : CHART_GRIDLINE}
                strokeWidth={1}
              />
              <text x={CHART_PAD.left - 8} y={yFor(t)} textAnchor="end" dominantBaseline="middle" fontSize="10" fill={CHART_MUTED}>
                {formatValue(t)}
              </text>
            </g>
          ))}

          {MONTH_LABELS.map((m, i) => (
            <text key={m} x={xFor(i)} y={CHART_HEIGHT - CHART_PAD.bottom + 16} textAnchor="middle" fontSize="10" fill={CHART_MUTED}>
              {m}
            </text>
          ))}

          {hoverIndex !== null && (
            <line
              x1={xFor(hoverIndex)}
              x2={xFor(hoverIndex)}
              y1={CHART_PAD.top}
              y2={CHART_PAD.top + plotHeight}
              stroke={CHART_MUTED}
              strokeWidth={1}
              opacity={0.5}
            />
          )}

          {/* Oldest year drawn first so more-recent (more relevant) lines sit on top. */}
          {[...series].reverse().map((s) =>
            s.points.length > 0 ? (
              <path key={s.year} d={linePath(s.points)} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
            ) : null
          )}

          {series.map((s) =>
            hoverIndex !== null && hoverIndex < s.points.length ? (
              <circle key={`hover-${s.year}`} cx={xFor(hoverIndex)} cy={yFor(s.points[hoverIndex])} r={5} fill={s.color} stroke="#fff" strokeWidth={2} />
            ) : null
          )}

          {series.map((s) =>
            s.endIndex >= 0 ? (
              <g key={`end-${s.year}`}>
                <circle cx={xFor(s.endIndex)} cy={yFor(s.points[s.endIndex])} r={5} fill={s.color} stroke="#fff" strokeWidth={2} />
                <text x={xFor(s.endIndex) + 8} y={labelYByIndex.get(series.indexOf(s))} dominantBaseline="middle" fontSize="11" fontWeight="700" fill={CHART_INK}>
                  {s.year}
                </text>
              </g>
            ) : null
          )}

          {MONTH_LABELS.map((_, i) => {
            const bandLeft = i === 0 ? CHART_PAD.left : (xFor(i - 1) + xFor(i)) / 2;
            const bandRight = i === 11 ? CHART_WIDTH - CHART_PAD.right : (xFor(i) + xFor(i + 1)) / 2;
            return (
              <rect
                key={i}
                x={bandLeft}
                y={CHART_PAD.top}
                width={bandRight - bandLeft}
                height={plotHeight}
                fill="transparent"
                onMouseEnter={() => setHoverIndex(i)}
                onMouseLeave={() => setHoverIndex((cur) => (cur === i ? null : cur))}
              />
            );
          })}
        </svg>
      </div>

      <div style={{ minHeight: "20px", textAlign: "center", fontSize: "13px", color: "#333", marginTop: "4px" }}>
        {hoverIndex !== null && (
          <span style={{ display: "inline-flex", gap: "18px", alignItems: "center", flexWrap: "wrap" }}>
            <strong>{MONTH_LABELS[hoverIndex]}</strong>
            {series.map((s) =>
              hoverIndex < s.points.length ? (
                <span key={s.year}>
                  <span style={{ display: "inline-block", width: "10px", height: "2px", background: s.color, marginRight: "4px" }} />
                  {s.year}: <strong>{formatValue(s.points[hoverIndex])}</strong>
                </span>
              ) : null
            )}
          </span>
        )}
      </div>

      <div style={{ display: "flex", gap: "16px", justifyContent: "center", fontSize: "12px", color: "#555", flexWrap: "wrap" }}>
        {series.map((s, i) => (
          <span key={s.year}>
            <span style={{ display: "inline-block", width: "14px", height: "2px", background: s.color, marginRight: "5px", verticalAlign: "middle" }} />
            {s.year} ({YEAR_AGE_LABEL[i] || `${i} years ago`})
          </span>
        ))}
      </div>
    </div>
  );
}

// One trend chart + table for a single metric/currency (e.g. "units", or
// "sales in EUR"). Split out so a multi-currency money view can render one
// of these per currency instead of blending unrelated currencies together.
function SummaryBlock({ title, years, currentMonth, yearRows, growthPct, formatValue, ariaLabel, returnsYearRows }) {
  return (
    <div>
      {title && <h4 style={{ margin: "0 0 8px" }}>{title}</h4>}
      <TrendChart years={years} yearRows={yearRows} currentMonth={currentMonth} formatValue={formatValue} ariaLabel={ariaLabel} />

      <div style={{ overflowX: "auto", marginTop: "16px" }}>
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
            <YearRows
              rowKeyPrefix={`marketplace-summary-${ariaLabel}`}
              years={years}
              yearRows={yearRows}
              currentMonth={currentMonth}
              growthPct={growthPct}
              formatValue={formatValue}
              returnsYearRows={returnsYearRows}
            />
          </tbody>
        </table>
      </div>
    </div>
  );
}

function formatPercent(v) {
  return v === null || v === undefined ? "–" : `${v.toFixed(1)}%`;
}

const MONEY_METRIC_OPTIONS = [
  { key: "sales", label: "Sales" },
  { key: "netSales", label: "Sales - PPC Cost" },
  { key: "acos", label: "ACOS" },
  { key: "tacos", label: "PPC Spend / Sales" },
];

function MarketplaceSummaryCard({ quantity, sales, netSales, acos, tacos, salesCurrency, years, currentMonth, metric, onMetricChange, loading, error, showReturns, returnsYearRows, returnsLoading, returnsError, onToggleReturns }) {
  const currency = salesCurrency || "USD";
  const moneyMetrics = { sales, netSales, acos, tacos };
  const summary = metric === "units" ? quantity : moneyMetrics[metric];
  const isPercentMetric = metric === "acos" || metric === "tacos";
  const formatValue = metric === "units" ? formatUnits : isPercentMetric ? formatPercent : (v) => formatMoney(v, currency);

  return (
    <div style={{ ...cardStyle(), marginBottom: "20px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px" }}>
        <h3 style={{ margin: 0 }}>Marketplace Totals</h3>
        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", alignItems: "center" }}>
          <button style={metric === "units" ? blueButtonStyle() : ghostButtonStyle()} onClick={() => onMetricChange("units")}>
            Units
          </button>
          {MONEY_METRIC_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              style={metric === opt.key ? blueButtonStyle() : ghostButtonStyle()}
              onClick={() => onMetricChange(opt.key)}
            >
              {opt.label}
              {opt.key === "sales" || opt.key === "netSales" ? ` (${CURRENCY_SYMBOLS[currency] || currency})` : ""}
            </button>
          ))}
          <label style={{ display: "flex", alignItems: "center", gap: "6px", marginLeft: "10px", fontSize: "13px" }}>
            <input type="checkbox" checked={showReturns} onChange={onToggleReturns} />
            Show Returns
          </label>
        </div>
      </div>

      {returnsError && <div style={{ marginTop: "8px", fontSize: "12px", color: GROWTH_RED }}>Returns: {returnsError}</div>}
      {showReturns && returnsLoading && <div style={{ marginTop: "8px", fontSize: "12px", color: "#888" }}>Loading returns...</div>}

      {loading && <div style={{ marginTop: "12px", textAlign: "center" }}>Loading...</div>}
      {error && <div style={{ marginTop: "12px", color: GROWTH_RED }}>{error}</div>}

      {!loading && !error && summary && (
        <div style={{ marginTop: "16px" }}>
          <SummaryBlock
            years={years}
            currentMonth={currentMonth}
            yearRows={summary.yearRows}
            growthPct={summary.growthPct}
            formatValue={formatValue}
            ariaLabel={metric}
            returnsYearRows={showReturns ? returnsYearRows : undefined}
          />
        </div>
      )}
    </div>
  );
}

export default function SalesPage() {
  const [selectedMarketplace, setSelectedMarketplace] = useState("");
  const [showAsin, setShowAsin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [collapsedGroups, setCollapsedGroups] = useState({});
  // Pareo / Pouf Covers family sections - collapsed by default.
  const [expandedFamilies, setExpandedFamilies] = useState({});

  const [metric, setMetric] = useState("units");
  const [marketplaceSummary, setMarketplaceSummary] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState("");

  // Returns are only fetched once the checkbox is actually turned on -
  // no point in an extra call on every page load for something most
  // visits won't look at. Two separate calls (month-level for the top
  // summary card, per-ASIN for the per-product/per-group rows below) since
  // they're different shapes and the per-ASIN one is only needed once
  // groups are actually rendered - fetched together regardless, both are
  // cheap single calls.
  const [showReturns, setShowReturns] = useState(false);
  const [returnsSummary, setReturnsSummary] = useState(null);
  const [returnsByAsin, setReturnsByAsin] = useState(null);
  const [returnsLoading, setReturnsLoading] = useState(false);
  const [returnsError, setReturnsError] = useState("");

  // Days of Supply per SKU - fetched once, independent of the selected
  // marketplace/currency (it's not a money figure, just stock ÷ sales rate
  // per region) - see GetDaysOfSupplyBySku.py for the actual computation.
  const [daysOfSupplyBySku, setDaysOfSupplyBySku] = useState(null);

  useEffect(() => {
    fetch(`${LOCAL_API_BASE}/GetDaysOfSupplyBySku`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data?.bySku) setDaysOfSupplyBySku(data.bySku);
      })
      .catch(() => {}); // non-critical - the column just shows "–" if this fails
  }, []);

  async function loadReturnsSummary(marketplaces) {
    setReturnsLoading(true);
    setReturnsError("");
    try {
      const [monthResponse, asinResponse] = await Promise.all([
        fetch(`${LOCAL_API_BASE}/GetReturnStatsByMonth`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ marketplaces }),
        }),
        fetch(`${LOCAL_API_BASE}/GetReturnStatsByAsin`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ marketplaces }),
        }),
      ]);
      const monthData = await monthResponse.json();
      if (!monthResponse.ok || monthData.error) throw new Error(monthData?.error || `HTTP ${monthResponse.status}`);
      const asinData = await asinResponse.json();
      if (!asinResponse.ok || asinData.error) throw new Error(asinData?.error || `HTTP ${asinResponse.status}`);
      setReturnsSummary(monthData);
      setReturnsByAsin(asinData.asinYearRows || {});
    } catch (err) {
      setReturnsError(err.message || "Failed to load return stats");
    } finally {
      setReturnsLoading(false);
    }
  }

  function toggleShowReturns() {
    const next = !showReturns;
    setShowReturns(next);
    if (next && !returnsSummary) {
      loadReturnsSummary(selectedMarketplace ? [selectedMarketplace] : ALL_MARKETPLACE_VALUES);
    }
  }

  async function loadMarketplaceSummary(marketplaces) {
    setSummaryLoading(true);
    setSummaryError("");

    try {
      const response = await fetch(`${LOCAL_API_BASE}/GetMarketplaceSalesSummary`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ marketplaces }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || `HTTP ${response.status}`);
      }

      setMarketplaceSummary(data);
    } catch (err) {
      setSummaryError(err.message || "Failed to load marketplace totals");
    } finally {
      setSummaryLoading(false);
    }
  }

  async function loadReport(marketplaces) {
    setLoading(true);
    setError("");

    try {
      const response = await fetch(`${LOCAL_API_BASE}/GetSalesDepartmentReport`, {
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

      // Groups start closed by default on every fresh load.
      const allCollapsed = {};
      (data.groups || []).forEach((g) => {
        allCollapsed[g.group] = true;
      });
      setCollapsedGroups(allCollapsed);
    } catch (err) {
      setError(err.message || "Failed to load sales report");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadReport(ALL_MARKETPLACE_VALUES);
    loadMarketplaceSummary(ALL_MARKETPLACE_VALUES);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleMarketplaceChange(value) {
    setSelectedMarketplace(value);
    loadReport(value ? [value] : ALL_MARKETPLACE_VALUES);
    loadMarketplaceSummary(value ? [value] : ALL_MARKETPLACE_VALUES);
    if (showReturns) loadReturnsSummary(value ? [value] : ALL_MARKETPLACE_VALUES);
  }

  async function refreshReport() {
    await loadReport(selectedMarketplace ? [selectedMarketplace] : ALL_MARKETPLACE_VALUES);
  }

  function toggleGroup(name) {
    setCollapsedGroups((prev) => ({ ...prev, [name]: !prev[name] }));
  }

  function expandAll() {
    setCollapsedGroups({});
    setExpandedFamilies(Object.fromEntries(FAMILIES.map((f) => [f.key, true])));
  }

  function collapseAll() {
    setExpandedFamilies({});
    if (!result?.groups) return;
    const next = {};
    result.groups.forEach((g) => {
      next[g.group] = true;
    });
    setCollapsedGroups(next);
  }

  const visibleGroups = useMemo(() => (result?.groups || []).filter((g) => g.group !== "IGNORE"), [result]);

  function renderGroup(group) {
    return (
      <GroupSection
        key={group.group}
        group={group}
        years={years}
        currentMonth={currentMonth}
        showAsin={showAsin}
        expanded={!collapsedGroups[group.group]}
        onToggle={() => toggleGroup(group.group)}
        returnsByAsin={showReturns ? returnsByAsin : undefined}
        selectedMarketplace={selectedMarketplace}
        daysOfSupplyBySku={daysOfSupplyBySku}
      />
    );
  }

  const years = useMemo(() => result?.years || [], [result]);
  const currentMonth = result?.currentMonth;

  // IGNORE is a valid destination group (used to exclude a SKU from every
  // report) but never appears in result.groups itself - add it explicitly
  // so it's always selectable in the "Move to Group" dropdown.
  const groupOptions = useMemo(() => {
    const names = new Set((result?.groups || []).map((g) => g.group));
    names.add("IGNORE");
    return [...names].sort();
  }, [result]);

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
        <h3 style={{ marginTop: 0 }}>Marketplace</h3>
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center" }}>
          <select
            value={selectedMarketplace}
            onChange={(e) => handleMarketplaceChange(e.target.value)}
            style={selectorStyle()}
            disabled={loading}
          >
            <option value="">All marketplaces</option>
            <optgroup label="Amazon">
              {MARKETPLACE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </optgroup>
            <optgroup label="Etsy">
              {ETSY_MARKETPLACE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </optgroup>
          </select>

          {loading && <span>Loading...</span>}

          <label style={{ display: "flex", alignItems: "center", gap: "6px", marginLeft: "auto" }}>
            <input type="checkbox" checked={showAsin} onChange={() => setShowAsin((v) => !v)} />
            Show ASIN column
          </label>
        </div>
      </div>

      <MarketplaceSummaryCard
        quantity={marketplaceSummary?.quantity}
        sales={marketplaceSummary?.sales}
        netSales={marketplaceSummary?.netSales}
        acos={marketplaceSummary?.acos}
        tacos={marketplaceSummary?.tacos}
        salesCurrency={marketplaceSummary?.salesCurrency}
        years={marketplaceSummary?.years || []}
        currentMonth={marketplaceSummary?.currentMonth}
        metric={metric}
        onMetricChange={setMetric}
        loading={summaryLoading}
        error={summaryError}
        showReturns={showReturns}
        onToggleReturns={toggleShowReturns}
        returnsYearRows={returnsSummary?.yearRows}
        returnsLoading={returnsLoading}
        returnsError={returnsError}
      />

      <div style={{ maxWidth: "1400px", marginInline: "auto" }}>
        <AdsCountryBreakdown />
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

          <BestWorstSellersCard
            groups={visibleGroups}
            years={years}
            currentMonth={currentMonth}
            selectedMarketplace={selectedMarketplace}
            daysOfSupplyBySku={daysOfSupplyBySku}
          />

          {FAMILIES.map((family) => {
            const familyGroups = visibleGroups.filter((g) => familyOf(g.group) === family.key);
            if (familyGroups.length === 0) return null;
            return (
              <FamilySection
                key={family.key}
                label={family.label}
                groups={familyGroups}
                expanded={!!expandedFamilies[family.key]}
                onToggle={() => setExpandedFamilies((prev) => ({ ...prev, [family.key]: !prev[family.key] }))}
              >
                {familyGroups.map(renderGroup)}
              </FamilySection>
            );
          })}

          {visibleGroups.filter((g) => !familyOf(g.group)).map(renderGroup)}

          {Array.isArray(result.unmapped) && result.unmapped.length > 0 && (
            <div style={cardStyle()}>
              <h3 style={{ marginTop: 0 }}>Unmapped SKUs</h3>
              <div style={{ color: "#555", fontSize: "13px", marginBottom: "8px" }}>
                Sales rows whose SKU isn't in the mapping (not counted in any group above).
              </div>
              <div style={{ overflowX: "auto" }}>
                <table style={{ borderCollapse: "collapse", width: "100%" }}>
                  <thead>
                    <tr>
                      <th style={tableCellStyle({ background: "#f4f4f4" })}>SKU</th>
                      <th style={numberCellStyle({ background: "#f4f4f4" })}>Total Quantity</th>
                      <th style={tableCellStyle({ background: "#f4f4f4" })}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.unmapped.map((row) => (
                      <tr key={row.sku}>
                        <td style={tableCellStyle()}>{row.sku}</td>
                        <td style={numberCellStyle()}>{row.totalQuantity}</td>
                        <td style={tableCellStyle()}>
                          {groupOptions.length > 0 && (
                            <MoveToGroupControl row={row} groupOptions={groupOptions} onAssigned={refreshReport} />
                          )}
                        </td>
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
        <Link style={blueButtonStyle()} to="/">
          Home
        </Link>
      </div>
    </div>
  );
}
