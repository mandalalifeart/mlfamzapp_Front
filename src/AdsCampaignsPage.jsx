import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

const API_BASE =
  import.meta.env.VITE_API_BASE ||
  "https://us-central1-mlfamzapp.cloudfunctions.net";

function cardStyle() {
  return { background: "#fff", border: "1px solid #ddd", borderRadius: "8px", padding: "16px" };
}

function buttonStyle() {
  return {
    padding: "10px 18px",
    fontSize: "14px",
    cursor: "pointer",
    borderRadius: "8px",
    border: "none",
    background: "#1976d2",
    color: "#fff",
    fontWeight: "600",
    textDecoration: "none",
    display: "inline-block",
  };
}

function inputStyle() {
  return { padding: "10px", borderRadius: "8px", border: "1px solid #ccc" };
}

function tableCellStyle(extra = {}) {
  return { border: "1px solid #ccc", padding: "8px 10px", textAlign: "left", ...extra };
}

function formatMoney(value, currencyCode) {
  const amount = Number(value || 0);
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: currencyCode || "USD" }).format(amount);
  } catch {
    return amount.toFixed(2);
  }
}

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const AD_PRODUCT_LABELS = { SPONSORED_PRODUCTS: "SP", SPONSORED_BRANDS: "SB", SPONSORED_DISPLAY: "SD" };

export default function AdsCampaignsPage() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [countryFilter, setCountryFilter] = useState("");
  const [adProductFilter, setAdProductFilter] = useState("");
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ month, year });
      if (countryFilter) params.set("country_code", countryFilter);
      const response = await fetch(`${API_BASE}/GetAdsCampaignStats?${params.toString()}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || `HTTP ${response.status}`);
      setCampaigns(data.campaigns || []);
    } catch (err) {
      setError(err.message || "Failed to load campaign stats");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month, year, countryFilter]);

  const countryCodes = [...new Set(campaigns.map((c) => c.countryCode).filter(Boolean))].sort();

  const visibleCampaigns = adProductFilter
    ? campaigns.filter((c) => c.adProduct === adProductFilter)
    : campaigns;

  const totals = visibleCampaigns.reduce(
    (acc, c) => ({
      spend: acc.spend + (c.spend || 0),
      sales: acc.sales + (c.sales || 0),
      impressions: acc.impressions + (c.impressions || 0),
      clicks: acc.clicks + (c.clicks || 0),
      orders: acc.orders + (c.orders || 0),
    }),
    { spend: 0, sales: 0, impressions: 0, clicks: 0, orders: 0 }
  );

  return (
    <div style={{ padding: "20px", fontFamily: "Arial, sans-serif", minHeight: "100vh", background: "#fafafa" }}>
      <h2 style={{ textAlign: "center", marginBottom: "20px" }}>Ads Campaign Statistics</h2>

      <div style={{ ...cardStyle(), maxWidth: "1200px", marginInline: "auto", marginBottom: "20px" }}>
        <div style={{ display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap", marginBottom: "14px" }}>
          <label>
            Month:{" "}
            <select style={inputStyle()} value={month} onChange={(e) => setMonth(Number(e.target.value))}>
              {MONTH_LABELS.map((label, i) => (
                <option key={label} value={i + 1}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Year:{" "}
            <input
              type="number"
              style={inputStyle()}
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
            />
          </label>
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
        </div>

        {loading && <p>Loading campaign stats...</p>}
        {error && <div className="error">{error}</div>}

        {!loading && !error && visibleCampaigns.length === 0 && (
          <p>No campaign data for this period yet. The daily pull may not have run for this month, or no connected account has active campaigns.</p>
        )}

        {!loading && visibleCampaigns.length > 0 && (
          <>
            <div style={{ display: "flex", gap: "24px", marginBottom: "16px", fontWeight: 600 }}>
              <span>Total Spend: {formatMoney(totals.spend, visibleCampaigns[0]?.currencyCode)}</span>
              <span>Total Sales: {formatMoney(totals.sales, visibleCampaigns[0]?.currencyCode)}</span>
              <span>ACOS: {totals.sales ? ((totals.spend / totals.sales) * 100).toFixed(1) : "0.0"}%</span>
            </div>

            <div style={{ overflowX: "auto" }}>
              <table style={{ borderCollapse: "collapse", width: "100%" }}>
                <thead>
                  <tr>
                    <th style={tableCellStyle({ background: "#f4f4f4" })}>Campaign</th>
                    <th style={tableCellStyle({ background: "#f4f4f4" })}>Ad Type</th>
                    <th style={tableCellStyle({ background: "#f4f4f4" })}>Country</th>
                    <th style={tableCellStyle({ background: "#f4f4f4" })}>Status</th>
                    <th style={tableCellStyle({ background: "#f4f4f4" })}>Impressions</th>
                    <th style={tableCellStyle({ background: "#f4f4f4" })}>Clicks</th>
                    <th style={tableCellStyle({ background: "#f4f4f4" })}>Spend</th>
                    <th style={tableCellStyle({ background: "#f4f4f4" })}>Sales</th>
                    <th style={tableCellStyle({ background: "#f4f4f4" })}>Orders</th>
                    <th style={tableCellStyle({ background: "#f4f4f4" })}>ACOS</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleCampaigns.map((c) => (
                    <tr key={`${c.countryCode}-${c.adProduct}-${c.campaignId}`}>
                      <td style={tableCellStyle()}>{c.campaignName}</td>
                      <td style={tableCellStyle()}>{AD_PRODUCT_LABELS[c.adProduct] || c.adProduct}</td>
                      <td style={tableCellStyle()}>{c.countryCode}</td>
                      <td style={tableCellStyle()}>{c.campaignStatus}</td>
                      <td style={tableCellStyle()}>{c.impressions}</td>
                      <td style={tableCellStyle()}>{c.clicks}</td>
                      <td style={tableCellStyle()}>{formatMoney(c.spend, c.currencyCode)}</td>
                      <td style={tableCellStyle()}>{formatMoney(c.sales, c.currencyCode)}</td>
                      <td style={tableCellStyle()}>{c.orders}</td>
                      <td style={tableCellStyle()}>{c.acos.toFixed(1)}%</td>
                    </tr>
                  ))}
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
        <Link style={buttonStyle()} to="/ads">
          Ads Connections
        </Link>
      </div>
    </div>
  );
}
