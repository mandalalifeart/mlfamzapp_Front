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

function shortenSkuForMobile(sku, isMobile) {
  if (!sku) return "";
  if (!isMobile) return sku;

  let shortSku = sku;

  if (shortSku.startsWith("CoverPouf")) {
    shortSku = shortSku.replace(/^CoverPouf/, "");
  }

  return shortSku;
}

function getFirstTagText(parentNode, tagNames) {
  for (const tagName of tagNames) {
    const node = parentNode.getElementsByTagName(tagName)[0];
    const value = node?.textContent?.trim();

    if (value) {
      return value;
    }
  }

  return "";
}

function formatOrderDate(dateText) {
  if (!dateText) return "-";

  const date = new Date(dateText);
  if (Number.isNaN(date.getTime())) {
    return dateText;
  }

  return date.toLocaleDateString("en-GB", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
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
    const salesChannel =
      order.getElementsByTagName("SalesChannel")[0]?.textContent?.trim() || "";
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

function extractLastOrdersFromXmlPayload(payload, region, selectedMarketplace = "") {
  const baseCurrency = getBaseCurrencyForRegion(region);
  const marketplaceFilter = normalizeSalesChannel(selectedMarketplace);

  if (!payload || typeof payload !== "string") {
    return [];
  }

  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(payload, "application/xml");
  const parserError = xmlDoc.querySelector("parsererror");

  if (parserError) {
    return [];
  }

  const orderNodes = Array.from(xmlDoc.getElementsByTagName("Order"));
  const rows = [];

  for (const order of orderNodes) {
    const salesChannel =
      order.getElementsByTagName("SalesChannel")[0]?.textContent?.trim() || "";
    const normalizedSalesChannel = normalizeSalesChannel(salesChannel);

    if (shouldIgnoreSalesChannel(salesChannel)) {
      continue;
    }

    if (marketplaceFilter && normalizedSalesChannel !== marketplaceFilter) {
      continue;
    }

    const orderNumber =
      getFirstTagText(order, [
        "AmazonOrderID",
        "AmazonOrderId",
        "OrderID",
        "OrderId",
        "OrderNumber",
        "MerchantOrderID",
        "MerchantOrderId",
      ]) || "-";

    const orderDateText =
      getFirstTagText(order, [
        "PurchaseDate",
        "OrderDate",
        "PostedDate",
        "LastUpdatedDate",
        "CreatedDate",
      ]) || "";
    const orderSortTime = new Date(orderDateText).getTime();

    const orderItems = Array.from(order.getElementsByTagName("OrderItem"));
    const orderAmount = getDirectChildAmount(order);
    const convertedOrderAmount = convertCurrencyAmount(
      orderAmount.value,
      orderAmount.currency,
      region
    );

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
        };
      })
      .filter(Boolean);

    const totalQtyInOrder = normalizedItems.reduce((sum, item) => sum + item.qty, 0);
    const totalItemAmounts = normalizedItems.reduce((sum, item) => sum + item.itemAmountValue, 0);
    const hasItemLevelAmounts = totalItemAmounts > 0;

    for (const item of normalizedItems) {
      let price = 0;

      if (hasItemLevelAmounts) {
        price = item.itemAmountValue;
      } else if (totalQtyInOrder > 0 && convertedOrderAmount) {
        price = (convertedOrderAmount * item.qty) / totalQtyInOrder;
      }

      rows.push({
        date: formatOrderDate(orderDateText),
        sortTime: Number.isFinite(orderSortTime) ? orderSortTime : 0,
        orderNumber,
        sku: item.sku,
        price: Number(price.toFixed(2)),
        currency: baseCurrency,
        quantity: item.qty,
      });
    }
  }

  return rows
    .sort((a, b) => {
      if (b.sortTime !== a.sortTime) return b.sortTime - a.sortTime;
      return String(b.orderNumber).localeCompare(String(a.orderNumber));
    })
    .slice(0, 10);
}

function extractMarketplaceItemCounts(payload) {
  if (!payload || typeof payload !== "string") return {};

  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(payload, "application/xml");
  const parserError = xmlDoc.querySelector("parsererror");

  if (parserError) return {};

  const orderNodes = Array.from(xmlDoc.getElementsByTagName("Order"));
  const counts = {};

  for (const order of orderNodes) {
    const salesChannel =
      order.getElementsByTagName("SalesChannel")[0]?.textContent?.trim() || "";

    if (shouldIgnoreSalesChannel(salesChannel)) continue;

    const normalizedSalesChannel = normalizeSalesChannel(salesChannel);
    const orderItems = Array.from(order.getElementsByTagName("OrderItem"));

    for (const orderItem of orderItems) {
      const quantity = Number(
        orderItem.getElementsByTagName("Quantity")[0]?.textContent?.trim() || "0"
      );
      const safeQty = Number.isFinite(quantity) ? quantity : 0;

      counts[normalizedSalesChannel] = (counts[normalizedSalesChannel] || 0) + safeQty;
    }
  }

  return counts;
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
    minWidth: "220px",
  };
}

function sectionCardStyle() {
  return {
    background: "#f8f8f8",
    borderRadius: "8px",
    padding: "16px",
    marginBottom: "20px",
    overflow: "hidden",
  };
}

function collapsibleHeaderStyle() {
  return {
    width: "100%",
    border: "1px solid #ddd",
    background: "#ffffff",
    color: "#222",
    borderRadius: "8px",
    padding: "10px 12px",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "12px",
    fontSize: "16px",
    fontWeight: "bold",
    lineHeight: 1.3,
    textAlign: "left",
    appearance: "none",
    WebkitAppearance: "none",
  };
}

function CollapsibleSection({ title, defaultOpen = true, children }) {
  const safeTitle = title || "Section";
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div style={{ marginTop: 20 }}>
      <button
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        style={collapsibleHeaderStyle()}
        aria-expanded={isOpen}
      >
        <span style={{ color: "#222", display: "inline-block" }}>{safeTitle}</span>
        <span aria-hidden="true" style={{ color: "#222", display: "inline-block", flexShrink: 0 }}>
          {isOpen ? "▲" : "▼"}
        </span>
      </button>

      {isOpen && <div style={{ marginTop: 12 }}>{children}</div>}
    </div>
  );
}

function RegionTable({ title, summary, isMobile }) {
  return (
    <CollapsibleSection title={title} defaultOpen={true}>
      <div
        style={{
          background: "#f8f8f8",
          borderRadius: 8,
          padding: 14,
          marginBottom: 16,
          textAlign: "center",
        }}
      >
        <div><strong>Total Orders:</strong> {summary.totalOrders}</div>
        <div><strong>Total Items:</strong> {summary.totalItems}</div>
        <div><strong>Total Amount:</strong> {summary.totalAmount} {summary.currency}</div>
      </div>

      <table
        style={{
          borderCollapse: "collapse",
          width: "100%",
          tableLayout: "fixed",
          background: "#fff",
        }}
      >
        <thead>
          <tr>
            <th
              style={{
                border: "1px solid #ccc",
                padding: isMobile ? "6px" : "10px",
                background: "#f4f4f4",
                width: "80px",
              }}
            >
              Image
            </th>

            <th
              style={{
                border: "1px solid #ccc",
                padding: isMobile ? "6px" : "10px",
                background: "#f4f4f4",
                width: "auto",
              }}
            >
              SKU
            </th>

            <th
              style={{
                border: "1px solid #ccc",
                padding: isMobile ? "6px" : "10px",
                background: "#f4f4f4",
                width: "50px",
                textAlign: "center",
              }}
            >
              #
            </th>
          </tr>
        </thead>

        <tbody>
          {summary.rows.map((row) => (
            <tr key={row.sku}>
              <td style={{ border: "1px solid #ccc", padding: "6px" }}>
                <img
                  src={`https://storage.googleapis.com/mlf-amz-images/${encodeURIComponent(row.sku)}.jpg`}
                  alt={row.sku}
                  style={{
                    width: isMobile ? "60px" : "80px",
                    height: isMobile ? "60px" : "80px",
                    objectFit: "cover",
                    borderRadius: "6px",
                  }}
                />
              </td>

              <td
                style={{
                  border: "1px solid #ccc",
                  padding: "8px",
                  fontSize: isMobile ? "14px" : "16px",
                  wordBreak: "break-word",
                  overflowWrap: "anywhere",
                  whiteSpace: "normal",
                }}
              >
                {shortenSkuForMobile(row.sku, isMobile)}
              </td>

              <td
                style={{
                  border: "1px solid #ccc",
                  padding: "8px",
                  textAlign: "center",
                  fontWeight: "bold",
                }}
              >
                {row.itemsSold}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </CollapsibleSection>
  );
}

function LastOrdersTable({ title, rows, isMobile }) {
  return (
    <CollapsibleSection title={title} defaultOpen={false}>
      {rows.length === 0 ? (
        <div style={{ textAlign: "center", padding: "14px", background: "#fff", borderRadius: "8px" }}>
          No orders found
        </div>
      ) : (
        <div
          style={{
            width: "100%",
            overflowX: "auto",
            background: "#ffffff",
            borderRadius: "8px",
            WebkitOverflowScrolling: "touch",
          }}
        >
          <table
            style={{
              borderCollapse: "collapse",
              width: "100%",
              minWidth: isMobile ? "720px" : "100%",
              background: "#fff",
            }}
          >
            <thead>
              <tr>
                <th style={{ border: "1px solid #ccc", padding: isMobile ? "6px" : "10px", textAlign: "left", background: "#f4f4f4", width: "90px" }}>
                  Date
                </th>
                <th style={{ border: "1px solid #ccc", padding: isMobile ? "6px" : "10px", textAlign: "left", background: "#f4f4f4", width: "170px" }}>
                  Order #
                </th>
                <th style={{ border: "1px solid #ccc", padding: isMobile ? "6px" : "10px", textAlign: "left", background: "#f4f4f4" }}>
                  SKU
                </th>
                <th style={{ border: "1px solid #ccc", padding: isMobile ? "6px" : "10px", textAlign: "right", background: "#f4f4f4", width: "110px" }}>
                  Price
                </th>
                <th style={{ border: "1px solid #ccc", padding: isMobile ? "6px" : "10px", textAlign: "center", background: "#f4f4f4", width: "70px" }}>
                  Qty
                </th>
              </tr>
            </thead>

            <tbody>
              {rows.map((row, index) => (
                <tr key={`${row.orderNumber}-${row.sku}-${index}`}>
                  <td style={{ border: "1px solid #ccc", padding: isMobile ? "6px" : "8px", whiteSpace: "nowrap" }}>
                    {row.date}
                  </td>
                  <td style={{ border: "1px solid #ccc", padding: isMobile ? "6px" : "8px", whiteSpace: "nowrap" }}>
                    {row.orderNumber}
                  </td>
                  <td
                    style={{
                      border: "1px solid #ccc",
                      padding: isMobile ? "6px" : "8px",
                      wordBreak: "break-word",
                      overflowWrap: "anywhere",
                    }}
                  >
                    {shortenSkuForMobile(row.sku, isMobile)}
                  </td>
                  <td style={{ border: "1px solid #ccc", padding: isMobile ? "6px" : "8px", textAlign: "right", whiteSpace: "nowrap" }}>
                    {row.price} {row.currency}
                  </td>
                  <td style={{ border: "1px solid #ccc", padding: isMobile ? "6px" : "8px", textAlign: "center", fontWeight: "bold" }}>
                    {row.quantity}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </CollapsibleSection>
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
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  const usaSummary = useMemo(() => {
    const payload = usaResponse?.data?.payload;
    return extractSkuSalesFromXmlPayload(payload, "usa", selectedMarketplace);
  }, [usaResponse, selectedMarketplace]);

  const deSummary = useMemo(() => {
    const payload = deResponse?.data?.payload;
    return extractSkuSalesFromXmlPayload(payload, "de", selectedMarketplace);
  }, [deResponse, selectedMarketplace]);

  const usaLastOrders = useMemo(() => {
    const payload = usaResponse?.data?.payload;
    return extractLastOrdersFromXmlPayload(payload, "usa", selectedMarketplace);
  }, [usaResponse, selectedMarketplace]);

  const deLastOrders = useMemo(() => {
    const payload = deResponse?.data?.payload;
    return extractLastOrdersFromXmlPayload(payload, "de", selectedMarketplace);
  }, [deResponse, selectedMarketplace]);

  const usaMpCounts = useMemo(() => {
    return extractMarketplaceItemCounts(usaResponse?.data?.payload);
  }, [usaResponse]);

  const deMpCounts = useMemo(() => {
    return extractMarketplaceItemCounts(deResponse?.data?.payload);
  }, [deResponse]);

  const mergedMpCounts = useMemo(() => {
    const merged = { ...usaMpCounts };

    for (const key of Object.keys(deMpCounts)) {
      merged[key] = (merged[key] || 0) + deMpCounts[key];
    }

    return merged;
  }, [usaMpCounts, deMpCounts]);

  const sortedMarketplaceOptions = useMemo(() => {
    return MARKETPLACE_OPTIONS
      .filter((option) => option.value !== "")
      .map((option) => ({
        ...option,
        count: mergedMpCounts[normalizeSalesChannel(option.value)] || 0,
      }))
      .sort((a, b) => {
        if (b.count !== a.count) return b.count - a.count;
        return a.label.localeCompare(b.label);
      });
  }, [mergedMpCounts]);

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

  useEffect(() => {
    function handleResize() {
      setIsMobile(window.innerWidth <= 768);
    }

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

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
    MARKETPLACE_OPTIONS.find((option) => option.value === selectedMarketplace)?.label ||
    "All marketplaces";

  return (
    <div
      style={{
        padding: isMobile ? "12px" : "20px",
        fontFamily: "Arial, sans-serif",
        minHeight: "100vh",
        backgroundColor: "#ffffff",
        color: "#222",
        boxSizing: "border-box",
        overflowX: "hidden",
        width: "100%",
      }}
    >
      <h2 style={{ textAlign: "center", marginTop: 0 }}>Report View</h2>

      <div
        style={{
          marginBottom: 16,
          maxWidth: "760px",
          marginInline: "auto",
          background: "#f8f8f8",
          padding: isMobile ? "12px" : "16px",
          borderRadius: "8px",
          boxSizing: "border-box",
        }}
      >
        <div><strong>USA Request ID:</strong> {usaReportId || "-"}</div>
        <div><strong>DE Request ID:</strong> {deReportId || "-"}</div>
        <div><strong>Start:</strong> {startDate || "-"}</div>
        <div><strong>End:</strong> {endDate || "-"}</div>
      </div>

      <div style={{ maxWidth: "1100px", marginInline: "auto" }}>
        <div style={sectionCardStyle()}>
          <h3 style={{ marginTop: 0, textAlign: "center" }}>Summary by Region</h3>

          <div
            style={{
              width: "100%",
              overflowX: "auto",
              background: "#ffffff",
              borderRadius: "8px",
              WebkitOverflowScrolling: "touch",
            }}
          >
            <table
              style={{
                borderCollapse: "collapse",
                width: "100%",
                minWidth: isMobile ? "320px" : "100%",
                marginTop: 12,
                background: "#ffffff",
              }}
            >
              <thead>
                <tr>
                  <th style={{ border: "1px solid #ccc", padding: isMobile ? "8px" : "10px", textAlign: "left", background: "#f4f4f4" }}>
                    Region
                  </th>
                  <th style={{ border: "1px solid #ccc", padding: isMobile ? "8px" : "10px", textAlign: "left", background: "#f4f4f4" }}>
                    Orders
                  </th>
                  <th style={{ border: "1px solid #ccc", padding: isMobile ? "8px" : "10px", textAlign: "left", background: "#f4f4f4" }}>
                    Items
                  </th>
                  <th style={{ border: "1px solid #ccc", padding: isMobile ? "8px" : "10px", textAlign: "left", background: "#f4f4f4" }}>
                    Amount
                  </th>
                </tr>
              </thead>
              <tbody>
                {regionSummaryRows.map((row) => (
                  <tr key={row.region}>
                    <td style={{ border: "1px solid #ccc", padding: isMobile ? "8px" : "10px" }}>{row.region}</td>
                    <td style={{ border: "1px solid #ccc", padding: isMobile ? "8px" : "10px" }}>{row.orders}</td>
                    <td style={{ border: "1px solid #ccc", padding: isMobile ? "8px" : "10px" }}>{row.items}</td>
                    <td style={{ border: "1px solid #ccc", padding: isMobile ? "8px" : "10px" }}>{row.amount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
              isMobile={isMobile}
            />

            <LastOrdersTable
              title={`USA Last 10 Orders (${selectedMarketplaceLabel})`}
              rows={usaLastOrders}
              isMobile={isMobile}
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
              title={`EU Totals + SKU Table (${selectedMarketplaceLabel})`}
              summary={deSummary}
              isMobile={isMobile}
            />

            <LastOrdersTable
              title={`EU Last 10 Orders (${selectedMarketplaceLabel})`}
              rows={deLastOrders}
              isMobile={isMobile}
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
          <option value="">
            All marketplaces ({usaSummary.totalItems + deSummary.totalItems})
          </option>

          {sortedMarketplaceOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label} ({option.count})
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