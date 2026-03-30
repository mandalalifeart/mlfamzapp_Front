import { useEffect } from "react";
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

  const usaReportId = location.state?.usaReportId || "";
  const deReportId = location.state?.deReportId || "";
  const startDate = location.state?.startDate || "";
  const endDate = location.state?.endDate || "";

  useEffect(() => {
    if (!usaReportId && !deReportId) return;

    const timer = setTimeout(() => {
      navigate("/report-view", {
        state: {
          usaReportId,
          deReportId,
          startDate,
          endDate,
        },
      });
    }, 7000);

    return () => clearTimeout(timer);
  }, [navigate, usaReportId, deReportId, startDate, endDate]);

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

  if (!usaReportId && !deReportId) {
    return (
      <div style={{ padding: "20px", fontFamily: "Arial, sans-serif", minHeight: "100vh" }}>
        <h2>No response data found</h2>

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
        <div><strong>USA Request ID:</strong> {usaReportId}</div>
        <div><strong>DE Request ID:</strong> {deReportId}</div>
        <div><strong>Start:</strong> {startDate}</div>
        <div><strong>End:</strong> {endDate}</div>
      </div>

      <div style={{ textAlign: "center", marginTop: "20px" }}>
        Forwarding to report view in 7 seconds...
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