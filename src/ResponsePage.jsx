import { useLocation, useNavigate } from "react-router-dom";

export default function ResponsePage() {
  const location = useLocation();
  const navigate = useNavigate();
  const responseData = location.state?.responseData;
  const startDate = location.state?.startDate || "";
  const endDate = location.state?.endDate || "";

  const usaReportId = responseData?.usa?.data?.report_req_id || "";
  const deReportId = responseData?.de?.data?.report_req_id || "";

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

  function goToUpdate() {
    navigate("/update", {
      state: {
        usaReportId,
        deReportId,
        startDate,
        endDate,
      },
    });
  }

  function goToReportView() {
    navigate("/report-view", {
      state: {
        usaReportId,
        deReportId,
        startDate,
        endDate,
      },
    });
  }

  if (!responseData) {
    return (
      <div style={{ padding: "20px", fontFamily: "Arial, sans-serif" }}>
        <div style={{ display: "flex", gap: "12px", marginBottom: "20px" }}>
          <button onClick={goHome}>Home</button>
          <button onClick={goToSales}>Sales</button>
        </div>

        <h2>No response data found</h2>
      </div>
    );
  }

  return (
    <div style={{ padding: "20px", fontFamily: "Arial, sans-serif" }}>
      <div style={{ display: "flex", gap: "12px", marginBottom: "20px" }}>
        <button onClick={goHome}>Home</button>
        <button onClick={goToSales}>Sales</button>
      </div>

      <h2>Requested Reports</h2>

      <div style={{ background: "#f4f4f4", padding: "16px", borderRadius: "8px", marginBottom: "16px" }}>
        <div><strong>USA Request ID:</strong> {usaReportId || "-"}</div>
        <div><strong>DE Request ID:</strong> {deReportId || "-"}</div>
        <div><strong>Start:</strong> {startDate || "-"}</div>
        <div><strong>End:</strong> {endDate || "-"}</div>
      </div>

      <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
        <button style={{ padding: "10px 16px", cursor: "pointer" }} onClick={goToSales}>
          Sales Page
        </button>
        <button style={{ padding: "10px 16px", cursor: "pointer" }} onClick={goToUpdate}>
          Update Page
        </button>
        <button style={{ padding: "10px 16px", cursor: "pointer" }} onClick={goToReportView}>
          Report View
        </button>
      </div>
    </div>
  );
}