import { useEffect, useMemo, useState } from "react";
import { useLocation, Link } from "react-router-dom";

function extractAmznGrValue(input) {
  if (typeof input !== "string") return input;
  const match = input.match(/^amzn\.gr\.([^-]+)/);
  return match ? match[1] : input;
}

function shouldIgnoreSalesChannel(salesChannel) {
  if (!salesChannel) return true;
  return salesChannel === "Non-Amazon" || salesChannel.includes("Prod");
}

function parseAmountValue(node) {
  if (!node) return 0;
  const raw = node.textContent?.trim() || "0";
  const value = Number(raw);
  return Number.isFinite(value) ? value : 0;
}

function round2(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function extractSkuSalesFromXmlPayload(payload) {
  if (!payload || typeof payload !== "string") {
    return {
      rows: [],
      totalAmount: 0,
      totalOrders: 0,
      currency: "",
    };
  }

  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(payload, "application/xml");

  const parserError = xmlDoc.querySelector("parsererror");
  if (parserError) {
    return {
      rows: [],
      totalAmount: 0,
      totalOrders: 0,
      currency: "",
    };
  }

  const orderNodes = Array.from(xmlDoc.getElementsByTagName("Order"));
  const totals = new Map();
  let totalOrders = 0;
  let totalAmount = 0;
  let currency = "";

  for (const order of orderNodes) {
    const salesChannel = order.getElementsByTagName("SalesChannel")[0]?.textContent?.trim() || "";
    if (shouldIgnoreSalesChannel(salesChannel)) {
      continue;
    }

    totalOrders += 1;

    const orderAmountNode = order.getElementsByTagName("Amount")[0] || null;
    const orderAmount = parseAmountValue(orderAmountNode);
    const orderCurrency = orderAmountNode?.getAttribute("currency") || "";
    if (!currency && orderCurrency) {
      currency = orderCurrency;
    }
    totalAmount += orderAmount;

    const orderItems = Array.from(order.getElementsByTagName("OrderItem"));
    const parsedItems = orderItems
      .map((orderItem) => {
        let sku = orderItem.getElementsByTagName("SKU")[0]?.textContent?.trim() || "";
        const quantityText = orderItem.getElementsByTagName("Quantity")[0]?.textContent?.trim() || "0";
        const quantity = Number(quantityText);
        const safeQty = Number.isFinite(quantity) ? quantity : 0;

        if (!sku || safeQty <= 0) return null;

        if (sku.startsWith("amzn.gr")) {
          sku = extractAmznGrValue(sku);
        }

        const itemAmountNode = orderItem.getElementsByTagName("Amount")[0] || null;
        const itemAmount = parseAmountValue(itemAmountNode);

        return {
          sku,
          quantity: safeQty,
          itemAmount,
        };
      })
      .filter(Boolean);

    const totalUnitsInOrder = parsedItems.reduce((sum, item) => sum + item.quantity, 0);
    const hasItemAmounts = parsedItems.some((item) => item.itemAmount > 0);

    for (const item of parsedItems) {
      const existing = totals.get(item.sku) || { itemsSold: 0, amount: 0 };

      let amountToAdd = 0;
      if (hasItemAmounts) {
        amountToAdd = item.itemAmount;
      } else if (totalUnitsInOrder > 0) {
        amountToAdd = (orderAmount * item.quantity) / totalUnitsInOrder;
      }

      totals.set(item.sku, {
        itemsSold: existing.itemsSold + item.quantity,
        amount: existing.amount + amountToAdd,
      });
    }
  }

  const rows = Array.from(totals.entries())
    .map(([sku, value]) => ({
      sku,
      itemsSold: value.itemsSold,
      amount: round2(value.amount),
    }))
    .sort((a, b) => b.itemsSold - a.itemsSold || b.amount - a.amount || a.sku.localeCompare(b.sku));

  return {
    rows,
    totalAmount: round2(totalAmount),
    totalOrders,
    currency,
  };
}

export default function ReportViewPage() {
  const location = useLocation();
  const usaReportId = location.state?.usaReportId;
  const deReportId = location.state?.deReportId;
  const startDate = location.state?.startDate;
  const endDate = location.state?.endDate;

  const [selectedMarketplace, setSelectedMarketplace] = useState("usa");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [statusText, setStatusText] = useState("Loading selected marketplace report...");
  const [successResponse, setSuccessResponse] = useState(null);
  const [debugResponses, setDebugResponses] = useState([]);

  const selectedReportReqId = selectedMarketplace === "usa" ? usaReportId : deReportId;

  const reportSummary = useMemo(() => {
    const payload = successResponse?.data?.payload;
    return extractSkuSalesFromXmlPayload(payload);
  }, [successResponse]);

  useEffect(() => {
    if (!usaReportId || !deReportId || !startDate || !endDate) {
      setError("Missing required report parameters");
      setStatusText("");
    }
  }, [usaReportId, deReportId, startDate, endDate]);

  useEffect(() => {
    if (!selectedMarketplace || !selectedReportReqId) {
      setError("Missing marketplace or report request ID");
      return;
    }

    let cancelled = false;
    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

    async function fetchReportWithRetry() {
      setLoading(true);
      setError("");
      setSuccessResponse(null);
      setDebugResponses([]);

      try {
        const maxAttempts = 12;
        const retryDelayMs = 30000;
        const API_BASE = "https://us-central1-mlfamzapp.cloudfunctions.net";

        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
          if (cancelled) return;

          setStatusText(`Checking ${selectedMarketplace.toUpperCase()} report... attempt ${attempt} of ${maxAttempts}`);

          const res = await fetch(`${API_BASE}/MlfReportGet`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              marketplace: selectedMarketplace,
              report_req_id: selectedReportReqId,
            }),
          });

          const text = await res.text();
          console.log("report-get raw response:", text);

          let data = {};
          if (text) {
            try {
              data = JSON.parse(text);
            } catch {
              throw new Error(`Invalid JSON: ${text}`);
            }
          }

          if (!res.ok) {
            throw new Error(data?.message || data?.error || `HTTP ${res.status}`);
          }

          const status = data?.status;
          const payloadStatus = data?.data?.payload;

          const isInProgress =
            status === "IN_PROCESS" ||
            status === "IN_PROGRESS" ||
            payloadStatus === "IN_PROCESS" ||
            payloadStatus === "IN_PROGRESS";

          if (isInProgress) {
            if (attempt === maxAttempts) {
              setError("Report still processing after max attempts");
              setLoading(false);
              return;
            }

            setStatusText(`Still processing ${selectedMarketplace.toUpperCase()}... retry in 30s (attempt ${attempt}/${maxAttempts})`);
            await sleep(retryDelayMs);
            continue;
          }

          if (status === "success") {
            setSuccessResponse(data);
            setStatusText(`Report loaded successfully for ${selectedMarketplace.toUpperCase()}.`);
            setLoading(false);
            return;
          }

          setDebugResponses((prev) => [
            ...prev,
            {
              time: new Date().toLocaleTimeString(),
              data,
            },
          ]);

          setStatusText("Received a non-success response.");
          setLoading(false);
          return;
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message || "Failed");
          setLoading(false);
        }
      }
    }

    fetchReportWithRetry();

    return () => {
      cancelled = true;
    };
  }, [selectedMarketplace, selectedReportReqId]);

  return (
    <div style={{ padding: "20px", fontFamily: "Arial" }}>
      <h2>Report View</h2>

      <div><strong>USA Request ID:</strong> {usaReportId || "-"}</div>
      <div><strong>DE Request ID:</strong> {deReportId || "-"}</div>
      <div><strong>Start:</strong> {startDate || "-"}</div>
      <div><strong>End:</strong> {endDate || "-"}</div>

      <div style={{ marginTop: 20, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <strong>Marketplace:</strong>
        <label>
          <input
            type="radio"
            name="marketplace"
            value="usa"
            checked={selectedMarketplace === "usa"}
            onChange={() => setSelectedMarketplace("usa")}
          />{" "}
          USA
        </label>
        <label>
          <input
            type="radio"
            name="marketplace"
            value="de"
            checked={selectedMarketplace === "de"}
            onChange={() => setSelectedMarketplace("de")}
          />{" "}
          DE
        </label>
      </div>

      <div style={{ marginTop: 12 }}>
        <strong>Selected Request ID:</strong> {selectedReportReqId || "-"}
      </div>

      {statusText && <div style={{ marginTop: 20 }}>{statusText}</div>}
      {error && <div style={{ marginTop: 20, color: "red" }}>{error}</div>}

      {!loading && !error && successResponse && (
        <div style={{ marginTop: 20 }}>
          <h3>Items Sold by SKU</h3>

          <div style={{ marginBottom: 12 }}>
            <div><strong>Total Orders:</strong> {reportSummary.totalOrders}</div>
            <div>
              <strong>Total Amount:</strong> {reportSummary.totalAmount}
              {reportSummary.currency ? ` ${reportSummary.currency}` : ""}
            </div>
          </div>

          {reportSummary.rows.length > 0 ? (
            <table
              style={{
                borderCollapse: "collapse",
                width: "100%",
                marginTop: 12,
              }}
            >
              <thead>
                <tr>
                  <th
                    style={{
                      border: "1px solid #ccc",
                      padding: "10px",
                      textAlign: "left",
                      background: "#f4f4f4",
                    }}
                  >
                    SKU
                  </th>
                  <th
                    style={{
                      border: "1px solid #ccc",
                      padding: "10px",
                      textAlign: "left",
                      background: "#f4f4f4",
                    }}
                  >
                    Number of Items Sold
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
                {reportSummary.rows.map((row) => (
                  <tr key={row.sku}>
                    <td style={{ border: "1px solid #ccc", padding: "10px" }}>{row.sku}</td>
                    <td style={{ border: "1px solid #ccc", padding: "10px" }}>{row.itemsSold}</td>
                    <td style={{ border: "1px solid #ccc", padding: "10px" }}>
                      {row.amount}
                      {reportSummary.currency ? ` ${reportSummary.currency}` : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div style={{ marginTop: 12 }}>
              Success response received, but no SKU rows could be extracted from the XML payload.
            </div>
          )}
        </div>
      )}

      {!loading && !error && debugResponses.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <h3>Other Responses</h3>

          {debugResponses.map((r, index) => (
            <div
              key={index}
              style={{
                background: "#f4f4f4",
                padding: 12,
                borderRadius: 8,
                marginBottom: 10,
              }}
            >
              <div style={{ fontSize: 12, color: "#666" }}>{r.time}</div>
              <pre style={{ margin: 0 }}>
                {JSON.stringify(r.data, null, 2)}
              </pre>
            </div>
          ))}
        </div>
      )}

      <div style={{ marginTop: 20 }}>
        <Link to="/response">Back</Link>
      </div>
    </div>
  );
}
