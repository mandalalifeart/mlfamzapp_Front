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
  const year = String(parts.year);
  const month = String(parts.month).padStart(2, "0");
  const day = String(parts.day).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function shiftDateString(dateStr, days) {
  const [year, month, day] = dateStr.split("-").map(Number);
  const utcDate = new Date(Date.UTC(year, month - 1, day));
  utcDate.setUTCDate(utcDate.getUTCDate() + days);
  return utcDate.toISOString().slice(0, 10);
}

function startOfMonth(dateStr) {
  const [year, month] = dateStr.split("-").map(Number);
  return `${String(year)}-${String(month).padStart(2, "0")}-01`;
}

function endOfMonth(dateStr) {
  const [year, month] = dateStr.split("-").map(Number);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${String(year)}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
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

export default function App() {
  const [selectedPreset, setSelectedPreset] = useState("today");
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  const navigate = useNavigate();

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

      const [resUSA, resDE] = await Promise.all([
        fetch(`${API_BASE}/MlfReportReq`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payloadUSA),
        }),
        fetch(`${API_BASE}/MlfReportReq`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payloadDE),
        }),
      ]);

      const textUSA = await resUSA.text();
      const textDE = await resDE.text();

      let dataUSA = {};
      let dataDE = {};

      if (textUSA) dataUSA = JSON.parse(textUSA);
      if (textDE) dataDE = JSON.parse(textDE);

      if (!resUSA.ok || !resDE.ok) {
        throw new Error("One of the requests failed");
      }

      if (dataUSA.status !== "success" || dataDE.status !== "success") {
        throw new Error("One of the requests failed");
      }

      const combinedData = {
        usa: dataUSA,
        de: dataDE,
      };

      setResult({
        usaReportId: dataUSA?.data?.report_req_id || "",
        deReportId: dataDE?.data?.report_req_id || "",
        startDate: apiDates.start_date,
        endDate: apiDates.end_date,
      });

      navigate("/response", {
        state: {
          responseData: combinedData,
          startDate: apiDates.start_date,
          endDate: apiDates.end_date,
        },
      });
    } catch (err) {
      setError(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  function goHome() {
    navigate("/");
  }

  function goToSales() {
    navigate("/sales", {
      state: {
        usaReportId: result?.usaReportId || "",
        deReportId: result?.deReportId || "",
        startDate: result?.startDate || "",
        endDate: result?.endDate || "",
      },
    });
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

        {result && (
          <div className="result">
            <div><strong>USA Request ID:</strong> {result.usaReportId}</div>
            <div><strong>DE Request ID:</strong> {result.deReportId}</div>
            <div><strong>Start:</strong> {result.startDate}</div>
            <div><strong>End:</strong> {result.endDate}</div>
          </div>
        )}

        <div style={bottomNavStyle()}>
          <button type="button" style={smallButtonStyle()} onClick={goHome}>
            Home
          </button>
          <button type="button" style={smallButtonStyle()} onClick={goToSales}>
            Sales
          </button>
        </div>
      </div>
    </div>
  );
}