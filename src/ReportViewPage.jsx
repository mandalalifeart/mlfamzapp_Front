import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

const API_BASE = "https://us-central1-mlfamzapp.cloudfunctions.net";

// ... (ALL YOUR CODE ABOVE STAYS EXACTLY THE SAME — no changes)

// ⬇️ ONLY CHANGE IS HERE ⬇️

export default function ReportViewPage() {
  const location = useLocation();
  const navigate = useNavigate();

  const usaReportId = location.state?.usaReportId || "";
  const deReportId = location.state?.deReportId || "";
  const startDate = location.state?.startDate || "";
  const endDate = location.state?.endDate || "";

  const [loadingUsa, setLoadingUsa] = useState(false);
  const [loadingDe, setLoadingDe] = useState(false);
  const [errorUsa, setErrorUsa] = useState("");
  const [errorDe, setErrorDe] = useState("");
  const [statusUsa, setStatusUsa] = useState("");
  const [statusDe, setStatusDe] = useState("");
  const [usaResponse, setUsaResponse] = useState(null);
  const [deResponse, setDeResponse] = useState(null);
  const [selectedMarketplace, setSelectedMarketplace] = useState("");

  const usaSummary = useMemo(() => {
    const payload = usaResponse?.data?.payload;
    return extractSkuSalesFromXmlPayload(payload, "usa", selectedMarketplace);
  }, [usaResponse, selectedMarketplace]);

  const deSummary = useMemo(() => {
    const payload = deResponse?.data?.payload;
    return extractSkuSalesFromXmlPayload(payload, "de", selectedMarketplace);
  }, [deResponse, selectedMarketplace]);

  function goToSales() {
    navigate("/sales", {
      state: { usaReportId, deReportId, startDate, endDate },
    });
  }

  function goToUpdate() {
    navigate("/update", {
      state: { usaReportId, deReportId, startDate, endDate },
    });
  }

  // ... (ALL YOUR useEffect logic stays the same)

  const regionSummaryRows = [
    {
      region: "USA",
      orders: usaSummary.totalOrders,
      items: usaSummary.totalItems,
      amount: `${usaSummary.totalAmount} ${usaSummary.currency}`,
    },
    {
      region: "DE",
      orders: deSummary.totalOrders,
      items: deSummary.totalItems,
      amount: `${deSummary.totalAmount} ${deSummary.currency}`,
    },
  ];

  const selectedMarketplaceLabel =
    MARKETPLACE_OPTIONS.find((option) => option.value === selectedMarketplace)?.label ||
    "All marketplaces";

  return (
    <div
      style={{
        padding: "20px",
        fontFamily: "Arial, sans-serif",
        minHeight: "100vh",
        background: "#ffffff", // ✅ FIX
        width: "100%",         // ✅ FIX
        margin: 0,             // ✅ FIX (extra safety)
      }}
    >
      <h2 style={{ textAlign: "center" }}>Report View</h2>

      <div
        style={{
          marginBottom: 16,
          maxWidth: "760px",
          marginInline: "auto",
          background: "#f8f8f8",
          padding: "16px",
          borderRadius: "8px",
        }}
      >
        <div><strong>USA Request ID:</strong> {usaReportId || "-"}</div>
        <div><strong>DE Request ID:</strong> {deReportId || "-"}</div>
        <div><strong>Start:</strong> {startDate || "-"}</div>
        <div><strong>End:</strong> {endDate || "-"}</div>
      </div>

      <div style={{ maxWidth: "1100px", marginInline: "auto" }}>
        <div style={sectionCardStyle()}>
          <h3 style={{ marginTop: 0 }}>Summary by Region</h3>

          <table style={{ borderCollapse: "collapse", width: "100%", marginTop: 12 }}>
            <thead>
              <tr>
                <th style={{ border: "1px solid #ccc", padding: "10px", background: "#f4f4f4" }}>Region</th>
                <th style={{ border: "1px solid #ccc", padding: "10px", background: "#f4f4f4" }}>Total Orders</th>
                <th style={{ border: "1px solid #ccc", padding: "10px", background: "#f4f4f4" }}>Total Items</th>
                <th style={{ border: "1px solid #ccc", padding: "10px", background: "#f4f4f4" }}>Total Amount</th>
              </tr>
            </thead>
            <tbody>
              {regionSummaryRows.map((row) => (
                <tr key={row.region}>
                  <td style={{ border: "1px solid #ccc", padding: "10px" }}>{row.region}</td>
                  <td style={{ border: "1px solid #ccc", padding: "10px" }}>{row.orders}</td>
                  <td style={{ border: "1px solid #ccc", padding: "10px" }}>{row.items}</td>
                  <td style={{ border: "1px solid #ccc", padding: "10px" }}>{row.amount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {!loadingUsa && !errorUsa && (
          <div style={sectionCardStyle()}>
            <RegionTable
              title={`USA Totals + SKU Table (${selectedMarketplaceLabel})`}
              summary={usaSummary}
            />
          </div>
        )}

        {!loadingDe && !errorDe && (
          <div style={sectionCardStyle()}>
            <RegionTable
              title={`DE Totals + SKU Table (${selectedMarketplaceLabel})`}
              summary={deSummary}
            />
          </div>
        )}
      </div>

      <div style={bottomNavStyle()}>
        <button style={smallButtonStyle()} onClick={() => navigate("/")}>Home</button>
        <button style={smallButtonStyle()} onClick={goToSales}>Sales</button>

        <select
          value={selectedMarketplace}
          onChange={(e) => setSelectedMarketplace(e.target.value)}
          style={selectorStyle()}
        >
          {MARKETPLACE_OPTIONS.map((option) => (
            <option key={option.label} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        <button style={updateButtonStyle()} onClick={goToUpdate}>Update</button>
      </div>
    </div>
  );
}