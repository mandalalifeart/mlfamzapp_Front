// Shared Reco / Days-of-Supply hover text for the Next Order and Product
// pages (2026-10-03). Every rate counts only days the product was in stock in
// the region (Amazon inventory ledger); every demand figure is rate x days;
// Reco subtracts Bal + OTW only (the Next column is ignored) - see
// GetNextOrderData.compute_region_recommendations.

function days(w) {
  if (!w) return "";
  if (w.source === "fallback_recent") return "no sales history then - recent rate used";
  if (w.allDaysUsed) return `${w.units} units / ${w.totalDays} days (fewer than 7 in-stock days - all days used)`;
  if (w.inStockDays === w.totalDays) return `${w.units} units / ${w.totalDays} days, always in stock`;
  return `${w.units} units / ${w.inStockDays} in-stock days of ${w.totalDays}`;
}

function span(w) {
  const m = w?.months || [];
  return m.length ? `${m[0]}${m.length > 1 ? ` – ${m[m.length - 1]}` : ""}` : "";
}

// Next shipment = QB - max(H - QA, 0) (per the user 2026-10-03):
// PA = today -> arrival, PB = 3 months after arrival, H = Bal + OTW.
export function buildRecoTooltip(debug, { bal, otw, region, recos }) {
  if (!debug || !debug.A) return "";
  const r = (region || "").toUpperCase();
  const zero = (v, shown) => (v.reco > 0 && shown === 0 ? " → 0 (below half the minimum order size)" : "");
  const line = (name, v, shown) =>
    `${name}: QA ${v.qa}, QB ${v.qb} → at arrival ${v.left} left → order ${v.qb} − ${v.left} = ${v.reco}${zero(v, shown)}`;
  return (
    `PA = today → arrival: ${debug.xDays} days · PB = 3 months after arrival: ${debug.pbDays} days\n` +
    `H = Bal ${bal} + OTW ${otw} = ${debug.have} (Next column not counted)\n` +
    `Next shipment = QB − max(H − QA, 0) - running out before arrival is not re-ordered\n\n` +
    `Sales per day (only days with stock in ${r}):\n` +
    `  A recent (${span(debug.recent)}): ${days(debug.recent)} = ${debug.recent.rate}/day (used for PA and PB)\n` +
    `  B PA 1yr ago (${span(debug.year1.pa)}): ${days(debug.year1.pa)} = ${debug.year1.pa.rate}/day\n` +
    `  B PB 1yr ago (${span(debug.year1.pb)}): ${days(debug.year1.pb)} = ${debug.year1.pb.rate}/day\n` +
    `  C PA 2yrs ago (${span(debug.year2.pa)}): ${days(debug.year2.pa)} = ${debug.year2.pa.rate}/day\n` +
    `  C PB 2yrs ago (${span(debug.year2.pb)}): ${days(debug.year2.pb)} = ${debug.year2.pb.rate}/day\n\n` +
    `${line("A", debug.A, recos?.[0])}\n${line("B", debug.B, recos?.[1])}\n${line("C", debug.C, recos?.[2])}`
  );
}

export function formatDaysOfSupply(bal, otw, avgDaily) {
  if (!avgDaily || avgDaily <= 0) return "∞";
  return Math.round((bal + otw) / avgDaily).toLocaleString();
}

export function daysOfSupplyTooltip(debug, bal, otw) {
  if (!debug) return "";
  return (
    `Days of supply = (Bal ${bal} + OTW ${otw}) / sales per day (in-stock days only)\n` +
    `A (recent, ${debug.avgDailyRecent}/day): ${formatDaysOfSupply(bal, otw, debug.avgDailyRecent)} days\n` +
    `B (season after arrival, 1yr ago, ${debug.avgDailySeasonal1yr}/day): ${formatDaysOfSupply(bal, otw, debug.avgDailySeasonal1yr)} days\n` +
    `C (season after arrival, 2yrs ago, ${debug.avgDailySeasonal2yr}/day): ${formatDaysOfSupply(bal, otw, debug.avgDailySeasonal2yr)} days`
  );
}

export function balanceTooltip(parts) {
  if (!parts) return "";
  const labels = { fba: "FBA", awd: "AWD", lg: "LG warehouse" };
  const entries = Object.entries(parts);
  return `Bal = ${entries.map(([k, v]) => `${labels[k] || k} ${v}`).join(" + ")} = ${entries.reduce((s, [, v]) => s + v, 0)}`;
}
