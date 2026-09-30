import { Fragment, useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { applyBidChange, disableBidTarget } from "./bidApply";
import { RULE_FIELDS } from "./bidRules";
import { buttonStyle } from "./buttonStyle";
import RuleFieldsGrid from "./RuleFieldsGrid";
import ProfileControls from "./ProfileControls";
import { useBidRuleProfiles } from "./useBidRuleProfiles";
import { useAdsFilterOptions } from "./useAdsFilterOptions";

const API_BASE =
  import.meta.env.VITE_API_BASE ||
  "https://us-central1-mlfamzapp.cloudfunctions.net";

function cardStyle() {
  return { background: "#fff", border: "1px solid #ddd", borderRadius: "8px", padding: "16px" };
}

function inputStyle() {
  return {
    padding: "10px",
    borderRadius: "8px",
    border: "1px solid #ccc",
    background: "#fff",
    color: "#222",
  };
}

function tableCellStyle(extra = {}) {
  return { border: "1px solid #ccc", padding: "8px 10px", textAlign: "left", ...extra };
}

function compactCellStyle(extra = {}) {
  return tableCellStyle({ fontSize: "12px", maxWidth: "110px", wordBreak: "break-word", ...extra });
}

function formatMoney(value, currencyCode) {
  const amount = Number(value || 0);
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: currencyCode || "USD" }).format(amount);
  } catch {
    return amount.toFixed(2);
  }
}

// One row per keyword, each period stacked as its own line within the
// cell (this app's established convention for multi-value cells) rather
// than exploding into 5x the rows.
function renderPeriodLines(k, metricKey, formatter) {
  return HISTORY_PERIODS.map((p, i) => (
    <span key={p.key}>
      {i > 0 && <br />}
      <span style={{ color: "#888" }}>{p.label}:</span> {formatter(k.periods?.[p.key]?.[metricKey] || 0, k.currencyCode)}
    </span>
  ));
}

const AD_PRODUCT_LABELS = { SPONSORED_PRODUCTS: "SP", SPONSORED_BRANDS: "SB", SPONSORED_DISPLAY: "SD" };
const LA_TIME_ZONE = "America/Los_Angeles";
const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const PRESETS = [
  { key: "today", label: "Today" },
  { key: "yesterday", label: "Yesterday" },
  { key: "last7days", label: "Last 7 Days" },
  { key: "last30days", label: "Last 30 Days" },
  { key: "ytd", label: "Year to Date" },
  { key: "month", label: "Month" },
  { key: "custom", label: "Custom" },
];

// Shown by default (preset === "") instead of one single period, per the
// user's request: every keyword's Spend/Sales/ACOS/CPC broken out across
// these 5 fixed windows at once, each stacked as its own line within one
// cell (this app's established multi-value-cell convention) rather than
// exploding into 5x the rows.
const HISTORY_PERIODS = [
  { key: "sevenDay", label: "7d" },
  { key: "thirtyDay", label: "30d" },
  { key: "sixtyDay", label: "60d" },
  { key: "ytd", label: "YTD" },
  { key: "lastYear", label: "Last Yr" },
];

function getHistoryPeriodRanges() {
  const today = getLosAngelesToday();
  const year = Number(today.slice(0, 4));
  return {
    sevenDay: { startDate: addDays(today, -6), endDate: today },
    thirtyDay: { startDate: addDays(today, -29), endDate: today },
    sixtyDay: { startDate: addDays(today, -59), endDate: today },
    ytd: { startDate: `${year}-01-01`, endDate: today },
    lastYear: { startDate: `${year - 1}-01-01`, endDate: `${year - 1}-12-31` },
  };
}

function getLosAngelesToday() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: LA_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const map = {};
  for (const p of parts) if (p.type !== "literal") map[p.type] = p.value;
  return `${map.year}-${map.month}-${map.day}`;
}

function addDays(dateStr, days) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function getMonthRange(year, month) {
  const today = getLosAngelesToday();
  const pad = (n) => String(n).padStart(2, "0");
  const startDate = `${year}-${pad(month)}-01`;
  const lastDayOfMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const monthEnd = `${year}-${pad(month)}-${pad(lastDayOfMonth)}`;
  const endDate = monthEnd > today ? today : monthEnd;
  return { startDate, endDate };
}

function getPresetRange(preset, selectedMonth) {
  const today = getLosAngelesToday();
  switch (preset) {
    case "today":
      return { startDate: today, endDate: today };
    case "yesterday": {
      const yesterday = addDays(today, -1);
      return { startDate: yesterday, endDate: yesterday };
    }
    case "last7days":
      return { startDate: addDays(today, -6), endDate: today };
    case "last30days":
      return { startDate: addDays(today, -29), endDate: today };
    case "ytd":
      return { startDate: `${today.slice(0, 4)}-01-01`, endDate: today };
    case "month":
      return getMonthRange(Number(today.slice(0, 4)), selectedMonth);
    default:
      return { startDate: today, endDate: today };
  }
}

export default function AdsKeywordsPage() {
  const [searchParams] = useSearchParams();
  // Pre-selects from a "Keywords" link on a specific /ads-campaigns row, so
  // the same date range/preset carries over instead of resetting
  // (2026-09-10, per the user).
  const [preset, setPreset] = useState(searchParams.get("preset") || "last7days");
  const [customStart, setCustomStart] = useState(searchParams.get("start") || getLosAngelesToday());
  const [customEnd, setCustomEnd] = useState(searchParams.get("end") || getLosAngelesToday());
  const [selectedMonth, setSelectedMonth] = useState(Number(getLosAngelesToday().slice(5, 7)));
  // Pre-selects from a "Keywords" link on a specific /ads-campaigns row -
  // country_code/portfolio only, campaign_id is handled by campaignFilter
  // below (see its own comment).
  const [countryFilter, setCountryFilter] = useState(searchParams.get("country_code") || "");
  const [adProductFilter, setAdProductFilter] = useState("");
  const [portfolioFilter, setPortfolioFilter] = useState(searchParams.get("portfolio") || "");
  const { countryOptions, portfolioOptionsFor } = useAdsFilterOptions();
  // Pre-selects from a "Keywords" link on a specific /ads-campaigns row, but
  // from here on it's just the one Campaign dropdown below - no separate
  // server-side pre-filter, so there's only ever one control for this.
  const [campaignFilter, setCampaignFilter] = useState(searchParams.get("campaign_id") || "");
  const [keywords, setKeywords] = useState([]);
  const [historyKeywords, setHistoryKeywords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [error, setError] = useState("");
  const [sortField, setSortField] = useState(null);
  const [sortDir, setSortDir] = useState("desc");

  // Bid recommendations - integrated straight into this page rather than
  // only living on /ads-bid-optimizer, per the user's request.
  const [showRules, setShowRules] = useState(false);
  const [rules, setRules] = useState(Object.fromEntries(RULE_FIELDS.map((f) => [f.key, f.default])));
  // Rules profiles reuse this page's own Country/Portfolio filters (above)
  // as the profile's country/portfolio, rather than a second copy of those
  // selectors inside the Rules panel - loading a saved profile here moves
  // the whole page's data, not just the recommendation query.
  const {
    savedProfiles,
    selectedProfile,
    profileNameInput,
    setProfileNameInput,
    profileError,
    handleSaveProfile,
    handleLoadProfile,
    handleClearProfile,
    handleDeleteProfile,
  } = useBidRuleProfiles({
    rules,
    setRules,
    country: countryFilter,
    setCountry: setCountryFilter,
    portfolio: portfolioFilter,
    setPortfolio: setPortfolioFilter,
  });
  const [recLoading, setRecLoading] = useState(false);
  const [recError, setRecError] = useState("");
  const [recommendations, setRecommendations] = useState(null); // targetId -> proposal
  const [recMeta, setRecMeta] = useState(null);
  const [applying, setApplying] = useState(null);
  const [applied, setApplied] = useState({});
  const [applyError, setApplyError] = useState({});
  const [disabling, setDisabling] = useState(null);
  const [disabled, setDisabled] = useState({});
  const [disableError, setDisableError] = useState({});
  const [editedBids, setEditedBids] = useState({});

  // Bid change history per keyword (2026-09-10, per the user) - fetched
  // ONCE for the whole page (not per-row) and grouped by targetId
  // client-side, same reasoning as loadHistoryPeriods above.
  const [bidHistoryByTarget, setBidHistoryByTarget] = useState(new Map());

  useEffect(() => {
    fetch(`${API_BASE}/GetBidChangeLog`)
      .then((r) => r.json())
      .then((data) => {
        const byTarget = new Map();
        for (const c of data.changes || []) {
          if (!byTarget.has(c.targetId)) byTarget.set(c.targetId, []);
          byTarget.get(c.targetId).push(c);
        }
        setBidHistoryByTarget(byTarget);
      })
      .catch(() => {}); // non-critical - a keyword's row just shows no history if this fails
  }, []);

  async function getRecommendations() {
    setRecLoading(true);
    setRecError("");
    try {
      const params = new URLSearchParams(Object.fromEntries(Object.entries(rules).map(([k, v]) => [k, String(v)])));
      // Driven by this page's own Country/Portfolio filters, not a separate
      // selection - see the useBidRuleProfiles wiring above.
      if (countryFilter) params.set("country_code", countryFilter);
      if (portfolioFilter) params.set("portfolio", portfolioFilter);
      const response = await fetch(`${API_BASE}/RunBidOptimizerDryRun?${params.toString()}`);
      const data = await response.json();
      if (!response.ok || data.error) throw new Error(data?.error || `HTTP ${response.status}`);
      const map = new Map(data.proposals.map((p) => [p.targetId, p]));
      setRecommendations(map);
      setRecMeta(data);
      setEditedBids({});
    } catch (err) {
      setRecError(err.message || "Failed to load recommendations");
    } finally {
      setRecLoading(false);
    }
  }

  async function handleApply(proposal, key) {
    const bidToApply = Number(editedBids[key] ?? proposal.proposedBid);
    setApplying(key);
    setApplyError((e) => ({ ...e, [key]: "" }));
    try {
      await applyBidChange({ ...proposal, proposedBid: bidToApply });
      setApplied((a) => ({ ...a, [key]: true }));
    } catch (err) {
      setApplyError((e) => ({ ...e, [key]: err.message || "Failed to apply" }));
    } finally {
      setApplying(null);
    }
  }

  async function handleDisable(proposal, key) {
    if (!window.confirm(`Pause "${proposal.targetText}" on Amazon? This stops it from serving until re-enabled in the Ads Console.`)) return;
    setDisabling(key);
    setDisableError((e) => ({ ...e, [key]: "" }));
    try {
      await disableBidTarget(proposal);
      setDisabled((d) => ({ ...d, [key]: true }));
    } catch (err) {
      setDisableError((e) => ({ ...e, [key]: err.message || "Failed to disable" }));
    } finally {
      setDisabling(null);
    }
  }

  function toggleSort(field) {
    if (sortField === field) {
      setSortDir((dir) => (dir === "desc" ? "asc" : "desc"));
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  }

  function sortHeaderStyle(field, extra = {}) {
    return { ...tableCellStyle({ background: "#f4f4f4", cursor: "pointer", userSelect: "none", ...extra }) };
  }

  function sortArrow(field) {
    if (sortField !== field) return "";
    return sortDir === "desc" ? " ▼" : " ▲";
  }

  const currentMonth = Number(getLosAngelesToday().slice(5, 7));
  const { startDate, endDate } =
    preset === "custom" ? { startDate: customStart, endDate: customEnd } : getPresetRange(preset, selectedMonth);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ start_date: startDate, end_date: endDate });
      if (countryFilter) params.set("country_code", countryFilter);
      if (portfolioFilter) params.set("portfolio", portfolioFilter);
      const response = await fetch(`${API_BASE}/GetAdsKeywordStats?${params.toString()}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || `HTTP ${response.status}`);
      setKeywords(data.keywords || []);
    } catch (err) {
      setError(err.message || "Failed to load keyword stats");
    } finally {
      setLoading(false);
    }
  }

  async function loadHistoryPeriods() {
    setHistoryLoading(true);
    setError("");
    try {
      const ranges = getHistoryPeriodRanges();
      // Widest to narrowest, so each row's display metadata (campaign/ad
      // group name, current bid) ends up from whichever window is most
      // current for that target, not from a stale year-old snapshot.
      const orderedKeys = ["lastYear", "ytd", "sixtyDay", "thirtyDay", "sevenDay"];
      const responses = await Promise.all(
        orderedKeys.map((key) => {
          const params = new URLSearchParams({ start_date: ranges[key].startDate, end_date: ranges[key].endDate });
          if (countryFilter) params.set("country_code", countryFilter);
          if (portfolioFilter) params.set("portfolio", portfolioFilter);
          return fetch(`${API_BASE}/GetAdsKeywordStats?${params.toString()}`).then((r) => r.json());
        })
      );
      // The same real keyword can come back as more than one row for the
      // same window - this account has more than one Amazon Ads profile
      // per country (e.g. two seller brands), and the same
      // campaign/ad-group/target apparently gets reported under both
      // (found live 2026-09-06: YTD spend showed LESS than 60d for a
      // keyword, because a second profile's row for the same target only
      // shows up in the wider window and was overwriting the first
      // profile's row instead of adding to it). Rows are summed per period
      // by campaign/ad-group/target, not just last-one-wins, so a wider
      // window's total can never come out lower than a narrower one's.
      const periodsByKey = {};
      const metaByKey = {};
      orderedKeys.forEach((periodKey, i) => {
        const data = responses[i];
        if (!data.keywords) return;
        const sums = {};
        for (const row of data.keywords) {
          const rowKey = `${row.countryCode}-${row.adProduct}-${row.campaignId}-${row.adGroupId}-${row.targetId}`;
          const s = sums[rowKey] || (sums[rowKey] = { impressions: 0, clicks: 0, spend: 0, sales: 0, orders: 0 });
          s.impressions += row.impressions || 0;
          s.clicks += row.clicks || 0;
          s.spend += row.spend || 0;
          s.sales += row.sales || 0;
          s.orders += row.orders || 0;
          metaByKey[rowKey] = row;
        }
        for (const [rowKey, s] of Object.entries(sums)) {
          periodsByKey[rowKey] = periodsByKey[rowKey] || {};
          periodsByKey[rowKey][periodKey] = {
            ...s,
            acos: s.sales ? (s.spend / s.sales) * 100 : 0,
            cpc: s.clicks ? s.spend / s.clicks : 0,
          };
        }
      });
      const merged = new Map();
      for (const rowKey of Object.keys(metaByKey)) {
        merged.set(rowKey, { ...metaByKey[rowKey], periods: periodsByKey[rowKey] || {} });
      }
      setHistoryKeywords([...merged.values()]);
    } catch (err) {
      setError(err.message || "Failed to load keyword history");
    } finally {
      setHistoryLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate, endDate, countryFilter, portfolioFilter]);

  // The multi-window stats row shows alongside the normal flat columns
  // regardless of which preset/date range is selected (2026-09-10, per the
  // user, same fix as AdsCampaignsPage.jsx) - fetched independently of the
  // flat load() above.
  useEffect(() => {
    loadHistoryPeriods();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [countryFilter, portfolioFilter]);

  // The Recommendation column (see the Bid Recommendations panel below) used
  // to only populate after manually expanding that panel and clicking "Get
  // Recommendations" - per the user's request (2026-09-06), it's now fetched
  // automatically so the column is there by default. Doesn't depend on
  // preset/date range - RunBidOptimizerDryRun uses its own internal lookback
  // window, independent of whichever period this page is displaying.
  useEffect(() => {
    getRecommendations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [countryFilter, portfolioFilter]);

  // A campaign filter carried over from a "Keywords" link (or just left
  // selected) belongs to whichever country it was in - switching Country
  // afterward left it selected even though it no longer matches anything in
  // the new country's data, showing a confusing "no data" with the Campaign
  // dropdown stuck on a name not in its own option list (found live
  // 2026-09-06). Skips the initial mount (the `didMount` guard) since the
  // very first render sets countryFilter's initial value too, and that's
  // exactly when a "Keywords" link's campaign_id needs to survive. Only
  // campaignFilter is reset here, not portfolioFilter - resetting
  // portfolioFilter on this same dependency would also fire when
  // handleLoadProfile sets country+portfolio together, wiping the portfolio
  // a saved profile just set.
  const didMountCountryReset = useRef(false);
  useEffect(() => {
    if (didMountCountryReset.current) {
      setCampaignFilter("");
    } else {
      didMountCountryReset.current = true;
    }
  }, [countryFilter]);

  useEffect(() => {
    const root = document.getElementById("root");
    root?.classList.add("full-bleed");
    return () => root?.classList.remove("full-bleed");
  }, []);

  const countryCodes = countryOptions;
  // Lets the stats sub-row look up its 5-window data by rowKey - the main
  // row is always the flat, single-period keywords list now.
  const historyByKey = new Map(
    historyKeywords.map((k) => [`${k.countryCode}-${k.adProduct}-${k.campaignId}-${k.adGroupId}-${k.targetId}`, k])
  );
  const campaignOptions = [...new Map(keywords.map((k) => [k.campaignId, k.campaignName])).entries()].sort(
    (a, b) => (a[1] || "").localeCompare(b[1] || "")
  );

  const visibleKeywords = keywords.filter(
    (k) => (k.spend || 0) > 0 && (!adProductFilter || k.adProduct === adProductFilter) && (!campaignFilter || k.campaignId === campaignFilter)
  );

  const totals = visibleKeywords.reduce(
    (acc, k) => ({
      spend: acc.spend + (k.spend || 0),
      sales: acc.sales + (k.sales || 0),
      impressions: acc.impressions + (k.impressions || 0),
      clicks: acc.clicks + (k.clicks || 0),
      orders: acc.orders + (k.orders || 0),
    }),
    { spend: 0, sales: 0, impressions: 0, clicks: 0, orders: 0 }
  );

  const sortedKeywords = [...visibleKeywords];
  if (sortField) {
    sortedKeywords.sort((a, b) => {
      const av = sortField === "acos" ? a.acos || 0 : a[sortField] || 0;
      const bv = sortField === "acos" ? b.acos || 0 : b[sortField] || 0;
      return sortDir === "desc" ? bv - av : av - bv;
    });
  }

  return (
    <div style={{ padding: "20px 0", fontFamily: "Arial, sans-serif", minHeight: "100vh", background: "#fafafa" }}>
      <h2 style={{ textAlign: "center", marginBottom: "20px" }}>Ads Keyword / Target Statistics</h2>

      <div style={{ ...cardStyle(), borderRadius: 0, borderLeft: "none", borderRight: "none", marginBottom: "20px" }}>
        <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap", marginBottom: "12px" }}>
          {PRESETS.map((p) => (
            <button
              key={p.key}
              type="button"
              onClick={() => setPreset(p.key)}
              style={{
                padding: "8px 14px",
                fontSize: "13px",
                borderRadius: "6px",
                border: preset === p.key ? "2px solid #1976d2" : "1px solid #ccc",
                background: preset === p.key ? "#e3f2fd" : "#fff",
                color: "#222",
                fontWeight: preset === p.key ? 700 : 400,
                cursor: "pointer",
              }}
            >
              {p.label}
            </button>
          ))}
        </div>

        {preset === "month" && (
          <div style={{ display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap", marginBottom: "12px" }}>
            <label>
              Month ({new Date().getFullYear()}):{" "}
              <select
                style={inputStyle()}
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(Number(e.target.value))}
              >
                {MONTH_LABELS.map((label, i) => (
                  <option key={label} value={i + 1} disabled={i + 1 > currentMonth}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}

        {preset === "custom" && (
          <div style={{ display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap", marginBottom: "12px" }}>
            <label>
              Start:{" "}
              <input
                type="date"
                style={inputStyle()}
                value={customStart}
                max={customEnd}
                onChange={(e) => setCustomStart(e.target.value)}
              />
            </label>
            <label>
              End:{" "}
              <input
                type="date"
                style={inputStyle()}
                value={customEnd}
                min={customStart}
                max={getLosAngelesToday()}
                onChange={(e) => setCustomEnd(e.target.value)}
              />
            </label>
          </div>
        )}

        <div style={{ display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap", marginBottom: "14px" }}>
          <label>
            Country:{" "}
            <select style={inputStyle()} value={countryFilter} onChange={(e) => setCountryFilter(e.target.value)}>
              <option value="">All</option>
              {countryCodes.map((code) => (
                <option key={code} value={code}>
                  {code}
                </option>
              ))}
            </select>
          </label>
          <label>
            Ad Type:{" "}
            <select style={inputStyle()} value={adProductFilter} onChange={(e) => setAdProductFilter(e.target.value)}>
              <option value="">All</option>
              {Object.entries(AD_PRODUCT_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Portfolio:{" "}
            <select style={inputStyle()} value={portfolioFilter} onChange={(e) => setPortfolioFilter(e.target.value)}>
              <option value="">All</option>
              {portfolioOptionsFor(countryFilter).map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Campaign:{" "}
            <select style={inputStyle()} value={campaignFilter} onChange={(e) => setCampaignFilter(e.target.value)}>
              <option value="">All</option>
              {campaignOptions.map(([id, name]) => (
                <option key={id} value={id}>
                  {name || id}
                </option>
              ))}
            </select>
          </label>
        </div>

        <p style={{ fontSize: "13px", color: "#777", marginTop: 0 }}>
          Refreshed daily (Amazon's Reporting API only retains ~60 days of history for keyword-level detail).
        </p>

        <div style={{ ...cardStyle(), background: "#f8fafc", marginBottom: "16px" }}>
          <div
            style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}
            onClick={() => setShowRules((s) => !s)}
          >
            <h4 style={{ margin: 0 }}>Bid Recommendations {showRules ? "▲" : "▼"}</h4>
            {recMeta && (
              <span style={{ fontSize: "12px", color: "#555" }}>
                {recMeta.proposalsCount} recommendation(s)
                {recMeta.skippedRecentlyChanged > 0 && ` · ${recMeta.skippedRecentlyChanged} skipped (recently changed)`}
              </span>
            )}
          </div>
          {showRules && (
            <div style={{ marginTop: "12px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: "10px" }}>
                <RuleFieldsGrid rules={rules} setRules={setRules} />
              </div>
              <ProfileControls
                savedProfiles={savedProfiles}
                selectedProfile={selectedProfile}
                onLoad={handleLoadProfile}
                onClear={handleClearProfile}
                profileNameInput={profileNameInput}
                setProfileNameInput={setProfileNameInput}
                onSave={handleSaveProfile}
                onDelete={handleDeleteProfile}
                error={profileError}
              />
              <div style={{ marginTop: "12px" }}>
                <button
                  style={{ ...buttonStyle(), opacity: recLoading ? 0.6 : 1, cursor: recLoading ? "not-allowed" : "pointer" }}
                  disabled={recLoading}
                  onClick={getRecommendations}
                >
                  {recLoading ? "Loading..." : "Get Recommendations"}
                </button>
                {recError && <span style={{ marginLeft: "12px", color: "#b00020", fontSize: "13px" }}>{recError}</span>}
              </div>
            </div>
          )}
        </div>

        {loading && <p>Loading keyword stats...</p>}
        {error && <div className="error">{error}</div>}

        {!loading && !error && visibleKeywords.length === 0 && <p>No keyword data yet.</p>}

        {!loading && visibleKeywords.length > 0 && (
          <>
            <div style={{ display: "flex", gap: "24px", marginBottom: "16px", fontWeight: 600 }}>
              <span>Total Spend: {formatMoney(totals.spend, visibleKeywords[0]?.currencyCode)}</span>
              <span>Total Sales: {formatMoney(totals.sales, visibleKeywords[0]?.currencyCode)}</span>
              <span>ACOS: {totals.sales ? ((totals.spend / totals.sales) * 100).toFixed(1) : "0.0"}%</span>
            </div>

            <div style={{ overflowX: "auto" }}>
              <table style={{ borderCollapse: "collapse", width: "100%" }}>
                <thead>
                  <tr>
                    <th style={tableCellStyle({ background: "#f4f4f4" })}>Keyword / Target</th>
                    <th style={compactCellStyle({ background: "#f4f4f4" })}>Match Type</th>
                    <th style={compactCellStyle({ background: "#f4f4f4" })}>Campaign</th>
                    <th style={compactCellStyle({ background: "#f4f4f4" })}>Ad Group</th>
                    <th style={compactCellStyle({ background: "#f4f4f4" })}>Ad Type</th>
                    <th style={tableCellStyle({ background: "#f4f4f4", width: "50px" })}>Clicks</th>
                    <th style={sortHeaderStyle("spend")} onClick={() => toggleSort("spend")}>
                      Spend{sortArrow("spend")}
                    </th>
                    <th style={tableCellStyle({ background: "#f4f4f4" })}>Sales</th>
                    <th style={tableCellStyle({ background: "#f4f4f4", width: "50px" })}>Orders</th>
                    <th style={sortHeaderStyle("acos")} onClick={() => toggleSort("acos")}>
                      ACOS{sortArrow("acos")}
                    </th>
                    <th style={tableCellStyle({ background: "#f4f4f4" })}>Bid</th>
                    {recommendations && (
                      <>
                        <th style={tableCellStyle({ background: "#f4f4f4" })}>Recommendation</th>
                        <th style={tableCellStyle({ background: "#f4f4f4", maxWidth: "140px" })}></th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {sortedKeywords.map((k) => {
                    const rowKey = `${k.countryCode}-${k.adProduct}-${k.campaignId}-${k.adGroupId}-${k.targetId}`;
                    const historyRow = historyByKey.get(rowKey);
                    const proposal = recommendations?.get(k.targetId);
                    // Lets Apply/Disable + a manual bid be used on any
                    // keyword, not just ones the optimizer produced a
                    // proposal for (e.g. below its min_spend threshold) -
                    // per the user's request (2026-09-06). currentBid comes
                    // from this row's own real Amazon-reported bid.
                    const effectiveProposal = proposal || {
                      targetId: k.targetId,
                      campaignId: k.campaignId,
                      adGroupId: k.adGroupId,
                      campaignName: k.campaignName,
                      targetText: k.targetText,
                      targetType: k.targetType,
                      matchType: k.matchType,
                      adProduct: k.adProduct,
                      countryCode: k.countryCode,
                      profileId: k.profileId,
                      currentBid: k.bid,
                      proposedBid: k.bid,
                      reason: "",
                    };
                    return (
                      <Fragment key={rowKey}>
                      <tr>
                        <td style={tableCellStyle({ fontWeight: "bold" })}>{k.targetText || k.targetId}</td>
                        <td style={compactCellStyle()}>{k.matchType}</td>
                        <td style={compactCellStyle()}>{k.campaignName}</td>
                        <td style={compactCellStyle()}>{k.adGroupName}</td>
                        <td style={compactCellStyle()}>{AD_PRODUCT_LABELS[k.adProduct] || k.adProduct}</td>
                        <td style={tableCellStyle({ width: "50px" })}>{k.clicks}</td>
                        <td style={tableCellStyle()}>{formatMoney(k.spend, k.currencyCode)}</td>
                        <td style={tableCellStyle()}>{formatMoney(k.sales, k.currencyCode)}</td>
                        <td style={tableCellStyle({ width: "50px" })}>{k.orders}</td>
                        <td style={tableCellStyle()}>{k.acos.toFixed(1)}%</td>
                        <td style={tableCellStyle()}>
                          {k.bid ? formatMoney(k.bid, k.currencyCode) : "-"}
                          {k.bid && k.bidUnverified && (
                            <div style={{ color: "#b00020", fontSize: "11px" }}>unverified</div>
                          )}
                          {bidHistoryByTarget.has(k.targetId) && (
                            <div style={{ fontSize: "11px", color: "#888" }}>
                              Last change: {bidHistoryByTarget.get(k.targetId)[0]?.changedAt}
                            </div>
                          )}
                        </td>
                        {recommendations && (
                          <>
                            <td style={compactCellStyle({ maxWidth: "220px" })}>
                              {k.bidUnverified ? (
                                <div style={{ color: "#b00020", fontSize: "12px" }}>
                                  Bid unverified (last known from a historical import, not confirmed current on
                                  Amazon) - Apply disabled
                                </div>
                              ) : (
                                <>
                                  <input
                                    type="number"
                                    step="0.01"
                                    style={{ ...inputStyle(), width: "70px", padding: "4px 6px" }}
                                    value={editedBids[rowKey] ?? effectiveProposal.proposedBid ?? ""}
                                    onChange={(e) => setEditedBids((b) => ({ ...b, [rowKey]: e.target.value }))}
                                  />
                                  {proposal && <div style={{ color: "#555", fontSize: "13px" }}>{proposal.reason}</div>}
                                </>
                              )}
                            </td>
                            <td style={tableCellStyle({ maxWidth: "140px" })}>
                              {!k.bidUnverified && (
                              <>
                                  {applied[rowKey] ? (
                                    <span style={{ color: "#1b7a1b", fontWeight: 600, fontSize: "12px" }}>Applied ✓</span>
                                  ) : (
                                    <>
                                      <button
                                        style={{
                                          ...buttonStyle(),
                                          minWidth: "auto",
                                          padding: "6px 12px",
                                          fontSize: "12px",
                                          opacity: applying === rowKey ? 0.6 : 1,
                                          cursor: applying === rowKey ? "not-allowed" : "pointer",
                                        }}
                                        disabled={applying === rowKey}
                                        onClick={() => handleApply(effectiveProposal, rowKey)}
                                      >
                                        {applying === rowKey ? "Applying..." : "Apply"}
                                      </button>
                                      {applyError[rowKey] && (
                                        <div style={{ color: "#b00020", fontSize: "11px", marginTop: "4px", maxWidth: "140px" }}>
                                          {applyError[rowKey]}
                                        </div>
                                      )}
                                    </>
                                  )}
                                  {disabled[rowKey] ? (
                                    <div style={{ color: "#b00020", fontWeight: 600, fontSize: "12px", marginTop: "4px" }}>Disabled ✓</div>
                                  ) : (
                                    !applied[rowKey] && (
                                      <button
                                        style={{
                                          ...buttonStyle(),
                                          minWidth: "auto",
                                          padding: "6px 12px",
                                          fontSize: "12px",
                                          marginTop: "4px",
                                          background: "#b00020",
                                          opacity: disabling === rowKey ? 0.6 : 1,
                                          cursor: disabling === rowKey ? "not-allowed" : "pointer",
                                        }}
                                        disabled={disabling === rowKey}
                                        onClick={() => handleDisable(effectiveProposal, rowKey)}
                                      >
                                        {disabling === rowKey ? "..." : "Disable"}
                                      </button>
                                    )
                                  )}
                                  {disableError[rowKey] && (
                                    <div style={{ color: "#b00020", fontSize: "11px", marginTop: "4px", maxWidth: "140px" }}>
                                      {disableError[rowKey]}
                                    </div>
                                  )}
                                </>
                              )}
                            </td>
                          </>
                        )}
                      </tr>
                      {historyRow && (
                        <tr>
                          <td colSpan={20} style={tableCellStyle({ background: "#fafafa", padding: "8px 10px" })}>
                            <div style={{ display: "flex", gap: "28px", flexWrap: "wrap" }}>
                              <div>
                                <strong>Spend</strong>
                                <div>{renderPeriodLines(historyRow, "spend", formatMoney)}</div>
                              </div>
                              <div>
                                <strong>Sales</strong>
                                <div>{renderPeriodLines(historyRow, "sales", formatMoney)}</div>
                              </div>
                              <div>
                                <strong>ACOS</strong>
                                <div>{renderPeriodLines(historyRow, "acos", (v) => `${v.toFixed(1)}%`)}</div>
                              </div>
                              <div>
                                <strong>CPC</strong>
                                <div>{renderPeriodLines(historyRow, "cpc", formatMoney)}</div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                      {bidHistoryByTarget.has(k.targetId) && (
                        <tr>
                          <td colSpan={20} style={tableCellStyle({ background: "#fff8e1", padding: "10px" })}>
                            <strong style={{ fontSize: "18px" }}>Bid Change History</strong>
                            <div style={{ marginTop: "6px" }}>
                              {bidHistoryByTarget.get(k.targetId).map((c, i) => (
                                <div key={i} style={{ fontSize: "18px", marginBottom: "4px" }}>
                                  {c.changedAt}: {formatMoney(c.oldBid, k.currencyCode)} → {formatMoney(c.newBid, k.currencyCode)}
                                  {c.action === "disable" && <span style={{ color: "#b00020" }}> (disabled)</span>}
                                  {c.reason && <span style={{ color: "#888" }}> — {c.reason}</span>}
                                </div>
                              ))}
                            </div>
                          </td>
                        </tr>
                      )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      <div style={{ display: "flex", justifyContent: "center", gap: "10px", marginTop: "28px", paddingBottom: "16px" }}>
        <Link style={buttonStyle()} to="/">
          Home
        </Link>
        <Link style={buttonStyle()} to="/ads-campaigns">
          Campaigns
        </Link>
        <Link style={buttonStyle()} to="/ads-search-terms">
          Search Terms
        </Link>
        <Link style={buttonStyle()} to="/ads-advertised-products">
          Advertised Products
        </Link>
        <Link style={buttonStyle()} to="/ads-bid-optimizer">
          Bid Optimizer
        </Link>
      </div>
    </div>
  );
}
