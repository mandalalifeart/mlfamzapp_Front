import { Fragment, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { buttonStyle } from "./buttonStyle";

// Import shipments (2026-10-26, per the user): every Malani / Acacia shipment
// with its supplier invoice, freight + customs documents (Unicargo for EU/UK,
// Xhipment via Amazon Global Logistics for USA) and what is still missing.
// Data = import_shipments in PocketBase (ImportShipments.py, local server);
// files are the /wise documents.
const LOCAL_API_BASE = "https://amzapi.mandalalifeart.com";
const WISE_REFRESH_KEY = import.meta.env.VITE_WISE_REFRESH_KEY || "";
const FLAG = { US: "🇺🇸", DE: "🇩🇪", GB: "🇬🇧", AU: "🇦🇺", JP: "🇯🇵", PL: "🇵🇱" };
const COUNTRY = { US: "USA", DE: "Germany / EU", GB: "United Kingdom", AU: "Australia", JP: "Japan", PL: "Poland" };
const COUNTRY_ORDER = ["US", "DE", "GB", "AU", "JP", "PL"];

function cardStyle(extra = {}) {
  return { background: "#fff", border: "1px solid #ddd", borderRadius: "8px", padding: "16px", marginBottom: "16px", ...extra };
}
function cell(extra = {}) {
  return { border: "1px solid #ccc", padding: "6px 8px", textAlign: "left", fontSize: "13px", verticalAlign: "top", ...extra };
}
function num(extra = {}) {
  return cell({ textAlign: "right", whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums", ...extra });
}
const TH = { background: "#f4f4f4" };
const money = (v) => (v ? `$${Number(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "–");
const docUrl = (id) => `${LOCAL_API_BASE}/GetWiseDocument?id=${encodeURIComponent(id)}&key=${encodeURIComponent(WISE_REFRESH_KEY)}`;

async function post(fn, body) {
  const r = await fetch(`${LOCAL_API_BASE}/${fn}?key=${encodeURIComponent(WISE_REFRESH_KEY)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await r.json();
  if (!r.ok || data.error) throw new Error(data.error || `HTTP ${r.status}`);
  return data;
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] || "");
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function MissingItem({ shipment, item, roles, onChanged }) {
  const [busy, setBusy] = useState(false);
  const isRole = Boolean(roles[item]);
  const label = isRole ? roles[item] : item;
  async function upload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    try {
      await post("UploadShipmentDocument", {
        shipmentId: shipment.id, role: item, filename: file.name, contentBase64: await fileToBase64(file),
      });
      onChanged();
    } catch (err) {
      alert(`Upload failed: ${err.message}`);
    } finally {
      setBusy(false);
    }
  }
  async function notNeeded() {
    if (!window.confirm(`Mark "${label}" as not needed for ${shipment.code}?`)) return;
    await post("SetImportShipmentRole", { shipmentId: shipment.id, role: item, notNeeded: true });
    onChanged();
  }
  return (
    <li style={{ marginBottom: "4px" }}>
      <span style={{ color: "#b00020" }}>✗ {label}</span>
      {item === "customs_declaration" && shipment.declarationHint && (
        <span style={{ color: "#777" }}> ({shipment.declarationHint})</span>
      )}
      {isRole && (
        <>
          {" "}
          <label style={{ color: "#1565c0", cursor: "pointer", marginLeft: "6px" }}>
            {busy ? "uploading…" : "⬆ upload"}
            <input type="file" style={{ display: "none" }} onChange={upload} disabled={busy} />
          </label>
          <span onClick={notNeeded} style={{ color: "#777", cursor: "pointer", marginLeft: "10px", fontSize: "12px" }}>
            not needed
          </span>
        </>
      )}
    </li>
  );
}

function Detail({ s, roles, onChanged }) {
  async function unlink(docId) {
    if (!window.confirm("Remove this document from the shipment? (The file stays on /wise.)")) return;
    await post("SetImportShipmentRole", { shipmentId: s.id, unlinkDocId: docId });
    onChanged();
  }
  async function needed(role) {
    await post("SetImportShipmentRole", { shipmentId: s.id, role, notNeeded: false });
    onChanged();
  }
  return (
    <div style={{ padding: "4px 8px 8px 24px" }}>
      <div style={{ fontSize: "12px", color: "#555", marginBottom: "8px" }}>
        {s.routeLabel}
        {s.forwarderFile && <> · file {s.forwarderFile}</>}
        {s.bl && <> · B/L {s.bl}</>}
        {s.amazonRefs.length > 0 && <> · Amazon {s.amazonRefs.join(", ")}</>}
        {s.packages ? <> · {s.packages} boxes</> : null}
        {s.weightKg ? <> · {s.weightKg} kg</> : null}
        {s.cbm ? <> · {s.cbm} CBM</> : null}
      </div>
      <table style={{ borderCollapse: "collapse", marginBottom: "8px" }}>
        <thead>
          <tr>
            <th style={cell(TH)}>Document</th>
            <th style={cell(TH)}>Issuer / number</th>
            <th style={cell(TH)}>Date</th>
            <th style={num(TH)}>Total</th>
            <th style={num(TH)}>Freight</th>
            <th style={num(TH)}>Duty</th>
            <th style={num(TH)}>Import VAT</th>
            <th style={cell(TH)}></th>
          </tr>
        </thead>
        <tbody>
          {s.docs.map((d) => (
            <tr key={d.id + d.role}>
              <td style={cell()}>
                {roles[d.role] || d.role}
                {d.note && <div style={{ color: "#777", fontSize: "12px" }}>{d.note}</div>}
              </td>
              <td style={cell()}>
                <a href={docUrl(d.id)} target="_blank" rel="noreferrer">
                  {d.issuer ? `${d.issuer} ` : ""}{d.number || d.filename}
                </a>
                {d.summary && <div style={{ color: "#777", fontSize: "12px", maxWidth: "380px" }}>{d.summary}</div>}
              </td>
              <td style={cell({ whiteSpace: "nowrap" })}>{d.date}</td>
              <td style={num()}>
                {d.total != null ? `${Number(d.total).toLocaleString(undefined, { minimumFractionDigits: 2 })} ${d.currency}` : "–"}
                {d.paid && <div style={{ color: "#2e7d32", fontSize: "11px" }}>paid via Wise</div>}
              </td>
              <td style={num()}>{money(d.freightUsd)}</td>
              <td style={num()}>{money(d.dutyUsd)}</td>
              <td style={num()}>{money(d.vatUsd)}</td>
              <td style={cell()}>
                <span onClick={() => unlink(d.id)} style={{ color: "#999", cursor: "pointer", fontSize: "12px" }}>remove</span>
              </td>
            </tr>
          ))}
          {s.amazonCharges.map((c, i) => (
            <tr key={`c${i}`} style={{ background: "#f7f9ff" }}>
              <td style={cell()}>Amazon settlement charge</td>
              <td style={cell()}>
                {c.category}
                {c.matches && <div style={{ color: "#777", fontSize: "12px" }}>= {c.matches}</div>}
              </td>
              <td style={cell({ whiteSpace: "nowrap" })}>{c.date}</td>
              <td style={num()}>{money(Math.abs(c.amount))}</td>
              <td colSpan={4} style={cell({ color: "#777", fontSize: "12px" })}>
                {c.counted ? "counted in the cost" : "for comparison (the invoices above are counted)"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {s.missing.length > 0 && (
        <div style={{ fontSize: "13px" }}>
          <b>Missing</b>
          <ul style={{ margin: "4px 0 8px 0", paddingLeft: "18px" }}>
            {s.missing.map((m) => (
              <MissingItem key={m} shipment={s} item={m} roles={roles} onChanged={onChanged} />
            ))}
          </ul>
        </div>
      )}
      {s.notNeeded.length > 0 && (
        <div style={{ fontSize: "12px", color: "#777" }}>
          Not needed:{" "}
          {s.notNeeded.map((r) => (
            <span key={r} style={{ marginRight: "10px" }}>
              {roles[r] || r}{" "}
              <span onClick={() => needed(r)} style={{ color: "#1565c0", cursor: "pointer" }}>(undo)</span>
            </span>
          ))}
        </div>
      )}
      {s.notes.map((n, i) => (
        <div key={i} style={{ fontSize: "12px", color: "#555", marginTop: "4px" }}>ℹ {n}</div>
      ))}
    </div>
  );
}

export default function ImportShipmentsPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [open, setOpen] = useState({});
  const [supplier, setSupplier] = useState("all");
  const [onlyMissing, setOnlyMissing] = useState(false);

  async function load() {
    setError("");
    try {
      const r = await fetch(`${LOCAL_API_BASE}/GetImportShipments`, { method: "POST", body: "{}" });
      const d = await r.json();
      if (d.error) throw new Error(d.error);
      setData(d);
    } catch (err) {
      setError(err.message);
    }
  }
  useEffect(() => {
    load();
  }, []);

  const rows = useMemo(() => {
    if (!data) return [];
    return data.shipments.filter(
      (s) => (supplier === "all" || s.supplier === supplier) && (!onlyMissing || s.missing.length > 0),
    );
  }, [data, supplier, onlyMissing]);
  // Per the user (2026-10-26): the table is divided by destination country.
  const groups = useMemo(() => {
    const by = {};
    rows.forEach((s) => (by[s.destination] = by[s.destination] || []).push(s));
    const rank = (c) => (COUNTRY_ORDER.indexOf(c) === -1 ? 99 : COUNTRY_ORDER.indexOf(c));
    return Object.keys(by)
      .sort((a, b) => rank(a) - rank(b))
      .map((c) => {
        const list = by[c];
        const sum = (k) => list.reduce((t, s) => t + (s.cost[k] || 0), 0);
        return {
          country: c, list, units: list.reduce((t, s) => t + (s.units || 0), 0),
          goods: sum("goods"), freight: sum("freight"), duty: sum("duty"), importVat: sum("importVat"),
          missing: list.filter((s) => s.missing.length > 0).length,
        };
      });
  }, [rows]);
  const missingCount = data ? data.shipments.filter((s) => s.missing.length > 0).length : 0;

  return (
    <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "16px", fontFamily: "sans-serif" }}>
      <div style={{ display: "flex", gap: "8px", alignItems: "center", marginBottom: "12px", flexWrap: "wrap" }}>
        <Link to="/" style={buttonStyle()}>← Home</Link>
        <Link to="/wise" style={buttonStyle()}>Wise</Link>
        <h2 style={{ margin: "0 0 0 8px" }}>Import shipments</h2>
      </div>
      <div style={cardStyle()}>
        <div style={{ fontSize: "13px", color: "#555", marginBottom: "10px" }}>
          Every Malani / Acacia shipment with its supplier invoice, freight and customs documents. EU/UK sea freight goes
          through Unicargo; USA through Amazon Global Logistics (Xhipment invoices, charged in the Amazon settlement).
          Click a row for its documents; upload a missing one right there.
        </div>
        <div style={{ display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap", fontSize: "13px" }}>
          <select value={supplier} onChange={(e) => setSupplier(e.target.value)}>
            <option value="all">All suppliers</option>
            <option value="malani">Malani</option>
            <option value="acacia">Acacia</option>
          </select>
          <label>
            <input type="checkbox" checked={onlyMissing} onChange={(e) => setOnlyMissing(e.target.checked)} /> only with
            missing documents
          </label>
          {data && (
            <span style={{ color: missingCount ? "#b00020" : "#2e7d32" }}>
              {missingCount} of {data.shipments.length} shipments have missing documents
            </span>
          )}
        </div>
      </div>
      {error && <div style={{ color: "#b00020" }}>{error}</div>}
      {!data && !error && <div>Loading…</div>}
      {data && (
        <div style={cardStyle({ overflowX: "auto" })}>
          <table style={{ borderCollapse: "collapse", width: "100%", minWidth: "900px" }}>
            <thead>
              <tr>
                <th style={cell(TH)}>Shipment</th>
                <th style={cell(TH)}>Shipped</th>
                <th style={cell(TH)}>Route</th>
                <th style={num(TH)}>Units</th>
                <th style={num(TH)}>Goods</th>
                <th style={num(TH)}>Freight</th>
                <th style={num(TH)}>Duty</th>
                <th style={num(TH)}>Import VAT</th>
                <th style={num(TH)}>Landed / unit</th>
                <th style={cell(TH)}>Documents</th>
              </tr>
            </thead>
            <tbody>
              {groups.map((g) => (
                <Fragment key={g.country}>
                  <tr style={{ background: "#e8eef7" }}>
                    <td colSpan={3} style={cell({ fontWeight: 700, fontSize: "14px" })}>
                      {FLAG[g.country] || ""} {COUNTRY[g.country] || g.country}
                      <span style={{ fontWeight: 400, color: "#555", fontSize: "12px" }}> · {g.list.length} shipments</span>
                    </td>
                    <td style={num({ fontWeight: 700 })}>{g.units || "–"}</td>
                    <td style={num({ fontWeight: 700 })}>{money(g.goods)}</td>
                    <td style={num({ fontWeight: 700 })}>{money(g.freight)}</td>
                    <td style={num({ fontWeight: 700 })}>{money(g.duty)}</td>
                    <td style={num({ fontWeight: 700 })}>{money(g.importVat)}</td>
                    <td style={num()}></td>
                    <td style={cell({ fontSize: "12px", color: g.missing ? "#b00020" : "#2e7d32" })}>
                      {g.missing ? `${g.missing} with missing docs` : "✓ all complete"}
                    </td>
                  </tr>
              {g.list.map((s) => (
                <Fragment key={s.id}>
                  <tr
                    onClick={() => setOpen((p) => ({ ...p, [s.id]: !p[s.id] }))}
                    style={{ cursor: "pointer", background: s.missing.length ? "#fff8f8" : undefined }}
                  >
                    <td style={cell({ whiteSpace: "nowrap" })}>
                      {open[s.id] ? "▾" : "▸"} {FLAG[s.destination] || ""} <b>{s.code}</b>
                      {s.status && s.status !== "arrived" && <div style={{ color: "#1565c0", fontSize: "12px" }}>{s.status}</div>}
                    </td>
                    <td style={cell({ whiteSpace: "nowrap" })}>{s.shipDate}</td>
                    <td style={cell()}>{s.routeLabel}</td>
                    <td style={num()}>{s.units || "–"}</td>
                    <td style={num()}>{money(s.cost.goods)}</td>
                    <td style={num()}>{money(s.cost.freight)}</td>
                    <td style={num()}>{money(s.cost.duty)}</td>
                    <td style={num()}>{money(s.cost.importVat)}</td>
                    <td style={num()} title="(goods + freight + duty) / units, import VAT excluded (deductible)">
                      {s.landedPerUnit ? `$${s.landedPerUnit.toFixed(2)}` : "–"}
                    </td>
                    <td style={cell({ fontSize: "12px" })}>
                      {s.docs.length} on file
                      {s.missing.length ? (
                        <div style={{ color: "#b00020" }}>{s.missing.length} missing</div>
                      ) : (
                        <div style={{ color: "#2e7d32" }}>✓ complete</div>
                      )}
                    </td>
                  </tr>
                  {open[s.id] && (
                    <tr>
                      <td colSpan={10} style={cell({ background: "#fafafa" })}>
                        <Detail s={s} roles={data.roles} onChanged={load} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {data && data.unassignedAmazonCharges.length > 0 && (
        <div style={cardStyle()}>
          <h3 style={{ marginTop: 0 }}>Amazon Global Logistics charges not matched to a shipment</h3>
          <table style={{ borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={cell(TH)}>Settlement</th>
                <th style={cell(TH)}>Charge</th>
                <th style={num(TH)}>Amount</th>
                <th style={cell(TH)}>Note</th>
              </tr>
            </thead>
            <tbody>
              {data.unassignedAmazonCharges.map((c, i) => (
                <tr key={i}>
                  <td style={cell()}>{c.date}</td>
                  <td style={cell()}>{c.category}</td>
                  <td style={num()}>{money(Math.abs(c.amount))}</td>
                  <td style={cell({ color: "#555" })}>{c.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
