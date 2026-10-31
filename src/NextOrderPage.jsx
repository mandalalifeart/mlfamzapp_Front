import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { buttonStyle, ghostButtonStyle } from "./buttonStyle";
import FamilySection from "./FamilySection";
import { FAMILIES, familyOf, orderFamilyGroups } from "./productFamilies";
import { balanceTooltip, buildRecoTooltip, daysOfSupplyTooltip, formatDaysOfSupply } from "./recoTooltip";

function productLink(item) {
  return `/product?sku=${encodeURIComponent(item.sku)}`;
}

// PocketBase-only functions run on the mini PC that already hosts
// PocketBase, instead of GCP - see CLAUDE.md "AmzBot: local job runner".
const API_BASE = "https://amzapi.mandalalifeart.com";

const IMAGE_BASE = "https://storage.googleapis.com/mlf-amz-images/";

const SAVE_ERROR_COLOR = "#b00020";
const SAVE_OK_COLOR = "#2e7d32";

// Relative column weights (turned into percentages per table) - the table
// uses table-layout:fixed so everything stays inside one screen width.
// Per the user (2026-10-03) a region (USA/DE/UK) can be expanded by clicking
// its header: it gains yearly sales + ACOS columns, and the other regions
// and GENERAL are hidden (2026-10-03 follow-up) until it's clicked again.
const ALL_REGIONS = [
  { key: "usa", label: "USA", balanceField: "usa_balance", otwField: "usa_on_the_way", nextField: "usa_next_shipment" },
  { key: "de", label: "DE", balanceField: "de_balance", otwField: "de_on_the_way", nextField: "de_next_shipment" },
  { key: "uk", label: "UK", balanceField: "uk_balance", otwField: "uk_on_the_way", nextField: "uk_next_shipment" },
  { key: "au", label: "AU", balanceField: "au_balance", otwField: "au_on_the_way", nextField: "au_next_shipment" },
  { key: "jp", label: "JP", balanceField: "jp_balance", otwField: "jp_on_the_way", nextField: "jp_next_shipment" },
];
// AU (2026-10-20, per the user) stays hidden while no AU SKU has sellable
// stock (first shipment still on the way) - the page sets this once per
// render via setShowAu, with a manual "show AU" link meanwhile.
// JP (2026-10-30, per the user "same as au") works the same way: hidden
// until it has stock or "show JP" is clicked.
let REGIONS = ALL_REGIONS.filter((r) => r.key !== "au" && r.key !== "jp");

function setShownOptionalRegions(shown) {
  REGIONS = ALL_REGIONS.filter((r) => (r.key !== "au" && r.key !== "jp") || shown[r.key]);
}
const REGION_COL_WEIGHTS = [3, 3, 4, 6, 6];
const EXTRA_COL_WEIGHTS = [4, 4, 4, 5, 5, 5, 4];
const GENERAL_COL_WEIGHTS = [3, 3, 4, 5, 5];
// GENERAL can be expanded too (2026-10-06, per the user): regions hide and
// GENERAL gains supplier SKU, total stock and total units sold per year.
const GENERAL_EXTRA_COL_WEIGHTS = [6, 4, 4, 4, 4];
const GENERAL_EXTRA_LABELS = ["Supplier SKU", "Stock all (Bal+OTW)"];

function regionColumnCount(region, focusRegion) {
  if (!focusRegion) return REGION_COL_WEIGHTS.length;
  if (focusRegion === "general") return 0;
  return region === focusRegion ? REGION_COL_WEIGHTS.length + EXTRA_COL_WEIGHTS.length : 0;
}

function columnWeights(showAsin, focusRegion) {
  const lead = showAsin ? [3, 8, 3] : [3, 11];
  const regions = REGIONS.flatMap((r) => {
    if (!focusRegion) return REGION_COL_WEIGHTS;
    return r.key === focusRegion ? [...REGION_COL_WEIGHTS, ...EXTRA_COL_WEIGHTS] : [];
  });
  if (focusRegion === "general") return [...lead, ...GENERAL_COL_WEIGHTS, ...GENERAL_EXTRA_COL_WEIGHTS];
  return [...lead, ...regions, ...(focusRegion ? [] : GENERAL_COL_WEIGHTS)];
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

// Reco/DoS hover text is shared with the Product page - see recoTooltip.js
// (in-stock-days rates, Reco = demand - Bal - OTW, per the user 2026-10-03).
function recoTooltipFor(item, region) {
  return buildRecoTooltip(item[`${region}_reco_debug`], {
    bal: item[`${region}_balance`] || 0,
    otw: item[`${region}_on_the_way`] || 0,
    region,
    recos: [
      item[`${region}_recommended_order`],
      item[`${region}_recommended_order_seasonal_1yr`],
      item[`${region}_recommended_order_seasonal_2yr`],
    ],
    sources: [item[`${region}_seasonal_1yr_source`], item[`${region}_seasonal_2yr_source`]],
  });
}

// needed = sum of the three "next shipment" quantities being planned across markets.
function computeNeeded(item) {
  return (item.uk_next_shipment || 0) + (item.de_next_shipment || 0) + (item.usa_next_shipment || 0) + (item.au_next_shipment || 0) + (item.jp_next_shipment || 0);
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

// Pill-shaped on/off filter toggle for the Next Order toolbar.
function FilterChip({ active, onClick, label }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "6px 14px",
        borderRadius: "999px",
        border: `1px solid ${active ? "#1565c0" : "#bbb"}`,
        background: active ? "#1565c0" : "#fff",
        color: active ? "#fff" : "#333",
        fontSize: "13px",
        fontWeight: 600,
        cursor: "pointer",
        whiteSpace: "nowrap",
      }}
    >
      {active ? "✓ " : ""}
      {label}
    </button>
  );
}

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

function ColGroup({ showAsin, focusRegion }) {
  const weights = columnWeights(showAsin, focusRegion);
  const total = weights.reduce((a, b) => a + b, 0);
  return (
    <colgroup>
      {weights.map((w, i) => (
        <col key={i} style={{ width: `${(100 * w) / total}%` }} />
      ))}
    </colgroup>
  );
}

function TableHeader({ showAsin, focusRegion, onFocusRegion, salesYears }) {
  const leadingLabels = showAsin ? ["Image", "SKU", "ASIN"] : ["Image", "SKU"];
  const groupHeaderStyle = numberCellStyle({ background: "#e8e8e8", textAlign: "center", fontWeight: 700 });
  const years = salesYears || [];
  const row2 = [];
  REGIONS.forEach((r) => {
    if (focusRegion && r.key !== focusRegion) {
      // hidden while another region is expanded
    } else {
      row2.push(...REGION_SUBLABELS);
      if (r.key === focusRegion) {
        row2.push(`${years[0] ?? ""} (YTD)`, `${years[1] ?? ""}`, `${years[2] ?? ""}`, "Ads ACOS (YTD)", "Sold via ads (YTD)", "TACOS (YTD)", "Malani Bal");
      }
    }
  });
  if (!focusRegion || focusRegion === "general") row2.push(...GENERAL_SUBLABELS);
  if (focusRegion === "general") {
    row2.push(...GENERAL_EXTRA_LABELS, `Sold ${years[0] ?? ""} (YTD)`, `Sold ${years[1] ?? ""}`, `Sold ${years[2] ?? ""}`);
  }

  return (
    <thead>
      <tr>
        {leadingLabels.map((label) => (
          <th key={label} rowSpan={2} style={tableCellStyle({ background: "#f4f4f4" })}>
            {label}
          </th>
        ))}
        {REGIONS.filter((r) => !focusRegion || r.key === focusRegion).map((r) => {
          const focused = focusRegion === r.key;
          return (
            <th
              key={r.key}
              colSpan={regionColumnCount(r.key, focusRegion)}
              onClick={() => onFocusRegion(focused ? null : r.key)}
              title={focused ? "Click to show all regions again" : `Click to expand ${r.label}: yearly sales, ads ACOS and units sold via ads (other regions and GENERAL are hidden)`}
              style={{ ...groupHeaderStyle, cursor: "pointer", userSelect: "none", background: focused ? "#d6e4f5" : "#e8e8e8" }}
            >
              {focused ? `${r.label} ▾ (click to show all)` : `${r.label} ▸`}
            </th>
          );
        })}
        {(!focusRegion || focusRegion === "general") && (
          <th
            colSpan={GENERAL_SUBLABELS.length + (focusRegion === "general" ? GENERAL_EXTRA_COL_WEIGHTS.length : 0)}
            onClick={() => onFocusRegion(focusRegion === "general" ? null : "general")}
            title={focusRegion === "general" ? "Click to show all regions again" : "Click to expand GENERAL: supplier SKU, total stock and total units sold per year (regions are hidden)"}
            style={{ ...groupHeaderStyle, cursor: "pointer", userSelect: "none", background: focusRegion === "general" ? "#d6e4f5" : "#e8e8e8" }}
          >
            {focusRegion === "general" ? "GENERAL ▾ (click to show all)" : "GENERAL ▸"}
          </th>
        )}
      </tr>
      <tr>
        {row2.map((label, i) => (
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
      title={recoTooltipFor(item, region)}
    >
      {formatUnits(recent)}/{formatUnits(seasonal1yr)}/{formatUnits(seasonal2yr)}
    </td>
  );
}

// Days of supply A/B/C = (Bal + OTW) / the matching sales-per-day (in-stock
// days only, per the user 2026-10-03). No sales -> "∞".
function DaysOfSupplyCell({ item, region }) {
  const debug = item[`${region}_reco_debug`];
  if (!debug) return <td style={valueCellStyle()}>–</td>;
  const bal = item[`${region}_balance`] || 0;
  const otw = item[`${region}_on_the_way`] || 0;
  const a = formatDaysOfSupply(bal, otw, debug.avgDailyRecent);
  const b = formatDaysOfSupply(bal, otw, debug.avgDailySeasonal1yr);
  const c = formatDaysOfSupply(bal, otw, debug.avgDailySeasonal2yr);
  return (
    <td style={valueCellStyle({ fontSize: "13px" })} title={daysOfSupplyTooltip(debug, bal, otw)}>
      {a}/{b}/{c}
    </td>
  );
}

// Ads ACOS (Amazon's own spend / 7-day sales, same as Seller Central) for
// this product in the region, this year - red above 50% (the user's own pause
// threshold), green at 30% or below. Tooltip adds the last 30 days.
function AcosCell({ ads }) {
  if (!ads || (!ads.spendYtd && !ads.salesYtd)) return <td style={valueCellStyle({ fontSize: "13px", color: "#999" })}>–</td>;
  const acos = ads.acosYtd;
  const color = acos === null ? SAVE_ERROR_COLOR : acos > 50 ? SAVE_ERROR_COLOR : acos <= 30 ? SAVE_OK_COLOR : undefined;
  const fmt = (v) => (v === null || v === undefined ? "no sales" : `${v}%`);
  return (
    <td
      style={valueCellStyle({ fontSize: "13px", fontWeight: 700, color })}
      title={
        `This year: ACOS ${fmt(ads.acosYtd)} (spend ${ads.spendYtd.toLocaleString()} / ad sales ${ads.salesYtd.toLocaleString()})\n` +
        `Last 30 days: ACOS ${fmt(ads.acos30d)} (spend ${ads.spend30d.toLocaleString()} / ad sales ${ads.sales30d.toLocaleString()})\n` +
        "USA includes Canada/Mexico (converted to USD)."
      }
    >
      {acos === null ? "∞" : `${Math.round(acos)}%`}
    </td>
  );
}

// Units of this product sold through ads this year (Amazon's exact-SKU
// "units sold" from Sep 2026 on; before that Amazon's ad orders, which can
// include other products bought after the click). Share = of all units sold
// this year in the region.
function AdUnitsCell({ ads, yearUnits }) {
  if (!ads || (!ads.spendYtd && !ads.unitsYtd)) return <td style={valueCellStyle({ fontSize: "13px", color: "#999" })}>–</td>;
  const share = yearUnits ? Math.round((100 * ads.unitsYtd) / yearUnits) : null;
  return (
    <td
      style={valueCellStyle({ fontSize: "13px" })}
      title={
        `Sold via ads this year: ${ads.unitsYtd} of ${yearUnits || 0} units${share !== null ? ` (${share}%)` : ""}\n` +
        `Last 30 days via ads: ${ads.units30d}\n` +
        "Exact product units from Sep 2026; earlier months use Amazon's ad orders (can include other products)."
      }
    >
      {ads.unitsYtd}
      {share !== null && <span style={{ fontSize: "10px", color: "#666" }}> ({share}%)</span>}
    </td>
  );
}

// TACOS = ad spend / all sales of this product in the region this year
// (organic + ads, Business Reports) - per the user 2026-10-23. Same colours
// as the weekly review's TACOS targets: green <= 20%, red > 35%.
function TacosCell({ tacos }) {
  if (!tacos || (!tacos.spendYtd && !tacos.totalSalesYtd)) return <td style={valueCellStyle({ fontSize: "13px", color: "#999" })}>–</td>;
  const v = tacos.tacosYtd;
  const color = v === null ? SAVE_ERROR_COLOR : v > 35 ? SAVE_ERROR_COLOR : v <= 20 ? SAVE_OK_COLOR : undefined;
  return (
    <td
      style={valueCellStyle({ fontSize: "13px", fontWeight: 700, color })}
      title={
        `This year: TACOS ${v === null ? "no sales" : `${v}%`} (ad spend ${tacos.spendYtd.toLocaleString()} / all sales ${tacos.totalSalesYtd.toLocaleString()})\n` +
        "All sales = organic + ads (Business Reports, ~2 days behind). Ad spend = Sponsored Products + Display only (Sponsored Brands has no per-product spend). USA includes Canada/Mexico (converted to USD)."
      }
    >
      {v === null ? "∞" : `${Math.round(v)}%`}
    </td>
  );
}

function RegionBlock({ item, region, balanceField, otwField, nextField, onSave, focusRegion }) {
  const noSales = hasNoRecentSales(item, region);
  const cellStyle = noSales ? { color: SAVE_ERROR_COLOR, fontWeight: 700 } : {};
  const nextCell = (
    <td style={numberCellStyle(noSales ? { background: "#fff1f1" } : {})}>
      <EditableCell item={item} field={nextField} onSave={onSave} />
    </td>
  );
  if (focusRegion && focusRegion !== region) return null;
  const yearly = item[`${region}_yearly_sales`] || [];
  return (
    <>
      <td style={valueCellStyle(cellStyle)} title={balanceTooltip(item[`${region}_balance_parts`])}>
        {formatUnits(item[balanceField])}
      </td>
      <td style={valueCellStyle(cellStyle)}>{formatUnits(item[otwField])}</td>
      {nextCell}
      <RecoCell item={item} region={region} noSales={noSales} />
      <DaysOfSupplyCell item={item} region={region} />
      {focusRegion === region && (
        <>
          <td style={valueCellStyle({ background: "#f5f9ff" })}>{formatUnits(yearly[0])}</td>
          <td style={valueCellStyle({ background: "#f5f9ff" })}>{formatUnits(yearly[1])}</td>
          <td style={valueCellStyle({ background: "#f5f9ff" })}>{formatUnits(yearly[2])}</td>
          <AcosCell ads={item[`${region}_ads`]} />
          <AdUnitsCell ads={item[`${region}_ads`]} yearUnits={yearly[0]} />
          <TacosCell tacos={item[`${region}_tacos`]} />
          <td style={valueCellStyle({ background: "#fbf7ee" })} title="Stock held at Malani (same for every region)">{formatUnits(item.malani_balance)}</td>
        </>
      )}
    </>
  );
}

function GeneralExtraCells({ item }) {
  const stock = REGIONS.reduce((sum, r) => sum + (item[r.balanceField] || 0) + (item[r.otwField] || 0), 0);
  const parts = REGIONS.map((r) => `${r.label} ${(item[r.balanceField] || 0) + (item[r.otwField] || 0)}`).join(" · ");
  const sold = [0, 1, 2].map((i) => REGIONS.reduce((sum, r) => sum + ((item[`${r.key}_yearly_sales`] || [])[i] || 0), 0));
  return (
    <>
      <td style={tableCellStyle({ fontSize: "11px", wordBreak: "break-word", whiteSpace: "normal" })}>{item.supplier_sku || "-"}</td>
      <td style={valueCellStyle({ fontWeight: 700 })} title={parts}>{formatUnits(stock)}</td>
      {sold.map((n, i) => (
        <td key={i} style={valueCellStyle()}>{formatUnits(n)}</td>
      ))}
    </>
  );
}

function ItemRow({ item, showAsin, onSave, focusRegion, onAddToMalani }) {
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

      {REGIONS.map((r) => (
        <RegionBlock
          key={r.key}
          item={item}
          region={r.key}
          balanceField={r.balanceField}
          otwField={r.otwField}
          nextField={r.nextField}
          onSave={onSave}
          focusRegion={focusRegion}
        />
      ))}

      {(!focusRegion || focusRegion === "general") && (
        <>
          <td style={valueCellStyle()}>{formatUnits(item.malani_balance)}</td>
          <td style={valueCellStyle()}>{formatUnits(item.malani_order)}</td>

          <td style={valueCellStyle({ fontWeight: 700 })}>{formatUnits(needed)}</td>
          <td style={valueCellStyle({ fontWeight: 700, color: missing > 0 ? SAVE_ERROR_COLOR : undefined })}>
            {formatUnits(missing)}
          </td>

          <td style={numberCellStyle()}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: "3px" }}>
              <EditableCell key={`no-${item.next_order}`} item={item} field="next_order" onSave={onSave} />
              {Number(item.next_order || 0) > 0 && (
                <button
                  onClick={() => onAddToMalani(item)}
                  title={`Add ${item.next_order} to Malani Order (then Next Order = 0)`}
                  style={{ border: "none", background: "none", cursor: "pointer", padding: 0, fontSize: "13px", lineHeight: 1 }}
                >
                  ➕
                </button>
              )}
            </span>
          </td>
        </>
      )}
      {focusRegion === "general" && <GeneralExtraCells item={item} />}
    </tr>
  );
}

// Group / segment totals (2026-10-18, per the user "add the total per group
// and segment"): sum of each region's Next column plus the GENERAL Next Order.
const TOTAL_FIELDS = [
  ["USA", "usa_next_shipment"],
  ["DE", "de_next_shipment"],
  ["UK", "uk_next_shipment"],
  ["AU", "au_next_shipment"],
  ["JP", "jp_next_shipment"],
  ["Next Order", "next_order"],
];

function NextTotals({ items }) {
  const sums = TOTAL_FIELDS.filter(([label]) => !["AU", "JP"].includes(label) || REGIONS.some((r) => r.label === label)).map(([label, key]) => [label, items.reduce((a, it) => a + (Number(it[key]) || 0), 0)]);
  return (
    <span style={{ fontSize: "13px", color: "#333" }}>
      <b>Next:</b>{" "}
      {sums.map(([label, v], i) => (
        <span key={label} style={{ marginLeft: i ? "10px" : 0 }}>
          {label} <b>{v.toLocaleString()}</b>
        </span>
      ))}
    </span>
  );
}

function GroupSection({ group, showAsin, expanded, onToggle, onSave, focusRegion, onFocusRegion, salesYears, onAddToMalani }) {
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
        <div style={{ color: "#555", fontSize: "13px", display: "flex", gap: "16px", flexWrap: "wrap", justifyContent: "flex-end" }}>
          <NextTotals items={group.items} />
          <span>{group.items.length} product{group.items.length === 1 ? "" : "s"}</span>
        </div>
      </div>

      {expanded && (
        <div style={{ overflowX: "auto", marginTop: "12px" }}>
          <table style={{ borderCollapse: "collapse", width: "100%", tableLayout: "fixed" }}>
            <ColGroup showAsin={showAsin} focusRegion={focusRegion} />
            <TableHeader showAsin={showAsin} focusRegion={focusRegion} onFocusRegion={onFocusRegion} salesYears={salesYears} />
            <tbody>
              {group.items.map((item) => (
                <ItemRow key={item.sku} item={item} showAsin={showAsin} onSave={onSave} focusRegion={focusRegion} onAddToMalani={onAddToMalani} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// "Add New Product" (2026-09-30, per the user): creates the SKU's
// asin_group_mapping row in the chosen group via AssignSkuGroup (createOnly,
// so an existing SKU is reported rather than silently moved). ASIN is
// optional - a product not yet listed on Amazon won't have one. Its
// sku_statistics row is created on first edit by UpdateNextOrderField.
function AddProductForm({ groupNames, onAdded, onCancel }) {
  const [sku, setSku] = useState("");
  const [group, setGroup] = useState("");
  const [asin, setAsin] = useState("");
  const [status, setStatus] = useState("idle"); // idle | saving | error
  const [errorMsg, setErrorMsg] = useState("");

  async function submit(e) {
    e.preventDefault();
    const cleanSku = sku.trim();
    if (!cleanSku || !group) {
      setStatus("error");
      setErrorMsg("SKU and group are required");
      return;
    }
    setStatus("saving");
    setErrorMsg("");
    try {
      const response = await fetch(`${API_BASE}/AssignSkuGroup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sku: cleanSku, asin: asin.trim(), group, createOnly: true }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || `HTTP ${response.status}`);
      await onAdded(cleanSku, group);
    } catch (err) {
      setStatus("error");
      setErrorMsg(err.message || "Failed to add product");
    }
  }

  const inputStyle = { padding: "6px 8px", borderRadius: "6px", border: "1px solid #bbb", fontSize: "14px" };

  return (
    <form
      onSubmit={submit}
      style={{ ...cardStyle(), display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap", background: "#f7fbf7", borderColor: "#b9d8b9" }}
    >
      <strong>New product:</strong>
      <input style={inputStyle} placeholder="SKU (required)" value={sku} onChange={(e) => setSku(e.target.value)} autoFocus />
      <select style={inputStyle} value={group} onChange={(e) => setGroup(e.target.value)}>
        <option value="">Choose group...</option>
        {FAMILIES.map((family) => {
          const names = groupNames.filter((g) => familyOf(g) === family.key);
          return names.length ? (
            <optgroup key={family.key} label={family.label}>
              {names.map((g) => <option key={g} value={g}>{g}</option>)}
            </optgroup>
          ) : null;
        })}
        {groupNames.filter((g) => !familyOf(g)).map((g) => <option key={g} value={g}>{g}</option>)}
      </select>
      <input style={inputStyle} placeholder="ASIN (optional)" value={asin} onChange={(e) => setAsin(e.target.value)} />
      <button type="submit" style={buttonStyle()} disabled={status === "saving"}>
        {status === "saving" ? "Adding..." : "Add"}
      </button>
      <button type="button" style={ghostButtonStyle()} onClick={onCancel} disabled={status === "saving"}>
        Cancel
      </button>
      {status === "error" && <span style={{ color: SAVE_ERROR_COLOR, fontSize: "13px" }}>{errorMsg}</span>}
    </form>
  );
}

const EXPLANATION_EXAMPLE_SKU = "PareoBlueP19";

function RecoExplanation({ nextShipmentDate, exampleItem }) {
  const debug = exampleItem?.usa_reco_debug;
  const p = { fontSize: "13px", color: "#333", lineHeight: 1.6 };
  return (
    <div style={cardStyle()}>
      <h3 style={{ marginTop: 0 }}>How Reco and Days of Supply are calculated (USA, DE and UK alike)</h3>
      <p style={p}>
        <strong>Sales per day</strong> = units sold in a period ÷ the days the product was <strong>in stock</strong> in
        that marketplace (Amazon inventory ledger: USA = US warehouses, UK = UK warehouses, DE = the whole EU network).
        Days without stock are ignored, so a stock-out doesn&apos;t make a product look slower than it is. If a period
        has fewer than 7 in-stock days, all days are used. Days older than Amazon&apos;s ledger (~18 months) count as in stock.
      </p>
      <p style={p}>
        <strong>Reco = next shipment</strong> (0 = nothing needed), per the user&apos;s formula:
        <br />PA = today → Next Shipment Arriving Date; PB = the 3 months after arrival; H = Bal + OTW (Next is not counted)
        <br />QA = pieces needed during PA; QB = pieces needed during PB
        <br />At arrival you have max(H − QA, 0) - if stock runs out before the shipment lands, those lost sales are not re-ordered
        <br /><strong>Next shipment = QB − max(H − QA, 0)</strong>
        <br /><strong>A (recent)</strong>: QA and QB from the last 3 months&apos; sales per day
        <br /><strong>B (1 year ago)</strong>: QA from the same PA dates last year, QB from the same PB months last year
        <br /><strong>C (2 years ago)</strong>: same with 2 years ago (B/C use the recent rate where there is no history that far back)
        <br /><strong>Days of Supply A/B/C</strong> = H ÷ sales per day (recent / season after arrival 1yr / 2yrs ago). Bal = FBA + AWD (+ LG for DE).
      </p>
      {exampleItem && debug && (
        <div style={{ marginTop: "12px", padding: "12px", background: "#f7f7f7", borderRadius: "6px", fontSize: "13px", lineHeight: 1.7, whiteSpace: "pre-line" }}>
          <strong>
            Worked example - {exampleItem.sku} USA (next shipment {nextShipmentDate})
          </strong>
          {"\n"}
          {recoTooltipFor(exampleItem, "usa")}
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
// Export per marketplace or GENERAL (2026-10-03, per the user): a
// marketplace export has every column of that marketplace's expanded view,
// GENERAL only the general columns. Both start with the product columns.
const XLSX_PRODUCT_COLUMNS = [
  { header: "Group", key: "group", width: 16, value: (item, group) => group },
  { header: "SKU", key: "sku", width: 26, value: (item) => item.sku },
  { header: "UPC", key: "upc", width: 16, value: (item) => item.upc || "" },
  { header: "Supplier SKU", key: "supplierSku", width: 16, value: (item) => item.supplier_sku || "" },
];

function dosValue(item, region, rateKey) {
  const rate = item[`${region}_reco_debug`]?.[rateKey];
  if (!rate || rate <= 0) return "∞";
  return Math.round(((item[`${region}_balance`] || 0) + (item[`${region}_on_the_way`] || 0)) / rate);
}

function regionXlsxColumns(region, years) {
  const ads = (item) => item[`${region}_ads`] || {};
  const yearly = (item) => item[`${region}_yearly_sales`] || [];
  const parts = (item) => item[`${region}_balance_parts`] || {};
  return [
    { header: "Bal", key: "bal", width: 9, num: true, value: (i) => i[`${region}_balance`] || 0 },
    { header: "FBA", key: "fba", width: 8, num: true, value: (i) => parts(i).fba || 0 },
    { header: "AWD", key: "awd", width: 8, num: true, value: (i) => parts(i).awd || 0 },
    ...(region === "de" ? [{ header: "LG", key: "lg", width: 8, num: true, value: (i) => parts(i).lg || 0 }] : []),
    { header: "OTW", key: "otw", width: 8, num: true, value: (i) => i[`${region}_on_the_way`] || 0 },
    { header: "Next", key: "next", width: 8, num: true, red: true, value: (i) => i[`${region}_next_shipment`] || 0 },
    { header: "Reco A (recent)", key: "recoA", width: 14, num: true, red: true, value: (i) => i[`${region}_recommended_order`] || 0 },
    { header: "Reco B (1yr ago)", key: "recoB", width: 15, num: true, red: true, value: (i) => i[`${region}_recommended_order_seasonal_1yr`] || 0 },
    { header: "Reco C (2yrs ago)", key: "recoC", width: 16, num: true, red: true, value: (i) => i[`${region}_recommended_order_seasonal_2yr`] || 0 },
    { header: "Days of Supply A", key: "dosA", width: 15, num: true, value: (i) => dosValue(i, region, "avgDailyRecent") },
    { header: "Days of Supply B", key: "dosB", width: 15, num: true, value: (i) => dosValue(i, region, "avgDailySeasonal1yr") },
    { header: "Days of Supply C", key: "dosC", width: 15, num: true, value: (i) => dosValue(i, region, "avgDailySeasonal2yr") },
    { header: `Sold ${years[0] ?? ""} (YTD)`, key: "y0", width: 13, num: true, value: (i) => yearly(i)[0] || 0 },
    { header: `Sold ${years[1] ?? ""}`, key: "y1", width: 11, num: true, value: (i) => yearly(i)[1] || 0 },
    { header: `Sold ${years[2] ?? ""}`, key: "y2", width: 11, num: true, value: (i) => yearly(i)[2] || 0 },
    { header: "Ads ACOS YTD %", key: "acos", width: 14, num: true, value: (i) => (ads(i).acosYtd ?? "") },
    { header: "Sold via ads YTD", key: "adUnits", width: 15, num: true, value: (i) => ads(i).unitsYtd ?? "" },
    { header: "TACOS YTD %", key: "tacos", width: 12, num: true, value: (i) => (i[`${region}_tacos`] || {}).tacosYtd ?? "" },
    { header: "Malani Bal", key: "malaniBalR", width: 11, num: true, value: (i) => i.malani_balance || 0 },
  ];
}

const GENERAL_XLSX_COLUMNS = [
  { header: "Malani Bal", key: "malaniBal", width: 11, num: true, value: (i) => i.malani_balance || 0 },
  { header: "Malani Order", key: "malaniOrd", width: 12, num: true, value: (i) => i.malani_order || 0 },
  { header: "USA Next", key: "usaNext", width: 10, num: true, value: (i) => i.usa_next_shipment || 0 },
  { header: "DE Next", key: "deNext", width: 10, num: true, value: (i) => i.de_next_shipment || 0 },
  { header: "UK Next", key: "ukNext", width: 10, num: true, value: (i) => i.uk_next_shipment || 0 },
  { header: "AU Next", key: "auNext", width: 10, num: true, value: (i) => i.au_next_shipment || 0 },
  { header: "JP Next", key: "jpNext", width: 10, num: true, value: (i) => i.jp_next_shipment || 0 },
  { header: "Needed", key: "needed", width: 10, num: true, value: (i) => computeNeeded(i) },
  { header: "Missing", key: "missing", width: 10, num: true, red: true, value: (i) => computeMissing(i) },
  { header: "Next Order", key: "nextOrder", width: 11, num: true, red: true, value: (i) => i.next_order || 0 },
];
const XLSX_HEADER_FILL = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F4E78" } };
const XLSX_ZEBRA_FILL = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF3F3F3" } };
const XLSX_RED_FONT = { color: { argb: "FFB00020" }, bold: true };
const XLSX_THIN_BORDER = { style: "thin", color: { argb: "FFCCCCCC" } };

// One sheet per scope ("usa" | "de" | "uk" | "au" | "jp" | "general").
function addScopeSheet(workbook, visibleGroups, scope, years, sheetName) {
  const columns = [
    ...XLSX_PRODUCT_COLUMNS,
    ...(scope === "general" ? GENERAL_XLSX_COLUMNS : regionXlsxColumns(scope, years || [])),
  ];
  // Per the user (2026-10-03): a country file has only rows where that
  // country's Next > 0; GENERAL only rows with Missing > 0 or Next Order > 0.
  const keep = (item) =>
    scope === "general"
      ? computeMissing(item) > 0 || Number(item.next_order || 0) > 0
      : Number(item[`${scope}_next_shipment`] || 0) > 0;
  fillSheet(workbook, sheetName, columns, visibleGroups, keep);
}

function fillSheet(workbook, sheetName, columns, visibleGroups, keep) {
  const sheet = workbook.addWorksheet(sheetName, { views: [{ state: "frozen", ySplit: 1 }] });
  sheet.columns = columns.map(({ header, key, width }) => ({ header, key, width }));

  const headerRow = sheet.getRow(1);
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = XLSX_HEADER_FILL;
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    cell.border = { top: XLSX_THIN_BORDER, bottom: XLSX_THIN_BORDER, left: XLSX_THIN_BORDER, right: XLSX_THIN_BORDER };
  });
  headerRow.height = 30;

  let rowIndex = 0;
  visibleGroups.forEach((group) => {
    group.items.filter(keep).forEach((item) => {
      rowIndex += 1;
      const row = sheet.addRow(Object.fromEntries(columns.map((c) => [c.key, c.value(item, group.group)])));
      row.eachCell((cell, colNumber) => {
        const col = columns[colNumber - 1];
        cell.border = { top: XLSX_THIN_BORDER, bottom: XLSX_THIN_BORDER, left: XLSX_THIN_BORDER, right: XLSX_THIN_BORDER };
        if (col.num) cell.alignment = { horizontal: "right" };
        if (rowIndex % 2 === 0) cell.fill = XLSX_ZEBRA_FILL;
        // red when > 0, same convention as the page (Next, Reco, Missing, Next Order)
        if (col.red && typeof cell.value === "number" && cell.value > 0) cell.font = XLSX_RED_FONT;
      });
    });
  });

  sheet.autoFilter = { from: "A1", to: `${sheet.getColumn(columns.length).letter}1` };
}

async function downloadWorkbook(workbook, fileTitle) {
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `next-order-${fileTitle.toLowerCase()}-${new Date().toISOString().slice(0, 10)}.xlsx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

async function newWorkbook() {
  // Dynamically imported so this ~1MB library is only fetched on export.
  const { default: ExcelJS } = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "AmzBot";
  workbook.created = new Date();
  return workbook;
}

async function exportXlsx(visibleGroups, scope, years) {
  const title = scope === "general" ? "GENERAL" : scope.toUpperCase();
  const workbook = await newWorkbook();
  addScopeSheet(workbook, visibleGroups, scope, years, `Next Order ${title}`);
  await downloadWorkbook(workbook, title);
}

// Export (2026-10-31, per the user): tick any of the marketplaces and/or
// GENERAL. One ticked = the same single-sheet file as before. Several = one
// file: a "Combined" sheet (product columns + each ticked marketplace's Next
// + total, rows where any of them > 0) when 2+ marketplaces are ticked, then
// one full sheet per ticked marketplace, then GENERAL.
async function exportSelectedXlsx(visibleGroups, selected, years) {
  if (!selected.length) return;
  if (selected.length === 1) {
    await exportXlsx(visibleGroups, selected[0][0], years);
    return;
  }
  const regions = selected.filter(([k]) => k !== "general").map(([key, label]) => ({ key, label }));
  const workbook = await newWorkbook();
  if (regions.length >= 2) {
    const combinedColumns = [
      ...XLSX_PRODUCT_COLUMNS,
      ...regions.map((r) => ({
        header: `${r.label} Next`, key: `${r.key}Next`, width: 10, num: true, red: true,
        value: (i) => i[`${r.key}_next_shipment`] || 0,
      })),
      {
        header: "Total Next", key: "totalNext", width: 11, num: true, red: true,
        value: (i) => regions.reduce((s, r) => s + Number(i[`${r.key}_next_shipment`] || 0), 0),
      },
      { header: "Malani Bal", key: "malaniBal", width: 11, num: true, value: (i) => i.malani_balance || 0 },
    ];
    fillSheet(workbook, "Combined", combinedColumns, visibleGroups,
      (i) => regions.some((r) => Number(i[`${r.key}_next_shipment`] || 0) > 0));
  }
  selected.forEach(([key, label]) => addScopeSheet(workbook, visibleGroups, key, years, `Next Order ${label}`));
  await downloadWorkbook(workbook, selected.map(([, label]) => label).join("-"));
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
  const [filterNext, setFilterNext] = useState(false);
  const [nextShipmentDate, setNextShipmentDate] = useState("");
  // One arriving date per region (2026-10-18, per the user).
  const [nextShipmentDates, setNextShipmentDates] = useState({});
  // Per-region months the goods must last after arrival (2026-10-18, default 3).
  const [coverMonths, setCoverMonths] = useState({});
  const [dateSaveStatus, setDateSaveStatus] = useState("idle"); // idle | saving | saved | error
  // Pareo / Home Decor family sections - collapsed by default, same as /sales.
  const [expandedFamilies, setExpandedFamilies] = useState({});
  const [showAddProduct, setShowAddProduct] = useState(false);
  // Expanded region (one of usa/de/uk) - shared by every group's table.
  const [focusRegion, setFocusRegion] = useState(null);
  const [salesYears, setSalesYears] = useState([]);
  const [addedMessage, setAddedMessage] = useState("");
  const [showAuManual, setShowAuManual] = useState(false);
  const auHasStock = groups.some((g) => g.items.some((i) => (i.au_balance || 0) > 0));
  const [showJpManual, setShowJpManual] = useState(false);
  const [multiExport, setMultiExport] = useState({});
  const jpHasStock = groups.some((g) => g.items.some((i) => (i.jp_balance || 0) > 0));
  setShownOptionalRegions({ au: auHasStock || showAuManual, jp: jpHasStock || showJpManual });
  const exportOptions = [...REGIONS.map((r) => [r.key, r.label]), ["general", "GENERAL"]];
  const exportSelected = exportOptions.filter(([k]) => multiExport[k]);

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
      setNextShipmentDates(data.nextShipmentDates || {});
      setCoverMonths(data.coverMonths || {});
      setSalesYears(data.salesYears || []);
      const allCollapsed = {};
      (data.groups || []).forEach((g) => {
        allCollapsed[g.group] = true;
      });
      setCollapsedGroups(allCollapsed);
      setExpandedFamilies({});
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

  // Per the user (2026-10-06): per-SKU icon next to Next Order moves that
  // item's Next Order into its Malani Order (malani_order += next_order,
  // next_order -> 0).
  async function addNextOrderToMalani(item) {
    const qty = Number(item.next_order || 0);
    if (qty <= 0) return;
    if (!window.confirm(`Add ${qty} to Malani Order for ${item.sku}? Next Order will then be 0.`)) return;
    try {
      const response = await fetch(`${API_BASE}/AddNextOrderToMalaniOrder`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ skus: [item.sku] }),
      });
      const data = await response.json();
      if (!response.ok || data.error) throw new Error(data?.error || `HTTP ${response.status}`);
      const changed = (data.changed || [])[0];
      if (!changed) throw new Error("nothing changed");
      setGroups((prev) =>
        prev.map((g) => ({
          ...g,
          items: g.items.map((it) => (it.sku === item.sku ? { ...it, malani_order: changed.malani_order, next_order: 0 } : it)),
        }))
      );
    } catch (err) {
      window.alert(`Failed: ${err.message || err}`);
    }
  }

  async function saveCoverMonths(value, region) {
    if (!/^\d+$/.test(value) || Number(value) < 1 || Number(value) > 24) return;
    setCoverMonths((prev) => ({ ...prev, [region]: Number(value) }));
    try {
      const response = await fetch(`${API_BASE}/UpdateNextShipmentDate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ region, coverMonths: value }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || `HTTP ${response.status}`);
      loadData();
    } catch (err) {
      setError(err.message || "Failed to save months");
    }
  }

  async function saveNextShipmentDate(newDate, region) {
    setNextShipmentDates((prev) => ({ ...prev, [region]: newDate }));
    if (region === "usa") setNextShipmentDate(newDate);
    setDateSaveStatus("saving");
    try {
      const response = await fetch(`${API_BASE}/UpdateNextShipmentDate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: newDate, region }),
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
    setExpandedFamilies(Object.fromEntries(FAMILIES.map((f) => [f.key, true])));
  }

  function collapseAll() {
    setExpandedFamilies({});
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
  const toggleFilterNext = makeToggleFilter(setFilterNext);

  const anyFilterActive = filterMissing || filterNextOrder || filterReco || filterNext;

  // "Next > 0" filter (2026-10-03, per the user): the expanded marketplace's
  // Next column, or any marketplace's when none is expanded.
  function itemHasNextAbove0(item) {
    const regions = focusRegion && focusRegion !== "general" ? [focusRegion] : REGIONS.map((r) => r.key);
    return regions.some((r) => Number(item[`${r}_next_shipment`] || 0) > 0);
  }

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
            (filterReco && itemHasRecoAbove0(item)) ||
            (filterNext && itemHasNextAbove0(item))
        ),
      }))
      .filter((g) => g.items.length > 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groups, filterMissing, filterNextOrder, filterReco, filterNext, focusRegion, anyFilterActive]);

  const groupNames = useMemo(() => groups.map((g) => g.group).filter((g) => g !== "IGNORE").sort(), [groups]);

  async function handleProductAdded(sku, group) {
    setShowAddProduct(false);
    await loadData();
    // Reopen where the new row landed so it's visible right away.
    setCollapsedGroups((prev) => ({ ...prev, [group]: false }));
    const family = familyOf(group);
    if (family) setExpandedFamilies((prev) => ({ ...prev, [family]: true }));
    setAddedMessage(`Added ${sku} to ${group}`);
    setTimeout(() => setAddedMessage(""), 5000);
  }

  function renderGroup(group) {
    return (
      <GroupSection
        key={group.group}
        group={group}
        showAsin={showAsin}
        expanded={!collapsedGroups[group.group]}
        onToggle={() => toggleGroup(group.group)}
        onSave={saveField}
        onAddToMalani={addNextOrderToMalani}
        focusRegion={focusRegion}
        onFocusRegion={setFocusRegion}
        salesYears={salesYears}
      />
    );
  }

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
          flexWrap: "wrap",
          marginBottom: "20px",
          fontSize: "14px",
        }}
      >
        <span style={{ fontWeight: 600 }}>Next Shipment Arriving Date:</span>
        {REGIONS.map((r) => r.key).map((region) => {
          const value = nextShipmentDates[region] || "";
          const left = value ? Math.max(0, Math.round((new Date(`${value}T00:00:00`) - new Date(new Date().toDateString())) / 864e5)) : null;
          return (
            <label key={region} style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
              <b>{region.toUpperCase()}</b>
              <input
                type="date"
                value={value}
                onChange={(e) => e.target.value && saveNextShipmentDate(e.target.value, region)}
                style={{
                  padding: "4px 8px",
                  borderRadius: "4px",
                  border: `1px solid ${STATUS_BORDER[dateSaveStatus]}`,
                  colorScheme: "light",
                  fontSize: "14px",
                }}
              />
              {left !== null && <span style={{ color: "#333" }}>({left}d)</span>}
              <span style={{ color: "#777" }}>enough for</span>
              <input
                type="number"
                min="1"
                max="24"
                key={`${region}-${coverMonths[region] || 3}`}
                defaultValue={coverMonths[region] || 3}
                title="How many months after arrival this shipment must last"
                onBlur={(e) => Number(e.target.value) !== (coverMonths[region] || 3) && saveCoverMonths(e.target.value, region)}
                onKeyDown={(e) => e.key === "Enter" && e.target.blur()}
                style={{ width: "48px", padding: "4px 6px", borderRadius: "4px", border: "1px solid #ccc", fontSize: "13px" }}
              />
              <span style={{ color: "#777" }}>months</span>
            </label>
          );
        })}
        {!auHasStock && (
          <button
            onClick={() => setShowAuManual((v) => !v)}
            title="AU is hidden until the first AU shipment is in stock"
            style={{ background: "none", border: "none", color: "#1565c0", cursor: "pointer", textDecoration: "underline", fontSize: "13px" }}
          >
            {showAuManual ? "hide AU" : "show AU"}
          </button>
        )}
        {!jpHasStock && (
          <button
            onClick={() => setShowJpManual((v) => !v)}
            title="JP is hidden until JP has stock"
            style={{ background: "none", border: "none", color: "#1565c0", cursor: "pointer", textDecoration: "underline", fontSize: "13px" }}
          >
            {showJpManual ? "hide JP" : "show JP"}
          </button>
        )}
        {dateSaveStatus === "saving" && <span style={{ color: "#888" }}>Saving...</span>}
        {dateSaveStatus === "saved" && <span style={{ color: SAVE_OK_COLOR }}>Saved</span>}
        <span style={{ color: "#777" }}>
          (used for the Reco columns - see the explanation and worked example at the bottom of the page)
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
          <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
            <button style={ghostButtonStyle()} onClick={expandAll}>
              Expand All Groups
            </button>
            <button style={ghostButtonStyle()} onClick={collapseAll}>
              Collapse All Groups
            </button>
            <span style={{ display: "inline-flex", alignItems: "center", gap: "8px", border: "1px solid #ccc", borderRadius: "8px", padding: "4px 8px", background: "#fff" }}>
              <span style={{ fontSize: "13px", fontWeight: 700, color: "#333" }}>Export XLSX:</span>
              {exportOptions.map(([key, label]) => (
                <label key={key} style={{ display: "inline-flex", alignItems: "center", gap: "3px", fontSize: "13px", cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={!!multiExport[key]}
                    onChange={() => setMultiExport((m) => ({ ...m, [key]: !m[key] }))}
                  />
                  {label}
                </label>
              ))}
              <button
                disabled={!exportSelected.length}
                onClick={() => exportSelectedXlsx(visibleGroups, exportSelected, salesYears)}
                style={{ padding: "6px 12px", borderRadius: "6px", border: "1px solid #1565c0", background: "#1565c0", color: "#fff", fontWeight: 600, fontSize: "13px", cursor: "pointer", opacity: exportSelected.length ? 1 : 0.4 }}
              >
                Export
              </button>
            </span>
            <button style={blueButtonStyle()} onClick={() => setShowAddProduct((v) => !v)}>
              + Add New Product
            </button>

            {addedMessage && <span style={{ color: SAVE_OK_COLOR, fontWeight: 600 }}>{addedMessage}</span>}
            <label style={{ display: "flex", alignItems: "center", gap: "6px", marginLeft: "auto", fontSize: "14px", cursor: "pointer" }}>
              <input type="checkbox" checked={showAsin} onChange={() => setShowAsin((v) => !v)} />
              Show ASIN column
            </label>
          </div>
          {/* Filters on their own row as toggle chips (2026-10-03, per the user). */}
          <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap", marginTop: "-6px" }}>
            <span style={{ fontWeight: 700, fontSize: "14px", color: "#333", marginRight: "4px" }}>Only show:</span>
            <FilterChip active={filterMissing} onClick={toggleFilterMissing} label="Missing > 0" />
            <FilterChip active={filterNextOrder} onClick={toggleFilterNextOrder} label="Next Order > 0" />
            <FilterChip active={filterReco} onClick={toggleFilterReco} label="Any Reco > 0" />
            <FilterChip active={filterNext} onClick={toggleFilterNext} label={focusRegion && focusRegion !== "general" ? `${focusRegion.toUpperCase()} Next > 0` : "Next > 0 (any marketplace)"} />
            {anyFilterActive && (
              <button
                onClick={() => {
                  setFilterMissing(false);
                  setFilterNextOrder(false);
                  setFilterReco(false);
                  setFilterNext(false);
                }}
                style={{ background: "none", border: "none", color: "#1565c0", cursor: "pointer", fontSize: "13px", textDecoration: "underline" }}
              >
                clear filters
              </button>
            )}
            {anyFilterActive && <span style={{ fontSize: "12px", color: "#777" }}>rows matching any selected filter</span>}
          </div>

          {anyFilterActive && visibleGroups.length === 0 && (
            <div style={{ textAlign: "center", color: "#555" }}>No rows match the selected filter(s).</div>
          )}

          {showAddProduct && (
            <AddProductForm groupNames={groupNames} onAdded={handleProductAdded} onCancel={() => setShowAddProduct(false)} />
          )}

          {FAMILIES.map((family) => {
            const familyGroups = orderFamilyGroups(family.key, visibleGroups.filter((g) => familyOf(g.group) === family.key));
            if (familyGroups.length === 0) return null;
            const productCount = familyGroups.reduce((sum, g) => sum + g.items.length, 0);
            return (
              <FamilySection
                key={family.key}
                label={family.label}
                summary={
                  <span style={{ display: "flex", gap: "16px", flexWrap: "wrap", justifyContent: "flex-end" }}>
                    <NextTotals items={familyGroups.flatMap((g) => g.items)} />
                    <span>{`${familyGroups.length} group${familyGroups.length === 1 ? "" : "s"} · ${productCount} products`}</span>
                  </span>
                }
                expanded={!!expandedFamilies[family.key]}
                onToggle={() => setExpandedFamilies((prev) => ({ ...prev, [family.key]: !prev[family.key] }))}
              >
                {familyGroups.map(renderGroup)}
              </FamilySection>
            );
          })}

          {visibleGroups.filter((g) => !familyOf(g.group)).map(renderGroup)}
        </div>
      )}

      {!loading && (
        <div style={{ maxWidth: "1400px", marginInline: "auto", marginTop: "24px" }}>
          <RecoExplanation nextShipmentDate={nextShipmentDate} exampleItem={exampleItem} />
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
