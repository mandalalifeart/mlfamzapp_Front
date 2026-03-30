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

  const normalized = salesChannel.trim().toLowerCase();

  if (normalized.startsWith("non-amazon")) return true;
  if (normalized.includes("prod")) return true;

  return false;
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

function getOrderItemAmount(orderItem) {
  if (!orderItem) {
    return { value: 0, currency: "" };
  }

  const itemPriceNode = orderItem.getElementsByTagName("ItemPrice")[0];
  if (itemPriceNode) {
    const amountNode = itemPriceNode.getElementsByTagName("Amount")[0];
    const value = Number(amountNode?.textContent?.trim() || "0");
    const currency = amountNode?.getAttribute("currency") || "";

    if (Number.isFinite(value) && value > 0) {
      return { value, currency };
    }
  }

  return getDirectChildAmount(orderItem);
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
      console.log("Ignoring order בגלל sales channel:", salesChannel);
      continue;
    }

    totalOrders += 1;

    const orderItems = Array.from(order.getElementsByTagName("OrderItem"));
    const orderAmount = getDirectChildAmount(order);

    const normalizedItems = orderItems
      .map((orderItem) => {
        let sku = orderItem.getElementsByTagName("SKU")[0]?.textContent?.trim() || "";
        if (!sku) return null;

        if (sku.startsWith("amzn.gr")) {
          sku = extractAmznGrValue(sku);
        }

        const quantity = Number(orderItem.getElementsByTagName("Quantity")[0]?.textContent?.trim() || "0");
        const safeQty = Number.isFinite(quantity) ? quantity : 0;

        const itemAmount = getOrderItemAmount(orderItem);

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

    if (hasItemLevelAmounts) {
      totalAmount += totalItemAmounts;
      if (!currency) {
        const firstCurrency = normalizedItems.find((item) => item.itemAmountCurrency)?.itemAmountCurrency || "";
        currency = firstCurrency;
      }
    } else {
      totalAmount += orderAmount.value;
      if (!currency && orderAmount.currency) {
        currency = orderAmount.currency;
      }
    }

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

export default function ReportViewPage() {
  const location = useLocation();
  const navigate = useNavigate();

  const usaReportId = location.state?.usaReportId || "";
  const deReportId = location.state?.deReportId || "";
  const startDate = location.state?.startDate || "";
  const endDate = location.state?.endDate || "";

  const [marketplace, setMarketplace] = useState("usa");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [statusText, setStatusText] = useState("");
  const [successResponse, setSuccessResponse] = useState(null);

  const selectedReportReqId = marketplace === "usa" ? usaReportId : deReportId;

  const reportSummary = useMemo(() => {
    const payload = successResponse?.data?.payload;
    return extractSkuSalesFromXmlPayload(payload);
  }, [successResponse]);

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
      },
    });
  }

  useEffect(() => {
    if (!selectedReportReqId) {
      setSuccessResponse(null);
      setError("Missing report request ID");
      return;
    }

    let cancelled = false;
    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

    async function fetchReportWithRetry() {
      setLoading(true);
      setError("");
      setSuccessResponse(null);
      setStatusText("Starting...");

      const maxAttempts = 12;
      const retryDelayMs = 30000;

      for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        if (cancelled) return;

        setStatusText(`Checking report... attempt ${attempt} of ${maxAttempts}`);

        try {
          const res = await fetch(`${API_BASE}/MlfReportGet`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              marketplace,
              report_req_id: selectedReportReqId,
            }),
          });

          const text = await res.text();
          console.log("MlfReportGet raw response:", text);

          let data = {};
          if (text) {
            data = JSON.parse(text);
          }

          console.log("MlfReportGet parsed response:", data);
          console.log("MlfReportGet payload:", data?.data?.payload);

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
    <div style={{ padding: "20px", fontFamily: "Arial, sans-serif", minHeight: "100vh" }}>
      <h2 style={{ textAlign: "center" }}>Report View</h2>

      <div
        style={{
          marginBottom: 16,
          maxWidth: "720px",
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

      <div style={{ marginBottom: 18, textAlign: "center" }}>
        <strong>Marketplace</strong>
        <div style={{ display: "flex", justifyContent: "center", gap: 24, marginTop: 10 }}>
          <label>
            <input
              type="radio"
              name="marketplace"
              value="usa"
              checked={marketplace === "usa"}
              onChange={(e) => setMarketplace(e.target.value)}
            />
            {" "}USA
          </label>

          <label>
            <input
              type="radio"
              name="marketplace"
              value="de"
              checked={marketplace === "de"}
              onChange={(e) => setMarketplace(e.target.value)}
            />
            {" "}DE
          </label>
        </div>
      </div>

      <div style={{ textAlign: "center", marginBottom: 18 }}>
        <button style={{ padding: "10px 18px", borderRadius: "8px", cursor: "pointer" }} onClick={goToUpdate}>
          Update
        </button>
      </div>

      {loading && <div style={{ textAlign: "center" }}>{statusText}</div>}
      {error && <div style={{ textAlign: "center", color: "red" }}>{error}</div>}

      {!loading && !error && successResponse && (
        <div style={{ marginTop: 20, maxWidth: "1000px", marginInline: "auto" }}>
          <div style={{ background: "#f8f8f8", borderRadius: 8, padding: 14, marginBottom: 16 }}>
            <div><strong>Total Orders:</strong> {reportSummary.totalOrders}</div>
            <div><strong>Total Amount:</strong> {reportSummary.totalAmount} {reportSummary.currency}</div>
          </div>

          <h3>Items Sold by SKU</h3>

          <table style={{ borderCollapse: "collapse", width: "100%", marginTop: 12 }}>
            <thead>
              <tr>
                <th style={{ border: "1px solid #ccc", padding: "10px", textAlign: "left", background: "#f4f4f4" }}>SKU</th>
                <th style={{ border: "1px solid #ccc", padding: "10px", textAlign: "left", background: "#f4f4f4" }}>Number of Items Sold</th>
                <th style={{ border: "1px solid #ccc", padding: "10px", textAlign: "left", background: "#f4f4f4" }}>Value</th>
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
        </div>
      )}

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