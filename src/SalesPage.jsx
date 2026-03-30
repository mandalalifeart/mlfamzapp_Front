import { useLocation, useNavigate } from "react-router-dom";

export default function SalesPage() {
  const location = useLocation();
  const navigate = useNavigate();

  const usaReportId = location.state?.usaReportId || "";
  const deReportId = location.state?.deReportId || "";
  const startDate = location.state?.startDate || "";
  const endDate = location.state?.endDate || "";

  const salesCards = [
    { marketplace: "usa", label: "USA", reportReqId: usaReportId },
    { marketplace: "de", label: "DE", reportReqId: deReportId },
  ];

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

  function openReport(marketplace) {
    navigate("/report-view", {
      state: {
        usaReportId,
        deReportId,
        startDate,
        endDate,
        defaultMarketplace: marketplace,
      },
    });
  }

  return (
    <div style={{ padding: "20px", fontFamily: "Arial, sans-serif" }}>
      <div style={{ display: "flex", gap: "12px", marginBottom: "20px" }}>
        <button onClick={goHome}>Home</button>
        <button onClick={goToSales}>Sales</button>
      </div>

      <h2>Sales</h2>

      <div style={{ marginBottom: "16px" }}>
        <div><strong>Start:</strong> {startDate || "-"}</div>
        <div><strong>End:</strong> {endDate || "-"}</div>
      </div>

      <div style={{ display: "grid", gap: "16px" }}>
        {salesCards.map((item) => (
          <div
            key={item.marketplace}
            style={{ background: "#f4f4f4", padding: "16px", borderRadius: "8px" }}
          >
            <h3 style={{ marginTop: 0 }}>{item.label} Sales</h3>
            <div><strong>Request ID:</strong> {item.reportReqId || "-"}</div>
            <button
              style={{ marginTop: "12px", padding: "10px 16px", cursor: "pointer" }}
              onClick={() => openReport(item.marketplace)}
              disabled={!item.reportReqId}
            >
              Open Sales Report
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}