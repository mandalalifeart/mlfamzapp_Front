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

function formatMoney(value, currencyCode) {
  const amount = Number(value || 0);
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: currencyCode || "USD" }).format(amount);
  } catch {
    return amount.toFixed(2);
  }
}

const AD_PRODUCT_LABELS = { SPONSORED_PRODUCTS: "SP", SPONSORED_BRANDS: "SB", SPONSORED_DISPLAY: "SD" };
const LA_TIME_ZONE = "America/Los_Angeles";

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const PRESETS = [
  { key: "today", label: "Today" },
  { key: "yesterday", label: "Yesterday" },
  { key: "last7days", label: "Last 7 Days" },
  { key: "ytd", label: "Year to Date" },
  { key: "month", label: "Month" },
  { key: "custom", label: "Custom" },
];

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
  // Don't request a range that extends past today (the current month, or a
  // clock/timezone edge case).
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
    case "ytd":
      return { startDate: `${today.slice(0, 4)}-01-01`, endDate: today };
    case "month":
      return getMonthRange(Number(today.slice(0, 4)), selectedMonth);
    default:
      return { startDate: today, endDate: today };
  }
}

export default function AdsCampaignsPage() {
  const [preset, setPreset] = useState("last7days");
  const [customStart, setCustomStart] = useState(getLosAngelesToday());
  const [customEnd, setCustomEnd] = useState(getLosAngelesToday());
  const [selectedMonth, setSelectedMonth] = useState(Number(getLosAngelesToday().slice(5, 7)));
  const [countryFilter, setCountryFilter] = useState("");
  const [adProductFilter, setAdProductFilter] = useState("");
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const currentMonth = Number(getLosAngelesToday().slice(5, 7));
  const { startDate, endDate } =
    preset === "custom" ? { startDate: customStart, endDate: customEnd } : getPresetRange(preset, selectedMonth);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ start_date: startDate, end_date: endDate });
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
  }, [startDate, endDate, countryFilter]);

  const countryCodes = [...new Set(campaigns.map((c) => c.countryCode).filter(Boolean))].sort();

  const visibleCampaigns = campaigns.filter(
    (c) => (c.spend || 0) > 0 && (!adProductFilter || c.adProduct === adProductFilter)
  );

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
                    <th style={tableCellStyle({ background: "#f4f4f4" })}></th>
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
                      <td style={tableCellStyle()}>
                        <Link
                          to={`/ads-keywords?campaign_id=${encodeURIComponent(c.campaignId)}&campaign_name=${encodeURIComponent(c.campaignName)}`}
                        >
                          Keywords
                        </Link>
                      </td>
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
        <Link style={buttonStyle()} to="/ads-keywords">
          Keyword Stats
        </Link>
      </div>
    </div>
  );
}
