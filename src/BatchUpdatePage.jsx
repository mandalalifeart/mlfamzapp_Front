import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

const API_BASE =
  import.meta.env.VITE_API_BASE ||
  "https://us-central1-mlfamzapp.cloudfunctions.net";

const LA_TIME_ZONE = "America/Los_Angeles";
const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const POLL_MAX_ATTEMPTS = 12;
const POLL_RETRY_DELAY_MS = 30000;

// Same LA-timezone date math as App.jsx (kept local to this page, matching how
// every page in this app owns its own small date helpers instead of a shared util).
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
    if (part.type !== "literal") map[part.type] = part.value;
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

function getLosAngelesNow() {
  return getTimeZoneParts(new Date(), LA_TIME_ZONE);
}

function getTimeZoneOffsetMillis(date, timeZone) {
  const parts = getTimeZoneParts(date, timeZone);
  const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second, 0);
  return asUtc - date.getTime();
}

function zonedDateTimeToUtc(dateStr, timeStr, timeZone) {
  const [year, month, day] = dateStr.split("-").map(Number);
  const [hour, minute, secondAndMs] = timeStr.split(":");
  const [second, ms = "0"] = secondAndMs.split(".");
  const msValue = Number(ms.padEnd(3, "0").slice(0, 3));

  const utcGuess = Date.UTC(year, month - 1, day, Number(hour), Number(minute), Number(second), 0);
  const offset = getTimeZoneOffsetMillis(new Date(utcGuess), timeZone);
  return new Date(utcGuess - offset + msValue);
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

// Builds the [start_date, end_date] ISO range for one calendar month in LA time.
// If the month is still in progress, end_date is "now" instead of month-end -
// same rule App.jsx uses for "this month".
function buildMonthDateRange(year, month) {
  const startDateStr = `${year}-${pad2(month)}-01`;
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const endDateStr = `${year}-${pad2(month)}-${pad2(lastDay)}`;

  const now = new Date();
  const laNow = getLosAngelesNow();
  const isCurrentMonth = laNow.year === year && laNow.month === month;

  const startDate = zonedDateTimeToUtc(startDateStr, "00:00:00.000", LA_TIME_ZONE);
  const endDate = isCurrentMonth ? now : zonedDateTimeToUtc(endDateStr, "23:59:59.999", LA_TIME_ZONE);

  return { start_date: startDate.toISOString(), end_date: endDate.toISOString() };
}

function isFutureMonth(year, month) {
  const laNow = getLosAngelesNow();
  return year > laNow.year || (year === laNow.year && month > laNow.month);
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
  } catch {
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

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Same 12-attempt / 30s-interval polling ReportViewPage.jsx uses, extracted so
// both marketplaces can be awaited the same way from a plain async loop.
async function pollReportReady(marketplace, reportReqId, onStatus) {
  for (let attempt = 1; attempt <= POLL_MAX_ATTEMPTS; attempt += 1) {
    onStatus?.(`Checking ${marketplace} report (attempt ${attempt}/${POLL_MAX_ATTEMPTS})...`);

    try {
      const res = await fetch(`${API_BASE}/MlfReportGet`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ marketplace, report_req_id: reportReqId }),
      });

      const text = await res.text();
      const data = text ? JSON.parse(text) : {};

      if (!res.ok) throw new Error(data?.message || data?.error || `HTTP ${res.status}`);

      const status = data?.status;
      const payloadStatus = data?.data?.payload;
      const isInProgress =
        status === "IN_PROCESS" || status === "IN_PROGRESS" || payloadStatus === "IN_PROCESS" || payloadStatus === "IN_PROGRESS";

      if (isInProgress) {
        if (attempt === POLL_MAX_ATTEMPTS) return { ok: false, error: `${marketplace} report still processing after max attempts` };
        await sleep(POLL_RETRY_DELAY_MS);
        continue;
      }

      if (status === "success") return { ok: true };
      return { ok: false, error: `Unexpected ${marketplace} report status: ${status}` };
    } catch (err) {
      if (attempt === POLL_MAX_ATTEMPTS) return { ok: false, error: err.message || `${marketplace} report fetch failed` };
      await sleep(POLL_RETRY_DELAY_MS);
    }
  }
  return { ok: false, error: `${marketplace} report timed out` };
}

async function runUpdateForMonth({ reportIds, apiDates, month, year }) {
  const response = await fetch(`${API_BASE}/UpdateSkuSalesMonth`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      reportIds,
      startDate: apiDates.start_date,
      endDate: apiDates.end_date,
      confirmMonth: month,
      confirmYear: year,
      dryRun: false,
    }),
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : {};
  if (!response.ok) throw new Error(data?.error || `HTTP ${response.status}`);
  return data;
}

function cardStyle() {
  return { background: "#fff", border: "1px solid #ddd", borderRadius: "8px", padding: "16px" };
}

function buttonStyle(disabled = false) {
  return {
    padding: "10px 18px",
    fontSize: "14px",
    cursor: disabled ? "not-allowed" : "pointer",
    borderRadius: "8px",
    border: "none",
    background: disabled ? "#9bbcf7" : "#1976d2",
    color: "#fff",
    fontWeight: "600",
    opacity: disabled ? 0.6 : 1,
  };
}

function stopButtonStyle(disabled) {
  return {
    padding: "10px 18px",
    fontSize: "14px",
    cursor: disabled ? "not-allowed" : "pointer",
    borderRadius: "8px",
    border: "1px solid #b00020",
    background: "#fff",
    color: "#b00020",
    fontWeight: "600",
    opacity: disabled ? 0.5 : 1,
  };
}

function inputStyle() {
  return { padding: "10px", borderRadius: "8px", border: "1px solid #ccc", width: "140px" };
}

function tableCellStyle(extra = {}) {
  return { border: "1px solid #ccc", padding: "8px 10px", textAlign: "left", ...extra };
}

const STATUS_COLORS = {
  pending: "#999",
  running: "#1976d2",
  done: "#1b7a1b",
  error: "#b00020",
  skipped: "#8a5a00",
};

// 2022-2024 were backfilled from an authoritative export and are locked
// against the live pipeline (see UpdateSkuSalesMonth.py's LOCKED_YEARS_MAX) -
// this mirrors that same cutoff so the batch never even attempts those years.
const EARLIEST_UNLOCKED_YEAR = 2025;

export default function BatchUpdatePage() {
  const navigate = useNavigate();

  const [year, setYear] = useState(Math.max(getLosAngelesNow().year, EARLIEST_UNLOCKED_YEAR));
  const [running, setRunning] = useState(false);
  const [rows, setRows] = useState([]);
  const [yearError, setYearError] = useState("");
  const stopRequestedRef = useRef(false);

  function initRows(targetYear) {
    return MONTH_LABELS.map((label, i) => ({
      month: i + 1,
      label,
      year: targetYear,
      status: "pending",
      detail: "",
      parsedOrderRows: null,
      dbRowsCount: null,
      countryRowsCount: null,
    }));
  }

  function updateRow(month, patch) {
    setRows((prev) => prev.map((r) => (r.month === month ? { ...r, ...patch } : r)));
  }

  async function processMonth(targetYear, month) {
    if (isFutureMonth(targetYear, month)) {
      updateRow(month, { status: "skipped", detail: "Future month - no data yet" });
      return;
    }

    updateRow(month, { status: "running", detail: "Requesting reports..." });
    const apiDates = buildMonthDateRange(targetYear, month);

    const [usaResult, deResult] = await Promise.allSettled([
      requestMarketplaceReport({ ...apiDates, marketplace: "usa" }),
      requestMarketplaceReport({ ...apiDates, marketplace: "de" }),
    ]);

    const usaReportId = usaResult.status === "fulfilled" ? usaResult.value : null;
    const deReportId = deResult.status === "fulfilled" ? deResult.value : null;

    if (!usaReportId && !deReportId) {
      updateRow(month, { status: "error", detail: "Both USA and DE/EU report requests failed" });
      return;
    }

    updateRow(month, { detail: "Waiting for reports to be ready..." });

    const pollJobs = [];
    if (usaReportId) pollJobs.push(pollReportReady("usa", usaReportId, (s) => updateRow(month, { detail: s })));
    if (deReportId) pollJobs.push(pollReportReady("de", deReportId, (s) => updateRow(month, { detail: s })));

    const pollResults = await Promise.all(pollJobs);
    let idx = 0;
    const usaReady = usaReportId ? pollResults[idx++].ok : false;
    const deReady = deReportId ? pollResults[idx++].ok : false;

    const reportIds = {};
    if (usaReady) reportIds.usa = usaReportId;
    if (deReady) reportIds.de = deReportId;

    if (Object.keys(reportIds).length === 0) {
      const errors = pollResults.map((r) => r.error).filter(Boolean).join("; ");
      updateRow(month, { status: "error", detail: errors || "Neither report became ready" });
      return;
    }

    updateRow(month, { detail: "Writing to PocketBase..." });

    try {
      const result = await runUpdateForMonth({ reportIds, apiDates, month, year: targetYear });
      updateRow(month, {
        status: "done",
        detail: result.asinWarning || "OK",
        parsedOrderRows: result.parsedOrderRows,
        dbRowsCount: result.dbRowsCount,
        countryRowsCount: result.countryRowsCount,
      });
    } catch (err) {
      updateRow(month, { status: "error", detail: err.message || "Update failed" });
    }
  }

  async function startBatch() {
    const targetYear = Number(year);
    if (!targetYear || targetYear < 2000) return;
    if (targetYear < EARLIEST_UNLOCKED_YEAR) {
      setYearError(
        `${targetYear} is locked - it was backfilled from an authoritative export. Only ${EARLIEST_UNLOCKED_YEAR} and later can be batch-updated.`
      );
      return;
    }
    setYearError("");

    stopRequestedRef.current = false;
    setRunning(true);
    setRows(initRows(targetYear));

    for (let month = 1; month <= 12; month += 1) {
      if (stopRequestedRef.current) {
        updateRow(month, { status: "skipped", detail: "Stopped before this month" });
        continue;
      }
      await processMonth(targetYear, month);
    }

    setRunning(false);
  }

  function stopBatch() {
    stopRequestedRef.current = true;
  }

  return (
    <div style={{ padding: "20px", fontFamily: "Arial, sans-serif", minHeight: "100vh", background: "#fafafa" }}>
      <h2 style={{ textAlign: "center", marginBottom: "20px" }}>Batch Update: All Months of a Year</h2>

      <div style={{ ...cardStyle(), maxWidth: "900px", marginInline: "auto", marginBottom: "20px" }}>
        <p style={{ marginTop: 0 }}>
          Runs the request → wait for report → write-to-PocketBase cycle for every month of the chosen year, USA and
          DE/EU, back to back. Each month writes for real (wet run) as soon as its report is ready - there's no pause
          to review before it commits. Keep this tab open while it runs; a full year can take a while since each
          month's Amazon report can take several minutes to generate.
        </p>

        <div style={{ display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
          <label>
            Year:{" "}
            <input
              type="number"
              min={EARLIEST_UNLOCKED_YEAR}
              value={year}
              onChange={(e) => setYear(e.target.value)}
              style={inputStyle()}
              disabled={running}
            />
          </label>

          <button style={buttonStyle(running)} onClick={startBatch} disabled={running}>
            {running ? "Running..." : `Start Batch for ${year}`}
          </button>

          {running && (
            <button style={stopButtonStyle(false)} onClick={stopBatch}>
              Stop After Current Month
            </button>
          )}
        </div>

        {yearError && (
          <div style={{ marginTop: "10px", color: "#b00020", fontSize: "14px" }}>{yearError}</div>
        )}
      </div>

      {rows.length > 0 && (
        <div style={{ ...cardStyle(), maxWidth: "1100px", marginInline: "auto", marginBottom: "20px" }}>
          <h3 style={{ marginTop: 0 }}>Progress</h3>
          <div style={{ overflowX: "auto" }}>
            <table style={{ borderCollapse: "collapse", width: "100%" }}>
              <thead>
                <tr>
                  <th style={tableCellStyle({ background: "#f4f4f4" })}>Month</th>
                  <th style={tableCellStyle({ background: "#f4f4f4" })}>Status</th>
                  <th style={tableCellStyle({ background: "#f4f4f4" })}>Detail</th>
                  <th style={tableCellStyle({ background: "#f4f4f4" })}>Parsed Order Rows</th>
                  <th style={tableCellStyle({ background: "#f4f4f4" })}>SKU Rows</th>
                  <th style={tableCellStyle({ background: "#f4f4f4" })}>Country Rows</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.month}>
                    <td style={tableCellStyle()}>
                      {row.label} {row.year}
                    </td>
                    <td style={tableCellStyle({ color: STATUS_COLORS[row.status], fontWeight: 700 })}>{row.status}</td>
                    <td style={tableCellStyle()}>{row.detail}</td>
                    <td style={tableCellStyle()}>{row.parsedOrderRows ?? "-"}</td>
                    <td style={tableCellStyle()}>{row.dbRowsCount ?? "-"}</td>
                    <td style={tableCellStyle()}>{row.countryRowsCount ?? "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "center", gap: "10px", marginTop: "28px", paddingBottom: "16px" }}>
        <button style={buttonStyle()} onClick={() => navigate("/")}>
          Home
        </button>
        <button style={buttonStyle()} onClick={() => navigate("/sales")}>
          Sales
        </button>
      </div>
    </div>
  );
}
