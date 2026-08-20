import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { getAdminKeyFromUrl } from "./adminKey";

const API_BASE =
  import.meta.env.VITE_API_BASE ||
  "https://us-central1-mlfamzapp.cloudfunctions.net";

function bottomNavStyle() {
  return {
    display: "flex",
    justifyContent: "center",
    gap: "10px",
    marginTop: "28px",
    paddingBottom: "16px",
    flexWrap: "wrap",
  };
}

function smallButtonStyle(disabled = false) {
  return {
    padding: "10px 18px",
    fontSize: "14px",
    cursor: disabled ? "not-allowed" : "pointer",
    borderRadius: "8px",
    border: "none",
    background: disabled ? "#9bbcf7" : "#1976d2",
    color: "#ffffff",
    fontWeight: "600",
    opacity: disabled ? 0.6 : 1,
  };
}

function cardStyle() {
  return {
    background: "#fff",
    border: "1px solid #ddd",
    borderRadius: "8px",
    padding: "16px",
  };
}

function inputStyle() {
  return {
    width: "100%",
    padding: "10px",
    borderRadius: "8px",
    border: "1px solid #ccc",
    boxSizing: "border-box",
  };
}

function tableCellStyle(extra = {}) {
  return {
    border: "1px solid #ccc",
    padding: "10px",
    textAlign: "left",
    ...extra,
  };
}

function formatLaMonthYearParts(dateValue) {
  if (!dateValue) return null;

  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return null;

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "numeric",
  }).formatToParts(date);

  const month = Number(parts.find((p) => p.type === "month")?.value || 0);
  const year = Number(parts.find((p) => p.type === "year")?.value || 0);

  if (!month || !year) return null;
  return { month, year };
}

function safeJsonPreview(value) {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function DataTable({ title, rows }) {
  if (!Array.isArray(rows) || rows.length === 0) {
    return (
      <div style={cardStyle()}>
        <h3 style={{ marginTop: 0 }}>{title}</h3>
        <div>No data</div>
      </div>
    );
  }

  const columns = Array.from(
    rows.reduce((set, row) => {
      Object.keys(row || {}).forEach((key) => set.add(key));
      return set;
    }, new Set())
  );

  return (
    <div style={cardStyle()}>
      <h3 style={{ marginTop: 0 }}>{title}</h3>
      <div style={{ overflowX: "auto" }}>
        <table style={{ borderCollapse: "collapse", width: "100%" }}>
          <thead>
            <tr>
              {columns.map((col) => (
                <th
                  key={col}
                  style={tableCellStyle({
                    background: "#f4f4f4",
                    whiteSpace: "nowrap",
                  })}
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => (
              <tr key={idx}>
                {columns.map((col) => (
                  <td key={col} style={tableCellStyle()}>
                    {typeof row?.[col] === "object"
                      ? safeJsonPreview(row[col])
                      : String(row?.[col] ?? "")}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function UpdatePage() {
  const location = useLocation();
  const navigate = useNavigate();

  const usaReportId = location.state?.usaReportId || "";
  const deReportId = location.state?.deReportId || "";
  const startDate = location.state?.startDate || "";
  const endDate = location.state?.endDate || "";
  const adminKey = getAdminKeyFromUrl() || location.state?.adminKey || "";

  const [confirmMonth, setConfirmMonth] = useState("");
  const [confirmYear, setConfirmYear] = useState("");
  const [dryRun, setDryRun] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  const dateValidation = useMemo(() => {
    if (!startDate || !endDate) {
      return {
        ok: false,
        message: "Missing startDate or endDate",
        month: null,
        year: null,
      };
    }

    const startParts = formatLaMonthYearParts(startDate);
    const endParts = formatLaMonthYearParts(endDate);

    if (!startParts || !endParts) {
      return {
        ok: false,
        message: "Invalid startDate or endDate",
        month: null,
        year: null,
      };
    }

    if (
      startParts.month !== endParts.month ||
      startParts.year !== endParts.year
    ) {
      return {
        ok: false,
        message:
          "startDate and endDate are not in the same month/year in America/Los_Angeles",
        month: null,
        year: null,
      };
    }

    return {
      ok: true,
      message: "",
      month: startParts.month,
      year: startParts.year,
    };
  }, [startDate, endDate]);

  useEffect(() => {
    if (dateValidation.ok) {
      setConfirmMonth(dateValidation.month);
      setConfirmYear(dateValidation.year);
    }
  }, [dateValidation]);

  async function handleRunUpdate() {
    setError("");
    setResult(null);

    if (!dateValidation.ok) {
      setError(dateValidation.message);
      return;
    }

    if (Number(confirmMonth) !== Number(dateValidation.month)) {
      setError(`Please confirm month ${dateValidation.month}`);
      return;
    }

    if (Number(confirmYear) !== Number(dateValidation.year)) {
      setError(`Please confirm year ${dateValidation.year}`);
      return;
    }

    if (!usaReportId && !deReportId) {
      setError("Missing usaReportId and deReportId");
      return;
    }

    const payload = {
      usaReportId,
      deReportId,
      startDate,
      endDate,
      confirmMonth: Number(confirmMonth),
      confirmYear: Number(confirmYear),
      dryRun,
    };

    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/UpdateSkuSalesMonth`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(adminKey ? { "x-admin-key": adminKey } : {}),
        },
        body: JSON.stringify(payload),
      });

      const text = await response.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        data = { raw: text };
      }

      if (!response.ok) {
        throw new Error(data?.error || `HTTP ${response.status}`);
      }

      setResult(data);
    } catch (err) {
      setError(err.message || "Request failed");
    } finally {
      setLoading(false);
    }
  }

  function goHome() {
    navigate("/");
  }

  return (
    <div
      style={{
        padding: "20px",
        fontFamily: "Arial, sans-serif",
        minHeight: "100vh",
        background: "#fafafa",
      }}
    >
      <h2 style={{ textAlign: "center", marginBottom: "20px" }}>
        Update SKU Sales Month
      </h2>

      <div
        style={{
          ...cardStyle(),
          maxWidth: "900px",
          marginInline: "auto",
          marginBottom: "20px",
          background: "#f4f4f4",
        }}
      >
        <div><strong>USA Report ID:</strong> {usaReportId || "-"}</div>
        <div><strong>DE Report ID:</strong> {deReportId || "-"}</div>
        <div><strong>Start Date:</strong> {startDate || "-"}</div>
        <div><strong>End Date:</strong> {endDate || "-"}</div>
        <div style={{ marginTop: "10px" }}>
          <strong>Detected LA Month/Year:</strong>{" "}
          {dateValidation.ok
            ? `${dateValidation.month}/${dateValidation.year}`
            : "-"}
        </div>
        {!dateValidation.ok && (
          <div style={{ color: "#b00020", marginTop: "8px" }}>
            {dateValidation.message}
          </div>
        )}
      </div>

      <div
        style={{
          ...cardStyle(),
          maxWidth: "900px",
          marginInline: "auto",
          marginBottom: "20px",
        }}
      >
        <h3 style={{ marginTop: 0, textAlign: "center" }}>Confirm Update</h3>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: "16px",
            alignItems: "end",
          }}
        >
          <div>
            <label style={{ display: "block", marginBottom: "6px" }}>
              Confirm Month
            </label>
            <input
              type="number"
              value={confirmMonth}
              onChange={(e) => setConfirmMonth(e.target.value)}
              style={inputStyle()}
              placeholder={dateValidation.ok ? String(dateValidation.month) : ""}
            />
          </div>

          <div>
            <label style={{ display: "block", marginBottom: "6px" }}>
              Confirm Year
            </label>
            <input
              type="number"
              value={confirmYear}
              onChange={(e) => setConfirmYear(e.target.value)}
              style={inputStyle()}
              placeholder={dateValidation.ok ? String(dateValidation.year) : ""}
            />
          </div>

          <div>
            <label style={{ display: "block", marginBottom: "6px" }}>
              Mode
            </label>
            <select
              value={dryRun ? "dry" : "wet"}
              onChange={(e) => setDryRun(e.target.value === "dry")}
              style={inputStyle()}
            >
              <option value="dry">Dry Run</option>
              <option value="wet">Wet Run</option>
            </select>
          </div>
        </div>

        <div style={{ marginTop: "20px", textAlign: "center" }}>
          <button
            style={{
              ...smallButtonStyle(loading || !dateValidation.ok),
              minWidth: "180px",
            }}
            onClick={handleRunUpdate}
            disabled={loading || !dateValidation.ok}
          >
            {loading ? "Running..." : dryRun ? "Run Dry Update" : "Run Wet Update"}
          </button>
        </div>

        {error && (
          <div
            style={{
              marginTop: "14px",
              color: "#b00020",
              background: "#fff1f1",
              border: "1px solid #f0caca",
              padding: "10px",
              borderRadius: "8px",
              textAlign: "center",
            }}
          >
            {error}
          </div>
        )}
      </div>

      {result && (
        <div
          style={{
            display: "grid",
            gap: "18px",
            maxWidth: "1200px",
            marginInline: "auto",
          }}
        >
          <div style={cardStyle()}>
            <h3 style={{ marginTop: 0 }}>Response Summary</h3>
            <table style={{ borderCollapse: "collapse", width: "100%" }}>
              <tbody>
                {Object.entries(result)
                  .filter(
                    ([, value]) =>
                      !Array.isArray(value) &&
                      (typeof value !== "object" || value === null)
                  )
                  .map(([key, value]) => (
                    <tr key={key}>
                      <td
                        style={tableCellStyle({
                          background: "#f4f4f4",
                          width: "240px",
                        })}
                      >
                        {key}
                      </td>
                      <td style={tableCellStyle()}>{String(value ?? "")}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>

          {Array.isArray(result.reports) && (
            <DataTable title="Reports" rows={result.reports} />
          )}

          {Array.isArray(result.aggregatedByMarketplace) && (
            <DataTable
              title="Aggregated By Marketplace"
              rows={result.aggregatedByMarketplace}
            />
          )}

          {Array.isArray(result.preview) && (
            <DataTable title="Preview Rows" rows={result.preview} />
          )}

          {!Array.isArray(result.reports) &&
            !Array.isArray(result.aggregatedByMarketplace) &&
            !Array.isArray(result.preview) && (
              <div style={cardStyle()}>
                <h3 style={{ marginTop: 0 }}>Full Response</h3>
                <pre
                  style={{
                    margin: 0,
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                  }}
                >
                  {safeJsonPreview(result)}
                </pre>
              </div>
            )}
        </div>
      )}

      <div style={bottomNavStyle()}>
        <button style={smallButtonStyle()} onClick={goHome}>
          Home
        </button>
      </div>
    </div>
  );
}