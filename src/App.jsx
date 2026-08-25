import { Link, useNavigate } from "react-router-dom";
import { useEffect, useMemo, useRef, useState } from "react";
import "./App.css";

const LA_TIME_ZONE = "America/Los_Angeles";
const API_BASE = "https://us-central1-mlfamzapp.cloudfunctions.net";

function formatMoney(value, currencyCode) {
  const amount = Number(value || 0);
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: currencyCode || "USD" }).format(amount);
  } catch {
    return amount.toFixed(2);
  }
}

function AdsAccountSummary() {
  const [accounts, setAccounts] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const now = new Date();
    fetch(`${API_BASE}/GetAdsAccountSummary?month=${now.getMonth() + 1}&year=${now.getFullYear()}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.error) throw new Error(data.error);
        setAccounts(data.accounts || []);
      })
      .catch((err) => setError(err.message || "Failed to load ads summary"));
  }, []);

  if (error) return null;
  if (!accounts || accounts.length === 0) return null;

  return (
    <div
      style={{
        width: "100%",
        maxWidth: "900px",
        marginInline: "auto",
        marginBottom: "20px",
        background: "#efefef",
        borderRadius: "8px",
        padding: "16px",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
        <h3 style={{ margin: 0 }}>Ads Accounts (This Month)</h3>
        <Link to="/ads-campaigns" style={{ fontSize: "13px" }}>
          View campaigns &rarr;
        </Link>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "12px" }}>
        {accounts.map((account) => (
          <div
            key={account.countryCode}
            style={{ background: "#fff", border: "1px solid #ddd", borderRadius: "8px", padding: "12px" }}
          >
            <div style={{ fontWeight: 700, marginBottom: "6px" }}>{account.countryCode}</div>
            <div style={{ fontSize: "13px", color: "#555" }}>
              Spend: {formatMoney(account.spend, account.currencyCode)}
            </div>
            <div style={{ fontSize: "13px", color: "#555" }}>
              Sales: {formatMoney(account.sales, account.currencyCode)}
            </div>
            <div style={{ fontSize: "13px", color: "#555" }}>ACOS: {account.acos.toFixed(1)}%</div>
          </div>
        ))}
      </div>
    </div>
  );
}

const presets = [
  { key: "today", label: "TODAY" },
  { key: "yesterday", label: "YESTERDAY" },
  { key: "last3days", label: "LAST 3 DAYS" },
  { key: "lastWeek", label: "LAST WEEK" },
  { key: "last30days", label: "LAST 30 DAYS" },
  { key: "thisMonth", label: "THIS MONTH" },
  { key: "lastMonth", label: "LAST MONTH" },
  { key: "custom", label: "CUSTOM" },
];

// URL parameter aliases. Values are case-insensitive and can contain spaces, - or _.
// Examples: last3days, "last 3 days", last-3-days, last_3_days.
const PRESET_PARAM_MAP = {
  today: "today",
  yesterday: "yesterday",
  last3days: "last3days",
  last3day: "last3days",
  lastweek: "lastWeek",
  last7days: "lastWeek",
  last30days: "last30days",
  thismonth: "thisMonth",
  lastmonth: "lastMonth",
  custom: "custom",
};

function normalizePresetParam(value) {
  if (!value) return null;

  const normalized = String(value)
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, "");

  return PRESET_PARAM_MAP[normalized] || null;
}

function isValidDateString(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "")) return false;

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function getTimeZoneParts(date, timeZone) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  const map = {};

  for (const part of parts) {
    if (part.type !== "literal") {
      map[part.type] = part.value;
    }
  }

  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour: Number(map.hour),
    minute: Number(map.minute),
    second: Number(map.second),
  };
}

function getLosAngelesDateString(date = new Date()) {
  const parts = getTimeZoneParts(date, LA_TIME_ZONE);
  return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}

function shiftDateString(dateStr, days) {
  const [year, month, day] = dateStr.split("-").map(Number);
  const utcDate = new Date(Date.UTC(year, month - 1, day));
  utcDate.setUTCDate(utcDate.getUTCDate() + days);
  return utcDate.toISOString().slice(0, 10);
}

function startOfMonth(dateStr) {
  const [year, month] = dateStr.split("-").map(Number);
  return `${year}-${String(month).padStart(2, "0")}-01`;
}

function endOfMonth(dateStr) {
  const [year, month] = dateStr.split("-").map(Number);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
}

function getPresetDates(preset) {
  const laToday = getLosAngelesDateString();

  switch (preset) {
    case "today":
      return { startDate: laToday, endDate: laToday };
    case "yesterday": {
      const d = shiftDateString(laToday, -1);
      return { startDate: d, endDate: d };
    }
    case "last3days":
      return { startDate: shiftDateString(laToday, -2), endDate: laToday };
    case "lastWeek":
      return { startDate: shiftDateString(laToday, -6), endDate: laToday };
    case "last30days":
      return { startDate: shiftDateString(laToday, -29), endDate: laToday };
    case "thisMonth":
      return { startDate: startOfMonth(laToday), endDate: laToday };
    case "lastMonth": {
      const [year, month] = laToday.split("-").map(Number);
      const previousMonthDate = new Date(Date.UTC(year, month - 2, 1));
      const previousMonthStr = `${previousMonthDate.getUTCFullYear()}-${String(
        previousMonthDate.getUTCMonth() + 1
      ).padStart(2, "0")}-01`;

      return {
        startDate: startOfMonth(previousMonthStr),
        endDate: endOfMonth(previousMonthStr),
      };
    }
    default:
      return { startDate: "", endDate: "" };
  }
}

// A start/end URL parameter may be either an ISO date or one of the preset names.
// For a preset value, startDate uses the preset start boundary and endDate uses
// the preset end boundary.
function resolveUrlDateValue(value, boundary) {
  if (!value) return null;

  if (isValidDateString(value)) {
    return value;
  }

  const preset = normalizePresetParam(value);
  if (!preset || preset === "custom") return null;

  const dates = getPresetDates(preset);
  return boundary === "start" ? dates.startDate : dates.endDate;
}

function getUrlDateConfig(search = window.location.search) {
  const params = new URLSearchParams(search);

  const startParam =
    params.get("startDate") ||
    params.get("start_date") ||
    params.get("start");

  const endParam =
    params.get("endDate") ||
    params.get("end_date") ||
    params.get("end");

  const presetParam =
    params.get("preset") ||
    params.get("range") ||
    params.get("period");

  const hasDateParams = startParam !== null || endParam !== null;
  const hasPresetParam = presetParam !== null;
  const hasUrlParams = hasDateParams || hasPresetParam;

  // Explicit start/end take priority over preset/range.
  if (hasDateParams) {
    const startDate = resolveUrlDateValue(startParam, "start");
    const endDate = resolveUrlDateValue(endParam, "end");
    const isValid = Boolean(startDate && endDate && startDate <= endDate);

    return {
      selectedPreset: "custom",
      customStartDate: startDate || "",
      customEndDate: endDate || "",
      hasUrlParams,
      shouldAutoSubmit: isValid,
      urlError: isValid
        ? ""
        : "Invalid URL date parameters. Provide both a valid startDate and endDate.",
    };
  }

  if (hasPresetParam) {
    const selectedPreset = normalizePresetParam(presetParam);
    const isValid = Boolean(selectedPreset && selectedPreset !== "custom");

    return {
      selectedPreset: isValid ? selectedPreset : "today",
      customStartDate: "",
      customEndDate: "",
      hasUrlParams,
      shouldAutoSubmit: isValid,
      urlError: isValid ? "" : "Invalid URL range/preset parameter.",
    };
  }

  return {
    selectedPreset: "today",
    customStartDate: "",
    customEndDate: "",
    hasUrlParams: false,
    shouldAutoSubmit: false,
    urlError: "",
  };
}

function getTimeZoneOffsetMillis(date, timeZone) {
  const parts = getTimeZoneParts(date, timeZone);
  const asUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
    0
  );
  return asUtc - date.getTime();
}

function zonedDateTimeToUtc(dateStr, timeStr, timeZone) {
  const [year, month, day] = dateStr.split("-").map(Number);
  const [hour, minute, secondAndMs] = timeStr.split(":");
  const [second, ms = "0"] = secondAndMs.split(".");
  const msValue = Number(ms.padEnd(3, "0").slice(0, 3));

  // Milliseconds are excluded from the guess used to look up the zone offset:
  // getTimeZoneParts (via Intl.DateTimeFormat) has only whole-second granularity,
  // so a non-zero ms here would get truncated when read back and reintroduced
  // as error in the final result (e.g. 23:59:59.999 LA rolling into the next day).
  const utcGuess = Date.UTC(
    year,
    month - 1,
    day,
    Number(hour),
    Number(minute),
    Number(second),
    0
  );

  const offset = getTimeZoneOffsetMillis(new Date(utcGuess), timeZone);
  return new Date(utcGuess - offset + msValue);
}

function buildApiDateRange(startDateStr, endDateStr) {
  const now = new Date();
  const laToday = getLosAngelesDateString(now);
  const startDate = zonedDateTimeToUtc(startDateStr, "00:00:00.000", LA_TIME_ZONE);

  if (endDateStr === laToday) {
    return {
      start_date: startDate.toISOString(),
      end_date: now.toISOString(),
    };
  }

  const endDate = zonedDateTimeToUtc(endDateStr, "23:59:59.999", LA_TIME_ZONE);

  return {
    start_date: startDate.toISOString(),
    end_date: endDate.toISOString(),
  };
}

function bottomNavStyle() {
  return {
    display: "flex",
    justifyContent: "center",
    gap: "10px",
    marginTop: "28px",
    paddingBottom: "16px",
  };
}

// Same look whether applied to a <button> (which also picks up App.css's
// generic `button` rule) or a <Link>'s rendered <a> (which doesn't) - spelled
// out explicitly here so the two render identically.
function smallButtonStyle() {
  return {
    padding: "8px 16px",
    fontSize: "14px",
    cursor: "pointer",
    borderRadius: "8px",
    border: "none",
    background: "#7d94bc",
    color: "#fff",
    fontWeight: 700,
    textDecoration: "none",
    display: "inline-block",
  };
}

async function requestMarketplaceReport(payload) {
  const response = await fetch(`${API_BASE}/MlfReportReq`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  let data = null;

  try {
    data = await response.json();
  } catch (err) {
    throw new Error(`Invalid JSON response for ${payload.marketplace}`);
  }

  if (!response.ok || data?.status !== "success") {
    throw new Error(data?.message || `Request failed for ${payload.marketplace}`);
  }

  const reportReqId = data?.data?.report_req_id || data?.data?.reportId || data?.report_req_id || data?.reportId;

  if (!reportReqId) {
    throw new Error(`Missing report request ID for ${payload.marketplace}`);
  }

  return reportReqId;
}

function getRequestErrorText(reason) {
  if (!reason) return "Unknown error";
  if (typeof reason === "string") return reason;
  if (reason.message) return reason.message;

  try {
    return JSON.stringify(reason);
  } catch (err) {
    return "Unknown error";
  }
}

function buildMarketplaceDetails({ usaReportId, deReportId, usaError, deError, apiDates }) {
  return [
    {
      marketplace: "USA",
      requestId: usaReportId,
      status: usaReportId === "0" ? "FAILED" : "SUCCESS",
      message: usaReportId === "0" ? usaError || "Request failed" : "Report request created successfully",
    },
    {
      marketplace: "DE/EU",
      requestId: deReportId,
      status: deReportId === "0" ? "FAILED" : "SUCCESS",
      message: deReportId === "0" ? deError || "Request failed" : "Report request created successfully",
    },
    {
      marketplace: "Date range",
      requestId: "",
      status: "INFO",
      message: `start_date: ${apiDates.start_date} | end_date: ${apiDates.end_date}`,
    },
  ];
}

export default function App() {
  const navigate = useNavigate();

  const initialUrlConfig = useMemo(() => getUrlDateConfig(), []);

  const [selectedPreset, setSelectedPreset] = useState(initialUrlConfig.selectedPreset);
  const [customStartDate, setCustomStartDate] = useState(initialUrlConfig.customStartDate);
  const [customEndDate, setCustomEndDate] = useState(initialUrlConfig.customEndDate);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(initialUrlConfig.urlError || "");
  const [errorDetails, setErrorDetails] = useState([]);
  const autoSubmitStartedRef = useRef(false);

  const resolvedDates = useMemo(() => {
    if (selectedPreset === "custom") {
      return {
        startDate: customStartDate,
        endDate: customEndDate,
      };
    }
    return getPresetDates(selectedPreset);
  }, [selectedPreset, customStartDate, customEndDate]);

  async function submitReport(startDate, endDate) {
    setError("");
    setErrorDetails([]);

    if (!startDate || !endDate) {
      setError("Please choose start and end dates");
      return;
    }

    if (startDate > endDate) {
      setError("Start date cannot be later than end date");
      return;
    }

    setLoading(true);

    try {
      const apiDates = buildApiDateRange(startDate, endDate);

      const payloadUSA = {
        start_date: apiDates.start_date,
        end_date: apiDates.end_date,
        marketplace: "usa",
      };

      const payloadDE = {
        start_date: apiDates.start_date,
        end_date: apiDates.end_date,
        marketplace: "de",
      };

      const [usaResult, deResult] = await Promise.allSettled([
        requestMarketplaceReport(payloadUSA),
        requestMarketplaceReport(payloadDE),
      ]);

      const usaReportId = usaResult.status === "fulfilled" ? usaResult.value : "0";
      const deReportId = deResult.status === "fulfilled" ? deResult.value : "0";
      const usaError = usaResult.status === "rejected" ? getRequestErrorText(usaResult.reason) : "";
      const deError = deResult.status === "rejected" ? getRequestErrorText(deResult.reason) : "";

      const marketplaceDetails = buildMarketplaceDetails({
        usaReportId,
        deReportId,
        usaError,
        deError,
        apiDates,
      });

      if (usaReportId === "0" && deReportId === "0") {
        console.error("USA request failed:", usaResult.reason);
        console.error("DE request failed:", deResult.reason);
        setError("Both marketplace requests failed");
        setErrorDetails(marketplaceDetails);
        return;
      }

      if (usaReportId === "0") {
        console.warn("USA request failed. Continuing with DE only:", usaResult.reason);
      }

      if (deReportId === "0") {
        console.warn("DE request failed. Continuing with USA only:", deResult.reason);
      }

      navigate("/response", {
        state: {
          usaReportId,
          deReportId,
          startDate: apiDates.start_date,
          endDate: apiDates.end_date,
          partialFailure: usaReportId === "0" || deReportId === "0",
          marketplaceErrors: {
            usa: usaError,
            de: deError,
          },
          marketplaceDetails,
        },
      });
    } catch (err) {
      console.error(err);
      setError(err.message || "Something went wrong");
      setErrorDetails([
        {
          marketplace: "General",
          requestId: "",
          status: "FAILED",
          message: err.message || "Something went wrong",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(e) {
    e.preventDefault();
    submitReport(resolvedDates.startDate, resolvedDates.endDate);
  }

  // When valid URL parameters are present, behave exactly like pressing SUBMIT:
  // create the USA + DE report requests and navigate directly to /response.
  // The ref prevents duplicate API calls in React StrictMode during development.
  useEffect(() => {
    if (!initialUrlConfig.shouldAutoSubmit || autoSubmitStartedRef.current) {
      return;
    }

    autoSubmitStartedRef.current = true;

    const dates =
      initialUrlConfig.selectedPreset === "custom"
        ? {
            startDate: initialUrlConfig.customStartDate,
            endDate: initialUrlConfig.customEndDate,
          }
        : getPresetDates(initialUrlConfig.selectedPreset);

    submitReport(dates.startDate, dates.endDate);
    // This should run only once for the URL that loaded the page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="app" style={{ flexDirection: "column", alignItems: "center" }}>
      <AdsAccountSummary />
      <div className="card">
        <form onSubmit={handleSubmit}>
          <div className="radio-list">
            {presets.map((preset) => (
              <label key={preset.key} className="radio-row">
                <input
                  type="radio"
                  name="preset"
                  value={preset.key}
                  checked={selectedPreset === preset.key}
                  onChange={() => setSelectedPreset(preset.key)}
                />
                <span>{preset.label}</span>
              </label>
            ))}
          </div>

          <div className="field">
            <label>STARTDATE:</label>
            <input
              type="date"
              value={selectedPreset === "custom" ? customStartDate : resolvedDates.startDate}
              onChange={(e) => setCustomStartDate(e.target.value)}
              disabled={selectedPreset !== "custom"}
            />
          </div>

          <div className="field">
            <label>ENDDATE:</label>
            <input
              type="date"
              value={selectedPreset === "custom" ? customEndDate : resolvedDates.endDate}
              onChange={(e) => setCustomEndDate(e.target.value)}
              disabled={selectedPreset !== "custom"}
            />
          </div>

          <button type="submit" disabled={loading}>
            {loading ? "SUBMITTING..." : "SUBMIT"}
          </button>
        </form>

        {error && <div className="error">{error}</div>}

        {errorDetails.length > 0 && (
          <div
            style={{
              marginTop: "14px",
              padding: "12px",
              background: "#fff3f3",
              border: "1px solid #d9002f",
              borderRadius: "8px",
              fontSize: "14px",
              lineHeight: "1.5",
            }}
          >
            <strong>Error details:</strong>
            {errorDetails.map((item) => (
              <div key={`${item.marketplace}-${item.status}`} style={{ marginTop: "8px" }}>
                <div>
                  <strong>{item.marketplace}:</strong> {item.status}
                  {item.requestId ? ` | Request ID: ${item.requestId}` : ""}
                </div>
                <div>{item.message}</div>
              </div>
            ))}
          </div>
        )}

        <div style={bottomNavStyle()}>
          <Link style={smallButtonStyle()} to="/">
            Home
          </Link>
          <Link style={smallButtonStyle()} to="/sales">
            Sales
          </Link>
          <Link style={smallButtonStyle()} to="/batch-update">
            Batch Update
          </Link>
          <Link style={smallButtonStyle()} to="/ads">
            Ads
          </Link>
          <Link style={smallButtonStyle()} to="/etsy">
            Etsy
          </Link>
          <Link style={smallButtonStyle()} to="/next-order">
            Next Order
          </Link>
        </div>
      </div>
    </div>
  );
}
