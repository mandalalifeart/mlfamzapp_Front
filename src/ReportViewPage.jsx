import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

const API_BASE = "https://us-central1-mlfamzapp.cloudfunctions.net";
const MAX_ATTEMPTS = 12;
const RETRY_SECONDS = 30;

function bottomNavStyle() {
  return {
    display: "flex",
    justifyContent: "center",
    gap: "14px",
    marginTop: "28px",
    paddingBottom: "16px",
    alignItems: "center",
    flexWrap: "wrap",
  };
}

function smallButtonStyle() {
  return {
    padding: "12px 36px",
    fontSize: "16px",
    fontWeight: "bold",
    cursor: "pointer",
    borderRadius: "8px",
    border: "none",
    background: "#819ac4",
    color: "white",
  };
}

function errorBoxStyle() {
  return {
    marginTop: "14px",
    padding: "14px",
    borderRadius: "8px",
    background: "#fff0f0",
    border: "1px solid #d00000",
    color: "#8a0000",
    textAlign: "left",
    maxWidth: "900px",
    marginInline: "auto",
    whiteSpace: "pre-wrap",
    fontFamily: "Arial, sans-serif",
    fontSize: "14px",
  };
}

function infoBoxStyle() {
  return {
    background: "#f6f6f6",
    padding: "24px",
    borderRadius: "8px",
    margin: "28px auto",
    maxWidth: "1100px",
    textAlign: "center",
  };
}

function isValidReportId(reportId) {
  return reportId && reportId !== "0";
}

function safeText(value) {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function getXmlText(parent, tagName) {
  const node = parent.getElementsByTagName(tagName)?.[0];
  return node?.textContent?.trim() || "";
}

function parseNumber(value) {
  const n = Number(String(value || "0").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

function parseAmazonXml(xmlText) {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlText, "text/xml");

  const parserError = xmlDoc.getElementsByTagName("parsererror")?.[0];
  if (parserError) {
    throw new Error("Could not parse Amazon XML report");
  }

  const orders = Array.from(xmlDoc.getElementsByTagName("Order"));

  let orderCount = 0;
  let itemCount = 0;
  let amount = 0;
  const rows = [];

  for (const order of orders) {
    orderCount += 1;

    const amazonOrderId = getXmlText(order, "AmazonOrderID");
    const salesChannel = getXmlText(order, "SalesChannel");
    const purchaseDate = getXmlText(order, "PurchaseDate");

    const orderItems = Array.from(order.getElementsByTagName("OrderItem"));

    for (const item of orderItems) {
      const sku = getXmlText(item, "SKU");
      const title = getXmlText(item, "Title") || getXmlText(item, "ProductName");
      const quantity = parseNumber(getXmlText(item, "Quantity"));

      // Amazon AllOrdersReport stores prices as:
      // <ItemPrice><Component><Type>Principal</Type><Amount currency="EUR">25.55</Amount></Component></ItemPrice>
      // So do not parse ItemPrice directly. Read the nested Amount instead.
      const itemPriceNode = item.querySelector("ItemPrice Component Amount");
      const itemPrice = parseNumber(itemPriceNode?.textContent || "0");

      itemCount += quantity;
      amount += itemPrice;

      rows.push({
        amazonOrderId,
        salesChannel,
        purchaseDate,
        sku,
        title,
        quantity,
        itemPrice,
      });
    }
  }

  return {
    orderCount,
    itemCount,
    amount,
    rows,
  };
}

async function fetchMarketplaceReport(marketplace, reportReqId) {
  if (!isValidReportId(reportReqId)) {
    return {
      status: "skipped",
      marketplace,
      reportReqId,
      message: `${marketplace.toUpperCase()} skipped because report request ID is 0`,
    };
  }

  let rawText = "";
  let data = null;

  try {
    const response = await fetch(`${API_BASE}/MlfReportGet`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        marketplace,
        report_req_id: reportReqId,
      }),
    });

    rawText = await response.text();

    try {
      data = rawText ? JSON.parse(rawText) : null;
    } catch {
      data = null;
    }

    const backendStatus = data?.status || "";
    const backendPayload = data?.data?.payload;
    const backendMessage = data?.message || data?.error || "";

    if (!response.ok) {
      return {
        status: "error",
        marketplace,
        reportReqId,
        httpStatus: response.status,
        backendStatus,
        message:
          safeText(backendPayload) ||
          safeText(backendMessage) ||
          rawText ||
          `HTTP ${response.status}`,
        fullResponse: data || rawText,
      };
    }

    if (backendStatus === "success") {
      const payload = data?.data?.payload || "";

      try {
        const parsed = parseAmazonXml(payload);
        return {
          status: "success",
          marketplace,
          reportReqId,
          payload,
          parsed,
          message: "Report loaded successfully",
          fullResponse: data,
        };
      } catch (parseErr) {
        return {
          status: "error",
          marketplace,
          reportReqId,
          httpStatus: response.status,
          backendStatus,
          message: parseErr.message || "XML parse error",
          fullResponse: data,
        };
      }
    }

    if (
      backendStatus === "IN_PROCESS" ||
      backendStatus === "IN_PROGRESS" ||
      backendPayload === "IN_PROCESS" ||
      backendPayload === "IN_PROGRESS"
    ) {
      return {
        status: "processing",
        marketplace,
        reportReqId,
        httpStatus: response.status,
        backendStatus,
        message: safeText(backendPayload) || "Report still processing",
        fullResponse: data,
      };
    }

    if (
      backendStatus === "ERROR_FATAL" ||
      backendStatus === "ERROR_MlfReportGet" ||
      backendStatus?.toUpperCase?.().includes("ERROR")
    ) {
      return {
        status: "error",
        marketplace,
        reportReqId,
        httpStatus: response.status,
        backendStatus,
        message:
          safeText(backendPayload) ||
          safeText(backendMessage) ||
          `Backend returned status: ${backendStatus}`,
        fullResponse: data,
      };
    }

    return {
      status: "error",
      marketplace,
      reportReqId,
      httpStatus: response.status,
      backendStatus,
      message:
        safeText(backendPayload) ||
        safeText(backendMessage) ||
        `Unexpected backend status: ${backendStatus}`,
      fullResponse: data,
    };
  } catch (err) {
    return {
      status: "error",
      marketplace,
      reportReqId,
      message: err.message || String(err),
      fullResponse: data || rawText || null,
    };
  }
}

function ErrorDetails({ result }) {
  if (!result || result.status !== "error") return null;

  return (
    <div style={errorBoxStyle()}>
      <div>
        <strong>{result.marketplace?.toUpperCase()} error details</strong>
      </div>

      <div style={{ marginTop: "8px" }}>
        <strong>Report request ID:</strong> {result.reportReqId || "missing"}
      </div>

      {result.httpStatus && (
        <div>
          <strong>HTTP status:</strong> {result.httpStatus}
        </div>
      )}

      {result.backendStatus && (
        <div>
          <strong>Backend status:</strong> {result.backendStatus}
        </div>
      )}

      <div style={{ marginTop: "8px" }}>
        <strong>Error message:</strong>
        <br />
        {result.message || "Unknown error"}
      </div>

      {result.fullResponse && (
        <details style={{ marginTop: "12px" }}>
          <summary style={{ cursor: "pointer", fontWeight: "bold" }}>
            Full backend response
          </summary>
          <pre style={{ overflowX: "auto", whiteSpace: "pre-wrap" }}>
            {safeText(result.fullResponse)}
          </pre>
        </details>
      )}
    </div>
  );
}

function MarketplaceSection({ title, result, attempt }) {
  return (
    <div style={infoBoxStyle()}>
      <h2>{title}</h2>

      {result?.status === "success" && (
        <div>
          <div style={{ color: "green", fontWeight: "bold" }}>
            {title} loaded successfully
          </div>
          <div>Orders: {result.parsed?.orderCount || 0}</div>
          <div>Items: {result.parsed?.itemCount || 0}</div>
          <div>Amount: {Math.round(result.parsed?.amount || 0)}</div>
        </div>
      )}

      {result?.status === "processing" && (
        <div>
          {title} still processing... retry in {RETRY_SECONDS}s attempt{" "}
          {attempt}/{MAX_ATTEMPTS}
        </div>
      )}

      {result?.status === "error" && (
        <>
          <div>
            {title} error... retrying in {RETRY_SECONDS}s attempt {attempt}/
            {MAX_ATTEMPTS}
          </div>
          <ErrorDetails result={result} />
        </>
      )}

      {result?.status === "skipped" && (
        <div style={{ color: "#777" }}>{result.message}</div>
      )}

      {!result && <div>{title} waiting...</div>}
    </div>
  );
}

export default function ReportViewPage() {
  const location = useLocation();
  const navigate = useNavigate();

  const usaReportId = location.state?.usaReportId || "0";
  const deReportId = location.state?.deReportId || "0";
  const startDate = location.state?.startDate || "";
  const endDate = location.state?.endDate || "";

  const [usaResult, setUsaResult] = useState(null);
  const [deResult, setDeResult] = useState(null);
  const [attempt, setAttempt] = useState(1);

  const timerRef = useRef(null);

  const hasUsa = isValidReportId(usaReportId);
  const hasDe = isValidReportId(deReportId);

  async function loadReports(currentAttempt) {
    const tasks = [];

    if (hasUsa) {
      tasks.push(
        fetchMarketplaceReport("usa", usaReportId).then((result) => {
          console.log("USA report result:", result);
          setUsaResult(result);
          return result;
        })
      );
    } else {
      setUsaResult({
        status: "skipped",
        marketplace: "usa",
        reportReqId: usaReportId,
        message: "USA skipped because request ID is 0",
      });
    }

    if (hasDe) {
      tasks.push(
        fetchMarketplaceReport("de", deReportId).then((result) => {
          console.log("DE report result:", result);
          setDeResult(result);
          return result;
        })
      );
    } else {
      setDeResult({
        status: "skipped",
        marketplace: "de",
        reportReqId: deReportId,
        message: "DE skipped because request ID is 0",
      });
    }

    const results = await Promise.all(tasks);

    const shouldRetry =
      currentAttempt < MAX_ATTEMPTS &&
      results.some(
        (result) =>
          result.status === "processing" ||
          result.status === "error"
      );

    if (shouldRetry) {
      timerRef.current = setTimeout(() => {
        setAttempt((prev) => prev + 1);
      }, RETRY_SECONDS * 1000);
    }
  }

  useEffect(() => {
    loadReports(attempt);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt]);

  const summary = useMemo(() => {
    const usaOrders = usaResult?.parsed?.orderCount || 0;
    const usaItems = usaResult?.parsed?.itemCount || 0;
    const usaAmount = usaResult?.parsed?.amount || 0;

    const deOrders = deResult?.parsed?.orderCount || 0;
    const deItems = deResult?.parsed?.itemCount || 0;
    const deAmount = deResult?.parsed?.amount || 0;

    return {
      usaOrders,
      usaItems,
      usaAmount,
      deOrders,
      deItems,
      deAmount,
      totalOrders: usaOrders + deOrders,
      totalItems: usaItems + deItems,
      totalAmount: usaAmount + deAmount,
    };
  }, [usaResult, deResult]);

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

  return (
    <div
      style={{
        padding: "20px",
        fontFamily: "Arial, sans-serif",
        minHeight: "100vh",
      }}
    >
      <h1 style={{ textAlign: "center" }}>Report View</h1>

      <div
        style={{
          background: "red",
          color: "white",
          padding: "10px",
          fontSize: "22px",
          fontWeight: "bold",
          textAlign: "center",
          marginBottom: "20px",
        }}
      >
        VERSION price-parser-fix-20260625
      </div>

      <div
        style={{
          maxWidth: "1100px",
          margin: "20px auto",
          background: "#f7f7f7",
          padding: "14px",
          borderRadius: "8px",
          textAlign: "center",
        }}
      >
        <div>
          <strong>Start:</strong> {startDate || "-"}
        </div>
        <div>
          <strong>End:</strong> {endDate || "-"}
        </div>
        <div>
          <strong>USA Report ID:</strong> {usaReportId}
        </div>
        <div>
          <strong>DE Report ID:</strong> {deReportId}
        </div>
      </div>

      <div style={infoBoxStyle()}>
        <h2>Summary by Region</h2>

        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            background: "white",
            fontSize: "20px",
          }}
        >
          <thead>
            <tr>
              <th style={tableHeaderStyle()}>Region</th>
              <th style={tableHeaderStyle()}>Orders</th>
              <th style={tableHeaderStyle()}>Items</th>
              <th style={tableHeaderStyle()}>Amount</th>
            </tr>
          </thead>

          <tbody>
            <tr>
              <td style={tableCellStyle()}>USA</td>
              <td style={tableCellStyle()}>{summary.usaOrders}</td>
              <td style={tableCellStyle()}>{summary.usaItems}</td>
              <td style={tableCellStyle()}>
                {Math.round(summary.usaAmount)} USD
              </td>
            </tr>

            <tr>
              <td style={tableCellStyle()}>DE</td>
              <td style={tableCellStyle()}>{summary.deOrders}</td>
              <td style={tableCellStyle()}>{summary.deItems}</td>
              <td style={tableCellStyle()}>
                {Math.round(summary.deAmount)} EUR
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <MarketplaceSection title="USA" result={usaResult} attempt={attempt} />
      <MarketplaceSection title="DE" result={deResult} attempt={attempt} />

      <div style={bottomNavStyle()}>
        <button type="button" style={smallButtonStyle()} onClick={() => navigate("/")}>
          Home
        </button>

        <button type="button" style={smallButtonStyle()} onClick={goToSales}>
          Sales
        </button>

        <select
          style={{
            padding: "12px 24px",
            fontSize: "16px",
            borderRadius: "8px",
            background: "#3c3c3c",
            color: "white",
            minWidth: "260px",
          }}
          defaultValue="all"
        >
          <option value="all">
            All marketplaces ({summary.totalItems})
          </option>
          <option value="usa">
            USA ({summary.usaItems})
          </option>
          <option value="de">
            DE ({summary.deItems})
          </option>
        </select>

        <button type="button" style={smallButtonStyle()} onClick={goToUpdate}>
          Update
        </button>
      </div>
    </div>
  );
}

function tableHeaderStyle() {
  return {
    border: "1px solid #ccc",
    padding: "16px",
    textAlign: "left",
    background: "#f4f4f4",
  };
}

function tableCellStyle() {
  return {
    border: "1px solid #ccc",
    padding: "16px",
    textAlign: "center",
  };
}