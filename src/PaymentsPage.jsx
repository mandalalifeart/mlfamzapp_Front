import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { buttonStyle } from "./buttonStyle";

const API_BASE =
  import.meta.env.VITE_API_BASE ||
  "https://us-central1-mlfamzapp.cloudfunctions.net";
const FINANCES_REFRESH_KEY = import.meta.env.VITE_FINANCES_REFRESH_KEY || "";

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

// Display label + native currency per marketplace tag (see AmazonFinances.py's
// MARKETPLACE_NAME_TO_TAG/CURRENCY_FALLBACK_TAG - "eu"/"uk"/"pl"/"se" are
// currency-level fallback buckets used for event types that carry no
// per-event marketplace of their own, alongside real per-country tags for
// the dominant categories that do (de/fr/it/es/uk/nl/se/pl/be).
const MARKETPLACE_INFO = {
  usa: { label: "USA", currency: "USD" },
  ca: { label: "Canada", currency: "CAD" },
  mex: { label: "Mexico", currency: "MXN" },
  de: { label: "Germany", currency: "EUR" },
  fr: { label: "France", currency: "EUR" },
  it: { label: "Italy", currency: "EUR" },
  es: { label: "Spain", currency: "EUR" },
  nl: { label: "Netherlands", currency: "EUR" },
  be: { label: "Belgium", currency: "EUR" },
  ie: { label: "Ireland", currency: "EUR" },
  eu: { label: "EU (unattributed)", currency: "EUR" },
  uk: { label: "UK", currency: "GBP" },
  pl: { label: "Poland", currency: "PLN" },
  se: { label: "Sweden", currency: "SEK" },
};

function marketplaceLabel(tag) {
  return MARKETPLACE_INFO[tag]?.label || tag;
}

function marketplaceCurrency(tag) {
  return MARKETPLACE_INFO[tag]?.currency || "USD";
}

function cardStyle(extra = {}) {
  return { background: "#fff", border: "1px solid #ddd", borderRadius: "8px", padding: "16px", ...extra };
}

function tableCellStyle(extra = {}) {
  return { border: "1px solid #ccc", padding: "6px 8px", textAlign: "left", fontSize: "13px", ...extra };
}

function numberCellStyle(extra = {}) {
  return tableCellStyle({ textAlign: "right", whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums", ...extra });
}

const CURRENCY_SYMBOLS = { USD: "$", EUR: "€", GBP: "£" };

function formatMoney(amount, currency = "USD") {
  if (amount === null || amount === undefined) return "–";
  const symbol = CURRENCY_SYMBOLS[currency] || `${currency} `;
  const sign = amount < 0 ? "-" : "";
  return `${sign}${symbol}${Math.abs(amount).toFixed(2)}`;
}

function formatDate(iso) {
  if (!iso) return "–";
  return iso.slice(0, 10);
}

// Fixed display order so the biggest/most-relevant categories read top-to-bottom
// consistently across months, rather than jumping around by whatever order
// PocketBase happens to return - "Other: X"/"Other Service Fee (X)"/"Other
// Charge (X)"/"Other Fee (X)" labels are dynamic (see AmazonFinances.py's
// generic fallback categorizer) so those sort alphabetically after the fixed set.
const CATEGORY_ORDER = [
  "Sales Revenue",
  "Shipping Charged to Buyer",
  "Tax Collected",
  "Referral Fee",
  "FBA Fulfillment Fee",
  "FBA Storage Fee",
  "FBA Returns Processing Fee",
  "FBA Removal Fee",
  "FBA Liquidation Revenue",
  "AWD Fee",
  "Subscription Fee",
  "Other Selling Fees",
  "Advertising",
  "Refunds",
];

function sortedCategories(categories) {
  const keys = Object.keys(categories);
  return keys.sort((a, b) => {
    const ai = CATEGORY_ORDER.indexOf(a);
    const bi = CATEGORY_ORDER.indexOf(b);
    if (ai !== -1 && bi !== -1) return ai - bi;
    if (ai !== -1) return -1;
    if (bi !== -1) return 1;
    return a.localeCompare(b);
  });
}

export default function PaymentsPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [refreshNote, setRefreshNote] = useState("");
  const [selectedMarketplace, setSelectedMarketplace] = useState("usa");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`${API_BASE}/GetPaymentsExpensesSummary`);
      const result = await response.json();
      if (!response.ok || result.error) throw new Error(result?.error || `HTTP ${response.status}`);
      setData(result);
      if (result.marketplaces?.length && !result.marketplaces.includes(selectedMarketplace)) {
        setSelectedMarketplace(result.marketplaces[0]);
      }
    } catch (err) {
      setError(err.message || "Failed to load payments summary");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function refresh() {
    setRefreshing(true);
    setRefreshNote("");
    try {
      const response = await fetch(`${API_BASE}/UpdateAmazonFinances?key=${encodeURIComponent(FINANCES_REFRESH_KEY)}`);
      const result = await response.json();
      if (!response.ok || result.error) throw new Error(result?.error || `HTTP ${response.status}`);
      if (result.acceptedInBackground) {
        setRefreshNote("Pulling in the background (this can take a while given Amazon's rate limit) — reload in a bit to see new data.");
      } else {
        const parts = Object.entries(result.regions || {}).map(
          ([region, r]) => `${region}: ${r.settlementsWritten} period(s), ${r.eventsProcessed} with detail${r.eventsUnavailable ? `, ${r.eventsUnavailable} too old for detail` : ""}${r.groupErrors?.length ? `, ${r.groupErrors.length} error(s)` : ""}`
        );
        setRefreshNote(parts.join(" · ") || "Refreshed.");
      }
      await load();
    } catch (err) {
      setRefreshNote(`Refresh failed: ${err.message || err}`);
    } finally {
      setRefreshing(false);
    }
  }

  const allSettlements = data?.settlements || [];
  const allMonths = data?.months || [];
  const marketplaces = data?.marketplaces || [];
  const byMarketplace = data?.totalDisbursedByMarketplace || {};

  const settlements = useMemo(
    () => allSettlements.filter((s) => s.marketplace === selectedMarketplace),
    [allSettlements, selectedMarketplace]
  );
  const openPeriods = useMemo(
    () => settlements.filter((s) => s.status === "Open"),
    [settlements]
  );
  const months = useMemo(
    () => allMonths.filter((m) => m.marketplace === selectedMarketplace),
    [allMonths, selectedMarketplace]
  );
  const currency = marketplaceCurrency(selectedMarketplace);

  return (
    <div style={{ padding: "20px 0", fontFamily: "Arial, sans-serif", minHeight: "100vh", background: "#fafafa" }}>
      <h2 style={{ textAlign: "center", marginBottom: "6px" }}>Payments & Expenses</h2>
      <p style={{ textAlign: "center", fontSize: "13px", color: "#555", marginBottom: "16px" }}>
        Amazon USA + EU settlements (disbursements) and fee/expense breakdown, pulled from the SP-API Finances API.
      </p>

      <div style={{ display: "flex", justifyContent: "center", gap: "10px", marginBottom: "16px" }}>
        <button style={buttonStyle()} onClick={refresh} disabled={refreshing}>
          {refreshing ? "Refreshing..." : "Refresh from Amazon"}
        </button>
      </div>
      {refreshNote && <p style={{ textAlign: "center", fontSize: "13px", color: "#555" }}>{refreshNote}</p>}

      {error && <div style={{ margin: "0 16px 16px", color: "#b00020", textAlign: "center" }}>{error}</div>}
      {loading && <p style={{ textAlign: "center" }}>Loading...</p>}

      {!loading && !error && (
        <>
          <div style={{ ...cardStyle(), margin: "0 16px 20px" }}>
            <div style={{ fontSize: "12px", color: "#888", textTransform: "uppercase", marginBottom: "8px" }}>
              Total Disbursed (native currency, all-time, by marketplace)
            </div>
            <div style={{ display: "flex", gap: "20px", flexWrap: "wrap" }}>
              {Object.keys(byMarketplace).length === 0 && <span style={{ color: "#888", fontSize: "13px" }}>No data yet.</span>}
              {Object.entries(byMarketplace).map(([tag, entry]) => (
                <div key={tag}>
                  <div style={{ fontSize: "20px", fontWeight: 700 }}>{formatMoney(entry.amount, entry.currency)}</div>
                  <div style={{ fontSize: "11px", color: "#888" }}>{marketplaceLabel(tag)}</div>
                </div>
              ))}
            </div>
          </div>

          {marketplaces.length > 0 && (
            <div style={{ display: "flex", justifyContent: "center", gap: "6px", flexWrap: "wrap", margin: "0 16px 16px" }}>
              {marketplaces.map((tag) => (
                <button
                  key={tag}
                  onClick={() => setSelectedMarketplace(tag)}
                  style={{
                    padding: "6px 12px", borderRadius: "16px", fontSize: "12px", cursor: "pointer",
                    border: tag === selectedMarketplace ? "1px solid #1a73e8" : "1px solid #ccc",
                    background: tag === selectedMarketplace ? "#e8f0fe" : "#fff",
                    color: tag === selectedMarketplace ? "#1a73e8" : "#333",
                    fontWeight: tag === selectedMarketplace ? 700 : 400,
                  }}
                >
                  {marketplaceLabel(tag)}
                </button>
              ))}
            </div>
          )}

          {openPeriods.length > 0 && (
            <div style={{ ...cardStyle(), margin: "0 16px 20px" }}>
              <div style={{ fontSize: "12px", color: "#888", textTransform: "uppercase", marginBottom: "6px" }}>
                Open Period{openPeriods.length > 1 ? "s" : ""} (not yet paid out) — {marketplaceLabel(selectedMarketplace)}
              </div>
              {openPeriods.map((p) => (
                <div key={p.group_id} style={{ fontSize: "13px" }}>
                  {formatMoney(p.original_amount, p.currency)} <span style={{ color: "#888" }}>(since {formatDate(p.period_start)})</span>
                </div>
              ))}
            </div>
          )}

          <div style={{ ...cardStyle(), margin: "0 16px 20px" }}>
            <h3 style={{ marginTop: 0 }}>Settlement History — {marketplaceLabel(selectedMarketplace)}</h3>
            <div style={{ overflowX: "auto" }}>
              <table style={{ borderCollapse: "collapse", width: "100%" }}>
                <thead>
                  <tr>
                    <th style={tableCellStyle({ background: "#f4f4f4" })}>Period</th>
                    <th style={tableCellStyle({ background: "#f4f4f4" })}>Status</th>
                    <th style={numberCellStyle({ background: "#f4f4f4" })}>Amount</th>
                    <th style={tableCellStyle({ background: "#f4f4f4" })}>Paid Out</th>
                    <th style={tableCellStyle({ background: "#f4f4f4" })}>Trace ID</th>
                  </tr>
                </thead>
                <tbody>
                  {settlements.map((s) => (
                    <tr key={s.id}>
                      <td style={tableCellStyle()}>
                        {formatDate(s.period_start)} → {formatDate(s.period_end) === "–" ? "ongoing" : formatDate(s.period_end)}
                      </td>
                      <td style={tableCellStyle()}>
                        {s.status}
                        {s.fund_transfer_status && s.fund_transfer_status !== "Succeeded" && (
                          <span style={{ color: "#b00020" }}> ({s.fund_transfer_status})</span>
                        )}
                      </td>
                      <td style={numberCellStyle()}>{formatMoney(s.original_amount, s.currency)}</td>
                      <td style={tableCellStyle()}>{formatDate(s.fund_transfer_date)}</td>
                      <td style={tableCellStyle({ fontSize: "11px", color: "#888" })}>{s.trace_id}</td>
                    </tr>
                  ))}
                  {settlements.length === 0 && (
                    <tr>
                      <td style={tableCellStyle()} colSpan={5}>No settlements for this marketplace yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div style={{ margin: "0 16px 20px", display: "flex", flexDirection: "column", gap: "16px" }}>
            {months.map((m) => (
              <div key={`${m.marketplace}-${m.year}-${m.month}`} style={cardStyle()}>
                <h3 style={{ marginTop: 0 }}>
                  {MONTH_NAMES[m.month - 1]} {m.year}
                  <span style={{ fontWeight: 400, fontSize: "13px", color: "#888", marginLeft: "10px" }}>
                    Net: <strong style={{ color: m.net >= 0 ? "#1b7a1b" : "#b00020" }}>{formatMoney(m.net, currency)}</strong>
                  </span>
                </h3>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ borderCollapse: "collapse", width: "100%", maxWidth: "480px" }}>
                    <tbody>
                      {sortedCategories(m.categories).map((cat) => (
                        <tr key={cat}>
                          <td style={tableCellStyle()}>{cat}</td>
                          <td style={numberCellStyle({ color: m.categories[cat] < 0 ? "#b00020" : "#1b7a1b" })}>
                            {formatMoney(m.categories[cat], currency)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
            {months.length === 0 && (
              <p style={{ textAlign: "center", color: "#555" }}>No expense data for this marketplace yet.</p>
            )}
          </div>

          <p style={{ textAlign: "center", fontSize: "11px", color: "#999", margin: "0 16px 20px" }}>
            "EU (unattributed)"/"UK"/"Poland"/"Sweden" group event types (storage fees, advertising, etc.) that don't carry
            a per-event country from Amazon at the settlement-currency level, rather than a specific country — sales/fees/refunds
            with a real per-order marketplace are broken out by real country. Categories are grouped by real Amazon fee/charge
            types where recognized; anything unrecognized still shows up under an "Other: ..." label rather than being dropped.
          </p>
        </>
      )}

      <div style={{ display: "flex", justifyContent: "center", gap: "10px", paddingBottom: "16px" }}>
        <Link style={buttonStyle()} to="/">
          Home
        </Link>
        <Link style={buttonStyle()} to="/sales">
          Sales
        </Link>
      </div>
    </div>
  );
}
