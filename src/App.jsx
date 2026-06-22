import { useNavigate } from "react-router-dom";
import { useMemo, useState } from "react";
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

  const [selectedPreset, setSelectedPreset] = useState("today");
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [errorDetails, setErrorDetails] = useState([]);

  const resolvedDates = useMemo(() => {
    if (selectedPreset === "custom") {
      return {
        startDate: customStartDate,
        endDate: customEndDate,
      };
    }
    return getPresetDates(selectedPreset);
  }, [selectedPreset, customStartDate, customEndDate]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setErrorDetails([]);

    const { startDate, endDate } = resolvedDates;

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