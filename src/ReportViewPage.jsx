import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

const API_BASE = "https://us-central1-mlfamzapp.cloudfunctions.net";

function extractAmznGrValue(input) {
  if (typeof input !== "string") return input;
  const match = input.match(/^amzn\.gr\.([^-]+)/);
  return match ? match[1] : input;
}

function shouldIgnoreSalesChannel(salesChannel) {
  if (!salesChannel) return true;
  return salesChannel === "Non-Amazon" || salesChannel.includes("Prod");
}

function getDirectChildAmount(parentNode) {
  const children = Array.from(parentNode.children || []);
  const amountNode = children.find((child) => child.tagName === "Amount");

  const value = Number(amountNode?.textContent?.trim() || "0");
  const currency = amountNode?.getAttribute("currency") || "";

  return {
    value: Number.isFinite(value) ? value : 0,
    currency,
  };
}

function extractSkuSalesFromXmlPayload(payload) {
  if (!payload || typeof payload !== "string") {
    return {
      rows: [],
      totalOrders: 0,
      totalAmount: 0,
      currency: "",
    };
  }

  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(payload, "application/xml");
  const parserError = xmlDoc.querySelector("parsererror");

  if (parserError) {
    return {
      rows: [],
      totalOrders: 0,
      totalAmount: 0,
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

    const orderItems = Array.from(order.getElementsByTagName("OrderItem"));
    const orderAmount = getDirectChildAmount(order);

    totalAmount += orderAmount.value;
    if (!currency && orderAmount.currency) {
      currency = orderAmount.currency;
    }

    const normalizedItems = orderItems
      .map((orderItem) => {
        let sku = orderItem.getElementsByTagName("SKU")[0]?.textContent?.trim() || "";
        if (!sku) return null;

        if (sku.startsWith("amzn.gr")) {
          sku = extractAmznGrValue(sku);
        }

        const quantity = Number(orderItem.getElementsByTagName("Quantity")[0]?.textContent?.trim() || "0");
        const safeQty = Number.isFinite(quantity) ? quantity : 0;

        const itemAmount = getDirectChildAmount(orderItem);

        return {
          sku,
          qty: safeQty,
          itemAmountValue: itemAmount.value,
          itemAmountCurrency: itemAmount.currency,
        };
      })
      .filter(Boolean);

    const totalQtyInOrder = normalizedItems.reduce((sum, item) => sum + item.qty, 0);
    const totalItemAmounts = normalizedItems.reduce((sum, item) => sum + item.itemAmountValue, 0);
    const hasItemLevelAmounts = totalItemAmounts > 0;

    for (const item of normalizedItems) {
      const existing = totals.get(item.sku) || { sku: item.sku, itemsSold: 0, value: 0 };
      existing.itemsSold += item.qty;

      if (hasItemLevelAmounts) {
        existing.value += item.itemAmountValue;
        if (!currency && item.itemAmountCurrency) {
          currency = item.itemAmountCurrency;
        }
      } else if (totalQtyInOrder > 0 && orderAmount.value) {
        existing.value += (orderAmount.value * item.qty) / totalQtyInOrder;
      }

      totals.set(item.sku, existing);
    }
  }

  const rows = Array.from(totals.values())
    .map((row) => ({
      ...row,
      value: Number(row.value.toFixed(2)),
    }))
    .sort((a, b) => b.itemsSold - a.itemsSold || a.sku.localeCompare(b.sku));

  return {
    rows,
    totalOrders,
    totalAmount: Number(totalAmount.toFixed(2)),
    currency,
  };
}

function getReportIdForMarketplace(marketplace, usaReportId, deReportId) {
  return marketplace === "usa" ? usaReportId : deReportId;
}

export default function ReportViewPage() {
  const location = useLocation();
  const navigate = useNavigate();

  const usaReportId = location.state?.usaReportId || "";
  const deReportId = location.state?.deReportId || "";
  const startDate = location.state?.startDate || "";
  const endDate = location.state?.endDate || "";
  const [marketplace, setMarketplace] = useState(location.state?.defaultMarketplace || "usa");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [statusText, setStatusText] = useState("");
  const [successResponse, setSuccessResponse] = useState(null);
  const [debugResponses, setDebugResponses] = useState([]);

  const selectedReportReqId = useMemo(
    () => getReportIdForMarketplace(marketplace, usaReportId, deReportId),
    [marketplace, usaReportId, deReportId]
  );

  const reportSummary = useMemo(() => {
    const payload = successResponse?.data?.payload;
    return extractSkuSalesFromXmlPayload(payload);
  }, [successResponse]);

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

  useEffect(() => {
    if (!selectedReportReqId) {
      setSuccessResponse(null);
      setError("Missing report request ID for selected marketplace");
      setLoading(false);
      return;
    }

    let cancelled = false;
    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

    async function fetchReportWithRetry() {
      setLoading(true);
      setError("");
      setSuccessResponse(null);
      setStatusText("Starting...");
      setDebugResponses([]);

      const maxAttempts = 12;
      const retryDelayMs = 30000;

      for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        if (cancelled) return;

        setStatusText(`Checking report... attempt ${attempt} of ${maxAttempts}`);

        try {
          const res = await fetch(`${API_BASE}/MlfReportGet`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              marketplace,
              report_req_id: selectedReportReqId,
            }),
          });

          const text = await res.text();

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

            setStatusText(`Still processing... retry in 30s (attempt ${attempt}/${maxAttempts})`);
            await sleep(retryDelayMs);
            continue;
          }

          if (status === "success") {
            setSuccessResponse(data);
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

          setLoading(false);
          return;
        } catch (err) {
          if (attempt === maxAttempts) {
            setError(err.message || "Failed");
            setLoading(false);
            return;
          }

          setStatusText(`Error... retrying in 30s (attempt ${attempt})`);
          await sleep(retryDelayMs);
        }
      }
    }

    fetchReportWithRetry();

    return () => {
      cancelled = true;
    };
  }, [marketplace, selectedReportReqId]);

  return (
    <div style={{ padding: "20px", fontFamily: "Arial, sans-serif" }}>
      <div style={{ display: "flex", gap: "12px", marginBottom: "20px" }}>
        <button onClick={goHome}>Home</button>
        <button onClick={goToSales}>Sales</button>
      </div>

      <h2>Report View</h2>

      <div style={{ marginBottom: 16 }}>
        <div><strong>USA Request ID:</strong> {usaReportId || "-"}</div>
        <div><strong>DE Request ID:</strong> {deReportId || "-"}</div>
        <div><strong>Start:</strong> {startDate || "-"}</div>
        <div><strong>End:</strong> {endDate || "-"}</div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <strong>Marketplace:</strong>
        <div style={{ display: "flex", gap: 16, marginTop: 10 }}>
          <label>
            <input
              type="radio"
              name="marketplace"
              value="usa"
              checked={marketplace === "usa"}
              onChange={(e) => setMarketplace(e.target.value)}
            />{" "}
            USA
          </label>
          <label>
            <input
              type="radio"
              name="marketplace"
              value="de"
              checked={marketplace === "de"}
              onChange={(e) => setMarketplace(e.target.value)}
            />{" "}
            DE
          </label>
        </div>
      </div>

      <div><strong>Selected Request ID:</strong> {selectedReportReqId || "-"}</div>

      {loading && <div style={{ marginTop: 20 }}>{statusText}</div>}
      {error && <div style={{ marginTop: 20, color: "red" }}>{error}</div>}

      {!loading && !error && successResponse && (
        <div style={{ marginTop: 20 }}>
          <div style={{ background: "#f8f8f8", borderRadius: 8, padding: 14, marginBottom: 16 }}>
            <div><strong>Total Orders:</strong> {reportSummary.totalOrders}</div>
            <div><strong>Total Amount:</strong> {reportSummary.totalAmount} {reportSummary.currency}</div>
          </div>

          <h3>Items Sold by SKU</h3>

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
                  <th style={{ border: "1px solid #ccc", padding: "10px", textAlign: "left", background: "#f4f4f4" }}>
                    SKU
                  </th>
                  <th style={{ border: "1px solid #ccc", padding: "10px", textAlign: "left", background: "#f4f4f4" }}>
                    Number of Items Sold
                  </th>
                  <th style={{ border: "1px solid #ccc", padding: "10px", textAlign: "left", background: "#f4f4f4" }}>
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
                      {row.value} {reportSummary.currency}
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
          {debugResponses.map((response, index) => (
            <div
              key={`${response.time}-${index}`}
              style={{ background: "#f4f4f4", padding: 12, borderRadius: 8, marginBottom: 10 }}
            >
              <div style={{ fontSize: 12, color: "#666" }}>{response.time}</div>
              <pre style={{ margin: 0, whiteSpace: "pre-wrap" }}>
                {JSON.stringify(response.data, null, 2)}
              </pre>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}