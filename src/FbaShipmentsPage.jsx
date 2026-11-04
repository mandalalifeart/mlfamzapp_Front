import { Fragment, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { buttonStyle } from "./buttonStyle";

// FBA inbound shipments (2026-10-11, per the user): products on the way per
// marketplace (units shipped but not received in shipments that are not closed),
// open shipments with receiving progress, and closed shipments with differences.
// Data = fba_shipments in PocketBase, synced daily from Amazon (UpdateFbaShipments).
const LOCAL_API_BASE = "https://amzapi.mandalalifeart.com";
const MARKETPLACES = ["USA", "DE", "UK", "AU"];
const FLAG = { USA: "🇺🇸", DE: "🇩🇪", UK: "🇬🇧", AU: "🇦🇺" };

function cardStyle(extra = {}) {
  return { background: "#fff", border: "1px solid #ddd", borderRadius: "8px", padding: "16px", marginBottom: "16px", ...extra };
}
function cell(extra = {}) {
  return { border: "1px solid #ccc", padding: "6px 8px", textAlign: "left", fontSize: "13px", ...extra };
}
function num(extra = {}) {
  return cell({ textAlign: "right", whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums", ...extra });
}
const TH = { background: "#f4f4f4" };

function ItemsTable({ items }) {
  return (
    <table style={{ borderCollapse: "collapse", margin: "6px 0 6px 24px" }}>
      <thead>
        <tr>
          <th style={cell(TH)}>SKU</th>
          <th style={num(TH)}>Shipped</th>
          <th style={num(TH)}>Received</th>
          <th style={num(TH)}>Difference</th>
        </tr>
      </thead>
      <tbody>
        {items.map((i) => {
          const diff = (i.received || 0) - (i.shipped || 0);
          return (
            <tr key={i.sku}>
              <td style={cell()}>{i.sku}</td>
              <td style={num()}>{i.shipped}</td>
              <td style={num()}>{i.received}</td>
              <td style={num({ color: diff < 0 ? "#b00020" : diff > 0 ? "#555" : "#2e7d32" })}>
                {diff === 0 ? "✓" : diff > 0 ? `+${diff}` : diff}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function ShipmentsTable({ rows, closed }) {
  const [open, setOpen] = useState({});
  if (!rows.length) return <div style={{ color: "#888", fontSize: "13px" }}>None.</div>;
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ borderCollapse: "collapse", width: "100%", minWidth: "760px" }}>
        <thead>
          <tr>
            <th style={cell(TH)}>Shipment</th>
            <th style={cell(TH)}>Name</th>
            <th style={cell(TH)}>MP</th>
            <th style={cell(TH)}>FC</th>
            <th style={cell(TH)}>Status</th>
            <th style={cell(TH)}>Created</th>
            <th style={num(TH)}>Shipped</th>
            <th style={num(TH)}>Received</th>
            <th style={num(TH)}>{closed ? "Difference" : "Still to receive"}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((s) => {
            const diff = s.received - s.shipped;
            const short = closed && diff < 0;
            return (
              <Fragment key={s.shipmentId}>
                <tr
                  onClick={() => setOpen((p) => ({ ...p, [s.shipmentId]: !p[s.shipmentId] }))}
                  style={{ cursor: "pointer", background: short ? "#fff1f1" : s.stuck ? "#fff8e1" : undefined }}
                >
                  <td style={cell({ whiteSpace: "nowrap" })}>
                    {open[s.shipmentId] ? "▾" : "▸"} {s.shipmentId}
                  </td>
                  <td style={cell()}>
                    {s.name}
                    {s.awdTransfer && <span style={{ color: "#777" }}> · AWD→FBA</span>}
                  </td>
                  <td style={cell()}>{FLAG[s.marketplace]} {s.marketplace}</td>
                  <td style={cell()}>{s.fc}</td>
                  <td style={cell({ whiteSpace: "nowrap" })}>
                    {s.status}
                    {s.stuck && <div style={{ color: "#b26a00", fontSize: "12px" }}>🚩 receiving {s.ageDays} days</div>}
                  </td>
                  <td style={cell({ whiteSpace: "nowrap" })}>
                    {s.created || "–"}
                    {s.ageDays != null && !closed && <div style={{ color: "#777", fontSize: "12px" }}>{s.ageDays} days ago</div>}
                  </td>
                  <td style={num()}>{s.shipped}</td>
                  <td style={num()}>{s.received}</td>
                  <td style={num({ fontWeight: 700, color: closed ? (diff < 0 ? "#b00020" : "#2e7d32") : "#1565c0" })}>
                    {closed ? (diff === 0 ? "✓ full" : diff > 0 ? `+${diff}` : `${diff} short`) : Math.max(s.shipped - s.received, 0)}
                  </td>
                </tr>
                {open[s.shipmentId] && (
                  <tr>
                    <td colSpan={9} style={cell({ background: "#fafafa" })}>
                      <ItemsTable items={s.items} />
                      {short && (
                        <div style={{ color: "#b00020", fontSize: "12px", marginLeft: "24px" }}>
                          Closed short: open a reconciliation case in Seller Central (Shipments → this shipment → Reconcile).
                        </div>
                      )}
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function FbaShipmentsPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [mp, setMp] = useState("all");
  const [showAwd, setShowAwd] = useState(false);
  const [closedDays, setClosedDays] = useState(60);
  const [refreshNote, setRefreshNote] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const r = await fetch(`${LOCAL_API_BASE}/GetFbaShipments`);
      const j = await r.json();
      if (!r.ok || j.error) throw new Error(j.error || `HTTP ${r.status}`);
      setData(j);
    } catch (e) {
      setError(e.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
  }, []);

  async function refresh() {
    setRefreshNote("Pulling from Amazon… (can take a few minutes)");
    try {
      const r = await fetch(`${LOCAL_API_BASE}/UpdateFbaShipments?days=30`);
      const j = await r.json();
      if (j.acceptedInBackground) setRefreshNote("Running in the background — reload in a few minutes.");
      else if (j.error) setRefreshNote(`Refresh failed: ${j.error}`);
      else setRefreshNote(`Updated ${j.written} shipment(s).`);
      await load();
    } catch (e) {
      setRefreshNote(`Refresh failed: ${e.message}`);
    }
  }

  const ships = useMemo(() => {
    let s = data?.shipments || [];
    if (mp !== "all") s = s.filter((x) => x.marketplace === mp);
    if (!showAwd) s = s.filter((x) => !x.awdTransfer);
    return s;
  }, [data, mp, showAwd]);
  const openShips = ships.filter((s) => s.open);
  const cutoff = new Date(Date.now() - closedDays * 86400000).toISOString().slice(0, 10);
  const closedShips = ships.filter((s) => s.status === "CLOSED" && (s.closedSeen || s.created || "") >= cutoff);
  const shownMps = mp === "all" ? MARKETPLACES : [mp];

  return (
    <div style={{ padding: "10px", fontFamily: "Arial, sans-serif", background: "#fafafa", minHeight: "100vh", maxWidth: "1200px", margin: "0 auto" }}>
      <div style={{ marginBottom: "10px" }}>
        <Link to="/">← Home</Link>
      </div>
      <h2 style={{ textAlign: "center" }}>FBA Shipments</h2>

      <div style={cardStyle({ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center" })}>
        <label>
          Marketplace{" "}
          <select value={mp} onChange={(e) => setMp(e.target.value)}>
            <option value="all">All</option>
            {MARKETPLACES.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </label>
        <label style={{ fontSize: "13px" }}>
          <input type="checkbox" checked={showAwd} onChange={(e) => setShowAwd(e.target.checked)} /> Show USA AWD→FBA auto transfers in the shipment lists
        </label>
        <button style={buttonStyle()} onClick={refresh}>Refresh from Amazon</button>
        <span style={{ fontSize: "12px", color: "#666" }}>
          Last sync: {data?.syncedAt ? data.syncedAt.slice(0, 16).replace("T", " ") : "–"} UTC · syncs daily 06:05
        </span>
        {refreshNote && <span style={{ fontSize: "12px" }}>{refreshNote}</span>}
      </div>

      {error && <div style={cardStyle({ color: "#b00020" })}>{error}</div>}
      {loading && <div>Loading…</div>}

      {data && (
        <>
          <div style={cardStyle()}>
            <h3 style={{ marginTop: 0 }}>🚚 Products on the way</h3>
            <div style={{ fontSize: "12px", color: "#666", marginBottom: "8px" }}>
              Units shipped but not yet received, in shipments that are not closed (AWD→FBA transfers included).
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "16px" }}>
              {shownMps.map((m) => {
                const rows = data.onTheWay?.[m] || [];
                return (
                  <div key={m} style={{ minWidth: 0 }}>
                    <h4 style={{ margin: "0 0 6px" }}>
                      {FLAG[m]} {m}: {rows.reduce((a, r) => a + r.units, 0)} units · {rows.length} products
                    </h4>
                    {rows.length === 0 ? (
                      <div style={{ color: "#888", fontSize: "13px" }}>Nothing on the way.</div>
                    ) : (
                      <table style={{ borderCollapse: "collapse", width: "100%" }}>
                        <thead>
                          <tr>
                            <th style={cell(TH)}>SKU</th>
                            <th style={num(TH)}>Units</th>
                            <th style={num(TH)}>Shipments</th>
                          </tr>
                        </thead>
                        <tbody>
                          {rows.map((r) => (
                            <tr key={r.sku}>
                              <td style={cell()}>
                                {r.sku}
                                {r.awdTransfer && <span style={{ color: "#777", fontSize: "11px" }}> AWD→FBA</span>}
                              </td>
                              <td style={num({ fontWeight: 700 })}>{r.units}</td>
                              <td style={num()} title={r.shipments.join("\n")}>{r.shipments.length}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div style={cardStyle()}>
            <h3 style={{ marginTop: 0 }}>Open shipments ({openShips.length})</h3>
            <div style={{ fontSize: "12px", color: "#666", marginBottom: "8px" }}>
              Click a row for its products. 🚩 = still receiving after 30 days (a case can be opened only once it is closed).
            </div>
            <ShipmentsTable rows={openShips} closed={false} />
          </div>

          <div style={cardStyle()}>
            <h3 style={{ marginTop: 0 }}>
              Closed shipments ({closedShips.length}) — last{" "}
              <select value={closedDays} onChange={(e) => setClosedDays(Number(e.target.value))}>
                {[30, 60, 90, 120].map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>{" "}
              days
            </h3>
            <div style={{ fontSize: "12px", color: "#666", marginBottom: "8px" }}>
              Red = closed short (open a reconciliation case).
            </div>
            <ShipmentsTable rows={closedShips} closed />
          </div>
        </>
      )}
    </div>
  );
}
