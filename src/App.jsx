ChatGPT Plus


















image(20260807-082002).png

Pasted text(20260807-081901).txt
Document
i want this app to be aple to get params , like start date and end date as a param ,  so all vlaues should be supported , today , yesterday  , last 3 days , .....

Worked for 1m 35s
Yes. I updated the app so the date range can be supplied through URL parameters while keeping your existing presets and Los Angeles date logic. 

 


Recommended usage
You can pass a single range:

?range=today
?range=yesterday
?range=last3days
?range=lastWeek
?range=last30days
?range=thisMonth
?range=lastMonth
Or use preset:

?preset=last3days
Or explicitly pass start/end:

?startDate=2026-08-01&endDate=2026-08-07
The start/end parameters also understand your preset words:

?startDate=today&endDate=today

?startDate=yesterday&endDate=yesterday

?startDate=last3days&endDate=last3days

?startDate=lastWeek&endDate=lastWeek

?startDate=last30days&endDate=last30days

?startDate=thisMonth&endDate=thisMonth

?startDate=lastMonth&endDate=lastMonth
It also accepts variations such as last 3 days, last-3-days, and last_3_days.

For example, opening:

https://YOUR-APP/report?range=last3days
will automatically select LAST 3 DAYS and calculate the correct dates. Explicit dates automatically select CUSTOM.

I also support both naming styles:

startDate / endDate
start_date / end_date
start / end
The URL parameters currently populate/select the dates but do not automatically press SUBMIT.

App_with_url_params.jsx

If you want, the next useful addition is an autoSubmit=true parameter so a URL such as ?range=yesterday&autoSubmit=true immediately runs the report without requiring the SUBMIT click.


App_with_url_params.jsx
Code


i want in the case when those parameters are set and valid to go directly to next stage 

Worked for 52s
Yes — that makes sense. When valid URL parameters are present, the app should behave exactly as if SUBMIT was pressed automatically: create the USA/DE report requests and then navigate directly to /response. Your existing manual Submit flow already does those steps. 

 


I changed it to do that.

Examples:

?range=today
?range=yesterday
?range=last3days
?range=lastWeek
?range=last30days
?range=thisMonth
?range=lastMonth
or:

?startDate=2026-08-01&endDate=2026-08-07
or:

?startDate=last3days&endDate=today
New behavior
No parameters → normal page, TODAY selected, user presses SUBMIT.

Valid parameters → automatically starts the report → goes directly to /response.

Invalid parameters → stays on this page and shows an error.

It also prevents accidental duplicate automatic API calls in React development mode.

App_with_url_params_autosubmit.jsx


App_with_url_params_autosubmit.jsx
Code


Library
/
App_with_url_params_autosubmit.jsx


import { useNavigate } from "react-router-dom";
import { useEffect, useMemo, useRef, useState } from "react";
import "./App.css";

const LA_TIME_ZONE = "America/Los_Angeles";
const API_BASE = "https://us-central1-mlfamzapp.cloudfunctions.net";

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

  const utcGuess = Date.UTC(
    year,
    month - 1,
    day,
    Number(hour),
    Number(minute),
    Number(second),
    Number(ms.padEnd(3, "0").slice(0, 3))
  );

  const offset = getTimeZoneOffsetMillis(new Date(utcGuess), timeZone);
  return new Date(utcGuess - offset);
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

function smallButtonStyle() {
  return {
    padding: "8px 16px",
    fontSize: "14px",
    cursor: "pointer",
    borderRadius: "8px",
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
    <div className="app">
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
          <button type="button" style={smallButtonStyle()} onClick={() => navigate("/")}>
            Home
          </button>
          <button type="button" style={smallButtonStyle()} onClick={() => navigate("/sales")}>
            Sales
          </button>
        </div>
      </div>
    </div>
  );
}
