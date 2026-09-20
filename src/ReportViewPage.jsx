import { Fragment, useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { buttonStyle } from "./buttonStyle";
import AdsCountryBreakdown from "./AdsCountryBreakdown";
import CollapsibleSection from "./CollapsibleSection";

const IMAGE_BASE = "https://storage.googleapis.com/mlf-amz-images/";

function productLink(sku, asin) {
  return `/product?asin=${encodeURIComponent(asin || "")}&sku=${encodeURIComponent(sku || "")}`;
}

// MlfReportGet is SP-API-only (no PocketBase dependency), so it runs on
// GCP - see CLAUDE.md "AmzBot: local job runner".
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

const currencyRatesToGbp = {
  GBP: 1,
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
  if (region === "usa") return "USD";
  if (region === "uk") return "GBP";
  return "EUR";
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

  if (region === "uk") {
    const rate = currencyRatesToGbp[from];
    if (!rate) {
      console.warn(`Missing GBP conversion rate for currency: ${from}`);
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

function isPareoSku(sku = "") {
  return sku.trim().toLowerCase().startsWith("pareo");
}

function buildCategorySummaryRows(summary) {
  const covers = {
    label: "Covers",
    items: 0,
    amount: 0,
  };

  const pareos = {
    label: "Pareos",
    items: 0,
    amount: 0,
  };

  for (const row of summary.rows || []) {
    const target = isPareoSku(row.sku) ? pareos : covers;
    target.items += Number(row.itemsSold) || 0;
    target.amount += Number(row.value) || 0;
  }

  return [
    {
      label: "Total",
      items: Number(summary.totalItems) || 0,
      amount: Number(summary.totalAmount) || 0,
    },
    {
      ...covers,
      amount: Number(covers.amount.toFixed(2)),
    },
    {
      ...pareos,
      amount: Number(pareos.amount.toFixed(2)),
    },
  ];
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

function formatOrderTime(dateText) {
  if (!dateText) return "-";

  const date = new Date(dateText);
  if (Number.isNaN(date.getTime())) {
    return dateText;
  }

  return date.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function extractSkuSalesFromXmlPayload(payload, region, selectedMarketplace = "", excludeMarketplace = "") {
  const baseCurrency = getBaseCurrencyForRegion(region);
  const marketplaceFilter = normalizeSalesChannel(selectedMarketplace);
  const marketplaceExclude = normalizeSalesChannel(excludeMarketplace);

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

    if (marketplaceExclude && normalizedSalesChannel === marketplaceExclude) {
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

        const asin = orderItem.getElementsByTagName("ASIN")[0]?.textContent?.trim() || "";

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
          asin,
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
      const existing = totals.get(item.sku) || { sku: item.sku, asin: "", itemsSold: 0, value: 0 };
      if (!existing.asin && item.asin) {
        existing.asin = item.asin;
      }
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
      const aIsPareo = isPareoSku(a.sku);
      const bIsPareo = isPareoSku(b.sku);

      // Show all pouf covers first. Pareos go after covers.
      if (aIsPareo !== bIsPareo) {
        return aIsPareo ? 1 : -1;
      }

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

function extractLastOrdersFromXmlPayload(payload, region, selectedMarketplace = "", excludeMarketplace = "") {
  const baseCurrency = getBaseCurrencyForRegion(region);
  const marketplaceFilter = normalizeSalesChannel(selectedMarketplace);
  const marketplaceExclude = normalizeSalesChannel(excludeMarketplace);

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

    if (marketplaceExclude && normalizedSalesChannel === marketplaceExclude) {
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
        time: formatOrderTime(orderDateText),
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

// Also used on a <Link> for the Home nav button (real <a>, so right-click
// "open in new tab" works) - spelled out explicitly since Link doesn't pick
// up App.css's generic `button` rule the way a real <button> does.
const smallButtonStyle = buttonStyle;

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
        <div style={{ marginBottom: 10 }}>
          <strong>Total Orders:</strong> {summary.totalOrders}
        </div>

        <table
          style={{
            borderCollapse: "collapse",
            width: "100%",
            maxWidth: "520px",
            marginInline: "auto",
            background: "#fff",
          }}
        >
          <thead>
            <tr>
              <th style={{ border: "1px solid #ccc", padding: isMobile ? "6px" : "8px", background: "#f4f4f4", textAlign: "left" }}>
                Type
              </th>
              <th style={{ border: "1px solid #ccc", padding: isMobile ? "6px" : "8px", background: "#f4f4f4", textAlign: "center" }}>
                Items
              </th>
              <th style={{ border: "1px solid #ccc", padding: isMobile ? "6px" : "8px", background: "#f4f4f4", textAlign: "right" }}>
                Amount
              </th>
            </tr>
          </thead>
          <tbody>
            {buildCategorySummaryRows(summary).map((row) => (
              <tr key={row.label}>
                <td style={{ border: "1px solid #ccc", padding: isMobile ? "6px" : "8px", fontWeight: "bold", textAlign: "left" }}>
                  {row.label}
                </td>
                <td style={{ border: "1px solid #ccc", padding: isMobile ? "6px" : "8px", textAlign: "center" }}>
                  {row.items}
                </td>
                <td style={{ border: "1px solid #ccc", padding: isMobile ? "6px" : "8px", textAlign: "right", whiteSpace: "nowrap" }}>
                  {row.amount.toFixed(2)} {summary.currency}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
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
                <Link to={productLink(row.sku, row.asin)} target="_blank" rel="noopener noreferrer">
                  <img
                    src={`${IMAGE_BASE}${encodeURIComponent(row.sku)}.jpg`}
                    alt={row.sku}
                    style={{
                      width: isMobile ? "60px" : "80px",
                      height: isMobile ? "60px" : "80px",
                      objectFit: "cover",
                      borderRadius: "6px",
                    }}
                  />
                </Link>
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
                <Link
                  to={productLink(row.sku, row.asin)}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: "inherit", textDecoration: "none" }}
                >
                  {shortenSkuForMobile(row.sku, isMobile)}
                </Link>
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
                <th style={{ border: "1px solid #ccc", padding: isMobile ? "6px" : "10px", textAlign: "left", background: "#f4f4f4", width: "80px" }}>
                  Time
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
                <th style={{ border: "1px solid #ccc", padding: isMobile ? "6px" : "10px", textAlign: "left", background: "#f4f4f4", width: "170px" }}>
                  Order ID
                </th>
              </tr>
            </thead>

            <tbody>
              {rows.map((row, index) => (
                <tr key={`${row.orderNumber}-${row.sku}-${index}`}>
                  <td style={{ border: "1px solid #ccc", padding: isMobile ? "6px" : "8px", whiteSpace: "nowrap" }}>
                    {row.time}
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
                  <td style={{ border: "1px solid #ccc", padding: isMobile ? "6px" : "8px", whiteSpace: "nowrap" }}>
                    {row.orderNumber}
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
  const [expandedRegions, setExpandedRegions] = useState({});

  const usaSummary = useMemo(() => {
    const payload = usaResponse?.data?.payload;
    return extractSkuSalesFromXmlPayload(payload, "usa", selectedMarketplace);
  }, [usaResponse, selectedMarketplace]);

  // The "de" report is really the whole EU region, and Amazon bundles the UK
  // into it too (confirmed live 2026-09-04 - 228 real amazon.co.uk orders
  // present in a single "de" report pull), NOT just the 9 EU_MARKETPLACES
  // countries. So "EU" here excludes co.uk by default (kept as its own peer
  // row below) unless the user has explicitly picked a specific marketplace
  // from the dropdown, in which case that exact selection is honored as-is.
  const deSummary = useMemo(() => {
    const payload = deResponse?.data?.payload;
    const excludeUk = !selectedMarketplace;
    return extractSkuSalesFromXmlPayload(payload, "de", selectedMarketplace, excludeUk ? "amazon.co.uk" : "");
  }, [deResponse, selectedMarketplace]);

  // UK's own totals - derived from the SAME already-fetched "de" report
  // payload (no separate report request - see the note on deSummary above),
  // always scoped to just amazon.co.uk regardless of the page-wide dropdown,
  // same as how usaSubSummaries' Canada/Mexico rows are always fixed too.
  const ukSummary = useMemo(() => {
    const payload = deResponse?.data?.payload;
    return extractSkuSalesFromXmlPayload(payload, "uk", "amazon.co.uk");
  }, [deResponse]);

  // Per-country sub-summaries for the Summary by Region table's USA/EU
  // expand rows - reuses the same extraction function already used for the
  // top-level totals, just re-filtered per SalesChannel. USA's own report
  // payload already carries amazon.ca/amazon.com.mx orders (Amazon bundles
  // NA marketplaces into one report), and DE's payload carries every other
  // EU country via SalesChannel, matching MARKETPLACE_OPTIONS above.
  const usaSubSummaries = useMemo(() => {
    const payload = usaResponse?.data?.payload;
    return [
      { label: "Canada", value: extractSkuSalesFromXmlPayload(payload, "usa", "amazon.ca") },
      { label: "Mexico", value: extractSkuSalesFromXmlPayload(payload, "usa", "amazon.com.mx") },
    ];
  }, [usaResponse]);

  const euSubSummaries = useMemo(() => {
    const payload = deResponse?.data?.payload;
    const euCodes = [
      { code: "amazon.de", label: "Germany" },
      { code: "amazon.fr", label: "France" },
      { code: "amazon.it", label: "Italy" },
      { code: "amazon.es", label: "Spain" },
      { code: "amazon.nl", label: "Netherlands" },
      { code: "amazon.se", label: "Sweden" },
      { code: "amazon.pl", label: "Poland" },
      { code: "amazon.com.be", label: "Belgium" },
      { code: "amazon.ie", label: "Ireland" },
    ];
    return euCodes.map(({ code, label }) => ({
      label,
      value: extractSkuSalesFromXmlPayload(payload, "de", code),
    }));
  }, [deResponse]);

  const usaLastOrders = useMemo(() => {
    const payload = usaResponse?.data?.payload;
    return extractLastOrdersFromXmlPayload(payload, "usa", selectedMarketplace);
  }, [usaResponse, selectedMarketplace]);

  const deLastOrders = useMemo(() => {
    const payload = deResponse?.data?.payload;
    const excludeUk = !selectedMarketplace;
    return extractLastOrdersFromXmlPayload(payload, "de", selectedMarketplace, excludeUk ? "amazon.co.uk" : "");
  }, [deResponse, selectedMarketplace]);

  const ukLastOrders = useMemo(() => {
    const payload = deResponse?.data?.payload;
    return extractLastOrdersFromXmlPayload(payload, "uk", "amazon.co.uk");
  }, [deResponse]);

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

  // Per the user: Sales and Update open in a new tab rather than navigating
  // away from this report-view page. window.open (not <Link target="_blank">
  // or navigate()) is used because a genuinely new tab has no react-router
  // history of its own, so react-router's navigate(path, {state}) can't
  // carry data into it - Update's report IDs/dates are passed as URL query
  // params instead (UpdatePage reads either source, see its own comment).
  // Sales needs no data at all (doesn't read location.state).
  function goToSales() {
    window.open("/sales", "_blank", "noopener,noreferrer");
  }

  function goToUpdate() {
    const params = new URLSearchParams({ usaReportId, deReportId, startDate, endDate });
    window.open(`/update?${params.toString()}`, "_blank", "noopener,noreferrer");
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

  const [usdRates, setUsdRates] = useState({});
  useEffect(() => {
    // Live 1-USD-buys-<currency> rates, same source/fallback pattern as the
    // backend's GetMarketplaceSalesSummary.fetch_usd_rates - used only to
    // blend this report's own EUR/GBP totals into one USD figure.
    fetch("https://api.frankfurter.dev/v1/latest?from=USD&to=EUR,GBP")
      .then((r) => r.json())
      .then((d) => setUsdRates(d.rates || {}))
      .catch(() => setUsdRates({ EUR: 0.92, GBP: 0.79 }));
  }, []);

  function toUsd(amount, currency) {
    if (currency === "USD") return amount;
    const rate = usdRates[currency];
    return rate ? amount / rate : null;
  }

  const usaUsd = toUsd(usaSummary.totalAmount, usaSummary.currency);
  const euUsd = toUsd(deSummary.totalAmount, deSummary.currency);
  const ukUsd = toUsd(ukSummary.totalAmount, ukSummary.currency);
  const totalSalesUsd =
    usaUsd === null || euUsd === null || ukUsd === null ? null : usaUsd + euUsd + ukUsd;

  const regionSummaryRows = [
    {
      region: "USA",
      orders: usaSummary.totalOrders,
      items: usaSummary.totalItems,
      amount: `${usaSummary.totalAmount} ${usaSummary.currency}`,
      children: usaSubSummaries.map((s) => ({
        region: s.label,
        orders: s.value.totalOrders,
        items: s.value.totalItems,
        amount: `${s.value.totalAmount} ${s.value.currency}`,
      })),
    },
    {
      // Displayed as "EU" - the DE-region report actually aggregates the
      // whole EU region (SalesChannel-disaggregated), not just Germany.
      region: "EU",
      orders: deSummary.totalOrders,
      items: deSummary.totalItems,
      amount: `${deSummary.totalAmount} ${deSummary.currency}`,
      children: euSubSummaries.map((s) => ({
        region: s.label,
        orders: s.value.totalOrders,
        items: s.value.totalItems,
        amount: `${s.value.totalAmount} ${s.value.currency}`,
      })),
    },
    {
      region: "UK",
      orders: ukSummary.totalOrders,
      items: ukSummary.totalItems,
      amount: `${ukSummary.totalAmount} ${ukSummary.currency}`,
      children: [],
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
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "12px", marginBottom: "4px", flexWrap: "wrap" }}>
        <h2 style={{ margin: 0, color: "#1976d2" }}>Report View</h2>
        <Link style={smallButtonStyle()} to="/">
          Home
        </Link>
      </div>

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
          <p style={{ textAlign: "center", fontWeight: 600, marginTop: 0 }}>
            Total Sales (USD): {totalSalesUsd === null ? "Loading..." : `$${totalSalesUsd.toFixed(2)}`}
          </p>

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
                {regionSummaryRows.map((row) => {
                  const hasChildren = row.children && row.children.length > 0;
                  const isOpen = !!expandedRegions[row.region];
                  return (
                    <Fragment key={row.region}>
                      <tr>
                        <td
                          style={{
                            border: "1px solid #ccc",
                            padding: isMobile ? "8px" : "10px",
                            cursor: hasChildren ? "pointer" : "default",
                            fontWeight: 600,
                          }}
                          onClick={() => hasChildren && setExpandedRegions((s) => ({ ...s, [row.region]: !s[row.region] }))}
                        >
                          {hasChildren && <span style={{ display: "inline-block", width: "14px" }}>{isOpen ? "▾" : "▸"}</span>}
                          {row.region}
                        </td>
                        <td style={{ border: "1px solid #ccc", padding: isMobile ? "8px" : "10px" }}>{row.orders}</td>
                        <td style={{ border: "1px solid #ccc", padding: isMobile ? "8px" : "10px" }}>{row.items}</td>
                        <td style={{ border: "1px solid #ccc", padding: isMobile ? "8px" : "10px" }}>{row.amount}</td>
                      </tr>
                      {isOpen &&
                        row.children.map((child) => (
                          <tr key={`${row.region}-${child.region}`}>
                            <td style={{ border: "1px solid #ccc", padding: isMobile ? "8px" : "10px", paddingLeft: "34px", color: "#555" }}>
                              {child.region}
                            </td>
                            <td style={{ border: "1px solid #ccc", padding: isMobile ? "8px" : "10px" }}>{child.orders}</td>
                            <td style={{ border: "1px solid #ccc", padding: isMobile ? "8px" : "10px" }}>{child.items}</td>
                            <td style={{ border: "1px solid #ccc", padding: isMobile ? "8px" : "10px" }}>{child.amount}</td>
                          </tr>
                        ))}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <AdsCountryBreakdown />

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

        {!loadingDe && !errorDe && (
          <div style={sectionCardStyle()}>
            {/* UK data comes from the same "de" report payload (Amazon
                bundles amazon.co.uk orders into it) - always scoped to just
                the UK regardless of the page-wide marketplace dropdown. */}
            <RegionTable
              title="UK Totals + SKU Table (amazon.co.uk)"
              summary={ukSummary}
              isMobile={isMobile}
            />

            <LastOrdersTable
              title="UK Last 10 Orders (amazon.co.uk)"
              rows={ukLastOrders}
              isMobile={isMobile}
            />
          </div>
        )}
      </div>

      <div style={bottomNavStyle()}>
        <Link style={smallButtonStyle()} to="/">
          Home
        </Link>
        <button style={smallButtonStyle()} onClick={goToSales}>
          Sales
        </button>

        <select
          value={selectedMarketplace}
          onChange={(e) => setSelectedMarketplace(e.target.value)}
          style={selectorStyle()}
        >
          <option value="">
            All marketplaces ({usaSummary.totalItems + deSummary.totalItems + ukSummary.totalItems})
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