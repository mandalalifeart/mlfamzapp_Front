import { useNavigate } from "react-router-dom";
import { useMemo, useState } from "react";
import "./App.css";

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

function formatDate(date) {
  return date.toISOString().slice(0, 10);
}

function shiftDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function getPresetDates(preset) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  switch (preset) {
    case "today":
      return { startDate: formatDate(today), endDate: formatDate(today) };
    case "yesterday": {
      const d = shiftDays(today, -1);
      return { startDate: formatDate(d), endDate: formatDate(d) };
    }
    case "last3days":
      return { startDate: formatDate(shiftDays(today, -2)), endDate: formatDate(today) };
    case "lastWeek":
      return { startDate: formatDate(shiftDays(today, -6)), endDate: formatDate(today) };
    case "last30days":
      return { startDate: formatDate(shiftDays(today, -29)), endDate: formatDate(today) };
    case "thisMonth":
      return { startDate: formatDate(startOfMonth(today)), endDate: formatDate(today) };
    case "lastMonth": {
      const m = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      return {
        startDate: formatDate(startOfMonth(m)),
        endDate: formatDate(endOfMonth(m)),
      };
    }
    default:
      return { startDate: "", endDate: "" };
  }
}

function parseLocalDate(dateStr) {
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function isSameLocalDay(dateA, dateB) {
  return (
    dateA.getFullYear() === dateB.getFullYear() &&
    dateA.getMonth() === dateB.getMonth() &&
    dateA.getDate() === dateB.getDate()
  );
}

function buildApiDateRange(startDateStr, endDateStr) {
  const now = new Date();

  const startDate = parseLocalDate(startDateStr);
  startDate.setHours(0, 0, 0, 0);

  const endDate = parseLocalDate(endDateStr);

  if (isSameLocalDay(endDate, now)) {
    return {
      start_date: startDate.toISOString(),
      end_date: now.toISOString(),
    };
  }

  endDate.setHours(23, 59, 59, 999);

  return {
    start_date: startDate.toISOString(),
    end_date: endDate.toISOString(),
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

      const payloadUK = {
        start_date: apiDates.start_date,
        end_date: apiDates.end_date,
        marketplace: "de",
      };

      console.log("resolved UI dates:", { startDate, endDate });
      console.log("sending USA:", payloadUSA);
      console.log("sending UK:", payloadUK);
	  const API_BASE = "https://us-central1-mlfamzapp.cloudfunctions.net";

      const [resUSA, resUK] = await Promise.all([
        fetch(`${API_BASE}/MlfReportReq`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payloadUSA),
        }),
        fetch(`${API_BASE}/MlfReportReq`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payloadUK),
        }),
      ]);

      const textUSA = await resUSA.text();
      const textUK = await resUK.text();

      console.log("USA response:", textUSA);
      console.log("UK response:", textUK);

      let dataUSA = {};
      let dataUK = {};

      if (textUSA) dataUSA = JSON.parse(textUSA);
      if (textUK) dataUK = JSON.parse(textUK);

      if (!resUSA.ok || !resUK.ok) {
        throw new Error("One of the requests failed");
      }

      if (dataUSA.status !== "success" || dataUK.status !== "success") {
        throw new Error("One of the requests failed");
      }

      const combinedData = {
        usa: dataUSA,
        uk: dataUK,
      };

      setResult({
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
            <div><strong>Request ID:</strong> {result.reportReqId}</div>
            <div><strong>Start:</strong> {result.startDate}</div>
            <div><strong>End:</strong> {result.endDate}</div>
          </div>
        )}
      </div>
    </div>
  );
}