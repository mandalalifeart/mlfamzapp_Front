import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import { buttonStyle } from "./buttonStyle";
import { pauseProductAd, enableProductAd } from "./bidApply";
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

function formatMoney(value, currencyCode) {
  const amount = Number(value || 0);
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: currencyCode || "USD" }).format(amount);
  } catch {
    return amount.toFixed(2);
  }
}

const AD_PRODUCT_LABELS = { SPONSORED_PRODUCTS: "SP", SPONSORED_DISPLAY: "SD" };
const LA_TIME_ZONE = "America/Los_Angeles";
const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const PRESETS = [
  { key: "lastmonth", label: "Last Month" },
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
    case "lastmonth": {
      const [y, m] = today.split("-").map(Number);
      const prevMonth = m === 1 ? 12 : m - 1;
      const prevYear = m === 1 ? y - 1 : y;
      return getMonthRange(prevYear, prevMonth);
    }
    case "ytd":
      return { startDate: `${today.slice(0, 4)}-01-01`, endDate: today };
    case "month":
      return getMonthRange(Number(today.slice(0, 4)), selectedMonth);
    default:
      return { startDate: today, endDate: today };
  }
}

export default function AdsAdvertisedProductsPage() {
  const [searchParams] = useSearchParams();
  const [preset, setPreset] = useState("lastmonth");
  const [customStart, setCustomStart] = useState(getLosAngelesToday());
  const [customEnd, setCustomEnd] = useState(getLosAngelesToday());
  const [selectedMonth, setSelectedMonth] = useState(Number(getLosAngelesToday().slice(5, 7)));
  const [countryFilter, setCountryFilter] = useState("");
  const [adProductFilter, setAdProductFilter] = useState("");
  const { countryOptions } = useAdsFilterOptions();
  const campaignIdFilter = searchParams.get("campaign_id") || "";
  const campaignNameFilter = searchParams.get("campaign_name") || "";
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sortField, setSortField] = useState("spend");
  const [sortDir, setSortDir] = useState("desc");
  const [checked, setChecked] = useState({});
  const [pausing, setPausing] = useState(false);
  const [paused, setPaused] = useState({});
  const [pauseErrors, setPauseErrors] = useState({});
  const [enabling, setEnabling] = useState(false);
  const [enabled, setEnabled] = useState({});
  const [enableErrors, setEnableErrors] = useState({});

  const currentMonth = Number(getLosAngelesToday().slice(5, 7));
  const { startDate, endDate } =
    preset === "custom" ? { startDate: customStart, endDate: customEnd } : getPresetRange(preset, selectedMonth);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ start_date: startDate, end_date: endDate });
      if (countryFilter) params.set("country_code", countryFilter);
      if (campaignIdFilter) params.set("campaign_id", campaignIdFilter);
      const response = await fetch(`${API_BASE}/GetAdsAdvertisedProductStats?${params.toString()}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || `HTTP ${response.status}`);
      setProducts(data.products || []);
    } catch (err) {
      setError(err.message || "Failed to load advertised product stats");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate, endDate, countryFilter, campaignIdFilter]);

  useEffect(() => {
    const root = document.getElementById("root");
    root?.classList.add("full-bleed");
    return () => root?.classList.remove("full-bleed");
  }, []);

  function rowKey(p) {
    return `${p.countryCode}-${p.adProduct}-${p.campaignId}-${p.asin}`;
  }

  function toggleChecked(key) {
    setChecked((c) => ({ ...c, [key]: !c[key] }));
  }

  async function pauseAllChecked() {
    const keys = Object.keys(checked).filter((k) => checked[k]);
    if (keys.length === 0) return;
    if (!window.confirm(`Pause ${keys.length} product ad(s) on Amazon? This stops them from serving until re-enabled.`)) return;

    setPausing(true);
    const byKey = Object.fromEntries(sortedProducts.map((p) => [rowKey(p), p]));
    for (const key of keys) {
      const row = byKey[key];
      if (!row) continue;
      try {
        await pauseProductAd(row);
        setPaused((p) => ({ ...p, [key]: true }));
        setEnabled((e) => ({ ...e, [key]: false }));
        setPauseErrors((e) => ({ ...e, [key]: "" }));
      } catch (err) {
        setPauseErrors((e) => ({ ...e, [key]: err.message || "Failed to pause" }));
      }
    }
    setChecked({});
    setPausing(false);
  }

  async function enableAllChecked() {
    const keys = Object.keys(checked).filter((k) => checked[k]);
    if (keys.length === 0) return;
    if (!window.confirm(`Enable ${keys.length} product ad(s) on Amazon? This resumes them serving.`)) return;

    setEnabling(true);
    const byKey = Object.fromEntries(sortedProducts.map((p) => [rowKey(p), p]));
    for (const key of keys) {
      const row = byKey[key];
      if (!row) continue;
      try {
        await enableProductAd(row);
        setEnabled((e) => ({ ...e, [key]: true }));
        setPaused((p) => ({ ...p, [key]: false }));
        setEnableErrors((e) => ({ ...e, [key]: "" }));
      } catch (err) {
        setEnableErrors((e) => ({ ...e, [key]: err.message || "Failed to enable" }));
      }
    }
    setChecked({});
    setEnabling(false);
  }

  function toggleSort(field) {
    if (sortField === field) {
      setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  }

  const countryCodes = countryOptions;

  const visibleProducts = adProductFilter ? products.filter((p) => p.adProduct === adProductFilter) : products;

  const totals = visibleProducts.reduce(
    (acc, p) => ({
      spend: acc.spend + (p.spend || 0),
      sales: acc.sales + (p.sales || 0),
      impressions: acc.impressions + (p.impressions || 0),
      clicks: acc.clicks + (p.clicks || 0),
      orders: acc.orders + (p.orders || 0),
    }),
    { spend: 0, sales: 0, impressions: 0, clicks: 0, orders: 0 }
  );

  const sortedProducts = [...visibleProducts].sort((a, b) => {
    if (sortField === "sku") {
      const av = a.sku || "";
      const bv = b.sku || "";
      return sortDir === "desc" ? bv.localeCompare(av) : av.localeCompare(bv);
    }
    const av = sortField === "acos" ? a.acos || 0 : a[sortField] || 0;
    const bv = sortField === "acos" ? b.acos || 0 : b[sortField] || 0;
    return sortDir === "desc" ? bv - av : av - bv;
  });

  return (
    <div style={{ padding: "20px 0", fontFamily: "Arial, sans-serif", minHeight: "100vh", background: "#fafafa" }}>
      <h2 style={{ textAlign: "center", marginBottom: "20px" }}>Advertised Product Performance</h2>

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
          {campaignIdFilter && (
            <span style={{ fontSize: "13px", color: "#555" }}>
              Filtered to campaign: <strong>{campaignNameFilter || campaignIdFilter}</strong>{" "}
              <Link to="/ads-advertised-products">(clear)</Link>
            </span>
          )}
        </div>

        <p style={{ fontSize: "13px", color: "#777", marginTop: 0 }}>
          Monthly data — refreshed on the 1st of each month for the previous calendar month. Sponsored Products and
          Sponsored Display only (Sponsored Brands has no advertised-product-level report).
        </p>

        {loading && <p>Loading advertised product stats...</p>}
        {error && <div className="error">{error}</div>}

        {!loading && !error && visibleProducts.length === 0 && (
          <p>No advertised product data for this period yet. The monthly pull runs on the 1st.</p>
        )}

        {!loading && visibleProducts.length > 0 && (
          <>
            <div style={{ display: "flex", gap: "24px", marginBottom: "16px", fontWeight: 600, alignItems: "center", flexWrap: "wrap" }}>
              <span>Total Spend: {formatMoney(totals.spend, visibleProducts[0]?.currencyCode)}</span>
              <span>Total Sales: {formatMoney(totals.sales, visibleProducts[0]?.currencyCode)}</span>
              <span>ACOS: {totals.sales ? ((totals.spend / totals.sales) * 100).toFixed(1) : "0.0"}%</span>
              <button
                style={{
                  ...buttonStyle(pausing || enabling || !Object.values(checked).some(Boolean)),
                  minWidth: "auto",
                  padding: "8px 14px",
                  fontSize: "13px",
                  background: "#b00020",
                  opacity: pausing || enabling || !Object.values(checked).some(Boolean) ? 0.6 : 1,
                  cursor: pausing || enabling || !Object.values(checked).some(Boolean) ? "not-allowed" : "pointer",
                }}
                disabled={pausing || enabling || !Object.values(checked).some(Boolean)}
                onClick={pauseAllChecked}
              >
                {pausing ? "Pausing..." : "Pause Checked"}
              </button>
              <button
                style={{
                  ...buttonStyle(pausing || enabling || !Object.values(checked).some(Boolean)),
                  minWidth: "auto",
                  padding: "8px 14px",
                  fontSize: "13px",
                  background: "#1b7a1b",
                  opacity: pausing || enabling || !Object.values(checked).some(Boolean) ? 0.6 : 1,
                  cursor: pausing || enabling || !Object.values(checked).some(Boolean) ? "not-allowed" : "pointer",
                }}
                disabled={pausing || enabling || !Object.values(checked).some(Boolean)}
                onClick={enableAllChecked}
              >
                {enabling ? "Enabling..." : "Enable Checked"}
              </button>
            </div>

            <div style={{ overflowX: "auto" }}>
              <table style={{ borderCollapse: "collapse", width: "100%" }}>
                <thead>
                  <tr>
                    <th style={tableCellStyle({ background: "#f4f4f4" })}></th>
                    <th style={tableCellStyle({ background: "#f4f4f4", cursor: "pointer" })} onClick={() => toggleSort("sku")}>
                      SKU {sortField === "sku" ? (sortDir === "desc" ? "↓" : "↑") : ""}
                    </th>
                    <th style={tableCellStyle({ background: "#f4f4f4" })}>ASIN</th>
                    <th style={tableCellStyle({ background: "#f4f4f4" })}>Campaign</th>
                    <th style={tableCellStyle({ background: "#f4f4f4" })}>Ad Group</th>
                    <th style={tableCellStyle({ background: "#f4f4f4" })}>Ad Type</th>
                    <th style={tableCellStyle({ background: "#f4f4f4" })}>Country</th>
                    <th style={tableCellStyle({ background: "#f4f4f4", cursor: "pointer" })} onClick={() => toggleSort("impressions")}>
                      Impressions {sortField === "impressions" ? (sortDir === "desc" ? "↓" : "↑") : ""}
                    </th>
                    <th style={tableCellStyle({ background: "#f4f4f4", cursor: "pointer" })} onClick={() => toggleSort("clicks")}>
                      Clicks {sortField === "clicks" ? (sortDir === "desc" ? "↓" : "↑") : ""}
                    </th>
                    <th style={tableCellStyle({ background: "#f4f4f4", cursor: "pointer" })} onClick={() => toggleSort("spend")}>
                      Spend {sortField === "spend" ? (sortDir === "desc" ? "↓" : "↑") : ""}
                    </th>
                    <th style={tableCellStyle({ background: "#f4f4f4", cursor: "pointer" })} onClick={() => toggleSort("sales")}>
                      Sales {sortField === "sales" ? (sortDir === "desc" ? "↓" : "↑") : ""}
                    </th>
                    <th style={tableCellStyle({ background: "#f4f4f4", cursor: "pointer" })} onClick={() => toggleSort("orders")}>
                      Orders {sortField === "orders" ? (sortDir === "desc" ? "↓" : "↑") : ""}
                    </th>
                    <th style={tableCellStyle({ background: "#f4f4f4", cursor: "pointer" })} onClick={() => toggleSort("acos")}>
                      ACOS {sortField === "acos" ? (sortDir === "desc" ? "↓" : "↑") : ""}
                    </th>
                    <th style={tableCellStyle({ background: "#f4f4f4" })}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedProducts.map((p) => {
                    const key = rowKey(p);
                    const isArchived = enabled[key] ? false : paused[key] ? false : p.adStatus === "ARCHIVED";
                    // Only the live-connected US Ads account can actually be
                    // written to right now - EU/UK rows here come from the
                    // manual CSV import and the connected EU profile has no
                    // real access to those campaigns (known account-mismatch
                    // issue), so pause/enable would just fail there.
                    const notWritable = p.countryCode !== "US";
                    return (
                      <tr key={key}>
                        <td style={tableCellStyle()}>
                          {isArchived ? (
                            <span style={{ color: "#888", fontSize: "11px" }} title="Archived on Amazon - cannot be paused or enabled via API">
                              Archived
                            </span>
                          ) : notWritable ? (
                            <span style={{ color: "#ccc", fontSize: "11px" }} title="Not connected to the live Ads API for this marketplace yet - pause/enable isn't available for non-US rows">
                              —
                            </span>
                          ) : (
                            <input
                              type="checkbox"
                              checked={!!checked[key]}
                              onChange={() => toggleChecked(key)}
                            />
                          )}
                          {pauseErrors[key] && (
                            <div style={{ color: "#b00020", fontSize: "10px", maxWidth: "90px" }}>{pauseErrors[key]}</div>
                          )}
                          {enableErrors[key] && (
                            <div style={{ color: "#b00020", fontSize: "10px", maxWidth: "90px" }}>{enableErrors[key]}</div>
                          )}
                        </td>
                        <td style={tableCellStyle({ whiteSpace: "pre-line" })}>{p.sku}</td>
                        <td style={tableCellStyle()}>{p.asin}</td>
                        <td style={tableCellStyle()}>{p.campaignName}</td>
                        <td style={tableCellStyle()}>{p.adGroupName}</td>
                        <td style={tableCellStyle()}>{AD_PRODUCT_LABELS[p.adProduct] || p.adProduct}</td>
                        <td style={tableCellStyle()}>{p.countryCode}</td>
                        <td style={tableCellStyle()}>{p.impressions}</td>
                        <td style={tableCellStyle()}>{p.clicks}</td>
                        <td style={tableCellStyle()}>{formatMoney(p.spend, p.currencyCode)}</td>
                        <td style={tableCellStyle()}>{formatMoney(p.sales, p.currencyCode)}</td>
                        <td style={tableCellStyle()}>{p.orders}</td>
                        <td style={tableCellStyle()}>{p.acos.toFixed(1)}%</td>
                        <td
                          style={tableCellStyle({
                            color: enabled[key] ? "#1b7a1b" : paused[key] ? "#b00020" : p.adStatus === "ENABLED" ? "#1b7a1b" : "#888",
                            fontWeight: 600,
                            fontSize: "12px",
                          })}
                        >
                          {enabled[key]
                            ? "Active"
                            : paused[key]
                            ? "Paused"
                            : p.adStatus === "ENABLED" ? "Active" : p.adStatus === "PAUSED" ? "Paused" : p.adStatus === "ARCHIVED" ? "Archived" : p.adStatus || "—"}
                        </td>
                      </tr>
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
        <Link style={buttonStyle()} to="/ads-keywords">
          Keywords
        </Link>
      </div>
    </div>
  );
}
