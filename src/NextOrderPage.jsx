import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { buttonStyle, ghostButtonStyle } from "./buttonStyle";

function productLink(item) {
  return `/product?asin=${encodeURIComponent(item.asin)}&sku=${encodeURIComponent(item.sku)}`;
}

// PocketBase-only functions run on the mini PC that already hosts
// PocketBase, instead of GCP - see CLAUDE.md "AmzBot: local job runner".
const API_BASE = "https://amzapi.mandalalifeart.com";

const IMAGE_BASE = "https://storage.googleapis.com/mlf-amz-images/";

const SAVE_ERROR_COLOR = "#b00020";
const SAVE_OK_COLOR = "#2e7d32";

// Percentages sum to 100 - table uses table-layout:fixed so these are exact
// column widths, keeping all columns inside one screen width with no
// horizontal scroll needed on a normal laptop/desktop viewport. Each region
// block grew from 4 to 5 columns (2026-09-24) with the new Days of Supply
// column (A/B/C) added alongside Reco - leading columns trimmed further to
// make room.
const COLUMN_WIDTHS_WITH_ASIN = [3, 8, 3, 3, 3, 4, 6, 6, 3, 3, 4, 6, 6, 3, 3, 4, 6, 6, 3, 3, 4, 5, 5];
// ASIN's width folded into SKU when the column is hidden.
const COLUMN_WIDTHS_NO_ASIN = [3, 11, 3, 3, 4, 6, 6, 3, 3, 4, 6, 6, 3, 3, 4, 6, 6, 3, 3, 4, 5, 5];

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
    padding: "3px 4px",
    textAlign: "left",
    fontSize: "11px",
    overflow: "hidden",
    textOverflow: "ellipsis",
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

// Larger, bolder font for the actual values (as opposed to headers), used on
// every read-only number cell.
function valueCellStyle(extra = {}) {
  return numberCellStyle({
    fontSize: "16px",
    padding: "3px 2px",
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

function formatUnits(value) {
  return Math.round(value || 0).toLocaleString();
}

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function formatMonths(monthPairs) {
  if (!monthPairs || monthPairs.length === 0) return "";
  return monthPairs.map(([y, m]) => `${MONTH_NAMES[m - 1]} ${y}`).join(" + ");
}

function seasonalSourceLabel(source) {
  switch (source) {
    case "actual":
      return "actual same season";
    case "fallback_recent":
      return "no seasonal history yet for this SKU - showing the recent-based value instead";
    default:
      return "";
  }
}

// Full breakdown shown on hover, per the user (2026-09-20, extended same
// day): days of supply (Bal+OTW ÷ recent daily avg), days to next order,
// each formula's own daily average, and the exact A/B formula with real
// numbers plugged in - reusing <region>_reco_debug (the same raw
// intermediates the bottom-of-page worked example already renders,
// including the daily averages themselves) so this never drifts from the
// backend's actual calculation. Note on rounding: below half a category's
// minimum order size the reco is zeroed out entirely; at or above half,
// it's shown as-is (NOT rounded up to the full minimum) - see
// GetNextOrderData.py's apply_category_min_order for the exact rule, so a
// "raw" value computed here can legitimately differ from the displayed one
// only by becoming 0. Generalized 2026-09-20 to work for any region
// (usa/uk/de), originally USA-only.
function buildRecoTooltip(item, region) {
  const debug = item[`${region}_reco_debug`];
  if (!debug) return "";

  const bal = item[`${region}_balance`] || 0;
  const otw = item[`${region}_on_the_way`] || 0;
  const seasonal1yrSource = item[`${region}_seasonal_1yr_source`];
  const seasonal2yrSource = item[`${region}_seasonal_2yr_source`];
  const recommendedOrder = item[`${region}_recommended_order`];
  const recommendedOrderSeasonal1yr = item[`${region}_recommended_order_seasonal_1yr`];
  const recommendedOrderSeasonal2yr = item[`${region}_recommended_order_seasonal_2yr`];
  const daysOfSupply = debug.avgDailyRecent > 0 ? ((bal + otw) / debug.avgDailyRecent).toFixed(1) : "∞ (no recent sales)";

  const seasonal1yr = seasonal1yrSource === "actual" ? debug.year1Total : debug.trailingTotal;
  const seasonal2yr = seasonal2yrSource === "actual" ? debug.year2Total : debug.trailingTotal;
  const rawA = Math.max(0, Math.round(debug.trailingTotal + debug.needForXDays - debug.alreadyCovered));
  const rawB = Math.max(0, Math.round(seasonal1yr + debug.needForXDays - debug.alreadyCovered));
  const rawC = Math.max(0, Math.round(seasonal2yr + debug.needForXDays - debug.alreadyCovered));
  const aZeroedNote = rawA > 0 && recommendedOrder === 0 ? " → zeroed out (below half the minimum order size)" : "";
  const bZeroedNote = rawB > 0 && recommendedOrderSeasonal1yr === 0 ? " → zeroed out (below half the minimum order size)" : "";
  const cZeroedNote = rawC > 0 && recommendedOrderSeasonal2yr === 0 ? " → zeroed out (below half the minimum order size)" : "";

  const stockoutNote = debug.zeroInventoryWeeks > 0
    ? `\n(excludes ${debug.zeroInventoryWeeks} week${debug.zeroInventoryWeeks === 1 ? "" : "s"} of zero ${region.toUpperCase()} stock from the recent-avg calc)`
    : "";

  return (
    `Days of supply: (${bal} + ${otw}) / ${debug.avgDailyRecent}/day = ${daysOfSupply} days\n` +
    `Days to next order: ${debug.xDays} days\n\n` +
    `Avg daily sales used for A (recent): ${debug.avgDailyRecent}/day${stockoutNote}\n` +
    `Avg daily sales used for B (seasonal, 1yr ago): ${debug.avgDailySeasonal1yr}/day\n` +
    `Avg daily sales used for C (seasonal, 2yr ago): ${debug.avgDailySeasonal2yr}/day\n\n` +
    `A (Recent) = ${debug.trailingTotal} + ${debug.needForXDays} - ${debug.alreadyCovered} = ${rawA}${aZeroedNote}\n` +
    `B (Seasonal, ${seasonalSourceLabel(seasonal1yrSource)}) = ${seasonal1yr} + ${debug.needForXDays} - ${debug.alreadyCovered} = ${rawB}${bZeroedNote}\n` +
    `C (Seasonal, ${seasonalSourceLabel(seasonal2yrSource)}) = ${seasonal2yr} + ${debug.needForXDays} - ${debug.alreadyCovered} = ${rawC}${cZeroedNote}`
  );
}

// needed = sum of the three "next shipment" quantities being planned across markets.
function computeNeeded(item) {
  return (item.uk_next_shipment || 0) + (item.de_next_shipment || 0) + (item.usa_next_shipment || 0);
}

// missing = needed - malani_balance - malani_order: what's still short after
// both the factory's on-hand stock AND whatever's already on order there
// (both reduce how much more needs to be placed).
function computeMissing(item) {
  return computeNeeded(item) - (item.malani_balance || 0) - (item.malani_order || 0);
}

// Uncontrolled-by-prop on purpose: the input owns its text while the user is
// typing, and only pushes a value up (recomputing Needed/Missing) once they
// commit it on blur/Enter - syncing from item[field] on every prop change
// would fight the user's keystrokes and needs an effect-driven setState.
const STATUS_BORDER = {
  idle: "#bbb",
  saving: "#bbb",
  saved: SAVE_OK_COLOR,
  error: SAVE_ERROR_COLOR,
};

function EditableCell({ item, field, onSave }) {
  const [value, setValue] = useState(item[field] ?? 0);
  const [status, setStatus] = useState("idle"); // idle | saving | saved | error

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
        width: "38px",
        padding: "2px 2px",
        textAlign: "right",
        borderRadius: "4px",
        fontSize: "15px",
        fontWeight: 600,
        colorScheme: "light",
        color: "#111",
        border: `1px solid ${STATUS_BORDER[status]}`,
        background: status === "saving" ? "#fff8e1" : "#fff",
      }}
    />
  );
}

// Two-row header per the user (2026-09-22): a top row grouping columns
// under USA / DE / UK / GENERAL (colSpan), with the actual field names
// (Bal, OTW, Next, Reco) on the row below - the single flat "USA Bal",
// "USA OTW", ... row got too cramped once DE/UK Reco columns were added,
// truncating almost every header to "USA...". Dropping the repeated region
// prefix from the row-2 labels (since the group row above already says it)
// also frees up real width for each column.
const REGION_SUBLABELS = ["Bal", "OTW", "Next", "Reco (A/B/C)", "DoS (A/B/C)"];
const GENERAL_SUBLABELS = ["Malani Bal", "Malani Ord", "Needed", "Missing", "Next Order"];
const ROW2_LABELS = [...REGION_SUBLABELS, ...REGION_SUBLABELS, ...REGION_SUBLABELS, ...GENERAL_SUBLABELS];

function ColGroup({ showAsin }) {
  const widths = showAsin ? COLUMN_WIDTHS_WITH_ASIN : COLUMN_WIDTHS_NO_ASIN;
  return (
    <colgroup>
      {widths.map((w, i) => (
        <col key={i} style={{ width: `${w}%` }} />
      ))}
    </colgroup>
  );
}

function TableHeader({ showAsin }) {
  const leadingLabels = showAsin ? ["Image", "SKU", "ASIN"] : ["Image", "SKU"];
  const groupHeaderStyle = numberCellStyle({ background: "#e8e8e8", textAlign: "center", fontWeight: 700 });

  return (
    <thead>
      <tr>
        {leadingLabels.map((label) => (
          <th key={label} rowSpan={2} style={tableCellStyle({ background: "#f4f4f4" })}>
            {label}
          </th>
        ))}
        <th colSpan={5} style={groupHeaderStyle}>USA</th>
        <th colSpan={5} style={groupHeaderStyle}>DE</th>
        <th colSpan={5} style={groupHeaderStyle}>UK</th>
        <th colSpan={5} style={groupHeaderStyle}>GENERAL</th>
      </tr>
      <tr>
        {ROW2_LABELS.map((label, i) => (
          <th key={i} style={numberCellStyle({ background: "#f4f4f4" })}>
            {label}
          </th>
        ))}
      </tr>
    </thead>
  );
}

// Per the user (2026-09-22): every field in a region's block turns red+bold
// when that region has had no sales in the recent lookback window (reusing
// {region}_reco_debug.trailingTotal - the same trailing-3-month total
// already computed for the reco formula, rather than a separate fetch).
// This flags stagnant/dead inventory for that region independent of
// whether a reorder is actually recommended (a SKU with 0 recent sales
// usually also has a 0 reco, since the formula is sales-driven, so this is
// a genuinely different signal from the Reco cell's own red highlighting).
function hasNoRecentSales(item, region) {
  const debug = item[`${region}_reco_debug`];
  return !debug || debug.trailingTotal <= 0;
}

function RecoCell({ item, region, noSales }) {
  const recent = item[`${region}_recommended_order`];
  const seasonal1yr = item[`${region}_recommended_order_seasonal_1yr`];
  const seasonal2yr = item[`${region}_recommended_order_seasonal_2yr`];
  return (
    <td
      style={valueCellStyle({
        fontWeight: 700,
        fontSize: "13px",
        color: noSales || recent > 0 || seasonal1yr > 0 || seasonal2yr > 0 ? SAVE_ERROR_COLOR : undefined,
      })}
      title={buildRecoTooltip(item, region)}
    >
      {formatUnits(recent)}/{formatUnits(seasonal1yr)}/{formatUnits(seasonal2yr)}
    </td>
  );
}

// Days of supply, per the user (2026-09-24): same "(Bal + OTW) / avg daily
// sales" math already shown in the Reco tooltip, now its own column with all
// 3 Reco sources' daily rates (A recent, B seasonal 1yr, C seasonal 2yr) -
// answers "how many days will current stock + what's on the way last, under
// each demand assumption" alongside the "how many more units to order"
// question Reco already answers. No sales at that rate -> "∞" (infinite
// supply at a 0 burn rate), not 0 or blank.
function formatDaysOfSupply(bal, otw, avgDaily) {
  if (!avgDaily || avgDaily <= 0) return "∞";
  return Math.round((bal + otw) / avgDaily).toLocaleString();
}

function DaysOfSupplyCell({ item, region }) {
  const debug = item[`${region}_reco_debug`];
  if (!debug) return <td style={valueCellStyle()}>–</td>;
  const bal = item[`${region}_balance`] || 0;
  const otw = item[`${region}_on_the_way`] || 0;
  const a = formatDaysOfSupply(bal, otw, debug.avgDailyRecent);
  const b = formatDaysOfSupply(bal, otw, debug.avgDailySeasonal1yr);
  const c = formatDaysOfSupply(bal, otw, debug.avgDailySeasonal2yr);
  return (
    <td
      style={valueCellStyle({ fontSize: "13px" })}
      title={
        `Days of supply = (${bal} Bal + ${otw} OTW) / avg daily sales\n` +
        `A (recent, ${debug.avgDailyRecent}/day): ${a} days\n` +
        `B (seasonal 1yr, ${debug.avgDailySeasonal1yr}/day): ${b} days\n` +
        `C (seasonal 2yr, ${debug.avgDailySeasonal2yr}/day): ${c} days`
      }
    >
      {a}/{b}/{c}
    </td>
  );
}

function RegionBlock({ item, region, balanceField, otwField, nextField, onSave }) {
  const noSales = hasNoRecentSales(item, region);
  const cellStyle = noSales ? { color: SAVE_ERROR_COLOR, fontWeight: 700 } : {};
  return (
    <>
      <td style={valueCellStyle(cellStyle)}>{formatUnits(item[balanceField])}</td>
      <td style={valueCellStyle(cellStyle)}>{formatUnits(item[otwField])}</td>
      <td style={numberCellStyle(noSales ? { background: "#fff1f1" } : {})}>
        <EditableCell item={item} field={nextField} onSave={onSave} />
      </td>
      <RecoCell item={item} region={region} noSales={noSales} />
      <DaysOfSupplyCell item={item} region={region} />
    </>
  );
}

function ItemRow({ item, showAsin, onSave }) {
  const needed = computeNeeded(item);
  const missing = computeMissing(item);

  return (
    <tr>
      <td style={tableCellStyle({ padding: "2px" })}>
        <Link to={productLink(item)} target="_blank" rel="noopener noreferrer">
          <img
            src={`${IMAGE_BASE}${encodeURIComponent(item.sku)}.jpg`}
            alt={item.sku}
            style={{ width: "26px", height: "26px", objectFit: "cover", borderRadius: "4px", display: "block" }}
          />
        </Link>
      </td>
      <td style={tableCellStyle({ fontWeight: 600, wordBreak: "break-word", whiteSpace: "normal" })}>
        <Link to={productLink(item)} target="_blank" rel="noopener noreferrer" style={{ color: "inherit", textDecoration: "none" }}>
          {item.sku}
        </Link>
      </td>
      {showAsin && (
        <td style={tableCellStyle({ fontFamily: "monospace", fontSize: "10px" })}>{item.asin}</td>
      )}

      <RegionBlock item={item} region="usa" balanceField="usa_balance" otwField="usa_on_the_way" nextField="usa_next_shipment" onSave={onSave} />
      <RegionBlock item={item} region="de" balanceField="de_balance" otwField="de_on_the_way" nextField="de_next_shipment" onSave={onSave} />
      <RegionBlock item={item} region="uk" balanceField="uk_balance" otwField="uk_on_the_way" nextField="uk_next_shipment" onSave={onSave} />

      <td style={valueCellStyle()}>{formatUnits(item.malani_balance)}</td>
      <td style={valueCellStyle()}>{formatUnits(item.malani_order)}</td>

      <td style={valueCellStyle({ fontWeight: 700 })}>{formatUnits(needed)}</td>
      <td style={valueCellStyle({ fontWeight: 700, color: missing > 0 ? SAVE_ERROR_COLOR : undefined })}>
        {formatUnits(missing)}
      </td>

      <td style={numberCellStyle()}>
        <EditableCell item={item} field="next_order" onSave={onSave} />
      </td>
    </tr>
  );
}

function GroupSection({ group, showAsin, expanded, onToggle, onSave }) {
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
          {group.items.length} product{group.items.length === 1 ? "" : "s"}
        </div>
      </div>

      {expanded && (
        <div style={{ overflowX: "auto", marginTop: "12px" }}>
          <table style={{ borderCollapse: "collapse", width: "100%", tableLayout: "fixed" }}>
            <ColGroup showAsin={showAsin} />
            <TableHeader showAsin={showAsin} />
            <tbody>
              {group.items.map((item) => (
                <ItemRow key={item.sku} item={item} showAsin={showAsin} onSave={onSave} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const EXPLANATION_EXAMPLE_SKU = "PareoBlueP19";

function RecoExplanation({ nextShipmentDate, recoMeta, exampleItem }) {
  const debug = exampleItem?.usa_reco_debug;

  return (
    <div style={cardStyle()}>
      <h3 style={{ marginTop: 0 }}>How the USA Reco column is calculated</h3>
      <p style={{ fontSize: "13px", color: "#333", lineHeight: 1.6 }}>
        All three recommendations answer the same question - "how many MORE units should I still add to USA Next" -
        so <strong>0 means already covered</strong>, not "don't ship anything." They share one near-term term
        (need_for_x_days: the gap between today and when the shipment arrives) and differ only in how they forecast
        the 3 months of demand AFTER the shipment lands.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "16px", marginTop: "12px" }}>
        <div>
          <strong>A - Recent</strong>
          <p style={{ fontSize: "13px", color: "#333", lineHeight: 1.6 }}>
            Assumes the next 3 months look like the last 3.
            <br />
            x = days from today to Next Shipment Arriving Date
            <br />
            need_for_x_days = x × (last 3 months' total ÷ real days in those months)
            <br />
            need_for_3_months = last 3 months' total, used as-is
            <br />
            <strong>A = need_for_3_months + need_for_x_days − USA Bal − USA OTW − USA Next</strong>
          </p>
        </div>
        <div>
          <strong>B - Seasonal (1 year ago)</strong>
          <p style={{ fontSize: "13px", color: "#333", lineHeight: 1.6 }}>
            A seasonal product's next 3 months can look nothing like its last 3 (e.g. shipping into summer from a
            winter baseline) - so instead it looks at the ACTUAL same 3 calendar months the shipment lands into, from
            1 year ago (falls back to A's number if that year has no history for this SKU).
            <br />
            <strong>B = seasonal_1yr + need_for_x_days − USA Bal − USA OTW − USA Next</strong>
          </p>
        </div>
        <div>
          <strong>C - Seasonal (2 years ago)</strong>
          <p style={{ fontSize: "13px", color: "#333", lineHeight: 1.6 }}>
            Same idea as B, but the ACTUAL same 3 calendar months from 2 years ago instead of 1 (falls back to A's
            number if that year has no history for this SKU).
            <br />
            <strong>C = seasonal_2yr + need_for_x_days − USA Bal − USA OTW − USA Next</strong>
          </p>
        </div>
      </div>

      {exampleItem && debug && (
        <div style={{ marginTop: "16px", padding: "12px", background: "#f7f7f7", borderRadius: "6px", fontSize: "13px", lineHeight: 1.7 }}>
          <strong>
            Worked example - {exampleItem.sku} ({exampleItem.asin})
          </strong>
          <div style={{ marginTop: "6px" }}>
            Today → Next Shipment Arriving Date ({nextShipmentDate}): x = {debug.xDays} days
            <br />
            Last 3 months ({formatMonths(recoMeta?.trailingMonths)}): {debug.trailingTotal} units over{" "}
            {recoMeta?.trailingLookbackDays} days → avg {exampleItem.usa_avg_monthly_sales}/month
            <br />
            need_for_x_days = {debug.xDays} × ({debug.trailingTotal}/{recoMeta?.trailingLookbackDays}) = {debug.needForXDays}
            <br />
            USA Bal + USA OTW + USA Next = {debug.alreadyCovered}
            <br />
            <br />
            <strong>A (Recent)</strong>: {debug.trailingTotal} + {debug.needForXDays} − {debug.alreadyCovered} ={" "}
            <strong>{formatUnits(exampleItem.usa_recommended_order)}</strong>
            <br />
            <br />
            Same season 1 year ago ({formatMonths(recoMeta?.seasonalYear1Months)}): {debug.year1Total} units (
            {seasonalSourceLabel(exampleItem.usa_seasonal_1yr_source)})
            <br />
            <strong>B (Seasonal, 1yr)</strong>:{" "}
            {exampleItem.usa_seasonal_1yr_source === "actual" ? debug.year1Total : debug.trailingTotal} +{" "}
            {debug.needForXDays} − {debug.alreadyCovered} ={" "}
            <strong>{formatUnits(exampleItem.usa_recommended_order_seasonal_1yr)}</strong>
            <br />
            <br />
            Same season 2 years ago ({formatMonths(recoMeta?.seasonalYear2Months)}): {debug.year2Total} units (
            {seasonalSourceLabel(exampleItem.usa_seasonal_2yr_source)})
            <br />
            <strong>C (Seasonal, 2yr)</strong>:{" "}
            {exampleItem.usa_seasonal_2yr_source === "actual" ? debug.year2Total : debug.trailingTotal} +{" "}
            {debug.needForXDays} − {debug.alreadyCovered} ={" "}
            <strong>{formatUnits(exampleItem.usa_recommended_order_seasonal_2yr)}</strong>
          </div>
        </div>
      )}
    </div>
  );
}

// Per the user (2026-09-23): replaced the old plain-CSV export with a fully
// formatted .xlsx (bold/colored header, frozen header row + autofilter,
// right-aligned number columns, borders, and the same red highlighting
// convention the on-page table already uses for Missing>0/Next Order>0/any
// Reco>0) - same underlying columns as the old CSV, plus a Group column
// since a flat export loses that grouping context otherwise.
const XLSX_COLUMNS = [
  { header: "Group", key: "group", width: 16 },
  { header: "SKU", key: "sku", width: 26 },
  { header: "UPC", key: "upc", width: 16 },
  { header: "Supplier SKU", key: "supplierSku", width: 16 },
  { header: "USA Reco (Recent)", key: "usaRecent", width: 16 },
  { header: "USA Reco (Seasonal 1yr)", key: "usaSeasonal1yr", width: 18 },
  { header: "USA Reco (Seasonal 2yr)", key: "usaSeasonal2yr", width: 18 },
  { header: "DE Reco (Recent)", key: "deRecent", width: 15 },
  { header: "DE Reco (Seasonal 1yr)", key: "deSeasonal1yr", width: 17 },
  { header: "DE Reco (Seasonal 2yr)", key: "deSeasonal2yr", width: 17 },
  { header: "UK Reco (Recent)", key: "ukRecent", width: 15 },
  { header: "UK Reco (Seasonal 1yr)", key: "ukSeasonal1yr", width: 17 },
  { header: "UK Reco (Seasonal 2yr)", key: "ukSeasonal2yr", width: 17 },
  { header: "Missing", key: "missing", width: 12 },
  { header: "Next Order", key: "nextOrder", width: 12 },
];
const XLSX_NUMBER_KEYS = XLSX_COLUMNS.slice(4).map((c) => c.key);
const XLSX_HEADER_FILL = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F4E78" } };
const XLSX_ZEBRA_FILL = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF3F3F3" } };
const XLSX_RED_FONT = { color: { argb: "FFB00020" }, bold: true };
const XLSX_THIN_BORDER = { style: "thin", color: { argb: "FFCCCCCC" } };

async function exportXlsx(visibleGroups) {
  // Dynamically imported (rather than a top-level import) so this ~1MB
  // library's code is only fetched when the Export XLSX button is actually
  // clicked, not bundled into the page's initial load.
  const { default: ExcelJS } = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "AmzBot";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet("Next Order", {
    views: [{ state: "frozen", ySplit: 1 }],
  });
  sheet.columns = XLSX_COLUMNS;

  const headerRow = sheet.getRow(1);
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = XLSX_HEADER_FILL;
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.border = { top: XLSX_THIN_BORDER, bottom: XLSX_THIN_BORDER, left: XLSX_THIN_BORDER, right: XLSX_THIN_BORDER };
  });
  headerRow.height = 20;

  let rowIndex = 0;
  visibleGroups.forEach((group) => {
    group.items.forEach((item) => {
      rowIndex += 1;
      const missing = computeMissing(item);
      const nextOrder = item.next_order || 0;
      const row = sheet.addRow({
        group: group.group,
        sku: item.sku,
        upc: item.upc || "",
        supplierSku: item.supplier_sku || "",
        usaRecent: item.usa_recommended_order || 0,
        usaSeasonal1yr: item.usa_recommended_order_seasonal_1yr || 0,
        usaSeasonal2yr: item.usa_recommended_order_seasonal_2yr || 0,
        deRecent: item.de_recommended_order || 0,
        deSeasonal1yr: item.de_recommended_order_seasonal_1yr || 0,
        deSeasonal2yr: item.de_recommended_order_seasonal_2yr || 0,
        ukRecent: item.uk_recommended_order || 0,
        ukSeasonal1yr: item.uk_recommended_order_seasonal_1yr || 0,
        ukSeasonal2yr: item.uk_recommended_order_seasonal_2yr || 0,
        missing,
        nextOrder,
      });

      row.eachCell((cell, colNumber) => {
        cell.border = { top: XLSX_THIN_BORDER, bottom: XLSX_THIN_BORDER, left: XLSX_THIN_BORDER, right: XLSX_THIN_BORDER };
        const key = XLSX_COLUMNS[colNumber - 1].key;
        if (XLSX_NUMBER_KEYS.includes(key)) {
          cell.numFmt = "0";
          cell.alignment = { horizontal: "right" };
        }
        if (rowIndex % 2 === 0) cell.fill = XLSX_ZEBRA_FILL;
      });

      // Same red-highlight convention as the on-page table: Missing>0 and
      // Next Order>0 flag their own cell; any region's Reco>0 flags all 9
      // Reco cells together (mirroring RecoCell's own highlight logic).
      if (missing > 0) row.getCell("missing").font = XLSX_RED_FONT;
      if (nextOrder > 0) row.getCell("nextOrder").font = XLSX_RED_FONT;
      const anyReco = XLSX_NUMBER_KEYS.slice(0, 9).some((key) => Number(row.getCell(key).value || 0) > 0);
      if (anyReco) {
        XLSX_NUMBER_KEYS.slice(0, 9).forEach((key) => {
          row.getCell(key).font = XLSX_RED_FONT;
        });
      }
    });
  });

  sheet.autoFilter = { from: "A1", to: `${sheet.getColumn(XLSX_COLUMNS.length).letter}1` };

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `next-order-${new Date().toISOString().slice(0, 10)}.xlsx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export default function NextOrderPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [groups, setGroups] = useState([]);
  const [collapsedGroups, setCollapsedGroups] = useState({});
  const [showAsin, setShowAsin] = useState(false);
  const [filterMissing, setFilterMissing] = useState(false);
  const [filterNextOrder, setFilterNextOrder] = useState(false);
  const [filterReco, setFilterReco] = useState(false);
  const [nextShipmentDate, setNextShipmentDate] = useState("");
  const [dateSaveStatus, setDateSaveStatus] = useState("idle"); // idle | saving | saved | error
  const [recoMeta, setRecoMeta] = useState(null); // { trailingMonths, seasonalYear1Months, seasonalYear2Months }

  async function loadData() {
    setLoading(true);
    setError("");

    try {
      const response = await fetch(`${API_BASE}/GetNextOrderData`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || `HTTP ${response.status}`);
      }

      setGroups(data.groups || []);
      setNextShipmentDate(data.nextShipmentDate || "");
      setRecoMeta({
        trailingMonths: data.trailingMonths || [],
        trailingLookbackDays: data.trailingLookbackDays || 0,
        seasonalYear1Months: data.seasonalYear1Months || [],
        seasonalYear2Months: data.seasonalYear2Months || [],
      });

      const allCollapsed = {};
      (data.groups || []).forEach((g) => {
        allCollapsed[g.group] = true;
      });
      setCollapsedGroups(allCollapsed);
    } catch (err) {
      setError(err.message || "Failed to load next order data");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    const root = document.getElementById("root");
    root?.classList.add("full-bleed");
    return () => root?.classList.remove("full-bleed");
  }, []);

  async function saveField(sku, field, value) {
    const response = await fetch(`${API_BASE}/UpdateNextOrderField`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sku, field, value }),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data?.error || `HTTP ${response.status}`);
    }

    setGroups((prev) =>
      prev.map((g) => ({
        ...g,
        items: g.items.map((item) => (item.sku === sku ? { ...item, [field]: value } : item)),
      }))
    );
  }

  async function saveNextShipmentDate(newDate) {
    setNextShipmentDate(newDate);
    setDateSaveStatus("saving");
    try {
      const response = await fetch(`${API_BASE}/UpdateNextShipmentDate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: newDate }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || `HTTP ${response.status}`);
      }
      setDateSaveStatus("saved");
      setTimeout(() => setDateSaveStatus((s) => (s === "saved" ? "idle" : s)), 1200);
      // The USA Reco column depends on this date (coverage window), so
      // reload everything to get recomputed recommendations rather than
      // leaving the table showing values based on the old date.
      loadData();
    } catch (err) {
      setDateSaveStatus("error");
      setError(err.message || "Failed to save next shipment date");
    }
  }

  function toggleGroup(name) {
    setCollapsedGroups((prev) => ({ ...prev, [name]: !prev[name] }));
  }

  function expandAll() {
    setCollapsedGroups({});
  }

  function collapseAll() {
    const next = {};
    groups.forEach((g) => {
      next[g.group] = true;
    });
    setCollapsedGroups(next);
  }


  // Split into 3 independent checkboxes per the user (2026-09-23) - was one
  // combined "Missing>0 OR Next Order>0 OR any Reco>0" checkbox. Whichever
  // of the 3 are checked are OR'd together (same combined semantics as
  // before when all 3 happened to be on at once); none checked shows every row.
  function makeToggleFilter(setter) {
    return () =>
      setter((v) => {
        const next = !v;
        if (next) expandAll(); // surface the filtered rows immediately instead of leaving groups collapsed
        return next;
      });
  }
  const toggleFilterMissing = makeToggleFilter(setFilterMissing);
  const toggleFilterNextOrder = makeToggleFilter(setFilterNextOrder);
  const toggleFilterReco = makeToggleFilter(setFilterReco);

  const anyFilterActive = filterMissing || filterNextOrder || filterReco;

  function itemHasRecoAbove0(item) {
    return (
      Number(item.usa_recommended_order || 0) > 0 ||
      Number(item.usa_recommended_order_seasonal_1yr || 0) > 0 ||
      Number(item.usa_recommended_order_seasonal_2yr || 0) > 0 ||
      Number(item.de_recommended_order || 0) > 0 ||
      Number(item.de_recommended_order_seasonal_1yr || 0) > 0 ||
      Number(item.de_recommended_order_seasonal_2yr || 0) > 0 ||
      Number(item.uk_recommended_order || 0) > 0 ||
      Number(item.uk_recommended_order_seasonal_1yr || 0) > 0 ||
      Number(item.uk_recommended_order_seasonal_2yr || 0) > 0
    );
  }

  const visibleGroups = useMemo(() => {
    if (!anyFilterActive) return groups;
    return groups
      .map((g) => ({
        ...g,
        items: g.items.filter(
          (item) =>
            (filterMissing && computeMissing(item) > 0) ||
            (filterNextOrder && Number(item.next_order || 0) > 0) ||
            (filterReco && itemHasRecoAbove0(item))
        ),
      }))
      .filter((g) => g.items.length > 0);
  }, [groups, filterMissing, filterNextOrder, filterReco, anyFilterActive]);

  const exampleItem = useMemo(() => {
    for (const g of groups) {
      const found = g.items.find((item) => item.sku === EXPLANATION_EXAMPLE_SKU);
      if (found) return found;
    }
    return null;
  }, [groups]);

  // Same "clamp at 0" convention as the backend's x_days (an overdue date
  // shouldn't show as negative) - computed client-side since it's pure
  // today-vs-the-date math with no server data needed.
  const daysUntilShipment = useMemo(() => {
    if (!nextShipmentDate) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(`${nextShipmentDate}T00:00:00`);
    return Math.max(0, Math.round((target - today) / (1000 * 60 * 60 * 24)));
  }, [nextShipmentDate]);

  return (
    <div
      style={{
        padding: "10px",
        fontFamily: "Arial, sans-serif",
        minHeight: "100vh",
        background: "#fafafa",
      }}
    >
      <h2 style={{ textAlign: "center", marginBottom: "12px" }}>Next Order</h2>

      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          gap: "10px",
          marginBottom: "20px",
          fontSize: "14px",
        }}
      >
        <label htmlFor="next-shipment-date" style={{ fontWeight: 600 }}>
          Next Shipment Arriving Date:
        </label>
        <input
          id="next-shipment-date"
          type="date"
          value={nextShipmentDate}
          onChange={(e) => e.target.value && saveNextShipmentDate(e.target.value)}
          style={{
            padding: "4px 8px",
            borderRadius: "4px",
            border: `1px solid ${STATUS_BORDER[dateSaveStatus]}`,
            colorScheme: "light",
            fontSize: "14px",
          }}
        />
        {dateSaveStatus === "saving" && <span style={{ color: "#888" }}>Saving...</span>}
        {dateSaveStatus === "saved" && <span style={{ color: SAVE_OK_COLOR }}>Saved</span>}
        {daysUntilShipment !== null && (
          <span style={{ fontWeight: 600, color: "#333" }}>
            ({daysUntilShipment} day{daysUntilShipment === 1 ? "" : "s"} left)
          </span>
        )}
        <span style={{ color: "#777" }}>
          (used to compute the USA Reco column - see the explanation and worked example at the bottom of the page)
        </span>
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

      {loading && <div style={{ marginBottom: "20px", textAlign: "center" }}>Loading...</div>}

      {!loading && groups.length > 0 && (
        <div style={{ display: "grid", gap: "18px" }}>
          <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
            <button style={ghostButtonStyle()} onClick={expandAll}>
              Expand All Groups
            </button>
            <button style={ghostButtonStyle()} onClick={collapseAll}>
              Collapse All Groups
            </button>
            <button style={ghostButtonStyle()} onClick={() => exportXlsx(visibleGroups)}>
              Export XLSX
            </button>
            <label style={{ display: "flex", alignItems: "center", gap: "6px", marginLeft: "auto", fontSize: "14px" }}>
              <input type="checkbox" checked={filterMissing} onChange={toggleFilterMissing} />
              Only show Missing &gt; 0
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "14px" }}>
              <input type="checkbox" checked={filterNextOrder} onChange={toggleFilterNextOrder} />
              Only show Next Order &gt; 0
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "14px" }}>
              <input type="checkbox" checked={filterReco} onChange={toggleFilterReco} />
              Only show any Reco &gt; 0
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "14px" }}>
              <input type="checkbox" checked={showAsin} onChange={() => setShowAsin((v) => !v)} />
              Show ASIN column
            </label>
          </div>

          {anyFilterActive && visibleGroups.length === 0 && (
            <div style={{ textAlign: "center", color: "#555" }}>No rows match the selected filter(s).</div>
          )}

          {visibleGroups.map((group) => (
            <GroupSection
              key={group.group}
              group={group}
              showAsin={showAsin}
              expanded={!collapsedGroups[group.group]}
              onToggle={() => toggleGroup(group.group)}
              onSave={saveField}
            />
          ))}
        </div>
      )}

      {!loading && (
        <div style={{ maxWidth: "1400px", marginInline: "auto", marginTop: "24px" }}>
          <RecoExplanation nextShipmentDate={nextShipmentDate} recoMeta={recoMeta} exampleItem={exampleItem} />
        </div>
      )}

      <div style={bottomNavStyle()}>
        <Link style={blueButtonStyle()} to="/">
          Home
        </Link>
        <Link style={blueButtonStyle()} to="/sales">
          Sales
        </Link>
      </div>
    </div>
  );
}
