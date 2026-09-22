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
// horizontal scroll needed on a normal laptop/desktop viewport.
const COLUMN_WIDTHS_WITH_ASIN = [4, 10, 4, 4, 4, 5, 6, 4, 4, 5, 6, 4, 4, 5, 6, 4, 4, 5, 6, 6];
// ASIN's width folded into SKU when the column is hidden.
const COLUMN_WIDTHS_NO_ASIN = [4, 14, 4, 4, 5, 6, 4, 4, 5, 6, 4, 4, 5, 6, 4, 4, 5, 6, 6];

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
    case "2yr_avg":
      return "average of the last 2 years' same season";
    case "1yr_only":
      return "last year's same season only (2 years ago has no history for this SKU)";
    case "2yr_only":
      return "2 years ago's same season only (last year has no history for this SKU)";
    case "fallback_recent":
      return "no seasonal history yet for this SKU - showing the recent-based value instead";
    default:
      return "";
  }
}

function seasonal3moFromDebug(seasonalSource, debug) {
  switch (seasonalSource) {
    case "2yr_avg":
      return (debug.year1Total + debug.year2Total) / 2;
    case "1yr_only":
      return debug.year1Total;
    case "2yr_only":
      return debug.year2Total;
    default:
      return debug.trailingTotal;
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
  const seasonalSource = item[`${region}_seasonal_source`];
  const recommendedOrder = item[`${region}_recommended_order`];
  const recommendedOrderSeasonal = item[`${region}_recommended_order_seasonal`];
  const daysOfSupply = debug.avgDailyRecent > 0 ? ((bal + otw) / debug.avgDailyRecent).toFixed(1) : "∞ (no recent sales)";

  const seasonal3mo = seasonal3moFromDebug(seasonalSource, debug);
  const rawA = Math.max(0, Math.round(debug.trailingTotal + debug.needForXDays - debug.alreadyCovered));
  const rawB = Math.max(0, Math.round(seasonal3mo + debug.needForXDays - debug.alreadyCovered));
  const aZeroedNote = rawA > 0 && recommendedOrder === 0 ? " → zeroed out (below half the minimum order size)" : "";
  const bZeroedNote = rawB > 0 && recommendedOrderSeasonal === 0 ? " → zeroed out (below half the minimum order size)" : "";

  const stockoutNote = debug.zeroInventoryWeeks > 0
    ? `\n(excludes ${debug.zeroInventoryWeeks} week${debug.zeroInventoryWeeks === 1 ? "" : "s"} of zero ${region.toUpperCase()} stock from the recent-avg calc)`
    : "";

  return (
    `Days of supply: (${bal} + ${otw}) / ${debug.avgDailyRecent}/day = ${daysOfSupply} days\n` +
    `Days to next order: ${debug.xDays} days\n\n` +
    `Avg daily sales used for A (recent): ${debug.avgDailyRecent}/day${stockoutNote}\n` +
    `Avg daily sales used for B (seasonal): ${debug.avgDailySeasonal}/day\n\n` +
    `A (Recent) = ${debug.trailingTotal} + ${debug.needForXDays} - ${debug.alreadyCovered} = ${rawA}${aZeroedNote}\n` +
    `B (Seasonal, ${seasonalSourceLabel(seasonalSource)}) = ${seasonal3mo} + ${debug.needForXDays} - ${debug.alreadyCovered} = ${rawB}${bZeroedNote}`
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
const REGION_SUBLABELS = ["Bal", "OTW", "Next", "Reco (A/B)"];
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
        <th colSpan={4} style={groupHeaderStyle}>USA</th>
        <th colSpan={4} style={groupHeaderStyle}>DE</th>
        <th colSpan={4} style={groupHeaderStyle}>UK</th>
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
  const seasonal = item[`${region}_recommended_order_seasonal`];
  return (
    <td
      style={valueCellStyle({
        fontWeight: 700,
        fontSize: "13px",
        color: noSales || recent > 0 || seasonal > 0 ? SAVE_ERROR_COLOR : undefined,
      })}
      title={buildRecoTooltip(item, region)}
    >
      {formatUnits(recent)}/{formatUnits(seasonal)}
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
        Both recommendations answer the same question - "how many MORE units should I still add to USA Next" - so{" "}
        <strong>0 means already covered</strong>, not "don't ship anything." They share one near-term term
        (need_for_x_days: the gap between today and when the shipment arrives) and differ only in how they forecast
        the 3 months of demand AFTER the shipment lands.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginTop: "12px" }}>
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
          <strong>B - Seasonal</strong>
          <p style={{ fontSize: "13px", color: "#333", lineHeight: 1.6 }}>
            A seasonal product's next 3 months can look nothing like its last 3 (e.g. shipping into summer from a
            winter baseline) - so instead it looks at the ACTUAL same 3 calendar months the shipment lands into, from
            1 and 2 years ago (averaged; falls back to whichever single year has history, or to A's number if neither
            year does).
            <br />
            <strong>B = seasonal_3_months + need_for_x_days − USA Bal − USA OTW − USA Next</strong>
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
            Same season 1 year ago ({formatMonths(recoMeta?.seasonalYear1Months)}): {debug.year1Total} units
            <br />
            Same season 2 years ago ({formatMonths(recoMeta?.seasonalYear2Months)}): {debug.year2Total} units
            <br />
            seasonal_3_months ({seasonalSourceLabel(exampleItem.usa_seasonal_source)}) ={" "}
            {exampleItem.usa_seasonal_source === "2yr_avg"
              ? `(${debug.year1Total} + ${debug.year2Total}) / 2 = ${(debug.year1Total + debug.year2Total) / 2}`
              : exampleItem.usa_seasonal_source === "1yr_only"
              ? debug.year1Total
              : exampleItem.usa_seasonal_source === "2yr_only"
              ? debug.year2Total
              : debug.trailingTotal}
            <br />
            <strong>B (Seasonal)</strong>: seasonal_3_months + {debug.needForXDays} − {debug.alreadyCovered} ={" "}
            <strong>{formatUnits(exampleItem.usa_recommended_order_seasonal)}</strong>
          </div>
        </div>
      )}
    </div>
  );
}

export default function NextOrderPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [groups, setGroups] = useState([]);
  const [collapsedGroups, setCollapsedGroups] = useState({});
  const [showAsin, setShowAsin] = useState(false);
  const [onlyMissing, setOnlyMissing] = useState(false);
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

  function exportCsv() {
    const rows = [[
      "SKU", "UPC", "Supplier SKU",
      "USA Reco (Recent)", "USA Reco (Seasonal)",
      "DE Reco (Recent)", "DE Reco (Seasonal)",
      "UK Reco (Recent)", "UK Reco (Seasonal)",
      "Missing", "Next Order",
    ]];
    visibleGroups.forEach((group) => {
      group.items.forEach((item) => {
        rows.push([
          item.sku,
          item.upc || "",
          item.supplier_sku || "",
          item.usa_recommended_order || 0,
          item.usa_recommended_order_seasonal || 0,
          item.de_recommended_order || 0,
          item.de_recommended_order_seasonal || 0,
          item.uk_recommended_order || 0,
          item.uk_recommended_order_seasonal || 0,
          computeMissing(item),
          item.next_order || 0,
        ]);
      });
    });

    const csv = rows
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\r\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `next-order-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  function toggleOnlyMissing() {
    setOnlyMissing((v) => {
      const next = !v;
      if (next) expandAll(); // surface the filtered rows immediately instead of leaving groups collapsed
      return next;
    });
  }

  const visibleGroups = useMemo(() => {
    if (!onlyMissing) return groups;
    return groups
      .map((g) => ({
        ...g,
        items: g.items.filter(
          (item) =>
            computeMissing(item) > 0 ||
            Number(item.next_order || 0) > 0 ||
            Number(item.usa_recommended_order || 0) > 0 ||
            Number(item.usa_recommended_order_seasonal || 0) > 0 ||
            Number(item.de_recommended_order || 0) > 0 ||
            Number(item.de_recommended_order_seasonal || 0) > 0 ||
            Number(item.uk_recommended_order || 0) > 0 ||
            Number(item.uk_recommended_order_seasonal || 0) > 0
        ),
      }))
      .filter((g) => g.items.length > 0);
  }, [groups, onlyMissing]);

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
            <button style={ghostButtonStyle()} onClick={exportCsv}>
              Export CSV
            </button>
            <label style={{ display: "flex", alignItems: "center", gap: "6px", marginLeft: "auto", fontSize: "14px" }}>
              <input type="checkbox" checked={onlyMissing} onChange={toggleOnlyMissing} />
              Only show Missing &gt; 0 or Next Order &gt; 0 or any Reco &gt; 0
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "14px" }}>
              <input type="checkbox" checked={showAsin} onChange={() => setShowAsin((v) => !v)} />
              Show ASIN column
            </label>
          </div>

          {onlyMissing && visibleGroups.length === 0 && (
            <div style={{ textAlign: "center", color: "#555" }}>No rows with Missing &gt; 0.</div>
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
