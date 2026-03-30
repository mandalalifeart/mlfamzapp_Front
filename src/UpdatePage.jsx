import { useLocation, useNavigate } from "react-router-dom";

const MARKETPLACES = ["usa", "ca", "mx", "uk", "de", "fr", "it", "es", "se", "ie", "pl", "nl", "be", "jp"];
const NORTH_AMERICA_MARKETS = new Set(["usa", "ca", "mx"]);

function getSourceReportId(marketplace, usaReportId, deReportId) {
  return NORTH_AMERICA_MARKETS.has(marketplace) ? usaReportId : deReportId;
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

export default function UpdatePage() {
  const location = useLocation();
  const navigate = useNavigate();

  const usaReportId = location.state?.usaReportId || "";
  const deReportId = location.state?.deReportId || "";
  const startDate = location.state?.startDate || "";

  function goToSales() {
    navigate("/sales", {
      state: {
        usaReportId,
        deReportId,
        startDate,
      },
    });
  }

  return (
    <div style={{ padding: "20px", fontFamily: "Arial, sans-serif", minHeight: "100vh" }}>
      <h2 style={{ textAlign: "center" }}>Update Page</h2>

      <div
        style={{
          background: "#f4f4f4",
          padding: "16px",
          borderRadius: "8px",
          marginBottom: "20px",
          maxWidth: "700px",
          marginInline: "auto",
        }}
      >
        <div><strong>USA Report ID:</strong> {usaReportId || "-"}</div>
        <div><strong>DE Report ID:</strong> {deReportId || "-"}</div>
        <div><strong>Start Date:</strong> {startDate || "-"}</div>
      </div>

      <div style={{ display: "grid", gap: "18px", maxWidth: "1000px", marginInline: "auto" }}>
        {MARKETPLACES.map((marketplace) => (
          <div
            key={marketplace}
            style={{
              background: "#fff",
              border: "1px solid #ddd",
              borderRadius: "8px",
              padding: "14px",
            }}
          >
            <h3 style={{ marginTop: 0 }}>{marketplace.toUpperCase()}</h3>

            <table style={{ borderCollapse: "collapse", width: "100%" }}>
              <thead>
                <tr>
                  <th style={{ border: "1px solid #ccc", padding: "10px", textAlign: "left", background: "#f4f4f4", width: "220px" }}>
                    Field
                  </th>
                  <th style={{ border: "1px solid #ccc", padding: "10px", textAlign: "left", background: "#f4f4f4" }}>
                    Value
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ border: "1px solid #ccc", padding: "10px" }}>Marketplace</td>
                  <td style={{ border: "1px solid #ccc", padding: "10px" }}>{marketplace.toUpperCase()}</td>
                </tr>
                <tr>
                  <td style={{ border: "1px solid #ccc", padding: "10px" }}>Source Report ID</td>
                  <td style={{ border: "1px solid #ccc", padding: "10px" }}>
                    {getSourceReportId(marketplace, usaReportId, deReportId) || "-"}
                  </td>
                </tr>
                <tr>
                  <td style={{ border: "1px solid #ccc", padding: "10px" }}>Start Date</td>
                  <td style={{ border: "1px solid #ccc", padding: "10px" }}>{startDate || "-"}</td>
                </tr>
                <tr>
                  <td style={{ border: "1px solid #ccc", padding: "10px" }}>Type</td>
                  <td style={{ border: "1px solid #ccc", padding: "10px" }}>sales</td>
                </tr>
              </tbody>
            </table>
          </div>
        ))}
      </div>

      <div style={bottomNavStyle()}>
        <button style={smallButtonStyle()} onClick={() => navigate("/")}>
          Home
        </button>
        <button style={smallButtonStyle()} onClick={goToSales}>
          Sales
        </button>
      </div>
    </div>
  );
}