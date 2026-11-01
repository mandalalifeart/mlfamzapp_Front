import { Fragment, useEffect, useState } from "react";

// Product cost + profit per unit (GetProductCost, per the user 2026-11-01):
// landed cost from the latest Malani/Acacia invoice + $1 shipping + 10% import
// tax on both; per marketplace Amazon fees and ad cost from the product's own
// TACOS and from its department's (pareo vs home decor) TACOS.
const API_BASE = "https://amzapi.mandalalifeart.com";
const SYM = { USD: "$", EUR: "€", GBP: "£" };

const money = (v, cur = "USD") => (v == null ? "—" : `${SYM[cur] || ""}${Number(v).toFixed(2)}`);
const pct = (v) => (v == null ? "—" : `${Number(v).toFixed(1)}%`);
const profitColor = (v) => (v == null ? "#555" : v < 0 ? "#b03a2e" : v < 3 ? "#b9770e" : "#1e8449");

function PriceScenarios({ sku, mp }) {
  const [result, setResult] = useState(null);

  useEffect(() => {
    fetch(`${API_BASE}/GetProductCostScenarios?sku=${encodeURIComponent(sku)}&mp=${mp}`)
      .then((r) => r.json())
      .then((d) => setResult(d))
      .catch((e) => setResult({ error: e.message }));
  }, [sku, mp]);

  if (!result) return <div style={{ color: "#777", padding: "8px" }}>Asking Amazon for fees at each price...</div>;
  if (result.error) return <div style={{ color: "#b00020", padding: "8px" }}>{result.error}</div>;
  const cur = result.currency;
  const th = { padding: "4px 8px", textAlign: "right", whiteSpace: "nowrap", background: "#eef3fb", fontSize: "12px" };
  const td = { padding: "4px 8px", textAlign: "right", borderTop: "1px solid #e3e9f3", whiteSpace: "nowrap" };
  return (
    <div style={{ padding: "8px 8px 12px", background: "#f7f9fd" }}>
      <table style={{ borderCollapse: "collapse", width: "100%", fontSize: "13px" }}>
        <thead>
          <tr>
            <th style={{ ...th, textAlign: "left" }}>{mp} price</th>
            <th style={th}>VAT</th>
            <th style={th}>Referral</th>
            <th style={th}>FBA fee</th>
            <th style={th}>Landed cost</th>
            <th style={th}>Profit before ads</th>
            <th style={{ ...th, borderLeft: "2px solid #d5deec" }}>Ad cost ({pct(result.productTacosPct)} now)</th>
            <th style={th}>Profit</th>
            <th style={th}>Margin</th>
            <th style={{ ...th, borderLeft: "2px solid #d5deec" }}>Dept ad cost ({pct(result.deptTacosPct)} now)</th>
            <th style={th}>Profit</th>
            <th style={th}>Margin</th>
          </tr>
        </thead>
        <tbody>
          {result.rows.map((r) => {
            const now = r.step === 0;
            const p = r.productTacos || {};
            const d = r.deptTacos || {};
            return (
              <tr key={r.step} style={{ fontWeight: now ? 700 : 400, background: now ? "#e6eefb" : undefined }}>
                <td style={{ ...td, textAlign: "left" }}>
                  {money(r.price, cur)} <span style={{ color: "#777", fontWeight: 400 }}>{now ? "(current)" : `${r.step > 0 ? "+" : ""}${r.step}%`}</span>
                </td>
                <td style={td}>{r.vat ? money(r.vat, cur) : "—"}</td>
                <td style={td} title={r.feesError || ""}>{r.feesError ? "?" : money(r.referral, cur)}</td>
                <td style={td}>{r.feesError ? "?" : money(r.fba, cur)}</td>
                <td style={td}>{money(result.landed, cur)}</td>
                <td style={{ ...td, color: profitColor(r.profitBeforeAds) }}>{money(r.profitBeforeAds, cur)}</td>
                <td style={{ ...td, borderLeft: "2px solid #d5deec" }}>{money(p.adCost, cur)}</td>
                <td style={{ ...td, fontWeight: 700, color: profitColor(p.profit) }}>{money(p.profit, cur)}</td>
                <td style={td}>{pct(p.margin)}</td>
                <td style={{ ...td, borderLeft: "2px solid #d5deec" }}>{money(d.adCost, cur)}</td>
                <td style={{ ...td, fontWeight: 700, color: profitColor(d.profit) }}>{money(d.profit, cur)}</td>
                <td style={td}>{pct(d.margin)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div style={{ fontSize: "11px", color: "#888", marginTop: "4px" }}>
        Fees re-estimated by Amazon at each price. Ad cost per unit is kept at today&apos;s level - how many units sell at another price isn&apos;t known.
      </div>
    </div>
  );
}

function PeriodTotals({ sku, asin }) {
  const [period, setPeriod] = useState("last_3m");
  const [result, setResult] = useState({ period: null });

  useEffect(() => {
    if (!sku && !asin) return;
    const q = sku ? `sku=${encodeURIComponent(sku)}` : `asin=${encodeURIComponent(asin)}`;
    fetch(`${API_BASE}/GetProductCostPeriod?${q}&period=${period}`)
      .then((r) => r.json())
      .then((d) => setResult({ period, data: d.error ? null : d, error: d.error || "" }))
      .catch((e) => setResult({ period, data: null, error: e.message }));
  }, [sku, asin, period]);
  const current = result.period === period;
  const data = current ? result.data : null;
  const error = current ? result.error : "";

  const th = { padding: "5px 8px", textAlign: "right", whiteSpace: "nowrap", background: "#f3f3f3" };
  const td = { padding: "5px 8px", textAlign: "right", borderTop: "1px solid #eee", whiteSpace: "nowrap" };
  const periods = data?.periods || { last_month: "Last month", last_3m: "Last 3 months", ytd: "This year", last_12m: "Last 12 months", last_year: "Last year" };
  const cols = [
    ["units", "Units", (v) => v],
    ["refunded", "Refunded", (v) => v || "—"],
    ["sales", "Sales", money],
    ["vat", "VAT", money],
    ["netSales", "Net sales", money],
    ["fees", "Amazon fees", money],
    ["productCost", "Product cost", money],
    ["ads", "Ads", money],
    ["tacos", "TACOS", pct],
  ];
  const row = (r, bold) => (
    <tr key={r.mp} style={{ fontWeight: bold ? 700 : 400, background: bold ? "#fafafa" : undefined }}>
      <td style={{ ...td, textAlign: "left", fontWeight: 700 }}>{r.mp}</td>
      {cols.map(([k, , f]) => <td key={k} style={td}>{f(r[k])}</td>)}
      <td style={{ ...td, fontWeight: 700, color: profitColor(r.profit) }}>{money(r.profit)}</td>
      <td style={td}>{pct(r.margin)}</td>
      <td style={td}>{money(r.profitPerUnit)}</td>
      <td style={{ ...td, borderLeft: "2px solid #ddd" }}>{bold ? "" : pct(r.deptTacos)}</td>
      <td style={{ ...td, color: profitColor(r.deptProfit) }}>{money(r.deptProfit)}</td>
    </tr>
  );

  return (
    <div style={{ marginTop: "18px" }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", alignItems: "center", marginBottom: "8px" }}>
        <h4 style={{ margin: 0, flex: "1 1 auto" }}>
          Totals per period (USD){data?.months?.length ? ` · ${data.months[0]} – ${data.months.at(-1)}` : ""}
        </h4>
        {Object.entries(periods).map(([k, label]) => (
          <button
            key={k}
            onClick={() => setPeriod(k)}
            style={{
              padding: "3px 10px", borderRadius: "12px", border: "1px solid #ccc", cursor: "pointer", fontSize: "12px",
              background: period === k ? "#1f5fbf" : "#fff", color: period === k ? "#fff" : "#333",
            }}
          >
            {label}
          </button>
        ))}
      </div>
      {error && <div style={{ color: "#b00020" }}>{error}</div>}
      {!error && !data && <div style={{ color: "#777" }}>Loading...</div>}
      {data && !data.rows.length && <div style={{ color: "#777" }}>No sales in this period.</div>}
      {data?.rows?.length > 0 && (
        <div style={{ overflowX: "auto" }}>
          <table style={{ borderCollapse: "collapse", width: "100%", fontSize: "13px" }}>
            <thead>
              <tr>
                <th style={{ ...th, textAlign: "left" }}></th>
                {cols.map(([k, label]) => <th key={k} style={th}>{label}</th>)}
                <th style={th}>Profit</th>
                <th style={th}>Margin</th>
                <th style={th}>Profit/unit</th>
                <th style={{ ...th, borderLeft: "2px solid #ddd" }}>Dept TACOS</th>
                <th style={th} title="Profit if ad spend were at the department TACOS">Profit at dept TACOS</th>
              </tr>
            </thead>
            <tbody>
              {data.total && row(data.total, true)}
              {data.rows.map((r) => row(r, false))}
            </tbody>
          </table>
        </div>
      )}
      <div style={{ fontSize: "11px", color: "#888", marginTop: "4px" }}>
        All amounts in USD at today&apos;s rate. Fees = today&apos;s referral % × sales + FBA fee × units (CA/MX use US fees, other EU use DE).
        Product cost = units × landed cost. Ads = this product&apos;s real SP+SD spend. Refunded units shown but not subtracted.
      </div>
    </div>
  );
}

export default function ProductCostCard({ sku, asin, cardStyle }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const [openMp, setOpenMp] = useState(null);

  useEffect(() => {
    if (!sku && !asin) return;
    const q = sku ? `sku=${encodeURIComponent(sku)}` : `asin=${encodeURIComponent(asin)}`;
    fetch(`${API_BASE}/GetProductCost?${q}`)
      .then((r) => r.json())
      .then((d) => (d.error ? setError(d.error) : setData(d)))
      .catch((e) => setError(e.message));
  }, [sku, asin]);

  const th = { padding: "5px 8px", textAlign: "right", whiteSpace: "nowrap", background: "#f3f3f3" };
  const td = { padding: "5px 8px", textAlign: "right", borderTop: "1px solid #eee", whiteSpace: "nowrap" };
  const c = data?.cost || {};

  return (
    <div style={cardStyle}>
      <h3 style={{ marginTop: 0 }}>Product Cost &amp; Profit</h3>
      {error && <div style={{ color: "#b00020" }}>{error}</div>}
      {!error && !data && <div style={{ color: "#777" }}>Loading...</div>}
      {data && (
        <>
          {c.landed == null ? (
            <div style={{ color: "#b9770e" }}>No Malani/Acacia invoice line found for EAN {data.ean || "—"}.</div>
          ) : (
            <div style={{ display: "flex", flexWrap: "wrap", gap: "24px", alignItems: "flex-start" }}>
              <table style={{ borderCollapse: "collapse", fontSize: "14px" }}>
                <tbody>
                  <tr>
                    <td style={{ padding: "3px 12px 3px 0" }}>
                      Purchase price{" "}
                      <span style={{ color: "#777", fontSize: "12px" }}>
                        ({c.supplier === "malani" ? "Malani" : "Acacia"} {c.invoice}, {c.invoiceDate}, code {c.supplierCode})
                      </span>
                    </td>
                    <td style={{ textAlign: "right" }}>{money(c.purchase)}</td>
                  </tr>
                  <tr>
                    <td style={{ padding: "3px 12px 3px 0" }}>Shipping <span style={{ color: "#777", fontSize: "12px" }}>(assumed)</span></td>
                    <td style={{ textAlign: "right" }}>{money(c.shipping)}</td>
                  </tr>
                  <tr>
                    <td style={{ padding: "3px 12px 3px 0" }}>
                      Import tax <span style={{ color: "#777", fontSize: "12px" }}>({data.assumptions.importTaxPct}% of purchase + shipping)</span>
                    </td>
                    <td style={{ textAlign: "right" }}>{money(c.importTax)}</td>
                  </tr>
                  <tr style={{ fontWeight: 700, borderTop: "2px solid #ccc" }}>
                    <td style={{ padding: "5px 12px 3px 0" }}>Landed cost per unit</td>
                    <td style={{ textAlign: "right", paddingTop: "5px" }}>{money(c.landed)}</td>
                  </tr>
                </tbody>
              </table>
              <div style={{ fontSize: "13px", color: "#555" }}>
                <div>12-month average purchase price (qty-weighted): <b>{money(c.avg12m)}</b></div>
                <button
                  onClick={() => setShowHistory((v) => !v)}
                  style={{ marginTop: "6px", fontSize: "12px", padding: "2px 10px", cursor: "pointer" }}
                >
                  {showHistory ? "Hide" : "Show"} invoice history ({c.history?.length || 0})
                </button>
                {showHistory && (
                  <table style={{ borderCollapse: "collapse", marginTop: "6px", fontSize: "12px" }}>
                    <thead>
                      <tr>{["Date", "Invoice", "Qty", "Unit $"].map((h) => <th key={h} style={th}>{h}</th>)}</tr>
                    </thead>
                    <tbody>
                      {[...(c.history || [])].reverse().map((h, i) => (
                        <tr key={i} style={{ color: h.cif ? "#999" : undefined }} title={h.cif ? "CIF invoice (freight inside) - not used" : ""}>
                          <td style={td}>{h.date}</td>
                          <td style={td}>{h.invoice}{h.cif ? " (CIF)" : ""}</td>
                          <td style={td}>{h.qty}</td>
                          <td style={td}>{money(h.price)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}

          {data.markets?.length > 0 && (
            <div style={{ overflowX: "auto", marginTop: "14px" }}>
              <table style={{ borderCollapse: "collapse", width: "100%", fontSize: "13px" }}>
                <thead>
                  <tr>
                    <th style={{ ...th, textAlign: "left" }}></th>
                    <th style={th}>Price</th>
                    <th style={th}>VAT</th>
                    <th style={th}>Referral</th>
                    <th style={th}>FBA fee</th>
                    <th style={th}>Landed cost</th>
                    <th style={th} title="Net price - fees - landed cost">Profit before ads</th>
                    <th style={{ ...th, borderLeft: "2px solid #ddd" }} title="SP+SD ad spend on this product / its sales">Product TACOS</th>
                    <th style={th}>Ad cost</th>
                    <th style={th}>Profit</th>
                    <th style={th}>Margin</th>
                    <th style={{ ...th, borderLeft: "2px solid #ddd" }} title={`All ${data.department === "pareo" ? "pareo" : "home decor"} ad spend (incl. SB) / all its sales`}>
                      {data.department === "pareo" ? "Pareo" : "Home decor"} TACOS
                    </th>
                    <th style={th}>Ad cost</th>
                    <th style={th}>Profit</th>
                    <th style={th}>Margin</th>
                  </tr>
                </thead>
                <tbody>
                  {data.markets.map((m) => {
                    const cur = m.currency;
                    const p = m.productTacos;
                    const d = m.deptTacos;
                    return (
                      <Fragment key={m.mp}>
                      <tr style={{ background: openMp === m.mp ? "#e6eefb" : undefined }}>
                        <td style={{ ...td, textAlign: "left", fontWeight: 700 }}>{m.mp}</td>
                        <td
                          style={{ ...td, cursor: "pointer", color: "#1f5fbf", textDecoration: "underline dotted" }}
                          title="Show profit at -20% / -10% / +10% / +20%"
                          onClick={() => setOpenMp((v) => (v === m.mp ? null : m.mp))}
                        >
                          {money(m.price, cur)} {openMp === m.mp ? "▴" : "▾"}
                        </td>
                        <td style={td}>{m.vat ? money(m.vat, cur) : "—"}</td>
                        <td style={td} title={m.feesError || ""}>{m.feesError ? "?" : money(m.referral, cur)}</td>
                        <td style={td}>{m.feesError ? "?" : money(m.fba, cur)}</td>
                        <td style={td} title={cur !== "USD" ? `$${c.landed} at ${m.fx} ${cur}/USD` : ""}>{money(m.landed, cur)}</td>
                        <td style={{ ...td, fontWeight: 600, color: profitColor(m.profitBeforeAds) }}>{money(m.profitBeforeAds, cur)}</td>
                        <td style={{ ...td, borderLeft: "2px solid #ddd" }} title={`spend ${money(p.spend, cur)} / sales ${money(p.sales, cur)}`}>
                          {p.spend ? pct(p.pct) : "no ads"}
                        </td>
                        <td style={td}>{money(p.adCost, cur)}</td>
                        <td style={{ ...td, fontWeight: 700, color: profitColor(p.profit) }}>{money(p.profit, cur)}</td>
                        <td style={td}>{pct(p.margin)}</td>
                        <td style={{ ...td, borderLeft: "2px solid #ddd" }} title={`spend ${money(d.spend, cur)} / sales ${money(d.sales, cur)}`}>{pct(d.pct)}</td>
                        <td style={td}>{money(d.adCost, cur)}</td>
                        <td style={{ ...td, fontWeight: 700, color: profitColor(d.profit) }}>{money(d.profit, cur)}</td>
                        <td style={td}>{pct(d.margin)}</td>
                      </tr>
                      {openMp === m.mp && (
                        <tr>
                          <td colSpan={15} style={{ padding: 0 }}>
                            <PriceScenarios sku={data.sku} mp={m.mp} />
                          </td>
                        </tr>
                      )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <PeriodTotals sku={sku} asin={asin} />
          <div style={{ fontSize: "11px", color: "#888", marginTop: "6px" }}>
            Per-unit table above: at the current price. Profit = price without VAT − referral − FBA fee − landed cost − ad cost (TACOS × price).
            TACOS over {data.months?.[0]} – {data.months?.at(-1)}. Product TACOS has no SB spend (not split per product); the department
            TACOS includes it. Fees are Amazon&apos;s estimate. No returns, storage or coupon costs.
          </div>
        </>
      )}
    </div>
  );
}
