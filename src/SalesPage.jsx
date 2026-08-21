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

const MAIN_SKU_WIDTH = "144px";
const GROWTH_GREEN = "#1b7a1b";
const GROWTH_RED = "#b00020";
const GROWTH_THRESHOLD_PCT = 10;

// Validated adjacent categorical pair (blue/orange) from the dataviz palette -
// clears CVD and normal-vision contrast checks for a 2-series comparison.
const SERIES_THIS_YEAR = "#2a78d6";
const SERIES_LAST_YEAR = "#eb6834";
const CHART_MUTED = "#898781";
const CHART_GRIDLINE = "#e1e0d9";
const CHART_BASELINE = "#c3c2b7";
const CHART_INK = "#0b0b0b";

// Sales are never currency-converted - each marketplace's total stays in its
// own local currency, so a multi-currency selection is shown as one block
// per currency rather than a single blended number.
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

function selectorStyle() {
  return {
    padding: "8px 12px",
    fontSize: "14px",
    borderRadius: "8px",
    minWidth: "220px",
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
        {showAsin && <th style={tableCellStyle({ background: "#f4f4f4" })}>ASIN</th>}
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
function YearRows({ rowKeyPrefix, years, yearRows, currentMonth, growthPct, renderLeading, formatValue = (v) => v }) {
  const rowCount = years.length;

  return years.map((year, i) => {
    const row = yearRows.find((y) => y.year === year) || { year, months: Array(12).fill(0), total: 0 };
    const prevRow = i + 1 < years.length ? yearRows.find((y) => y.year === years[i + 1]) : null;
    const isCurrentYear = i === 0;

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
          </td>
        ))}
      </tr>
    );
  });
}

function ItemRows({ item, showAsin, years, currentMonth }) {
  return (
    <YearRows
      rowKeyPrefix={item.asin}
      years={years}
      yearRows={item.years}
      currentMonth={currentMonth}
      growthPct={item.growthPct}
      renderLeading={(rowCount) => (
        <>
          <td rowSpan={rowCount} style={tableCellStyle({ verticalAlign: "top", width: "70px" })}>
            <img
              src={`${IMAGE_BASE}${encodeURIComponent(item.mainSku)}.jpg`}
              alt={item.mainSku}
              style={{ width: "60px", height: "60px", objectFit: "cover", borderRadius: "6px" }}
            />
          </td>

          <td rowSpan={rowCount} style={tableCellStyle({ verticalAlign: "top", fontWeight: 600, width: MAIN_SKU_WIDTH })}>
            {item.mainSku}
            <div style={{ marginTop: "6px" }}>
              <GrowthBadge pct={item.growthPct} />
            </div>
          </td>

          {showAsin && (
            <td rowSpan={rowCount} style={tableCellStyle({ verticalAlign: "top", fontFamily: "monospace" })}>
              {item.asin}
            </td>
          )}
        </>
      )}
    />
  );
}

function GroupSection({ group, years, currentMonth, showAsin, expanded, onToggle }) {
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
              renderLeading={(rowCount) => (
                <>
                  <td rowSpan={rowCount} style={tableCellStyle({ width: "70px" })} />
                  <td rowSpan={rowCount} style={tableCellStyle({ verticalAlign: "top", fontWeight: 700, width: MAIN_SKU_WIDTH })}>
                    Group Total
                    <div style={{ marginTop: "6px" }}>
                      <GrowthBadge pct={group.growthPct} />
                    </div>
                  </td>
                  {showAsin && <td rowSpan={rowCount} style={tableCellStyle()} />}
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
                <ItemRows key={item.asin} item={item} showAsin={showAsin} years={years} currentMonth={currentMonth} />
              ))}
            </tbody>
          </table>
        </div>
      )}
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

// This-year-vs-last-year monthly trend for the currently selected marketplace(s).
// Only two series so color alone (no legend box) would be enough per the
// series-count ladder, but a legend is kept since the direct end-labels can
// collide when both lines end on the same month.
function TrendChart({ years, yearRows, currentMonth, formatValue, ariaLabel }) {
  const thisYear = years[0];
  const lastYear = years[1];
  const thisYearRow = yearRows.find((y) => y.year === thisYear);
  const lastYearRow = lastYear ? yearRows.find((y) => y.year === lastYear) : null;

  // The current year's line only plots through months that actually happened -
  // future months are 0 in the data, and drawing them would fake a Dec crash.
  const monthsElapsed = Math.min(Math.max(currentMonth || 0, 1), 12);
  const thisYearPoints = (thisYearRow?.months || []).slice(0, monthsElapsed);
  const lastYearPoints = lastYearRow?.months || [];

  const [hoverIndex, setHoverIndex] = useState(null);

  const plotWidth = CHART_WIDTH - CHART_PAD.left - CHART_PAD.right;
  const plotHeight = CHART_HEIGHT - CHART_PAD.top - CHART_PAD.bottom;
  const xFor = (i) => CHART_PAD.left + (i / 11) * plotWidth;

  const maxValue = Math.max(1, ...thisYearPoints, ...lastYearPoints);
  const step = niceNumber(maxValue / 4);
  let yMax = step * 4;
  while (yMax < maxValue) yMax += step;
  const yFor = (v) => CHART_PAD.top + plotHeight - (v / yMax) * plotHeight;
  const ticks = [0, step, step * 2, step * 3, yMax];

  function linePath(points) {
    return points.map((v, i) => `${i === 0 ? "M" : "L"} ${xFor(i)} ${yFor(v)}`).join(" ");
  }

  const thisYearPath = linePath(thisYearPoints);
  const lastYearPath = linePath(lastYearPoints);
  const thisYearEndIndex = thisYearPoints.length - 1;
  const lastYearEndIndex = lastYearPoints.length - 1;

  // Nudge the two end-labels apart if both lines finish on the same month.
  let thisYearLabelY = thisYearEndIndex >= 0 ? yFor(thisYearPoints[thisYearEndIndex]) : null;
  let lastYearLabelY = lastYearEndIndex >= 0 ? yFor(lastYearPoints[lastYearEndIndex]) : null;
  if (
    thisYearEndIndex === lastYearEndIndex &&
    thisYearLabelY !== null &&
    lastYearLabelY !== null &&
    Math.abs(thisYearLabelY - lastYearLabelY) < 16
  ) {
    const mid = (thisYearLabelY + lastYearLabelY) / 2;
    thisYearLabelY = mid - 9;
    lastYearLabelY = mid + 9;
  }

  return (
    <div>
      <div style={{ overflowX: "auto" }}>
        <svg
          viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
          style={{ width: "100%", maxWidth: `${CHART_WIDTH}px`, display: "block" }}
          role="img"
          aria-label={`Monthly ${ariaLabel} trend, ${thisYear} vs ${lastYear ?? "prior year"}`}
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

          {lastYearPath && (
            <path d={lastYearPath} fill="none" stroke={SERIES_LAST_YEAR} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          )}
          {thisYearPath && (
            <path d={thisYearPath} fill="none" stroke={SERIES_THIS_YEAR} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          )}

          {hoverIndex !== null && hoverIndex < lastYearPoints.length && (
            <circle cx={xFor(hoverIndex)} cy={yFor(lastYearPoints[hoverIndex])} r={5} fill={SERIES_LAST_YEAR} stroke="#fff" strokeWidth={2} />
          )}
          {hoverIndex !== null && hoverIndex < thisYearPoints.length && (
            <circle cx={xFor(hoverIndex)} cy={yFor(thisYearPoints[hoverIndex])} r={5} fill={SERIES_THIS_YEAR} stroke="#fff" strokeWidth={2} />
          )}

          {lastYearEndIndex >= 0 && (
            <>
              <circle
                cx={xFor(lastYearEndIndex)}
                cy={yFor(lastYearPoints[lastYearEndIndex])}
                r={5}
                fill={SERIES_LAST_YEAR}
                stroke="#fff"
                strokeWidth={2}
              />
              <text x={xFor(lastYearEndIndex) + 8} y={lastYearLabelY} dominantBaseline="middle" fontSize="11" fontWeight="700" fill={CHART_INK}>
                {lastYear}
              </text>
            </>
          )}
          {thisYearEndIndex >= 0 && (
            <>
              <circle
                cx={xFor(thisYearEndIndex)}
                cy={yFor(thisYearPoints[thisYearEndIndex])}
                r={5}
                fill={SERIES_THIS_YEAR}
                stroke="#fff"
                strokeWidth={2}
              />
              <text x={xFor(thisYearEndIndex) + 8} y={thisYearLabelY} dominantBaseline="middle" fontSize="11" fontWeight="700" fill={CHART_INK}>
                {thisYear}
              </text>
            </>
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
          <span style={{ display: "inline-flex", gap: "18px", alignItems: "center" }}>
            <strong>{MONTH_LABELS[hoverIndex]}</strong>
            {hoverIndex < thisYearPoints.length && (
              <span>
                <span style={{ display: "inline-block", width: "10px", height: "2px", background: SERIES_THIS_YEAR, marginRight: "4px" }} />
                {thisYear}: <strong>{formatValue(thisYearPoints[hoverIndex])}</strong>
              </span>
            )}
            {hoverIndex < lastYearPoints.length && (
              <span>
                <span style={{ display: "inline-block", width: "10px", height: "2px", background: SERIES_LAST_YEAR, marginRight: "4px" }} />
                {lastYear}: <strong>{formatValue(lastYearPoints[hoverIndex])}</strong>
              </span>
            )}
          </span>
        )}
      </div>

      <div style={{ display: "flex", gap: "16px", justifyContent: "center", fontSize: "12px", color: "#555" }}>
        <span>
          <span
            style={{ display: "inline-block", width: "14px", height: "2px", background: SERIES_THIS_YEAR, marginRight: "5px", verticalAlign: "middle" }}
          />
          {thisYear} (this year)
        </span>
        {lastYear && (
          <span>
            <span
              style={{
                display: "inline-block",
                width: "14px",
                height: "2px",
                background: SERIES_LAST_YEAR,
                marginRight: "5px",
                verticalAlign: "middle",
              }}
            />
            {lastYear} (last year)
          </span>
        )}
      </div>
    </div>
  );
}

// One trend chart + table for a single metric/currency (e.g. "units", or
// "sales in EUR"). Split out so a multi-currency money view can render one
// of these per currency instead of blending unrelated currencies together.
function SummaryBlock({ title, years, currentMonth, yearRows, growthPct, formatValue, ariaLabel }) {
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
            />
          </tbody>
        </table>
      </div>
    </div>
  );
}

function MarketplaceSummaryCard({ quantity, salesByCurrency, years, currentMonth, metric, onMetricChange, loading, error }) {
  // Biggest currency (by current total) shown first.
  const currencyEntries = Object.entries(salesByCurrency || {}).sort(
    ([, a], [, b]) => (b.yearRows?.[0]?.total || 0) - (a.yearRows?.[0]?.total || 0)
  );

  return (
    <div style={{ ...cardStyle(), marginBottom: "20px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px" }}>
        <h3 style={{ margin: 0 }}>Marketplace Totals</h3>
        <div style={{ display: "flex", gap: "6px" }}>
          <button style={metric === "units" ? blueButtonStyle() : ghostButtonStyle()} onClick={() => onMetricChange("units")}>
            Units
          </button>
          <button style={metric === "money" ? blueButtonStyle() : ghostButtonStyle()} onClick={() => onMetricChange("money")}>
            Money
          </button>
        </div>
      </div>

      {loading && <div style={{ marginTop: "12px", textAlign: "center" }}>Loading...</div>}
      {error && <div style={{ marginTop: "12px", color: GROWTH_RED }}>{error}</div>}

      {!loading && !error && metric === "units" && quantity && (
        <div style={{ marginTop: "16px" }}>
          <SummaryBlock
            years={years}
            currentMonth={currentMonth}
            yearRows={quantity.yearRows}
            growthPct={quantity.growthPct}
            formatValue={formatUnits}
            ariaLabel="units"
          />
        </div>
      )}

      {!loading && !error && metric === "money" && (
        <div style={{ marginTop: "16px", display: "grid", gap: "24px" }}>
          {currencyEntries.length === 0 && (
            <div style={{ color: "#555" }}>No sales data for this selection.</div>
          )}
          {currencyEntries.map(([currency, data]) => (
            <SummaryBlock
              key={currency}
              title={currencyEntries.length > 1 ? `Sales (${currency})` : undefined}
              years={years}
              currentMonth={currentMonth}
              yearRows={data.yearRows}
              growthPct={data.growthPct}
              formatValue={(v) => formatMoney(v, currency)}
              ariaLabel={`sales (${currency})`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function SalesPage() {
  const navigate = useNavigate();

  const [selectedMarketplace, setSelectedMarketplace] = useState("");
  const [showAsin, setShowAsin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [collapsedGroups, setCollapsedGroups] = useState({});

  const [metric, setMetric] = useState("units");
  const [marketplaceSummary, setMarketplaceSummary] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState("");

  async function loadMarketplaceSummary(marketplaces) {
    setSummaryLoading(true);
    setSummaryError("");

    try {
      const response = await fetch(`${API_BASE}/GetMarketplaceSalesSummary`, {
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
  const currentMonth = result?.currentMonth;

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
            {MARKETPLACE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
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
        salesByCurrency={marketplaceSummary?.salesByCurrency}
        years={marketplaceSummary?.years || []}
        currentMonth={marketplaceSummary?.currentMonth}
        metric={metric}
        onMetricChange={setMetric}
        loading={summaryLoading}
        error={summaryError}
      />

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
              currentMonth={currentMonth}
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
