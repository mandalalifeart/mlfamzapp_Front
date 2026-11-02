import { Fragment, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { buttonStyle } from "./buttonStyle";

// FBA fee monitor (2026-11-02, per the user): Amazon's FBA fee preview per
// product per marketplace, compared with the same product type in that
// marketplace. 🔴 fee clearly above the type median (probably measured too
// big/heavy), 🟠 other size tier. Weekly snapshot (UpdateFbaFees, Mondays).
const LOCAL_API_BASE = "https://amzapi.mandalalifeart.com";
const FLAGS = { US: "🇺🇸", CA: "🇨🇦", MX: "🇲🇽", GB: "🇬🇧", DE: "🇩🇪", FR: "🇫🇷", IT: "🇮🇹", ES: "🇪🇸", NL: "🇳🇱", BE: "🇧🇪", IE: "🇮🇪", PL: "🇵🇱", SE: "🇸🇪", AE: "🇦🇪", SA: "🇸🇦" };

const cardStyle = (extra = {}) => ({ background: "#fff", border: "1px solid #ddd", borderRadius: "8px", padding: "16px", marginBottom: "16px", ...extra });
const cell = (extra = {}) => ({ border: "1px solid #ddd", padding: "5px 8px", textAlign: "left", fontSize: "13px", ...extra });
const num = (extra = {}) => cell({ textAlign: "right", whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums", ...extra });
const TH = { background: "#f4f4f4", position: "sticky", top: 0 };
const f2 = (v) => (v == null ? "—" : Number(v).toFixed(2));
const cm = (v) => (v == null ? "—" : Number(v).toFixed(1));

function History({ asin, store }) {
  const [rows, setRows] = useState(null);
  useEffect(() => {
    fetch(`${LOCAL_API_BASE}/GetFbaFeeHistory?asin=${asin}&store=${store}`)
      .then((r) => r.json())
      .then((d) => setRows(d.history || []))
      .catch(() => setRows([]));
  }, [asin, store]);
  if (!rows) return <div style={{ padding: "6px 24px", color: "#777" }}>Loading...</div>;
  return (
    <table style={{ borderCollapse: "collapse", margin: "6px 0 6px 24px" }}>
      <thead>
        <tr>
          <th style={cell(TH)}>Week</th>
          <th style={cell(TH)}>SKU</th>
          <th style={num(TH)}>FBA fee</th>
          <th style={cell(TH)}>Size tier</th>
          <th style={num(TH)}>Sides cm</th>
          <th style={num(TH)}>Weight g</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.week + r.sku}>
            <td style={cell()}>{r.week}</td>
            <td style={cell()}>{r.sku}</td>
            <td style={num()}>{f2(r.fba_fee)} {r.currency}</td>
            <td style={cell()}>{r.size_tier}</td>
            <td style={num()}>{cm(r.longest_cm)} × {cm(r.median_cm)} × {cm(r.shortest_cm)}</td>
            <td style={num()}>{r.weight_g?.toFixed(0)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function FbaFeesPage() {
  const [params, setParams] = useSearchParams();
  const store = params.get("store") || "";
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [onlyFlagged, setOnlyFlagged] = useState(false);
  const [type, setType] = useState("");
  const [open, setOpen] = useState(null);

  useEffect(() => {
    setLoading(true);
    fetch(`${LOCAL_API_BASE}/GetFbaFees${store ? `?store=${store}` : ""}`)
      .then((r) => r.json())
      .then((d) => (d.error ? setError(d.error) : (setData(d), setError(""))))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [store]);

  const rows = (data?.rows || []).filter((r) => (!onlyFlagged || r.level) && (!type || r.type === type));
  const types = [...new Set((data?.rows || []).map((r) => r.type))].sort();
  const cur = data?.rows?.[0]?.currency || "";

  return (
    <div style={{ padding: "20px 16px", fontFamily: "Arial, sans-serif", background: "#fafafa", minHeight: "100vh", color: "#222", textAlign: "left" }}>
      <h2 style={{ textAlign: "center", marginBottom: "4px" }}>FBA fees per marketplace</h2>
      <p style={{ textAlign: "center", fontSize: "13px", color: "#555", marginTop: 0 }}>
        Amazon&apos;s FBA fee preview{data?.week ? ` · week of ${data.week}` : ""}. Each product is compared with the same product type in the same
        marketplace: 🔴 fee clearly higher than the type&apos;s usual fee (Amazon probably measured the package too big or heavy - worth a re-measure case),
        🟠 a different size tier than most of its type.
      </p>

      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", justifyContent: "center", marginBottom: "12px" }}>
        {(data?.stores || []).map((s) => (
          <button
            key={s}
            onClick={() => {
              setParams({ store: s });
              setOpen(null);
            }}
            style={{
              padding: "5px 10px", borderRadius: "14px", border: "1px solid #ccc", cursor: "pointer", fontSize: "13px",
              background: data.store === s ? "#1f5fbf" : "#fff", color: data.store === s ? "#fff" : "#333",
            }}
          >
            {FLAGS[s] || ""} {s}
            {data.counts?.[s]?.red ? <span style={{ marginLeft: 4 }}>🔴{data.counts[s].red}</span> : null}
            {data.counts?.[s]?.orange ? <span style={{ marginLeft: 4 }}>🟠{data.counts[s].orange}</span> : null}
          </button>
        ))}
      </div>

      {error && <div style={{ color: "#b00020", textAlign: "center" }}>{error}</div>}
      {loading && <p style={{ textAlign: "center" }}>Loading...</p>}

      {!loading && data && (
        <>
          {data.changes?.length > 0 && (
            <div style={cardStyle({ background: "#fff8e6", borderColor: "#f0d48a" })}>
              <strong>Changes vs last week ({data.changes.length})</strong>
              {data.changes.map((c) => (
                <div key={c.sku} style={{ fontSize: "13px" }}>
                  {c.up ? "🔴" : "🟢"} {c.sku}: {c.why.join("; ")}
                </div>
              ))}
            </div>
          )}

          <div style={cardStyle()}>
            <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", alignItems: "center", marginBottom: "8px", fontSize: "13px" }}>
              <label>
                <input type="checkbox" checked={onlyFlagged} onChange={(e) => setOnlyFlagged(e.target.checked)} /> only 🔴/🟠
              </label>
              <label>
                Type{" "}
                <select value={type} onChange={(e) => setType(e.target.value)}>
                  <option value="">all</option>
                  {types.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </label>
              <span style={{ color: "#666" }}>{rows.length} products · fees in {cur} · click a row for its fee history</span>
            </div>
            <div style={{ overflowX: "auto", maxHeight: "75vh" }}>
              <table style={{ borderCollapse: "collapse", width: "100%", minWidth: "1100px" }}>
                <thead>
                  <tr>
                    <th style={cell(TH)}></th>
                    <th style={cell(TH)}>Product</th>
                    <th style={cell(TH)}>Type</th>
                    <th style={num(TH)}>Price</th>
                    <th style={num(TH)}>FBA fee</th>
                    <th style={num(TH)} title="Median FBA fee of this product type in this marketplace">Type fee</th>
                    <th style={cell(TH)}>Size tier</th>
                    <th style={num(TH)}>Sides cm</th>
                    <th style={num(TH)} title="Typical (median) sides of this type">Type sides</th>
                    <th style={num(TH)}>Weight g</th>
                    <th style={num(TH)}>Type weight</th>
                    <th style={num(TH)} title="Units sold in this marketplace, last 12 months">Units 12m</th>
                    <th style={num(TH)} title="(fee - type fee) × units 12m">Extra / year</th>
                    <th style={cell(TH)}>Why flagged</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <Fragment key={r.asin}>
                      <tr
                        onClick={() => setOpen(open === r.asin ? null : r.asin)}
                        style={{ cursor: "pointer", background: r.level === "red" ? "#fdecea" : r.level === "orange" ? "#fff6e5" : undefined }}
                      >
                        <td style={cell()}>{r.level === "red" ? "🔴" : r.level === "orange" ? "🟠" : ""}</td>
                        <td style={cell({ fontWeight: 600 })}>
                          <Link to={`/product?sku=${encodeURIComponent(r.mainSku)}`} onClick={(e) => e.stopPropagation()} style={{ color: "inherit" }}>
                            {r.mainSku}
                          </Link>
                          <div style={{ fontSize: "11px", color: "#888", fontWeight: 400 }}>{r.asin}</div>
                        </td>
                        <td style={cell()}>{r.type}</td>
                        <td style={num()}>{f2(r.price)}</td>
                        <td style={num({ fontWeight: 700, color: r.level === "red" ? "#b03a2e" : undefined })}>{f2(r.fba_fee)}</td>
                        <td style={num({ color: "#666" })}>{f2(r.typeFee)}</td>
                        <td style={cell({ fontSize: "12px" })}>
                          {r.size_tier}
                          {r.size_tier !== r.typeTier && <div style={{ color: "#888" }}>type: {r.typeTier}</div>}
                        </td>
                        <td style={num()}>{cm(r.longest_cm)} × {cm(r.median_cm)} × {cm(r.shortest_cm)}</td>
                        <td style={num({ color: "#666" })}>{(r.typeSides || []).map(cm).join(" × ")}</td>
                        <td style={num()}>{r.weight_g?.toFixed(0)}</td>
                        <td style={num({ color: "#666" })}>{r.typeWeight?.toFixed(0)}</td>
                        <td style={num()}>{r.units12m || "—"}</td>
                        <td style={num({ fontWeight: r.extraPerYear ? 700 : 400 })}>{r.extraPerYear ? r.extraPerYear.toFixed(0) : "—"}</td>
                        <td style={cell({ fontSize: "12px" })}>{r.flags?.join("; ")}</td>
                      </tr>
                      {open === r.asin && (
                        <tr>
                          <td colSpan={14} style={{ padding: 0 }}>
                            <History asin={r.asin} store={data.store} />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ fontSize: "11px", color: "#888", marginTop: "6px" }}>
              Type = pareo / pareo set / pouf cover / pillow cover / stuffed pouf / outdoor cover / cube cover / stool (types with ≥ 3 products).
              🔴 = fee &gt; type median × 1.15 and ≥ 0.30 more per unit; the size/weight outliers next to it show what Amazon measured differently.
              Fee = fulfilment fee per unit (EU: domestic fulfilment fee for that store).
            </div>
          </div>
        </>
      )}

      <div style={{ display: "flex", justifyContent: "center", gap: "10px", padding: "16px 0" }}>
        <Link style={buttonStyle()} to="/">Home</Link>
        <Link style={buttonStyle()} to="/fba-shipments">FBA Shipments</Link>
      </div>
    </div>
  );
}
