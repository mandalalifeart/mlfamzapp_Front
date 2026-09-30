// Shared between AdsBidOptimizerPage and AdsKeywordsPage so both pages'
// rules menus stay in sync with RunBidOptimizerDryRun's query params.
export const RULE_FIELDS = [
  { key: "target_acos", label: "Target ACOS %", default: 30 },
  { key: "lookback_days", label: "Decision window (days)", default: 30 },
  { key: "recent_days", label: "Recent trend window (days)", default: 7 },
  { key: "baseline_days", label: "Baseline window (days)", default: 60 },
  { key: "attribution_lag_days", label: "Attribution lag (days)", default: 7 },
  { key: "min_spend", label: "Min spend $", default: 5.0 },
  { key: "zero_sales_spend", label: "Zero-sales cutoff $", default: 3.0 },
  { key: "tolerance_pct", label: "Tolerance %", default: 10 },
  { key: "max_change_pct", label: "Max change % / run", default: 20 },
  { key: "min_bid", label: "Min bid $", default: 0.1 },
  { key: "max_bid", label: "Max bid $", default: 5.0 },
];
