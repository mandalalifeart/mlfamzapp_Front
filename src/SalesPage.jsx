import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

const API_BASE =
  import.meta.env.VITE_API_BASE ||
  "https://us-central1-mlfamzapp.cloudfunctions.net";

const REGION_OPTIONS = [
  { value: "all", label: "All Marketplaces" },
  { value: "eu", label: "EU" },
  { value: "usa", label: "USA" },
  { value: "ca", label: "CA" },
  { value: "mx", label: "MX" },
  { value: "uk", label: "UK" },
  { value: "de", label: "DE" },
  { value: "fr", label: "FR" },
  { value: "it", label: "IT" },
  { value: "es", label: "ES" },
  { value: "se", label: "SE" },
  { value: "ie", label: "IE" },
  { value: "pl", label: "PL" },
  { value: "nl", label: "NL" },
  { value: "be", label: "BE" },
  { value: "jp", label: "JP" },
];

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

function blueButtonStyle(disabled = false) {
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

function numberCellStyle(extra = {}) {
  return tableCellStyle({
    textAlign: "right",
    whiteSpace: "nowrap",
    ...extra,
  });
}

function safeJsonPreview(value) {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function SummaryTable({ rows }) {
  if (!Array.isArray(rows) || rows.length === 0) {
    return (
      <div style={cardStyle()}>
        <h3 style={{ marginTop: 0 }}>Department Summary</h3>
        <div>No data</div>
      </div>
    );
  }

  return (
    <div style={cardStyle()}>
      <h3 style={{ marginTop: 0 }}>Department Summary</h3>
      <div style={{ overflowX: "auto" }}>
        <table style={{ borderCollapse: "collapse", width: "100%" }}>
          <thead>
            <tr>
              <th style={tableCellStyle({ background: "#f4f4f4" })}>Department</th>
              <th style={numberCellStyle({ background: "#f4f4f4" })}>ASIN Count</th>
              <th style={numberCellStyle({ background: "#f4f4f4" })}>2023</th>
              <th style={numberCellStyle({ background: "#f4f4f4" })}>2024</th>
              <th style={numberCellStyle({ background: "#f4f4f4" })}>2025</th>
              <th style={numberCellStyle({ background: "#f4f4f4" })}>2026</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.department}>
                <td style={tableCellStyle()}>{row.department}</td>
                <td style={numberCellStyle()}>{row.asinCount ?? 0}</td>
                <td style={numberCellStyle()}>{row.Y2023 ?? 0}</td>
                <td style={numberCellStyle()}>{row.Y2024 ?? 0}</td>
                <td style={numberCellStyle()}>{row.Y2025 ?? 0}</td>
                <td style={numberCellStyle()}>{row.Y2026 ?? 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function DepartmentTable({ title, rows }) {
  if (!Array.isArray(rows) || rows.length === 0) {
    return (
      <div style={cardStyle()}>
        <h3 style={{ marginTop: 0 }}>{title}</h3>
        <div>No data</div>
      </div>
    );
  }

  const years = ["2026", "2025", "2024", "2023"];

  function getMonthValue(row, year, monthIndex) {
    const key = `${year}-${String(monthIndex + 1).padStart(2, "0")}`;
    return Number(row[key] ?? 0);
  }

  function getYearTotal(row, year) {
    return Number(row[`Y${year}`] ?? 0);
  }

  return (
    <div style={cardStyle()}>
      <h3 style={{ marginTop: 0 }}>{title}</h3>

      <div style={{ overflowX: "auto" }}>
        <table style={{ borderCollapse: "collapse", width: "100%", minWidth: "1400px" }}>
          <thead>
            <tr>
              <th style={tableCellStyle({ background: "#f4f4f4" })}>SKU</th>
              <th style={tableCellStyle({ background: "#f4f4f4" })}>ASIN</th>
              <th style={tableCellStyle({ background: "#f4f4f4" })}>Year</th>
              {Array.from({ length: 12 }).map((_, i) => (
                <th
                  key={i}
                  style={numberCellStyle({ background: "#f4f4f4", minWidth: "70px" })}
                >
                  {i + 1}
                </th>
              ))}
              <th style={numberCellStyle({ background: "#f4f4f4" })}>Total</th>
            </tr>
          </thead>

          <tbody>
            {rows.flatMap((row, rowIndex) => {
              const isTotal = rowIndex === 0 && row.ASIN === "ALL";

              return years.map((year, yIndex) => {
                const isFirstYearRow = yIndex === 0;
                const yearlyTotal = getYearTotal(row, year);

                return (
                  <tr key={`${row.ASIN}-${year}`}>
                    <td
                      style={tableCellStyle({
                        fontWeight: isTotal ? "700" : "400",
                        background: isTotal ? "#f9fbff" : "#fff",
                        verticalAlign: "top",
                      })}
                    >
                      {isFirstYearRow ? row.SKU : ""}
                    </td>

                    <td
                      style={tableCellStyle({
                        fontWeight: isTotal ? "700" : "400",
                        background: isTotal ? "#f9fbff" : "#fff",
                        verticalAlign: "top",
                      })}
                    >
                      {isFirstYearRow ? row.ASIN : ""}
                    </td>

                    <td
                      style={tableCellStyle({
                        background: isTotal ? "#f9fbff" : "#fff",
                        fontWeight: isTotal ? "700" : "400",
                      })}
                    >
                      {year}
                    </td>

                    {Array.from({ length: 12 }).map((_, i) => (
                      <td
                        key={i}
                        style={numberCellStyle({
                          background: isTotal ? "#f9fbff" : "#fff",
                          fontWeight: isTotal ? "700" : "400",
                        })}
                      >
                        {getMonthValue(row, year, i)}
                      </td>
                    ))}

                    <td
                      style={numberCellStyle({
                        fontWeight: "700",
                        background: isTotal ? "#f9fbff" : "#fff",
                      })}
                    >
                      {yearlyTotal}
                    </td>
                  </tr>
                );
              });
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function SalesPage() {
  const location = useLocation();
  const navigate = useNavigate();

  const usaReportId = location.state?.usaReportId || "";
  const deReportId = location.state?.deReportId || "";
  const startDate = location.state?.startDate || "";
  const endDate = location.state?.endDate || "";
  const adminKey = location.state?.adminKey || "";

  const [region, setRegion] = useState(location.state?.defaultRegion || "all");
  const [asin, setAsin] = useState(location.state?.defaultAsin || "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  const departmentSummary = useMemo(
    () => (Array.isArray(result?.departmentSummary) ? result.departmentSummary : []),
    [result]
  );

  async function loadSalesReport(selectedRegion, selectedAsin) {
    setLoading(true);
    setError("");
    setResult(null);

    try {
      const response = await fetch(`${API_BASE}/GetSalesDepartmentReport`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(adminKey ? { "x-admin-key": adminKey } : {}),
        },
        body: JSON.stringify({
          region: selectedRegion,
          asin: selectedAsin || null,
        }),
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
      setError(err.message || "Failed to load sales report");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSalesReport(region, asin);
  }, [region]);

  function goHome() {
    navigate("/");
  }

  function goToUpdate() {
    navigate("/update", {
      state: {
        usaReportId,
        deReportId,
        startDate,
        endDate,
        adminKey,
      },
    });
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
        Sales by Department
      </h2>

      <div
        style={{
          ...cardStyle(),
          maxWidth: "1000px",
          marginInline: "auto",
          marginBottom: "20px",
          background: "#f4f4f4",
        }}
      >
        <div><strong>USA Report ID:</strong> {usaReportId || "-"}</div>
        <div><strong>DE Report ID:</strong> {deReportId || "-"}</div>
        <div><strong>Start Date:</strong> {startDate || "-"}</div>
        <div><strong>End Date:</strong> {endDate || "-"}</div>
      </div>

      <div
        style={{
          ...cardStyle(),
          maxWidth: "1000px",
          marginInline: "auto",
          marginBottom: "20px",
        }}
      >
        <h3 style={{ marginTop: 0 }}>Filters</h3>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(220px, 320px) minmax(220px, 320px) auto",
            gap: "12px",
            alignItems: "end",
          }}
        >
          <div>
            <label style={{ display: "block", marginBottom: "6px" }}>
              Select Region
            </label>
            <select
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              style={inputStyle()}
            >
              {REGION_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: "block", marginBottom: "6px" }}>
              ASIN (optional)
            </label>
            <input
              value={asin}
              onChange={(e) => setAsin(e.target.value.toUpperCase())}
              style={inputStyle()}
              placeholder="B07Q4FM2CL"
            />
          </div>

          <div>
            <button
              style={blueButtonStyle(loading)}
              onClick={() => loadSalesReport(region, asin)}
              disabled={loading}
            >
              {loading ? "Loading..." : "Reload"}
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div
          style={{
            maxWidth: "1000px",
            marginInline: "auto",
            marginBottom: "20px",
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

      {loading && (
        <div
          style={{
            maxWidth: "1000px",
            marginInline: "auto",
            marginBottom: "20px",
            textAlign: "center",
          }}
        >
          Loading sales report...
        </div>
      )}

      {!loading && result && (
        <div
          style={{
            display: "grid",
            gap: "18px",
            maxWidth: "1400px",
            marginInline: "auto",
          }}
        >
          <div style={cardStyle()}>
            <h3 style={{ marginTop: 0 }}>Response Summary</h3>
            <table style={{ borderCollapse: "collapse", width: "100%" }}>
              <tbody>
                <tr>
                  <td style={tableCellStyle({ background: "#f4f4f4", width: "240px" })}>
                    Status
                  </td>
                  <td style={tableCellStyle()}>{result.status ?? "-"}</td>
                </tr>
                <tr>
                  <td style={tableCellStyle({ background: "#f4f4f4" })}>Region</td>
                  <td style={tableCellStyle()}>{result.region ?? "-"}</td>
                </tr>
                <tr>
                  <td style={tableCellStyle({ background: "#f4f4f4" })}>ASIN Filter</td>
                  <td style={tableCellStyle()}>{result.asinFilter ?? "-"}</td>
                </tr>
                <tr>
                  <td style={tableCellStyle({ background: "#f4f4f4" })}>Mapped SKU Count</td>
                  <td style={tableCellStyle()}>{result.mappedSkuCount ?? "-"}</td>
                </tr>
                <tr>
                  <td style={tableCellStyle({ background: "#f4f4f4" })}>Matched Sales Rows</td>
                  <td style={tableCellStyle()}>{result.matchedSalesRows ?? "-"}</td>
                </tr>
                <tr>
                  <td style={tableCellStyle({ background: "#f4f4f4" })}>Source Row Count</td>
                  <td style={tableCellStyle()}>{result.sourceRowCount ?? 0}</td>
                </tr>
                <tr>
                  <td style={tableCellStyle({ background: "#f4f4f4" })}>Mapping File</td>
                  <td style={tableCellStyle()}>{result.mappingFile ?? "-"}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {Array.isArray(result.mappedSkus) && result.mappedSkus.length > 0 && (
            <div style={cardStyle()}>
              <h3 style={{ marginTop: 0 }}>Mapped SKUs</h3>
              <div>{result.mappedSkus.join(", ")}</div>
            </div>
          )}

          {Array.isArray(result.missingSkuExamples) && result.missingSkuExamples.length > 0 && (
            <div style={cardStyle()}>
              <h3 style={{ marginTop: 0 }}>Missing SKU Examples</h3>
              <div>{result.missingSkuExamples.join(", ")}</div>
            </div>
          )}

          {result.mappingStats && (
            <div style={cardStyle()}>
              <h3 style={{ marginTop: 0 }}>Mapping Stats</h3>
              <table style={{ borderCollapse: "collapse", width: "100%" }}>
                <tbody>
                  {Object.entries(result.mappingStats).map(([key, value]) => (
                    <tr key={key}>
                      <td style={tableCellStyle({ background: "#f4f4f4", width: "240px" })}>
                        {key}
                      </td>
                      <td style={tableCellStyle()}>{String(value ?? "")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <SummaryTable rows={departmentSummary} />

          <DepartmentTable title="PAREO" rows={result.departments?.PAREO || []} />
          <DepartmentTable title="P_RUG" rows={result.departments?.P_RUG || []} />
          <DepartmentTable title="P_BOHO" rows={result.departments?.P_BOHO || []} />

          {!result.departments && (
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
        <button style={blueButtonStyle()} onClick={goHome}>
          Home
        </button>
        <button style={blueButtonStyle()} onClick={goToUpdate}>
          Update
        </button>
      </div>
    </div>
  );
}