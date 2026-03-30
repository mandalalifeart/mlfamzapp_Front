import { useLocation, useNavigate } from "react-router-dom";

const MARKETPLACES = ["usa", "ca", "mx", "uk", "de", "fr", "it", "es", "se", "ie", "pl", "nl", "be", "jp"];
const NORTH_AMERICA_MARKETS = new Set(["usa", "ca", "mx"]);

function getSourceReportId(marketplace, usaReportId, deReportId) {
  return NORTH_AMERICA_MARKETS.has(marketplace) ? usaReportId : deReportId;
}

function createTableRows(marketplace, usaReportId, deReportId, startDate) {
  return [
    ["Marketplace", marketplace.toUpperCase()],
    ["Source Report ID", getSourceReportId(marketplace, usaReportId, deReportId) || ""],
    ["Start Date", startDate || ""],
    ["Type", "sales"],
  ];
}

export default function UpdatePage() {
  const location = useLocation();
  const navigate = useNavigate();

  const usaReportId = location.state?.usaReportId || "";
  const deReportId = location.state?.deReportId || "";
  const startDate = location.state?.startDate || "";
  const endDate = location.state?.endDate || "";

  function goHome() {
    navigate("/");
  }

  function goToSales() {
    navigate("/sales", {
      state: {
        usaReportId,
        deReportId,
        startDate,
        endDate,
      },
    });
  }

  return (
    <div style={{ padding: "20px", fontFamily: "Arial, sans-serif" }}>
      <div style={{ display: "flex", gap: "12px", marginBottom: "20px" }}>
        <button onClick={goHome}>Home</button>
        <button onClick={goToSales}>Sales</button>
      </div>

      <h2>Update Page</h2>

      <div style={{ background: "#f4f4f4", padding: "16px", borderRadius: "8px", marginBottom: "20px" }}>
        <div><strong>USA Report ID:</strong> {usaReportId || "-"}</div>
        <div><strong>DE Report ID:</strong> {deReportId || "-"}</div>
        <div><strong>Start Date:</strong> {startDate || "-"}</div>
      </div>

      <div style={{ display: "grid", gap: "18px" }}>
        {MARKETPLACES.map((marketplace) => {
          const rows = createTableRows(marketplace, usaReportId, deReportId, startDate);
          return (
            <div
              key={marketplace}
              style={{ background: "#fff", border: "1px solid #ddd", borderRadius: "8px", padding: "14px" }}
            >
              <h3 style={{ marginTop: 0 }}>{marketplace.toUpperCase()}</h3>
              <table style={{ borderCollapse: "collapse", width: "100%" }}>
                <thead>
                  <tr>
                    <th
                      style={{
                        border: "1px solid #ccc",
                        padding: "10px",
                        textAlign: "left",
                        background: "#f4f4f4",
                        width: "220px",
                      }}
                    >
                      Field
                    </th>
                    <th
                      style={{
                        border: "1px solid #ccc",
                        padding: "10px",
                        textAlign: "left",
                        background: "#f4f4f4",
                      }}
                    >
                      Value
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(([field, value]) => (
                    <tr key={field}>
                      <td style={{ border: "1px solid #ccc", padding: "10px" }}>{field}</td>
                      <td style={{ border: "1px solid #ccc", padding: "10px" }}>{value || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        })}
      </div>
    </div>
  );
}