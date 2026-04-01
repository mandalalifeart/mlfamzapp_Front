import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

const API_BASE = "https://us-central1-mlfamzapp.cloudfunctions.net";

/*
  Base currency rules:
  - USA region => everything shown in USD
  - DE region  => everything shown in EUR

  Update these rates whenever needed.
*/
const currencyRatesToUsd = {
  USD: 1,
  CAD: 0.74,
  MXN: 0.049,
};

const currencyRatesToEur = {
  EUR: 1,
  PLN: 0.23,
  SEK: 0.088,
  GBP: 1.17,
  CZK: 0.04,
  HUF: 0.0025,
  DKK: 0.134,
  RON: 0.2,
  BGN: 0.51,
};

const MARKETPLACE_OPTIONS = [
  { value: "", label: "All marketplaces" },
  { value: "amazon.com", label: "com" },
  { value: "amazon.ca", label: "ca" },
  { value: "amazon.com.mx", label: "mex" },
  { value: "amazon.co.uk", label: "co.uk" },
  { value: "amazon.de", label: "de" },
  { value: "amazon.fr", label: "fr" },
  { value: "amazon.it", label: "it" },
  { value: "amazon.es", label: "es" },
  { value: "amazon.se", label: "se" },
  { value: "amazon.com.be", label: "com.be" },
  { value: "amazon.co.jp", label: "jp" },
  { value: "amazon.pl", label: "pl" },
  { value: "amazon.nl", label: "nl" },
  { value: "amazon.ie", label: "ie" },
];

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

function getBaseCurrencyForRegion(region) {
  return region === "usa" ? "USD" : "EUR";
}

function convertCurrencyAmount(amount, fromCurrency, region) {
  const safeAmount = Number(amount) || 0;
  const from = (fromCurrency || "").toUpperCase().trim();

  if (!from) {
    return safeAmount;
  }

  if (region === "usa") {
    const rate = currencyRatesToUsd[from];
    if (!rate) {
      console.warn(`Missing USD conversion rate for currency: ${from}`);
      return safeAmount;
    }
    return safeAmount * rate;
  }

  const rate = currencyRatesToEur[from];
  if (!rate) {
    console.warn(`Missing EUR conversion rate for currency: ${from}`);
    return safeAmount;
  }
  return safeAmount * rate;
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

function normalizeSalesChannel(salesChannel) {
  return (salesChannel || "").trim().toLowerCase();
}

function extractSkuSalesFromXmlPayload(payload, region, selectedMarketplace = "") {
  const baseCurrency = getBaseCurrencyForRegion(region);
  const marketplaceFilter = normalizeSalesChannel(selectedMarketplace);

  if (!payload || typeof payload !== "string") {
    return {
      rows: [],
      totalOrders: 0,
      totalItems: 0,
      totalAmount: 0,
      currency: baseCurrency,
    };
  }

  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(payload, "application/xml");
  const parserError = xmlDoc.querySelector("parsererror");

  if (parserError) {
    return {
      rows: [],
      totalOrders: 0,
      totalItems: 0,
      totalAmount: 0,
      currency: baseCurrency,
    };
  }

  const orderNodes = Array.from(xmlDoc.getElementsByTagName("Order"));
  const totals = new Map();
  let totalOrders = 0;
  let totalItems = 0;
  let totalAmount = 0;

  for (const order of orderNodes) {
    const salesChannel = order.getElementsByTagName("SalesChannel")[0]?.textContent?.trim() || "";
    const normalizedSalesChannel = normalizeSalesChannel(salesChannel);

    if (shouldIgnoreSalesChannel(salesChannel)) {
      console.log(`Ignoring ${region} order because of sales channel:`, salesChannel);
      continue;
    }

    if (marketplaceFilter && normalizedSalesChannel !== marketplaceFilter) {
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

        const quantity = Number(
          orderItem.getElementsByTagName("Quantity")[0]?.textContent?.trim() || "0"
        );
        const safeQty = Number.isFinite(quantity) ? quantity : 0;

        totalItems += safeQty;

        const itemAmount = getOrderItemAmount(orderItem);
        const convertedItemAmount = convertCurrencyAmount(
          itemAmount.value,
          itemAmount.currency,
          region
        );

        return {
          sku,
          qty: safeQty,
          itemAmountValue: convertedItemAmount,
          itemAmountCurrency: baseCurrency,
        };
      })
      .filter(Boolean);

    const convertedOrderAmount = convertCurrencyAmount(
      orderAmount.value,
      orderAmount.currency,
      region
    );

    const totalQtyInOrder = normalizedItems.reduce((sum, item) => sum + item.qty, 0);
    const totalItemAmounts = normalizedItems.reduce((sum, item) => sum + item.itemAmountValue, 0);
    const hasItemLevelAmounts = totalItemAmounts > 0;

    if (hasItemLevelAmounts) {
      totalAmount += totalItemAmounts;
    } else {
      totalAmount += convertedOrderAmount;
    }

    for (const item of normalizedItems) {
      const existing = totals.get(item.sku) || { sku: item.sku, itemsSold: 0, value: 0 };
      existing.itemsSold += item.qty;

      if (hasItemLevelAmounts) {
        existing.value += item.itemAmountValue;
      } else if (totalQtyInOrder > 0 && convertedOrderAmount) {
        existing.value += (convertedOrderAmount * item.qty) / totalQtyInOrder;
      }

      totals.set(item.sku, existing);
    }
  }

  const rows = Array.from(totals.values())
    .map((row) => ({
      ...row,
      value: Number(row.value.toFixed(2)),
    }))
    .sort((a, b) => {
      const aIsCover = a.sku.toLowerCase().startsWith("cover");
      const bIsCover = b.sku.toLowerCase().startsWith("cover");

      if (aIsCover && !bIsCover) return -1;
      if (!aIsCover && bIsCover) return 1;

      if (b.itemsSold !== a.itemsSold) {
        return b.itemsSold - a.itemsSold;
      }

      return a.sku.localeCompare(b.sku);
    });

  return {
    rows,
    totalOrders,
    totalItems,
    totalAmount: Number(totalAmount.toFixed(2)),
    currency: baseCurrency,
  };
}

function bottomNavStyle() {
  return {
    display: "flex",
    justifyContent: "center",
    gap: "10px",
    marginTop: "28px",
    paddingBottom: "16px",
    flexWrap: "wrap",
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

function updateButtonStyle() {
  return {
    padding: "6px 14px",
    fontSize: "13px",
    cursor: "pointer",
    borderRadius: "8px",
  };
}

function selectorStyle() {
  return {
    padding: "8px 12px",
    fontSize: "14px",
    borderRadius: "8px",
    minWidth: "180px",
  };
}

function sectionCardStyle() {
  return {
    background: "#f8f8f8",
    borderRadius: "8px",
    padding: "16px",
    marginBottom: "20px",
  };
}

function RegionTable({ title, summary }) {
  return (
    <div style={{ marginTop: 20 }}>
      <h3 style={{ marginBottom: 12 }}>{title}</h3>

      <div style={{ background: "#f8f8f8", borderRadius: 8, padding: 14, marginBottom: 16 }}>
        <div><strong>Total Orders:</strong> {summary.totalOrders}</div>
        <div><strong>Total Items:</strong> {summary.totalItems}</div>
        <div><strong>Total Amount:</strong> {summary.totalAmount} {summary.currency}</div>
      </div>

      <table style={{ borderCollapse: "collapse", width: "100%", marginTop: 12 }}>
        <thead>
          <tr>
            <th
              style={{
                border: "1px solid #ccc",
                padding: "10px",
                textAlign: "left",
                background: "#f4f4f4",
                width: "90px",
              }}
            >
              Image
            </th>
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
          </tr>
        </thead>
        <tbody>
          {summary.rows.length > 0 ? (
            summary.rows.map((row) => (
              <tr key={row.sku}>
                <td style={{ border: "1px solid #ccc", padding: "12px" }}>
                  <img
                    src={`https://storage.googleapis.com/mlf-amz-images/${encodeURIComponent(row.sku)}.jpg`}
                    alt={row.sku}
                    style={{ width: "100px", height: "100px", objectFit: "cover", borderRadius: "6px" }}
                    onError={(e) => {
                      e.currentTarget.style.display = "none";
                    }}
                  />
                </td>
                <td style={{ border: "1px solid #ccc", padding: "10px" }}>{row.sku}</td>
                <td style={{ border: "1px solid #ccc", padding: "10px" }}>{row.itemsSold}</td>
              </tr>
            ))
          ) : (
            <tr>
              <td
                colSpan={3}
                style={{ border: "1px solid #ccc", padding: "12px", textAlign: "center" }}
              >
                No rows found
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

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
    console.log("ReportViewPage mounted with state:", {
      usaReportId,
      deReportId,
      startDate,
      endDate,
    });
  }, [usaReportId, deReportId, startDate, endDate]);

  useEffect(() => {
    if (!usaReportId) {
      setUsaResponse(null);
      setErrorUsa("Missing USA report request ID");
      return;
    }

    let cancelled = false;
    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

    async function fetchUsaReport() {
      setLoadingUsa(true);
      setErrorUsa("");
      setUsaResponse(null);
      setStatusUsa("Starting USA report...");

      const maxAttempts = 12;
      const retryDelayMs = 30000;

      for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        if (cancelled) return;

        setStatusUsa(`Checking USA report... attempt ${attempt} of ${maxAttempts}`);

        try {
          const res = await fetch(`${API_BASE}/MlfReportGet`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              marketplace: "usa",
              report_req_id: usaReportId,
            }),
          });

          const text = await res.text();
          console.log("USA MlfReportGet raw response:", text);

          let data = {};
          if (text) {
            data = JSON.parse(text);
          }

          console.log("USA MlfReportGet parsed response:", data);
          console.log("USA MlfReportGet payload:", data?.data?.payload);

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
              setErrorUsa("USA report still processing after max attempts");
              setLoadingUsa(false);
              return;
            }

            setStatusUsa(`USA still processing... retry in 30s (attempt ${attempt}/${maxAttempts})`);
            await sleep(retryDelayMs);
            continue;
          }

          if (status === "success") {
            setUsaResponse(data);
            setLoadingUsa(false);
            return;
          }

          setLoadingUsa(false);
          return;
        } catch (err) {
          if (attempt === maxAttempts) {
            setErrorUsa(err.message || "USA fetch failed");
            setLoadingUsa(false);
            return;
          }

          setStatusUsa(`USA error... retrying in 30s (attempt ${attempt})`);
          await sleep(retryDelayMs);
        }
      }
    }

    fetchUsaReport();

    return () => {
      cancelled = true;
    };
  }, [usaReportId]);

  useEffect(() => {
    if (!deReportId) {
      setDeResponse(null);
      setErrorDe("Missing DE report request ID");
      return;
    }

    let cancelled = false;
    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

    async function fetchDeReport() {
      setLoadingDe(true);
      setErrorDe("");
      setDeResponse(null);
      setStatusDe("Starting DE report...");

      const maxAttempts = 12;
      const retryDelayMs = 30000;

      for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        if (cancelled) return;

        setStatusDe(`Checking DE report... attempt ${attempt} of ${maxAttempts}`);

        try {
          const res = await fetch(`${API_BASE}/MlfReportGet`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              marketplace: "de",
              report_req_id: deReportId,
            }),
          });

          const text = await res.text();
          console.log("DE MlfReportGet raw response:", text);

          let data = {};
          if (text) {
            data = JSON.parse(text);
          }

          console.log("DE MlfReportGet parsed response:", data);
          console.log("DE MlfReportGet payload:", data?.data?.payload);

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
              setErrorDe("DE report still processing after max attempts");
              setLoadingDe(false);
              return;
            }

            setStatusDe(`DE still processing... retry in 30s (attempt ${attempt}/${maxAttempts})`);
            await sleep(retryDelayMs);
            continue;
          }

          if (status === "success") {
            setDeResponse(data);
            setLoadingDe(false);
            return;
          }

          setLoadingDe(false);
          return;
        } catch (err) {
          if (attempt === maxAttempts) {
            setErrorDe(err.message || "DE fetch failed");
            setLoadingDe(false);
            return;
          }

          setStatusDe(`DE error... retrying in 30s (attempt ${attempt})`);
          await sleep(retryDelayMs);
        }
      }
    }

    fetchDeReport();

    return () => {
      cancelled = true;
    };
  }, [deReportId]);

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
    MARKETPLACE_OPTIONS.find((option) => option.value === selectedMarketplace)?.label || "All marketplaces";

  return (
    <div style={{ padding: "20px", fontFamily: "Arial, sans-serif", minHeight: "100vh" }}>
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
                <th style={{ border: "1px solid #ccc", padding: "10px", textAlign: "left", background: "#f4f4f4" }}>
                  Region
                </th>
                <th style={{ border: "1px solid #ccc", padding: "10px", textAlign: "left", background: "#f4f4f4" }}>
                  Total Orders
                </th>
                <th style={{ border: "1px solid #ccc", padding: "10px", textAlign: "left", background: "#f4f4f4" }}>
                  Total Items
                </th>
                <th style={{ border: "1px solid #ccc", padding: "10px", textAlign: "left", background: "#f4f4f4" }}>
                  Total Amount
                </th>
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

        {loadingUsa && (
          <div style={sectionCardStyle()}>
            <h3 style={{ marginTop: 0 }}>USA</h3>
            <div>{statusUsa}</div>
          </div>
        )}

        {errorUsa && (
          <div style={sectionCardStyle()}>
            <h3 style={{ marginTop: 0 }}>USA</h3>
            <div style={{ color: "red" }}>{errorUsa}</div>
          </div>
        )}

        {!loadingUsa && !errorUsa && (
          <div style={sectionCardStyle()}>
            <RegionTable
              title={`USA Totals + SKU Table (${selectedMarketplaceLabel})`}
              summary={usaSummary}
            />
          </div>
        )}

        {loadingDe && (
          <div style={sectionCardStyle()}>
            <h3 style={{ marginTop: 0 }}>DE</h3>
            <div>{statusDe}</div>
          </div>
        )}

        {errorDe && (
          <div style={sectionCardStyle()}>
            <h3 style={{ marginTop: 0 }}>DE</h3>
            <div style={{ color: "red" }}>{errorDe}</div>
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
        <button style={smallButtonStyle()} onClick={() => navigate("/")}>
          Home
        </button>
        <button style={smallButtonStyle()} onClick={goToSales}>
          Sales
        </button>
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
        <button style={updateButtonStyle()} onClick={goToUpdate}>
          Update
        </button>
      </div>
    </div>
  );
}
