import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { buttonStyle } from "./buttonStyle";

const API_BASE =
  import.meta.env.VITE_API_BASE ||
  "https://us-central1-mlfamzapp.cloudfunctions.net";

function cardStyle() {
  return { background: "#fff", border: "1px solid #ddd", borderRadius: "8px", padding: "16px" };
}

function inputStyle() {
  return {
    padding: "10px",
    borderRadius: "8px",
    border: "1px solid #ccc",
    background: "#fff",
    color: "#222",
  };
}

function tableCellStyle(extra = {}) {
  return { border: "1px solid #ccc", padding: "8px 10px", textAlign: "left", ...extra };
}

function formatMoney(amount, currencyCode) {
  const value = Number(amount || 0);
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: currencyCode || "USD" }).format(value);
  } catch {
    return value.toFixed(2);
  }
}

export default function EtsyPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState(null);
  const [error, setError] = useState("");

  const [listings, setListings] = useState([]);
  const [listingsLoading, setListingsLoading] = useState(false);
  const [listingsError, setListingsError] = useState("");
  const [search, setSearch] = useState("");
  const [insightFilter, setInsightFilter] = useState("");
  const [pulling, setPulling] = useState(false);
  const [pullResult, setPullResult] = useState(null);
  const [listingsExpanded, setListingsExpanded] = useState(false);

  const [orders, setOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersError, setOrdersError] = useState("");
  const [orderSearch, setOrderSearch] = useState("");
  const [pullingOrders, setPullingOrders] = useState(false);
  const [pullOrdersResult, setPullOrdersResult] = useState(null);

  async function loadStatus() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`${API_BASE}/GetEtsyConnectionStatus`);
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || `HTTP ${response.status}`);
      setStatus(data);
    } catch (err) {
      setError(err.message || "Failed to load connection status");
    } finally {
      setLoading(false);
    }
  }

  async function loadListings() {
    setListingsLoading(true);
    setListingsError("");
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      const response = await fetch(`${API_BASE}/GetEtsyListings?${params.toString()}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || `HTTP ${response.status}`);
      setListings(data.listings || []);
    } catch (err) {
      setListingsError(err.message || "Failed to load listings");
    } finally {
      setListingsLoading(false);
    }
  }

  useEffect(() => {
    loadStatus();
  }, []);

  async function loadOrders() {
    setOrdersLoading(true);
    setOrdersError("");
    try {
      const params = new URLSearchParams();
      if (orderSearch) params.set("search", orderSearch);
      const response = await fetch(`${API_BASE}/GetEtsyOrders?${params.toString()}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || `HTTP ${response.status}`);
      setOrders(data.orders || []);
    } catch (err) {
      setOrdersError(err.message || "Failed to load orders");
    } finally {
      setOrdersLoading(false);
    }
  }

  useEffect(() => {
    if (status?.connected) loadListings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status?.connected, search]);

  useEffect(() => {
    if (status?.connected) loadOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status?.connected, orderSearch]);

  const [markingInProgress, setMarkingInProgress] = useState(null);

  async function markInProgress(receiptId) {
    setMarkingInProgress(receiptId);
    try {
      const response = await fetch(`${API_BASE}/MarkEtsyOrderInProgress`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ receipt_id: receiptId }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || `HTTP ${response.status}`);
      setOrders((prev) => prev.map((o) => (o.receiptId === receiptId ? { ...o, mcfStatus: "in_progress" } : o)));
    } catch (err) {
      alert(err.message || "Failed to mark order in progress");
    } finally {
      setMarkingInProgress(null);
    }
  }

  useEffect(() => {
    const root = document.getElementById("root");
    root?.classList.add("full-bleed");
    return () => root?.classList.remove("full-bleed");
  }, []);

  useEffect(() => {
    if (searchParams.get("connected") || searchParams.get("error")) {
      setSearchParams({}, { replace: true });
      loadStatus();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, setSearchParams]);

  const redirectError = searchParams.get("error");
  const redirectConnected = searchParams.get("connected");

  async function pullListings() {
    setPulling(true);
    setPullResult(null);
    try {
      const response = await fetch(`${API_BASE}/UpdateEtsyListings`);
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || `HTTP ${response.status}`);
      setPullResult(data);
      loadListings();
    } catch (err) {
      setPullResult({ error: err.message || "Pull failed" });
    } finally {
      setPulling(false);
    }
  }

  async function pullOrders() {
    setPullingOrders(true);
    setPullOrdersResult(null);
    try {
      const response = await fetch(`${API_BASE}/UpdateEtsyOrders`);
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || `HTTP ${response.status}`);
      setPullOrdersResult(data);
      loadOrders();
    } catch (err) {
      setPullOrdersResult({ error: err.message || "Pull failed" });
    } finally {
      setPullingOrders(false);
    }
  }

  function formatDate(unixSeconds) {
    if (!unixSeconds) return "";
    return new Date(unixSeconds * 1000).toLocaleDateString();
  }

  return (
    <div style={{ padding: "20px 0", fontFamily: "Arial, sans-serif", minHeight: "100vh", background: "#fafafa" }}>
      <h2 style={{ textAlign: "center", marginBottom: "20px" }}>Etsy Shop</h2>

      <div style={{ ...cardStyle(), borderRadius: 0, borderLeft: "none", borderRight: "none", marginBottom: "20px" }}>
        <p style={{ marginTop: 0 }}>
          Connect the app to your Etsy shop via Login with Etsy. Once connected, the app can pull your active
          listings (title, SKU, quantity, price) for inventory tracking.
        </p>

        {redirectConnected && (
          <div style={{ marginBottom: "14px", color: "#1b7a1b", fontWeight: 600 }}>Etsy connected successfully.</div>
        )}
        {redirectError && (
          <div className="error" style={{ marginBottom: "14px" }}>
            Connection failed: {redirectError}
          </div>
        )}

        {loading && <p>Loading connection status...</p>}
        {error && <div className="error">{error}</div>}

        {!loading && status && (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "14px" }}>
              <span
                style={{
                  display: "inline-block",
                  width: "10px",
                  height: "10px",
                  borderRadius: "50%",
                  background: status.connected ? "#1b7a1b" : "#b00020",
                }}
              />
              <strong>
                {status.connected ? `Connected — ${status.shopName || status.shopId}` : "Not connected"}
              </strong>
            </div>

            {status.lastError && (
              <div style={{ marginBottom: "14px", color: "#b00020", fontSize: "14px" }}>
                Last error: {status.lastError}
              </div>
            )}

            <a style={buttonStyle()} href={status.authorizeUrl}>
              {status.connected ? "Reconnect" : "Connect with Etsy"}
            </a>

            {status.connected && (
              <button
                type="button"
                onClick={pullListings}
                disabled={pulling}
                style={{ ...buttonStyle(), marginLeft: "10px", background: pulling ? "#9bbcf7" : "#1976d2" }}
              >
                {pulling ? "Pulling..." : "Pull Listings Now"}
              </button>
            )}

            {status.connected && (
              <a href="#etsy-orders-section" style={{ marginLeft: "14px", fontSize: "14px" }}>
                Jump to Orders ↓
              </a>
            )}

            {pullResult && (
              <div style={{ marginTop: "12px", fontSize: "14px" }}>
                {pullResult.error ? (
                  <span style={{ color: "#b00020" }}>Pull failed: {pullResult.error}</span>
                ) : (
                  <span style={{ color: "#1b7a1b" }}>
                    Pulled {pullResult.listingsWritten} listing(s)
                    {pullResult.errors?.length ? ` (${pullResult.errors.length} errors)` : ""}.
                  </span>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {status?.connected && (
        <div style={{ ...cardStyle(), borderRadius: 0, borderLeft: "none", borderRight: "none", marginBottom: "20px" }}>
          <div
            onClick={() => setListingsExpanded((v) => !v)}
            style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer", flexWrap: "wrap", gap: "6px" }}
          >
            <h3 style={{ margin: 0 }}>
              {listingsExpanded ? "▾" : "▸"} Listings
            </h3>
            {listings.length > 0 && (
              <div style={{ display: "flex", gap: "20px", fontSize: "14px" }}>
                <span>{listings.length} listings</span>
                <span style={{ color: "#b00020" }}>
                  {listings.filter((l) => l.insight?.startsWith("Needs attention")).length} need attention
                </span>
                <span style={{ color: "#a35a00" }}>
                  {listings.filter((l) => l.insight?.startsWith("Low visibility")).length} low visibility
                </span>
                <span style={{ color: "#1b7a1b" }}>
                  {listings.filter((l) => l.insight === "OK").length} OK
                </span>
              </div>
            )}
          </div>

          {listingsExpanded && (
            <>
              <div style={{ display: "flex", gap: "12px", alignItems: "center", margin: "14px 0", flexWrap: "wrap" }}>
                <label>
                  Search:{" "}
                  <input
                    type="text"
                    style={inputStyle()}
                    value={search}
                    placeholder="Title or SKU"
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </label>
                <label>
                  Performance:{" "}
                  <select style={inputStyle()} value={insightFilter} onChange={(e) => setInsightFilter(e.target.value)}>
                    <option value="">All</option>
                    <option value="attention">Needs attention (views, no sales)</option>
                    <option value="visibility">Low visibility (few views)</option>
                  </select>
                </label>
              </div>

              {listingsLoading && <p>Loading listings...</p>}
              {listingsError && <div className="error">{listingsError}</div>}

              {!listingsLoading && !listingsError && listings.length === 0 && (
                <p>No listings pulled yet. Click "Pull Listings Now" above.</p>
              )}

              {!listingsLoading && listings.length > 0 && (() => {
                const visibleListings = listings.filter((l) => {
                  if (insightFilter === "attention") return l.insight?.startsWith("Needs attention");
                  if (insightFilter === "visibility") return l.insight?.startsWith("Low visibility");
                  return true;
                });
                return (
                <div style={{ overflowX: "auto" }}>
                  <table style={{ borderCollapse: "collapse", width: "100%" }}>
                    <thead>
                      <tr>
                        <th style={tableCellStyle({ background: "#f4f4f4", maxWidth: "220px" })}>Title</th>
                        <th style={tableCellStyle({ background: "#f4f4f4" })}>Listing ID</th>
                        <th style={tableCellStyle({ background: "#f4f4f4" })}>SKU</th>
                        <th style={tableCellStyle({ background: "#f4f4f4" })}>State</th>
                        <th style={tableCellStyle({ background: "#f4f4f4" })}>Quantity</th>
                        <th style={tableCellStyle({ background: "#f4f4f4" })}>Price</th>
                        <th style={tableCellStyle({ background: "#f4f4f4" })}>Views</th>
                        <th style={tableCellStyle({ background: "#f4f4f4" })}>Favorites</th>
                        <th style={tableCellStyle({ background: "#f4f4f4" })}>Orders</th>
                        <th style={tableCellStyle({ background: "#f4f4f4", maxWidth: "140px" })}>Performance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleListings.map((l) => (
                        <tr key={l.listingId}>
                          <td style={tableCellStyle({ maxWidth: "220px", wordBreak: "break-word" })}>
                            <a href={l.url} target="_blank" rel="noopener noreferrer">
                              {l.title}
                            </a>
                          </td>
                          <td style={tableCellStyle()}>{l.listingId}</td>
                          <td style={tableCellStyle({ whiteSpace: "pre-line" })}>{l.sku}</td>
                          <td style={tableCellStyle()}>{l.state}</td>
                          <td style={tableCellStyle()}>{l.quantity}</td>
                          <td style={tableCellStyle()}>{formatMoney(l.priceAmount, l.priceCurrency)}</td>
                          <td style={tableCellStyle()}>{l.views}</td>
                          <td style={tableCellStyle()}>{l.numFavorers}</td>
                          <td style={tableCellStyle()}>{l.ordersCount} ({l.orderedQuantity} units)</td>
                          <td
                            style={tableCellStyle({
                              maxWidth: "140px",
                              fontSize: "12px",
                              wordBreak: "break-word",
                              color: l.insight?.startsWith("Needs attention")
                                ? "#b00020"
                                : l.insight?.startsWith("Low visibility")
                                ? "#a35a00"
                                : "#1b7a1b",
                            })}
                          >
                            {l.insight}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                );
              })()}
            </>
          )}
        </div>
      )}

      {status?.connected && (
        <div id="etsy-orders-section" style={{ ...cardStyle(), borderRadius: 0, borderLeft: "none", borderRight: "none", marginBottom: "20px" }}>
          <div style={{ display: "flex", gap: "12px", alignItems: "center", marginBottom: "14px", flexWrap: "wrap" }}>
            <h3 style={{ margin: 0 }}>Orders</h3>
            <label>
              Search:{" "}
              <input
                type="text"
                style={inputStyle()}
                value={orderSearch}
                placeholder="Buyer or item"
                onChange={(e) => setOrderSearch(e.target.value)}
              />
            </label>
            <button
              type="button"
              onClick={pullOrders}
              disabled={pullingOrders}
              style={{ ...buttonStyle(), background: pullingOrders ? "#9bbcf7" : "#1976d2" }}
            >
              {pullingOrders ? "Pulling..." : "Pull Orders Now"}
            </button>
          </div>

          {pullOrdersResult && (
            <div style={{ marginBottom: "14px", fontSize: "14px" }}>
              {pullOrdersResult.error ? (
                <span style={{ color: "#b00020" }}>Pull failed: {pullOrdersResult.error}</span>
              ) : (
                <span style={{ color: "#1b7a1b" }}>
                  Pulled {pullOrdersResult.ordersWritten} order(s)
                  {pullOrdersResult.errors?.length ? ` (${pullOrdersResult.errors.length} errors)` : ""}.
                </span>
              )}
            </div>
          )}

          {ordersLoading && <p>Loading orders...</p>}
          {ordersError && <div className="error">{ordersError}</div>}

          {!ordersLoading && !ordersError && orders.length === 0 && (
            <p>No orders pulled yet. Click "Pull Orders Now" above.</p>
          )}

          {!ordersLoading && orders.length > 0 && (
            <div style={{ overflowX: "auto" }}>
              <table style={{ borderCollapse: "collapse", width: "100%" }}>
                <thead>
                  <tr>
                    <th style={tableCellStyle({ background: "#f4f4f4" })}>Order #</th>
                    <th style={tableCellStyle({ background: "#f4f4f4" })}>Date</th>
                    <th style={tableCellStyle({ background: "#f4f4f4" })}>Buyer</th>
                    <th style={tableCellStyle({ background: "#f4f4f4" })}>Marketplace</th>
                    <th style={tableCellStyle({ background: "#f4f4f4" })}>Item</th>
                    <th style={tableCellStyle({ background: "#f4f4f4" })}>SKU</th>
                    <th style={tableCellStyle({ background: "#f4f4f4" })}>Qty</th>
                    <th style={tableCellStyle({ background: "#f4f4f4" })}>Total</th>
                    <th style={tableCellStyle({ background: "#f4f4f4" })}>Status</th>
                    <th style={tableCellStyle({ background: "#f4f4f4" })}>MCF Status</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((o) => {
                    const lines = o.lineItems && o.lineItems.length
                      ? o.lineItems
                      : [{ title: o.itemsSummary, quantity: o.itemCount, sku: "" }];
                    return (
                      <tr key={o.receiptId}>
                        <td style={tableCellStyle()}>
                          <a
                            href={
                              o.status === "Shipped"
                                ? `https://www.etsy.com/your/orders/sold/completed?order_id=${o.receiptId}`
                                : `https://www.etsy.com/your/orders/sold/new?search_query=${o.receiptId}`
                            }
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            {o.receiptId}
                          </a>
                        </td>
                        <td style={tableCellStyle()}>{formatDate(o.created)}</td>
                        <td style={tableCellStyle()}>{o.buyerName}</td>
                        <td style={tableCellStyle()}>{o.marketplace}</td>
                        <td style={tableCellStyle()}>
                          {lines.map((line, idx) => (
                            <span key={idx}>
                              {idx > 0 && <br />}
                              {line.quantity}x{" "}
                              {line.listingId ? (
                                <a
                                  href={`https://www.etsy.com/listing/${line.listingId}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                >
                                  {line.title}
                                </a>
                              ) : (
                                line.title
                              )}
                            </span>
                          ))}
                        </td>
                        <td style={tableCellStyle()}>
                          {lines.map((line, idx) => (
                            <span key={idx}>
                              {idx > 0 && <br />}
                              {line.sku}
                            </span>
                          ))}
                        </td>
                        <td style={tableCellStyle()}>{o.itemCount}</td>
                        <td style={tableCellStyle()}>{formatMoney(o.totalAmount, o.currency)}</td>
                        <td style={tableCellStyle()}>{o.status}</td>
                        <td style={tableCellStyle()}>
                          {o.mcfStatus === "in_progress" ? (
                            "In Progress"
                          ) : o.mcfStatus === "shipped" ? (
                            "Shipped"
                          ) : o.mcfStatus === "manual" ? (
                            "Manual (Seller Central)"
                          ) : o.status === "Pending" ? (
                            <button
                              type="button"
                              onClick={() => markInProgress(o.receiptId)}
                              disabled={markingInProgress === o.receiptId}
                              style={{
                                padding: "4px 8px",
                                fontSize: "12px",
                                cursor: "pointer",
                                borderRadius: "6px",
                                border: "1px solid #1976d2",
                                background: markingInProgress === o.receiptId ? "#e3f2fd" : "#fff",
                                color: "#1976d2",
                              }}
                            >
                              {markingInProgress === o.receiptId ? "Marking..." : "Mark In Progress"}
                            </button>
                          ) : (
                            "-"
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "center", gap: "10px", marginTop: "28px", paddingBottom: "16px" }}>
        <Link style={buttonStyle()} to="/">
          Home
        </Link>
      </div>
    </div>
  );
}
