import { useLocation, useNavigate } from "react-router-dom";

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
      <div style={{ padding: "20px", fontFamily: "Arial, sans-serif", minHeight: "100vh" }}>
        <h2>No response data found</h2>

        <div style={bottomNavStyle()}>
          <button style={smallButtonStyle()} onClick={goHome}>
            Home
          </button>
          <button style={smallButtonStyle()} onClick={goToSales}>
            Sales
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: "20px", fontFamily: "Arial, sans-serif", minHeight: "100vh" }}>
      <h2 style={{ textAlign: "center" }}>Requested Reports</h2>

      <div
        style={{
          background: "#f4f4f4",
          padding: "16px",
          borderRadius: "8px",
          marginBottom: "16px",
          maxWidth: "700px",
          marginInline: "auto",
        }}
      >
        <div><strong>USA Request ID:</strong> {usaReportId || "-"}</div>
        <div><strong>DE Request ID:</strong> {deReportId || "-"}</div>
        <div><strong>Start:</strong> {startDate || "-"}</div>
        <div><strong>End:</strong> {endDate || "-"}</div>
      </div>

      <div style={{ display: "flex", justifyContent: "center", marginTop: "24px" }}>
        <button style={{ padding: "10px 18px", cursor: "pointer", borderRadius: "8px" }} onClick={goToReportView}>
          Report View
        </button>
      </div>

      <div style={bottomNavStyle()}>
        <button style={smallButtonStyle()} onClick={goHome}>
          Home
        </button>
        <button style={smallButtonStyle()} onClick={goToSales}>
          Sales
        </button>
      </div>
    </div>
  );
}