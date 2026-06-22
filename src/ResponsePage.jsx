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

function isValidReportId(reportId) {
  return Boolean(reportId && reportId !== "0");
}

function reportStatusText(reportId) {
  return isValidReportId(reportId) ? reportId : "0 - failed / skipped";
}

export default function ResponsePage() {
  const location = useLocation();
  const navigate = useNavigate();

  const usaReportId = location.state?.usaReportId || "0";
  const deReportId = location.state?.deReportId || "0";
  const startDate = location.state?.startDate || "";
  const endDate = location.state?.endDate || "";

  const hasUsaReport = isValidReportId(usaReportId);
  const hasDeReport = isValidReportId(deReportId);
  const hasAnyReport = hasUsaReport || hasDeReport;
  const hasPartialFailure = hasAnyReport && (!hasUsaReport || !hasDeReport);

  useEffect(() => {
    if (!hasAnyReport) return;

    const timer = setTimeout(() => {
      navigate("/report-view", {
        replace: true,
        state: {
          usaReportId,
          deReportId,
          startDate,
          endDate,
        },
      });
    }, 7000);

    return () => clearTimeout(timer);
  }, [navigate, usaReportId, deReportId, startDate, endDate, hasAnyReport]);

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

  if (!hasAnyReport) {
    return (
      <div style={{ padding: "20px", fontFamily: "Arial, sans-serif", minHeight: "100vh" }}>
        <h2 style={{ textAlign: "center", color: "#b00020" }}>
          Both marketplace requests failed
        </h2>

        <p style={{ textAlign: "center" }}>
          No report request ID was created for USA or DE/EU.
        </p>

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
        <div>
          <strong>USA Request ID:</strong> {reportStatusText(usaReportId)}
        </div>
        <div>
          <strong>DE/EU Request ID:</strong> {reportStatusText(deReportId)}
        </div>
        <div>
          <strong>Start:</strong> {startDate}
        </div>
        <div>
          <strong>End:</strong> {endDate}
        </div>
      </div>

      {hasPartialFailure && (
        <div
          style={{
            textAlign: "center",
            marginTop: "20px",
            color: "#b00020",
            fontWeight: "bold",
          }}
        >
          One marketplace request failed. Continuing with the available marketplace.
        </div>
      )}

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
