import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

const API_BASE =
  import.meta.env.VITE_API_BASE ||
  "https://us-central1-mlfamzapp.cloudfunctions.net";

function cardStyle() {
  return { background: "#fff", border: "1px solid #ddd", borderRadius: "8px", padding: "16px" };
}

function buttonStyle() {
  return {
    padding: "10px 18px",
    fontSize: "14px",
    cursor: "pointer",
    borderRadius: "8px",
    border: "none",
    background: "#1976d2",
    color: "#fff",
    fontWeight: "600",
    textDecoration: "none",
    display: "inline-block",
  };
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
  const [pulling, setPulling] = useState(false);
  const [pullResult, setPullResult] = useState(null);

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

  useEffect(() => {
    if (status?.connected) loadListings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status?.connected, search]);

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
          <div style={{ display: "flex", gap: "12px", alignItems: "center", marginBottom: "14px" }}>
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
          </div>

          {listingsLoading && <p>Loading listings...</p>}
          {listingsError && <div className="error">{listingsError}</div>}

          {!listingsLoading && !listingsError && listings.length === 0 && (
            <p>No listings pulled yet. Click "Pull Listings Now" above.</p>
          )}

          {!listingsLoading && listings.length > 0 && (
            <div style={{ overflowX: "auto" }}>
              <table style={{ borderCollapse: "collapse", width: "100%" }}>
                <thead>
                  <tr>
                    <th style={tableCellStyle({ background: "#f4f4f4" })}>Title</th>
                    <th style={tableCellStyle({ background: "#f4f4f4" })}>SKU</th>
                    <th style={tableCellStyle({ background: "#f4f4f4" })}>State</th>
                    <th style={tableCellStyle({ background: "#f4f4f4" })}>Quantity</th>
                    <th style={tableCellStyle({ background: "#f4f4f4" })}>Price</th>
                  </tr>
                </thead>
                <tbody>
                  {listings.map((l) => (
                    <tr key={l.listingId}>
                      <td style={tableCellStyle()}>
                        <a href={l.url} target="_blank" rel="noopener noreferrer">
                          {l.title}
                        </a>
                      </td>
                      <td style={tableCellStyle()}>{l.sku}</td>
                      <td style={tableCellStyle()}>{l.state}</td>
                      <td style={tableCellStyle()}>{l.quantity}</td>
                      <td style={tableCellStyle()}>{formatMoney(l.priceAmount, l.priceCurrency)}</td>
                    </tr>
                  ))}
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
