import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { buttonStyle } from "./buttonStyle";

const API_BASE =
  import.meta.env.VITE_API_BASE ||
  "https://us-central1-mlfamzapp.cloudfunctions.net";

function cardStyle() {
  return { background: "#fff", border: "1px solid #ddd", borderRadius: "8px", padding: "16px" };
}



function inputStyle() {
  return { padding: "8px 10px", borderRadius: "6px", border: "1px solid #ccc", width: "90px" };
}

function selectStyle() {
  return { padding: "8px 10px", borderRadius: "6px", border: "1px solid #ccc" };
}

function tableCellStyle(extra = {}) {
  return { border: "1px solid #ccc", padding: "6px 8px", textAlign: "left", fontSize: "13px", ...extra };
}

function numberCellStyle(extra = {}) {
  return tableCellStyle({ textAlign: "right", whiteSpace: "nowrap", ...extra });
}

function formatMoney(v) {
  return `$${Number(v || 0).toFixed(2)}`;
}

function formatAcos(v) {
  return v === null || v === undefined ? "–" : `${v.toFixed(1)}%`;
}

// Green when ACOS improved (went down) after the change, red when it got
// worse, grey when there's not enough data yet either side to compare.
function acosDeltaColor(before, after) {
  if (before === null || before === undefined || after === null || after === undefined) return "#888";
  return after < before ? "#1b7a1b" : after > before ? "#b00020" : "#888";
}

export default function BidChangePerformancePage() {
  const [windowDays, setWindowDays] = useState(14);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [countryFilter, setCountryFilter] = useState("");
  const [portfolioFilter, setPortfolioFilter] = useState("");
  const [campaignFilter, setCampaignFilter] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`${API_BASE}/GetBidChangePerformance?window_days=${windowDays}`);
      const result = await response.json();
      if (!response.ok || result.error) throw new Error(result?.error || `HTTP ${response.status}`);
      setData(result);
    } catch (err) {
      setError(err.message || "Failed to load bid change performance");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [windowDays]);

  useEffect(() => {
    const root = document.getElementById("root");
    root?.classList.add("full-bleed");
    return () => root?.classList.remove("full-bleed");
  }, []);

  const allChanges = data?.changes || [];

  // Cascading: each dropdown's options are scoped by whichever filters are
  // "upstream" of it (Country -> Portfolio -> Campaign), so picking a
  // country only offers that country's real portfolios/campaigns instead of
  // every portfolio across every country (2026-09-10, per the user).
  const countries = useMemo(() => [...new Set(allChanges.map((c) => c.countryCode).filter(Boolean))].sort(), [allChanges]);
  const portfolios = useMemo(
    () =>
      [...new Set(allChanges.filter((c) => !countryFilter || c.countryCode === countryFilter).map((c) => c.portfolioName).filter(Boolean))].sort(),
    [allChanges, countryFilter]
  );
  const campaigns = useMemo(
    () =>
      [...new Set(
        allChanges
          .filter((c) => (!countryFilter || c.countryCode === countryFilter) && (!portfolioFilter || c.portfolioName === portfolioFilter))
          .map((c) => c.campaignName)
          .filter(Boolean)
      )].sort(),
    [allChanges, countryFilter, portfolioFilter]
  );

  function handleCountryFilterChange(value) {
    setCountryFilter(value);
    if (portfolioFilter && !allChanges.some((c) => c.countryCode === value && c.portfolioName === portfolioFilter)) {
      setPortfolioFilter("");
    }
    if (campaignFilter && !allChanges.some((c) => c.countryCode === value && c.campaignName === campaignFilter)) {
      setCampaignFilter("");
    }
  }

  function handlePortfolioFilterChange(value) {
    setPortfolioFilter(value);
    if (campaignFilter && !allChanges.some((c) => c.portfolioName === value && c.campaignName === campaignFilter)) {
      setCampaignFilter("");
    }
  }

  const changes = useMemo(
    () =>
      allChanges.filter(
        (c) =>
          (!countryFilter || c.countryCode === countryFilter) &&
          (!portfolioFilter || c.portfolioName === portfolioFilter) &&
          (!campaignFilter || c.campaignName === campaignFilter)
      ),
    [allChanges, countryFilter, portfolioFilter, campaignFilter]
  );

  return (
    <div style={{ padding: "20px 0", fontFamily: "Arial, sans-serif", minHeight: "100vh", background: "#fafafa" }}>
      <h2 style={{ textAlign: "center", marginBottom: "6px" }}>Bid Change Performance</h2>
      <p style={{ textAlign: "center", fontSize: "13px", color: "#555", marginBottom: "16px" }}>
        Every bid change applied through the Bid Optimizer, with performance in the window before vs. after.
      </p>

      <div style={{ ...cardStyle(), margin: "0 16px 20px", display: "flex", alignItems: "center", gap: "16px", justifyContent: "center", flexWrap: "wrap" }}>
        <label style={{ fontSize: "13px", color: "#555" }}>
          Compare window (days before/after):{" "}
          <input
            style={inputStyle()}
            type="number"
            min="1"
            value={windowDays}
            onChange={(e) => setWindowDays(Number(e.target.value) || 14)}
          />
        </label>

        <label style={{ fontSize: "13px", color: "#555" }}>
          Country:{" "}
          <select style={selectStyle()} value={countryFilter} onChange={(e) => handleCountryFilterChange(e.target.value)}>
            <option value="">All</option>
            {countries.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </label>

        <label style={{ fontSize: "13px", color: "#555" }}>
          Portfolio:{" "}
          <select style={selectStyle()} value={portfolioFilter} onChange={(e) => handlePortfolioFilterChange(e.target.value)}>
            <option value="">All</option>
            {portfolios.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </label>

        <label style={{ fontSize: "13px", color: "#555" }}>
          Campaign:{" "}
          <select style={selectStyle()} value={campaignFilter} onChange={(e) => setCampaignFilter(e.target.value)}>
            <option value="">All</option>
            {campaigns.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </label>
      </div>

      {error && <div style={{ margin: "0 16px 16px", color: "#b00020", textAlign: "center" }}>{error}</div>}
      {loading && <p style={{ textAlign: "center" }}>Loading...</p>}

      {!loading && !error && allChanges.length === 0 && (
        <p style={{ textAlign: "center", color: "#555" }}>
          No applied bid changes yet - once you click Apply on a proposal in the Bid Optimizer, it'll show up here.
        </p>
      )}
      {!loading && !error && allChanges.length > 0 && changes.length === 0 && (
        <p style={{ textAlign: "center", color: "#555" }}>No bid changes match this filter.</p>
      )}

      {!loading && changes.length > 0 && (
        <div style={{ ...cardStyle(), margin: "0 16px 20px" }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ borderCollapse: "collapse", width: "100%", tableLayout: "fixed" }}>
              <thead>
                <tr>
                  <th style={tableCellStyle({ background: "#f4f4f4", width: "150px" })}>Target</th>
                  <th style={tableCellStyle({ background: "#f4f4f4", width: "120px" })}>Campaign</th>
                  <th style={tableCellStyle({ background: "#f4f4f4", width: "100px" })}>Portfolio</th>
                  <th style={tableCellStyle({ background: "#f4f4f4", width: "70px" })}>Country</th>
                  <th style={numberCellStyle({ background: "#f4f4f4", width: "90px" })}>Bid Change</th>
                  <th style={tableCellStyle({ background: "#f4f4f4", width: "90px" })}>Changed</th>
                  <th style={numberCellStyle({ background: "#f4f4f4", width: "70px" })}>Before Spend</th>
                  <th style={numberCellStyle({ background: "#f4f4f4", width: "70px" })}>Before ACOS</th>
                  <th style={numberCellStyle({ background: "#f4f4f4", width: "70px" })}>After Spend</th>
                  <th style={numberCellStyle({ background: "#f4f4f4", width: "70px" })}>After ACOS</th>
                  <th style={tableCellStyle({ background: "#f4f4f4" })}>Original Reason</th>
                </tr>
              </thead>
              <tbody>
                {changes.map((c, i) => (
                  <tr key={`${c.targetId}-${c.changedAt}-${i}`}>
                    <td style={tableCellStyle()}>{c.targetText || c.targetId}</td>
                    <td style={tableCellStyle()}>{c.campaignName}</td>
                    <td style={tableCellStyle()}>{c.portfolioName || "–"}</td>
                    <td style={tableCellStyle()}>{c.countryCode}</td>
                    <td style={numberCellStyle()}>
                      {formatMoney(c.oldBid)} → {formatMoney(c.newBid)}
                    </td>
                    <td style={tableCellStyle()}>
                      {c.changedAt}
                      <div style={{ fontSize: "11px", color: "#888" }}>{c.daysSinceChange}d ago</div>
                    </td>
                    <td style={numberCellStyle()}>{formatMoney(c.before.spend)}</td>
                    <td style={numberCellStyle()}>{formatAcos(c.before.acos)}</td>
                    <td style={numberCellStyle()}>{formatMoney(c.after.spend)}</td>
                    <td style={numberCellStyle({ fontWeight: 700, color: acosDeltaColor(c.before.acos, c.after.acos) })}>
                      {formatAcos(c.after.acos)}
                    </td>
                    <td style={tableCellStyle({ fontSize: "12px", color: "#555", whiteSpace: "normal" })}>{c.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "center", gap: "10px", paddingBottom: "16px" }}>
        <Link style={buttonStyle()} to="/">
          Home
        </Link>
        <Link style={buttonStyle()} to="/ads-bid-optimizer">
          Bid Optimizer
        </Link>
      </div>
    </div>
  );
}
