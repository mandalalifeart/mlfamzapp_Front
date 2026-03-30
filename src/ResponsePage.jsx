import { useEffect } from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";

export default function ResponsePage() {
  const location = useLocation();
  const navigate = useNavigate();
  const responseData = location.state?.responseData;
  const startDate = location.state?.startDate;
  const endDate = location.state?.endDate;

  useEffect(() => {
    if (!responseData || !startDate || !endDate) return;

    const usaReportId = responseData?.usa?.data?.report_req_id;
    const deReportId = responseData?.uk?.data?.report_req_id;

    if (!usaReportId || !deReportId) return;

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
  }, [navigate, responseData, startDate, endDate]);

  if (!responseData) {
    return (
      <div style={{ padding: "20px", fontFamily: "Arial, sans-serif" }}>
        <h2>No response data found</h2>
        <Link to="/">Back to main page</Link>
      </div>
    );
  }

  const usaReportId = responseData?.usa?.data?.report_req_id;
  const deReportId = responseData?.uk?.data?.report_req_id;

  return (
    <div style={{ padding: "20px", fontFamily: "Arial, sans-serif" }}>
      <h2>Requested Reports</h2>

      <div style={{ background: "#f4f4f4", padding: "16px", borderRadius: "8px", marginBottom: "16px" }}>
        <h3>USA</h3>
        <div><strong>Request ID:</strong> {usaReportId}</div>
      </div>

      <div style={{ background: "#f4f4f4", padding: "16px", borderRadius: "8px", marginBottom: "16px" }}>
        <h3>DE</h3>
        <div><strong>Request ID:</strong> {deReportId}</div>
      </div>

      <div style={{ background: "#f9f9f9", padding: "16px", borderRadius: "8px", marginBottom: "16px" }}>
        <div><strong>Start:</strong> {startDate}</div>
        <div><strong>End:</strong> {endDate}</div>
      </div>

      <div style={{ marginTop: "20px", color: "#555" }}>
        Redirecting automatically to Report View in 7 seconds...
      </div>
    </div>
  );
}
