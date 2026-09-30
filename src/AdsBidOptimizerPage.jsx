import { Fragment, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { applyBidChange, disableBidTarget } from "./bidApply";
import { RULE_FIELDS } from "./bidRules";
import { buttonStyle } from "./buttonStyle";
import RuleFieldsGrid from "./RuleFieldsGrid";
import ProfileControls from "./ProfileControls";
import { useBidRuleProfiles } from "./useBidRuleProfiles";
import ReasonBreakdownRow from "./ReasonBreakdownRow";
import { useAdsFilterOptions } from "./useAdsFilterOptions";

const API_BASE =
  import.meta.env.VITE_API_BASE ||
  "https://us-central1-mlfamzapp.cloudfunctions.net";

function cardStyle() {
  return { background: "#fff", border: "1px solid #ddd", borderRadius: "8px", padding: "16px" };
}

function inputStyle() {
  return {
    padding: "8px 10px",
    borderRadius: "6px",
    border: "1px solid #ccc",
    width: "90px",
    background: "#fff",
    color: "#222",
  };
}

function tableCellStyle(extra = {}) {
  return { border: "1px solid #ccc", padding: "3px 5px", textAlign: "left", fontSize: "12px", ...extra };
}

function numberCellStyle(extra = {}) {
  return tableCellStyle({ textAlign: "right", whiteSpace: "nowrap", ...extra });
}

function formatMoney(v) {
  return `$${Number(v || 0).toFixed(2)}`;
}

const SORT_OPTIONS = [
  { key: "spend", label: "Spend" },
  { key: "actualAcos", label: "ACOS" },
  { key: "clicks", label: "Clicks" },
];

export default function AdsBidOptimizerPage() {
  const [rules, setRules] = useState(Object.fromEntries(RULE_FIELDS.map((f) => [f.key, f.default])));
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sortKey, setSortKey] = useState("spend");
  const [sortDir, setSortDir] = useState("desc");
  const [portfolio, setPortfolio] = useState("");
  const { countryOptions, portfolioOptionsFor, campaignOptionsFor } = useAdsFilterOptions();
  const [country, setCountry] = useState("");
  const [campaignFilter, setCampaignFilter] = useState("");
  const [applying, setApplying] = useState(null);
  const [applied, setApplied] = useState({});
  const [applyError, setApplyError] = useState({});
  const [disabling, setDisabling] = useState(null);
  const [disabled, setDisabled] = useState({});
  const [disableError, setDisableError] = useState({});
  const [editedBids, setEditedBids] = useState({});
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
  } = useBidRuleProfiles({ rules, setRules, country, setCountry, portfolio, setPortfolio });

  async function handleApply(p, key) {
    const bidToApply = Number(editedBids[key] ?? p.proposedBid);
    setApplying(key);
    setApplyError((e) => ({ ...e, [key]: "" }));
    try {
      await applyBidChange({ ...p, proposedBid: bidToApply });
      setApplied((a) => ({ ...a, [key]: true }));
    } catch (err) {
      setApplyError((e) => ({ ...e, [key]: err.message || "Failed to apply" }));
    } finally {
      setApplying(null);
    }
  }

  async function handleDisable(p, key) {
    if (!window.confirm(`Pause "${p.targetText}" on Amazon? This stops it from serving until re-enabled in the Ads Console.`)) return;
    setDisabling(key);
    setDisableError((e) => ({ ...e, [key]: "" }));
    try {
      await disableBidTarget(p);
      setDisabled((d) => ({ ...d, [key]: true }));
    } catch (err) {
      setDisableError((e) => ({ ...e, [key]: err.message || "Failed to disable" }));
    } finally {
      setDisabling(null);
    }
  }

  useEffect(() => {
    const root = document.getElementById("root");
    root?.classList.add("full-bleed");
    return () => root?.classList.remove("full-bleed");
  }, []);

  // A stale campaign selection from before a Country/Portfolio switch no
  // longer matches anything in the new selection - same staleness issue
  // fixed on the Keywords/Search Terms pages.
  const didMountCountryReset = useRef(false);
  useEffect(() => {
    if (didMountCountryReset.current) {
      setCampaignFilter("");
    } else {
      didMountCountryReset.current = true;
    }
  }, [country, portfolio]);

  async function runOptimizer() {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams(Object.fromEntries(Object.entries(rules).map(([k, v]) => [k, String(v)])));
      if (portfolio) params.set("portfolio", portfolio);
      if (country) params.set("country_code", country);
      const response = await fetch(`${API_BASE}/RunBidOptimizerDryRun?${params.toString()}`);
      const data = await response.json();
      if (!response.ok || data.error) throw new Error(data?.error || `HTTP ${response.status}`);
      setResult(data);
      setEditedBids({});
      setApplied({});
      setApplyError({});
    } catch (err) {
      setError(err.message || "Failed to run optimizer");
    } finally {
      setLoading(false);
    }
  }

  function toggleSort(key) {
    if (sortKey === key) {
      setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  const campaignOptions = campaignOptionsFor(country, portfolio);
  const proposals = (result?.proposals || []).filter((p) => !campaignFilter || p.campaignId === campaignFilter);
  proposals.sort((a, b) => {
    const av = a[sortKey] ?? -Infinity;
    const bv = b[sortKey] ?? -Infinity;
    return sortDir === "desc" ? bv - av : av - bv;
  });

  return (
    <div style={{ padding: "20px 0", fontFamily: "Arial, sans-serif", minHeight: "100vh", background: "#fafafa" }}>
      <h2 style={{ textAlign: "center", marginBottom: "20px" }}>Bid Optimizer</h2>

      <div style={{ ...cardStyle(), margin: "0 16px 20px" }}>
        <h3 style={{ marginTop: 0 }}>Rules</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "12px" }}>
          <label style={{ display: "flex", flexDirection: "column", gap: "4px", fontSize: "12px", color: "#555" }}>
            Country
            <select
              style={{ ...inputStyle(), width: "auto" }}
              value={country}
              onChange={(e) => setCountry(e.target.value)}
            >
              <option value="">All countries</option>
              {countryOptions.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: "4px", fontSize: "12px", color: "#555" }}>
            Campaign
            <select
              style={{ ...inputStyle(), width: "auto" }}
              value={campaignFilter}
              onChange={(e) => setCampaignFilter(e.target.value)}
            >
              <option value="">All campaigns</option>
              {campaignOptions.map(([id, name]) => (
                <option key={id} value={id}>
                  {name || id}
                </option>
              ))}
            </select>
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: "4px", fontSize: "12px", color: "#555" }}>
            Portfolio
            <select
              style={{ ...inputStyle(), width: "auto" }}
              value={portfolio}
              onChange={(e) => setPortfolio(e.target.value)}
            >
              <option value="">All portfolios</option>
              {portfolioOptionsFor(country).map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </label>
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
        <div style={{ marginTop: "16px", textAlign: "center" }}>
          <button style={buttonStyle(loading)} disabled={loading} onClick={runOptimizer}>
            {loading ? "Running..." : "Run Optimizer"}
          </button>
        </div>
      </div>

      {error && <div style={{ margin: "0 16px 16px", color: "#b00020", textAlign: "center" }}>{error}</div>}

      {result && (
        <div style={{ ...cardStyle(), margin: "0 16px 20px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: "8px", marginBottom: "12px" }}>
            <div style={{ fontSize: "13px", color: "#555" }}>
              Window: {result.startDate} to {result.endDate} &middot; {result.targetsEvaluated} targets evaluated &middot;{" "}
              <strong>{proposals.length} proposed changes</strong>
              {campaignFilter && proposals.length !== result.proposalsCount && <> (of {result.proposalsCount} total)</>}
              {result.skippedRecentlyChanged > 0 && (
                <> &middot; {result.skippedRecentlyChanged} skipped (bid already changed in this window)</>
              )}
            </div>
            <div style={{ fontSize: "12px", color: "#888" }}>Sort by: </div>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table style={{ borderCollapse: "collapse", width: "100%", tableLayout: "fixed" }}>
              <thead>
                <tr>
                  <th style={tableCellStyle({ background: "#f4f4f4", width: "42px" })}>Country</th>
                  <th style={tableCellStyle({ background: "#f4f4f4", width: "80px" })}>Portfolio</th>
                  <th style={tableCellStyle({ background: "#f4f4f4", width: "100px" })}>Campaign</th>
                  <th style={tableCellStyle({ background: "#f4f4f4", width: "130px" })}>Target</th>
                  <th style={tableCellStyle({ background: "#f4f4f4", width: "38px" })}>Match</th>
                  {SORT_OPTIONS.map((opt) => (
                    <th
                      key={opt.key}
                      style={numberCellStyle({ background: "#f4f4f4", cursor: "pointer", width: "60px" })}
                      onClick={() => toggleSort(opt.key)}
                    >
                      {opt.label} {sortKey === opt.key ? (sortDir === "desc" ? "↓" : "↑") : ""}
                    </th>
                  ))}
                  <th style={numberCellStyle({ background: "#f4f4f4", width: "65px" })}>Sales</th>
                  <th style={numberCellStyle({ background: "#f4f4f4", width: "45px" })}>Current Bid</th>
                  <th style={numberCellStyle({ background: "#f4f4f4", width: "50px" })}>Proposed Bid</th>
                  <th style={tableCellStyle({ background: "#f4f4f4", width: "100px" })}></th>
                </tr>
              </thead>
              <tbody>
                {proposals.map((p, i) => {
                  const key = `${p.targetId}-${i}`;
                  const editedValue = editedBids[key] ?? p.proposedBid;
                  return (
                    <Fragment key={key}>
                    <tr>
                      <td style={tableCellStyle()}>{p.countryCode}</td>
                      <td style={tableCellStyle()}>{p.portfolioName || "–"}</td>
                      <td style={tableCellStyle()}>{p.campaignName}</td>
                      <td style={tableCellStyle()}>{p.targetText}</td>
                      <td style={tableCellStyle()} title={p.matchType}>{p.matchType?.charAt(0) || ""}</td>
                      <td style={numberCellStyle()}>{formatMoney(p.spend)}</td>
                      <td style={numberCellStyle()}>{p.actualAcos !== null && p.actualAcos !== undefined ? `${p.actualAcos}%` : "–"}</td>
                      <td style={numberCellStyle()}>{p.clicks}</td>
                      <td style={numberCellStyle()}>{formatMoney(p.sales)}</td>
                      <td style={numberCellStyle()}>{formatMoney(p.currentBid)}</td>
                      <td
                        style={numberCellStyle({
                          fontWeight: 700,
                          color: p.proposedBid > p.currentBid ? "#1b7a1b" : "#b00020",
                        })}
                      >
                        {formatMoney(p.proposedBid)}
                      </td>
                      <td style={tableCellStyle()}>
                        {applied[key] ? (
                          <span style={{ color: "#1b7a1b", fontWeight: 600, fontSize: "12px" }}>Applied ✓</span>
                        ) : (
                          <>
                            <input
                              type="number"
                              step="0.01"
                              value={editedValue}
                              onChange={(e) => setEditedBids((b) => ({ ...b, [key]: e.target.value }))}
                              style={{
                                width: "60px",
                                padding: "3px 4px",
                                fontSize: "12px",
                                borderRadius: "4px",
                                border: "1px solid #ccc",
                                marginBottom: "4px",
                                display: "block",
                              }}
                            />
                            <button
                              style={{ ...buttonStyle(applying === key), minWidth: "60px", padding: "4px 8px", fontSize: "11px", width: "60px" }}
                              disabled={applying === key}
                              onClick={() => handleApply(p, key)}
                            >
                              {applying === key ? "Applying..." : "Apply"}
                            </button>
                          </>
                        )}
                        {applyError[key] && (
                          <div style={{ color: "#b00020", fontSize: "11px", marginTop: "4px", maxWidth: "160px" }}>
                            {applyError[key]}
                          </div>
                        )}
                        {disabled[key] ? (
                          <div style={{ color: "#b00020", fontWeight: 600, fontSize: "12px", marginTop: "4px" }}>Disabled ✓</div>
                        ) : (
                          !applied[key] && (
                            <button
                              style={{
                                ...buttonStyle(disabling === key),
                                minWidth: "60px",
                                width: "60px",
                                padding: "4px 8px",
                                fontSize: "11px",
                                marginTop: "4px",
                                background: "#b00020",
                              }}
                              disabled={disabling === key}
                              onClick={() => handleDisable(p, key)}
                            >
                              {disabling === key ? "..." : "Disable"}
                            </button>
                          )
                        )}
                        {disableError[key] && (
                          <div style={{ color: "#b00020", fontSize: "11px", marginTop: "4px", maxWidth: "160px" }}>
                            {disableError[key]}
                          </div>
                        )}
                      </td>
                    </tr>
                    <ReasonBreakdownRow proposal={p} colSpan={12} />
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "center", gap: "10px", paddingBottom: "16px" }}>
        <Link style={buttonStyle()} to="/">
          Home
        </Link>
        <Link style={buttonStyle()} to="/bid-change-performance">
          Bid Change Performance
        </Link>
      </div>
    </div>
  );
}
