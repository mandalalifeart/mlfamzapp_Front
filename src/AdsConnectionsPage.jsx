import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

const API_BASE =
  import.meta.env.VITE_API_BASE ||
  "https://us-central1-mlfamzapp.cloudfunctions.net";

function cardStyle() {
  return { background: "#fff", border: "1px solid #ddd", borderRadius: "8px", padding: "16px" };
}

function buttonStyle(disabled = false) {
  return {
    padding: "10px 18px",
    fontSize: "14px",
    cursor: disabled ? "not-allowed" : "pointer",
    borderRadius: "8px",
    border: "none",
    background: disabled ? "#9bbcf7" : "#1976d2",
    color: "#fff",
    fontWeight: "600",
    opacity: disabled ? 0.6 : 1,
    textDecoration: "none",
    display: "inline-block",
  };
}

function tableCellStyle(extra = {}) {
  return { border: "1px solid #ccc", padding: "8px 10px", textAlign: "left", ...extra };
}

export default function AdsConnectionsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState(null);
  const [error, setError] = useState("");

  async function loadStatus() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`${API_BASE}/GetAdsConnectionStatus`);
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || `HTTP ${response.status}`);
      setStatus(data);
    } catch (err) {
      setError(err.message || "Failed to load connection status");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadStatus();
  }, []);

  useEffect(() => {
    if (searchParams.get("connected") || searchParams.get("error")) {
      // Clear the OAuth redirect params from the URL once we've read them.
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const redirectError = searchParams.get("error");

  return (
    <div style={{ padding: "20px", fontFamily: "Arial, sans-serif", minHeight: "100vh", background: "#fafafa" }}>
      <h2 style={{ textAlign: "center", marginBottom: "20px" }}>Ads Connections</h2>

      <div style={{ ...cardStyle(), maxWidth: "900px", marginInline: "auto", marginBottom: "20px" }}>
        <p style={{ marginTop: 0 }}>
          Connect the app to your Amazon Advertising account via Login with Amazon. Once connected, the app can pull
          PPC spend/sales into the sales reports.
        </p>

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
              <strong>{status.connected ? "Connected" : "Not connected"}</strong>
            </div>

            {status.lastError && (
              <div style={{ marginBottom: "14px", color: "#b00020", fontSize: "14px" }}>
                Last error: {status.lastError}
              </div>
            )}

            {!status.connected && status.authorizeUrl && (
              <a style={buttonStyle()} href={status.authorizeUrl}>
                Connect with Amazon Ads
              </a>
            )}

            {status.connected && (
              <>
                <a style={buttonStyle()} href={status.authorizeUrl}>
                  Reconnect
                </a>

                <h3 style={{ marginTop: "24px" }}>Discovered Profiles</h3>
                {status.profiles.length === 0 ? (
                  <p>No advertising profiles found on this account.</p>
                ) : (
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ borderCollapse: "collapse", width: "100%" }}>
                      <thead>
                        <tr>
                          <th style={tableCellStyle({ background: "#f4f4f4" })}>Region</th>
                          <th style={tableCellStyle({ background: "#f4f4f4" })}>Country</th>
                          <th style={tableCellStyle({ background: "#f4f4f4" })}>Currency</th>
                          <th style={tableCellStyle({ background: "#f4f4f4" })}>Account</th>
                          <th style={tableCellStyle({ background: "#f4f4f4" })}>Profile ID</th>
                        </tr>
                      </thead>
                      <tbody>
                        {status.profiles.map((p) => (
                          <tr key={`${p.region}-${p.profileId}`}>
                            <td style={tableCellStyle()}>{p.region}</td>
                            <td style={tableCellStyle()}>{p.countryCode}</td>
                            <td style={tableCellStyle()}>{p.currencyCode}</td>
                            <td style={tableCellStyle()}>{p.accountName}</td>
                            <td style={tableCellStyle()}>{p.profileId}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>

      <div style={{ display: "flex", justifyContent: "center", gap: "10px", marginTop: "28px", paddingBottom: "16px" }}>
        <Link style={buttonStyle()} to="/">
          Home
        </Link>
        <Link style={buttonStyle()} to="/sales">
          Sales
        </Link>
      </div>
    </div>
  );
}
