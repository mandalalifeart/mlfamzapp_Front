import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { buttonStyle } from "./buttonStyle";

const API_BASE =
  import.meta.env.VITE_API_BASE ||
  "https://us-central1-mlfamzapp.cloudfunctions.net";
const RETURNS_REFRESH_KEY = import.meta.env.VITE_RETURNS_REFRESH_KEY || "";

function cardStyle(extra = {}) {
  return { background: "#fff", border: "1px solid #ddd", borderRadius: "8px", padding: "16px", ...extra };
}

function tableCellStyle(extra = {}) {
  return { border: "1px solid #ccc", padding: "6px 8px", textAlign: "left", fontSize: "13px", ...extra };
}

function numberCellStyle(extra = {}) {
  return tableCellStyle({ textAlign: "right", whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums", ...extra });
}

function formatDate(iso) {
  if (!iso) return "–";
  return iso.slice(0, 10);
}

const MARKETPLACE_LABEL = { usa: "USA", eu: "EU" };

export default function ReturnsPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [refreshNote, setRefreshNote] = useState("");
  const [marketplaceFilter, setMarketplaceFilter] = useState("all");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`${API_BASE}/GetReturnStats`);
      const result = await response.json();
      if (!response.ok || result.error) throw new Error(result?.error || `HTTP ${response.status}`);
      setData(result);
    } catch (err) {
      setError(err.message || "Failed to load return stats");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function refresh() {
    setRefreshing(true);
    setRefreshNote("");
    try {
      const response = await fetch(`${API_BASE}/UpdateAmazonReturns?key=${encodeURIComponent(RETURNS_REFRESH_KEY)}`);
      const result = await response.json();
      if (!response.ok || result.error) throw new Error(result?.error || `HTTP ${response.status}`);
      if (result.acceptedInBackground) {
        setRefreshNote("Pulling in the background — reload in a bit to see new data.");
      } else {
        const parts = Object.entries(result.regions || {}).map(
          ([tag, r]) => `${MARKETPLACE_LABEL[tag] || tag}: ${r.returnsWritten} return(s)`
        );
        setRefreshNote(parts.join(" · ") || "Refreshed.");
      }
      await load();
    } catch (err) {
      setRefreshNote(`Refresh failed: ${err.message || err}`);
    } finally {
      setRefreshing(false);
    }
  }

  const allReturns = data?.returns || [];
  const returns = useMemo(
    () => (marketplaceFilter === "all" ? allReturns : allReturns.filter((r) => r.marketplace === marketplaceFilter)),
    [allReturns, marketplaceFilter]
  );

  return (
    <div style={{ padding: "20px 0", fontFamily: "Arial, sans-serif", minHeight: "100vh", background: "#fafafa" }}>
      <h2 style={{ textAlign: "center", marginBottom: "6px" }}>Return Statistics</h2>
      <p style={{ textAlign: "center", fontSize: "13px", color: "#555", marginBottom: "16px" }}>
        FBA customer returns, USA + EU, pulled from Amazon's Reports API.
      </p>

      <div style={{ display: "flex", justifyContent: "center", gap: "10px", marginBottom: "16px" }}>
        <button style={buttonStyle()} onClick={refresh} disabled={refreshing}>
          {refreshing ? "Refreshing..." : "Refresh from Amazon"}
        </button>
      </div>
      {refreshNote && <p style={{ textAlign: "center", fontSize: "13px", color: "#555" }}>{refreshNote}</p>}

      {error && <div style={{ margin: "0 16px 16px", color: "#b00020", textAlign: "center" }}>{error}</div>}
      {loading && <p style={{ textAlign: "center" }}>Loading...</p>}

      {!loading && !error && (
        <>
          <div style={{ ...cardStyle(), margin: "0 16px 20px", display: "flex", gap: "24px", flexWrap: "wrap" }}>
            <div>
              <div style={{ fontSize: "24px", fontWeight: 700 }}>{data?.totalReturns ?? 0}</div>
              <div style={{ fontSize: "11px", color: "#888" }}>Total units returned</div>
            </div>
            {Object.entries(data?.byMarketplace || {}).map(([tag, count]) => (
              <div key={tag}>
                <div style={{ fontSize: "24px", fontWeight: 700 }}>{count}</div>
                <div style={{ fontSize: "11px", color: "#888" }}>{MARKETPLACE_LABEL[tag] || tag}</div>
              </div>
            ))}
          </div>

          <div style={{ margin: "0 16px 20px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
            <div style={cardStyle()}>
              <h3 style={{ marginTop: 0, fontSize: "15px" }}>Top Return Reasons</h3>
              <div style={{ overflowX: "auto" }}>
                <table style={{ borderCollapse: "collapse", width: "100%" }}>
                  <tbody>
                    {(data?.topReasons || []).map((r) => (
                      <tr key={r.reason}>
                        <td style={tableCellStyle()}>{r.reason}</td>
                        <td style={numberCellStyle()}>{r.count}</td>
                      </tr>
                    ))}
                    {(data?.topReasons || []).length === 0 && (
                      <tr><td style={tableCellStyle()}>No data yet.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div style={cardStyle()}>
              <h3 style={{ marginTop: 0, fontSize: "15px" }}>Returns By Month</h3>
              <div style={{ overflowX: "auto" }}>
                <table style={{ borderCollapse: "collapse", width: "100%" }}>
                  <tbody>
                    {(data?.byMonth || []).slice().reverse().map((m) => (
                      <tr key={m.month}>
                        <td style={tableCellStyle()}>{m.month}</td>
                        <td style={numberCellStyle()}>{m.count}</td>
                      </tr>
                    ))}
                    {(data?.byMonth || []).length === 0 && (
                      <tr><td style={tableCellStyle()}>No data yet.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div style={{ ...cardStyle(), margin: "0 16px 20px" }}>
            <h3 style={{ marginTop: 0 }}>Top SKUs by Returns</h3>
            <div style={{ overflowX: "auto" }}>
              <table style={{ borderCollapse: "collapse", width: "100%" }}>
                <thead>
                  <tr>
                    <th style={tableCellStyle({ background: "#f4f4f4" })}>SKU</th>
                    <th style={tableCellStyle({ background: "#f4f4f4" })}>ASIN</th>
                    <th style={tableCellStyle({ background: "#f4f4f4" })}>Product</th>
                    <th style={numberCellStyle({ background: "#f4f4f4" })}>Returns</th>
                  </tr>
                </thead>
                <tbody>
                  {(data?.topSkus || []).slice(0, 25).map((s) => (
                    <tr key={s.sku}>
                      <td style={tableCellStyle()}>{s.sku}</td>
                      <td style={tableCellStyle()}>{s.asin}</td>
                      <td style={tableCellStyle({ maxWidth: "320px" })}>{s.productName}</td>
                      <td style={numberCellStyle()}>{s.count}</td>
                    </tr>
                  ))}
                  {(data?.topSkus || []).length === 0 && (
                    <tr><td style={tableCellStyle()} colSpan={4}>No data yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div style={{ ...cardStyle(), margin: "0 16px 20px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px" }}>
              <h3 style={{ margin: 0 }}>Return Log (most recent {returns.length})</h3>
              <select value={marketplaceFilter} onChange={(e) => setMarketplaceFilter(e.target.value)} style={{ padding: "4px 8px" }}>
                <option value="all">All marketplaces</option>
                <option value="usa">USA</option>
                <option value="eu">EU</option>
              </select>
            </div>
            <div style={{ overflowX: "auto", marginTop: "10px" }}>
              <table style={{ borderCollapse: "collapse", width: "100%" }}>
                <thead>
                  <tr>
                    <th style={tableCellStyle({ background: "#f4f4f4" })}>Date</th>
                    <th style={tableCellStyle({ background: "#f4f4f4" })}>SKU</th>
                    <th style={tableCellStyle({ background: "#f4f4f4" })}>Reason</th>
                    <th style={tableCellStyle({ background: "#f4f4f4" })}>Disposition</th>
                    <th style={tableCellStyle({ background: "#f4f4f4" })}>Comment</th>
                  </tr>
                </thead>
                <tbody>
                  {returns.map((r) => (
                    <tr key={r.id}>
                      <td style={tableCellStyle()}>{formatDate(r.return_date)}</td>
                      <td style={tableCellStyle()}>{r.sku}</td>
                      <td style={tableCellStyle()}>{r.reason}</td>
                      <td style={tableCellStyle()}>{r.detailed_disposition}</td>
                      <td style={tableCellStyle({ maxWidth: "320px" })}>{r.customer_comments || "–"}</td>
                    </tr>
                  ))}
                  {returns.length === 0 && (
                    <tr><td style={tableCellStyle()} colSpan={5}>No returns for this filter.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      <div style={{ display: "flex", justifyContent: "center", gap: "10px", paddingBottom: "16px" }}>
        <Link style={buttonStyle()} to="/">
          Home
        </Link>
        <Link style={buttonStyle()} to="/payments">
          Payments
        </Link>
      </div>
    </div>
  );
}
