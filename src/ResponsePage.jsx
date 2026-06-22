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

function getMarketplaceError(marketplaceErrors, key) {
  return marketplaceErrors?.[key] || "Request failed or was skipped";
}

export default function ResponsePage() {
  const location = useLocation();
  const navigate = useNavigate();

  const usaReportId = location.state?.usaReportId || "0";
  const deReportId = location.state?.deReportId || "0";
  const startDate = location.state?.startDate || "";
  const endDate = location.state?.endDate || "";
  const marketplaceErrors = location.state?.marketplaceErrors || {};
  const marketplaceDetails = location.state?.marketplaceDetails || [];

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

        <div
          style={{
            background: "#fff3f3",
            border: "1px solid #d9002f",
            borderRadius: "8px",
            padding: "14px",
            maxWidth: "700px",
            margin: "18px auto 0",
            lineHeight: "1.5",
          }}
        >
          <strong>Error details:</strong>
          <div style={{ marginTop: "8px" }}>
            <strong>USA:</strong> {getMarketplaceError(marketplaceErrors, "usa")}
          </div>
          <div style={{ marginTop: "8px" }}>
            <strong>DE/EU:</strong> {getMarketplaceError(marketplaceErrors, "de")}
          </div>
          <div style={{ marginTop: "8px" }}>
            <strong>Start:</strong> {startDate || "not available"}
          </div>
          <div>
            <strong>End:</strong> {endDate || "not available"}
          </div>
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
            background: "#fff3f3",
            border: "1px solid #d9002f",
            borderRadius: "8px",
            padding: "14px",
            maxWidth: "700px",
            margin: "18px auto 0",
            color: "#333",
            lineHeight: "1.5",
          }}
        >
          <div style={{ color: "#b00020", fontWeight: "bold", textAlign: "center" }}>
            One marketplace request failed. Continuing with the available marketplace.
          </div>

          <div style={{ marginTop: "12px" }}>
            <strong>USA status:</strong> {hasUsaReport ? "SUCCESS" : "FAILED"}
          </div>
          <div>
            <strong>USA details:</strong>{" "}
            {hasUsaReport ? `Report request ID ${usaReportId}` : getMarketplaceError(marketplaceErrors, "usa")}
          </div>

          <div style={{ marginTop: "10px" }}>
            <strong>DE/EU status:</strong> {hasDeReport ? "SUCCESS" : "FAILED"}
          </div>
          <div>
            <strong>DE/EU details:</strong>{" "}
            {hasDeReport ? `Report request ID ${deReportId}` : getMarketplaceError(marketplaceErrors, "de")}
          </div>
        </div>
      )}

      {marketplaceDetails.length > 0 && (
        <div
          style={{
            background: "#f7f7f7",
            border: "1px solid #ddd",
            borderRadius: "8px",
            padding: "14px",
            maxWidth: "700px",
            margin: "18px auto 0",
            lineHeight: "1.5",
          }}
        >
          <strong>Request summary:</strong>
          {marketplaceDetails.map((item) => (
            <div key={`${item.marketplace}-${item.status}`} style={{ marginTop: "8px" }}>
              <strong>{item.marketplace}:</strong> {item.status}
              {item.requestId ? ` | Request ID: ${item.requestId}` : ""}
              <div>{item.message}</div>
            </div>
          ))}
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
