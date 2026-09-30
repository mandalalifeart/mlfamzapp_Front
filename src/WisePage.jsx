import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { buttonStyle } from "./buttonStyle";

const API_BASE =
  import.meta.env.VITE_API_BASE ||
  "https://us-central1-mlfamzapp.cloudfunctions.net";
const WISE_REFRESH_KEY = import.meta.env.VITE_WISE_REFRESH_KEY || "";

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

const CURRENCY_SYMBOLS = { USD: "$", EUR: "€", GBP: "£", INR: "₹" };

function formatMoney(amount, currency = "USD") {
  if (amount === null || amount === undefined) return "–";
  const symbol = CURRENCY_SYMBOLS[currency] || `${currency} `;
  const sign = amount < 0 ? "-" : "";
  return `${sign}${symbol}${Math.abs(amount).toFixed(2)}`;
}

function formatDate(iso) {
  if (!iso) return "–";
  return iso.slice(0, 10);
}

function cardStyle(extra = {}) {
  return { background: "#fff", border: "1px solid #ddd", borderRadius: "8px", padding: "16px", ...extra };
}

function tableCellStyle(extra = {}) {
  return { border: "1px solid #ccc", padding: "6px 8px", textAlign: "left", fontSize: "13px", ...extra };
}

function numberCellStyle(extra = {}) {
  return tableCellStyle({ textAlign: "right", whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums", ...extra });
}

export default function WisePage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [refreshNote, setRefreshNote] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`${API_BASE}/GetWiseFinancesSummary`);
      const result = await response.json();
      if (!response.ok || result.error) throw new Error(result?.error || `HTTP ${response.status}`);
      setData(result);
    } catch (err) {
      setError(err.message || "Failed to load Wise summary");
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
      const response = await fetch(`${API_BASE}/UpdateWiseFinances?key=${encodeURIComponent(WISE_REFRESH_KEY)}`);
      const result = await response.json();
      if (!response.ok || result.error) throw new Error(result?.error || `HTTP ${response.status}`);
      const parts = Object.entries(result.regions || {}).map(
        ([tag, r]) => `${tag}: ${r.transfersWritten} transfer(s), ${r.balancesWritten} balance(s)`
      );
      setRefreshNote(parts.join(" · ") || "Refreshed.");
      await load();
    } catch (err) {
      setRefreshNote(`Refresh failed: ${err.message || err}`);
    } finally {
      setRefreshing(false);
    }
  }

  const balances = data?.currentBalances || [];
  const transfers = data?.transfers || [];
  const months = data?.monthlyOutflow || [];

  const filteredTransfers = useMemo(() => {
    if (statusFilter === "all") return transfers;
    return transfers.filter((t) => t.status === statusFilter);
  }, [transfers, statusFilter]);

  const statuses = useMemo(
    () => [...new Set(transfers.map((t) => t.status).filter(Boolean))].sort(),
    [transfers]
  );

  return (
    <div style={{ padding: "20px 0", fontFamily: "Arial, sans-serif", minHeight: "100vh", background: "#fafafa" }}>
      <h2 style={{ textAlign: "center", marginBottom: "6px" }}>Wise (Mandala Life ART OÜ)</h2>
      <p style={{ textAlign: "center", fontSize: "13px", color: "#555", marginBottom: "16px" }}>
        Balances and transfer history pulled from the Wise business account.
      </p>

      <div style={{ display: "flex", justifyContent: "center", gap: "10px", marginBottom: "16px" }}>
        <button style={buttonStyle()} onClick={refresh} disabled={refreshing}>
          {refreshing ? "Refreshing..." : "Refresh from Wise"}
        </button>
      </div>
      {refreshNote && <p style={{ textAlign: "center", fontSize: "13px", color: "#555" }}>{refreshNote}</p>}

      {error && <div style={{ margin: "0 16px 16px", color: "#b00020", textAlign: "center" }}>{error}</div>}
      {loading && <p style={{ textAlign: "center" }}>Loading...</p>}

      {!loading && !error && (
        <>
          <div style={{ ...cardStyle(), margin: "0 16px 20px" }}>
            <div style={{ fontSize: "12px", color: "#888", textTransform: "uppercase", marginBottom: "8px" }}>
              Current Balances
            </div>
            <div style={{ display: "flex", gap: "20px", flexWrap: "wrap" }}>
              {balances.length === 0 && <span style={{ color: "#888", fontSize: "13px" }}>No data yet — click "Refresh from Wise".</span>}
              {balances
                .filter((b) => b.amount)
                .map((b) => (
                  <div key={b.currency}>
                    <div style={{ fontSize: "20px", fontWeight: 700 }}>{formatMoney(b.amount, b.currency)}</div>
                    <div style={{ fontSize: "11px", color: "#888" }}>{b.currency}</div>
                  </div>
                ))}
            </div>
            {data?.currentBalances?.length > 0 && (
              <div style={{ fontSize: "11px", color: "#999", marginTop: "8px" }}>
                As of {formatDate(balances[0]?.snapshot_at)}
              </div>
            )}
          </div>

          {data?.note && (
            <p style={{ textAlign: "center", fontSize: "11px", color: "#999", margin: "0 16px 20px" }}>{data.note}</p>
          )}

          <div style={{ margin: "0 16px 20px", display: "flex", flexDirection: "column", gap: "16px" }}>
            {months.slice(0, 6).map((m) => (
              <div key={`${m.currency}-${m.year}-${m.month}`} style={cardStyle()}>
                <h3 style={{ marginTop: 0, fontSize: "15px" }}>
                  {MONTH_NAMES[m.month - 1]} {m.year} — {m.currency}
                  <span style={{ fontWeight: 400, fontSize: "13px", color: "#888", marginLeft: "10px" }}>
                    Sent out: <strong>{formatMoney(m.totalOut, m.currency)}</strong> ({m.count} transfer{m.count === 1 ? "" : "s"})
                  </span>
                </h3>
              </div>
            ))}
            {months.length === 0 && (
              <p style={{ textAlign: "center", color: "#555" }}>No transfer data yet.</p>
            )}
          </div>

          <div style={{ ...cardStyle(), margin: "0 16px 20px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px" }}>
              <div>
                <h3 style={{ margin: 0 }}>Transfer History (most recent {filteredTransfers.length})</h3>
                <div style={{ fontSize: "11px", color: "#999" }}>
                  "Paid To" is only available for roughly the last ~100 transfers (Wise's activity feed doesn't go further back).
                </div>
              </div>
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ padding: "4px 8px" }}>
                <option value="all">All statuses</option>
                {statuses.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div style={{ overflowX: "auto", marginTop: "10px" }}>
              <table style={{ borderCollapse: "collapse", width: "100%" }}>
                <thead>
                  <tr>
                    <th style={tableCellStyle({ background: "#f4f4f4" })}>Date</th>
                    <th style={tableCellStyle({ background: "#f4f4f4" })}>Paid To</th>
                    <th style={tableCellStyle({ background: "#f4f4f4" })}>Reference</th>
                    <th style={tableCellStyle({ background: "#f4f4f4" })}>Status</th>
                    <th style={numberCellStyle({ background: "#f4f4f4" })}>Source</th>
                    <th style={numberCellStyle({ background: "#f4f4f4" })}>Target</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTransfers.map((t) => (
                    <tr key={t.transfer_id}>
                      <td style={tableCellStyle()}>{formatDate(t.created_at)}</td>
                      <td style={tableCellStyle()}>{t.counterparty || "–"}</td>
                      <td style={tableCellStyle()}>{t.reference || "–"}</td>
                      <td style={tableCellStyle()}>{t.status}</td>
                      <td style={numberCellStyle()}>{formatMoney(t.source_value, t.source_currency)}</td>
                      <td style={numberCellStyle()}>{formatMoney(t.target_value, t.target_currency)}</td>
                    </tr>
                  ))}
                  {filteredTransfers.length === 0 && (
                    <tr>
                      <td style={tableCellStyle()} colSpan={6}>No transfers for this filter.</td>
                    </tr>
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
          Amazon Payments
        </Link>
      </div>
    </div>
  );
}
