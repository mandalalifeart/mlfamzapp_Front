import { Fragment, useEffect, useMemo, useState } from "react";
import CollapsibleSection from "./CollapsibleSection";

// Coupons & Promotions (added 2026-10-21, per the user). Two views:
// - ReportPromotions: parsed client-side from the already-loaded orders
//   report payloads on /report-view (every <OrderItem> carries <Promotion>
//   with the promotion ids + ItemPromotionDiscount).
// - SalesPromotionsCard: stored history from GetPromotionSales (written by
//   UpdateSkuSalesMonth into promo_sales_monthly) on /sales.
// Coupons are "PLM-<uuid>" ids; readable names come from promotion_names.

const LOCAL_API_BASE = "https://amzapi.mandalalifeart.com";

const CURRENCY_SYMBOL = { USD: "$", EUR: "€", GBP: "£", CAD: "CA$", MXN: "MX$", SEK: "SEK ", PLN: "PLN ", AUD: "A$", JPY: "¥" };
const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function money(amount, currency) {
  const sym = CURRENCY_SYMBOL[currency] ?? `${currency} `;
  return `${sym}${Number(amount || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function kindOf(id) {
  return id.toUpperCase().startsWith("PLM-") ? "coupon" : "promotion";
}

function KindBadge({ kind }) {
  const isCoupon = kind === "coupon";
  return (
    <span
      style={{
        fontSize: 11,
        padding: "1px 6px",
        borderRadius: 8,
        marginRight: 6,
        background: isCoupon ? "#fff3e0" : "#e3f2fd",
        color: isCoupon ? "#e65100" : "#0d47a1",
        whiteSpace: "nowrap",
      }}
    >
      {isCoupon ? "Coupon" : "Promotion"}
    </span>
  );
}

const th = { textAlign: "left", padding: "6px 8px", borderBottom: "1px solid #ddd", fontSize: 13, whiteSpace: "nowrap" };
const td = { padding: "6px 8px", borderBottom: "1px solid #f0f0f0", fontSize: 13, verticalAlign: "top" };
const tdNum = { ...td, textAlign: "right", whiteSpace: "nowrap" };

// Short description of a coupon/promotion (per the user 2026-10-24: show this
// instead of the long name on /report-view): "Coupon -15% · Pareo",
// "Promo buy 3 -10% / buy 5 -15% · Pareo". Built from the id/name (B3-10,
// "buy 2 save 10%", "Save 15%"), else the real average discount; category
// from the name, else from the SKUs sold with it.
export function promoShortLabel(id, names, { pct, skus } = {}) {
  const rec = names?.[id] || {};
  const kind = rec.kind || kindOf(id);
  const text = `${id} ${rec.name || ""}`;
  const low = text.toLowerCase();
  let cat = low.includes("pareo") ? "Pareo" : low.includes("home decor") || low.includes("pouf") ? "Home decor" : "";
  if (!cat && skus) {
    const list = Object.keys(skus);
    const pareo = list.filter((k) => k.toLowerCase().includes("pareo")).length;
    cat = list.length ? (pareo * 2 >= list.length ? "Pareo" : "Home decor") : "";
  }
  let tiers = [...text.matchAll(/\bB(\d+)-(\d+)\b/g)].map((m) => `buy ${m[1]} -${m[2]}%`);
  if (!tiers.length) tiers = [...text.matchAll(/buy (\d+) save (\d+)%/gi)].map((m) => `buy ${m[1]} -${m[2]}%`);
  if (!tiers.length) tiers = [...new Set([...text.matchAll(/buy (\d+) -(\d+)%/gi)].map((m) => `buy ${m[1]} -${m[2]}%`))];
  const save = text.match(/save (\d+)%/i);
  const off = tiers.length ? tiers.join(" / ") : save ? `-${save[1]}%` : pct ? `-${Math.round(pct)}%` : "";
  return [kind === "coupon" ? `Coupon ${off}` : `Promo ${off}`, cat].filter((x) => x && x.trim()).join(" · ").replace(/\s+/g, " ").trim();
}

// Shared fetch of promotion_names (id -> {name, kind, note}).
export function usePromotionNames() {
  const [names, setNames] = useState({});
  useEffect(() => {
    fetch(`${LOCAL_API_BASE}/GetPromotionNames`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" })
      .then((r) => r.json())
      .then((d) => setNames(d.names || {}))
      .catch(() => setNames({}));
  }, []);
  return names;
}

const SALES_CHANNEL_CURRENCY = {
  "amazon.com": "USD", "amazon.ca": "CAD", "amazon.com.mx": "MXN", "amazon.co.uk": "GBP",
  "amazon.de": "EUR", "amazon.fr": "EUR", "amazon.it": "EUR", "amazon.es": "EUR", "amazon.nl": "EUR",
  "amazon.com.be": "EUR", "amazon.ie": "EUR", "amazon.se": "SEK", "amazon.pl": "PLN", "amazon.com.au": "AUD",
};

// One row per (promotion id, currency) from an orders-report XML payload.
// includeChannel(salesChannelLowercase) decides which orders count.
const CHANNEL_COUNTRY = {
  "amazon.com": "US", "amazon.ca": "CA", "amazon.com.mx": "MX", "amazon.co.uk": "UK", "amazon.de": "DE",
  "amazon.fr": "FR", "amazon.it": "IT", "amazon.es": "ES", "amazon.nl": "NL", "amazon.com.be": "BE",
  "amazon.ie": "IE", "amazon.se": "SE", "amazon.pl": "PL", "amazon.com.au": "AU",
};

export function extractPromotionsFromXmlPayload(payload, includeChannel) {
  const result = { rows: [], totalItems: 0, promoItems: 0 };
  if (!payload || typeof payload !== "string" || !payload.includes("<Order")) return result;
  const xml = new DOMParser().parseFromString(payload, "application/xml");
  const map = new Map();
  for (const order of Array.from(xml.getElementsByTagName("Order"))) {
    const channel = (order.getElementsByTagName("SalesChannel")[0]?.textContent || "").trim().toLowerCase();
    if (!channel || channel.includes("non-amazon") || !includeChannel(channel)) continue;
    const orderId = order.getElementsByTagName("AmazonOrderID")[0]?.textContent?.trim() || "";
    for (const item of Array.from(order.getElementsByTagName("OrderItem"))) {
      const qty = parseInt(item.getElementsByTagName("Quantity")[0]?.textContent || "0", 10) || 0;
      if (qty <= 0) continue;
      result.totalItems += qty;
      let principal = 0;
      let currency = SALES_CHANNEL_CURRENCY[channel] || "";
      for (const comp of Array.from(item.getElementsByTagName("Component"))) {
        if ((comp.getElementsByTagName("Type")[0]?.textContent || "").trim() !== "Principal") continue;
        const amt = comp.getElementsByTagName("Amount")[0];
        principal += parseFloat(amt?.textContent || "0") || 0;
        currency = amt?.getAttribute("currency") || currency;
      }
      const sku = item.getElementsByTagName("SKU")[0]?.textContent?.trim() || "";
      let itemHasPromo = false;
      for (const promo of Array.from(item.getElementsByTagName("Promotion"))) {
        const ids = (promo.getElementsByTagName("PromotionIDs")[0]?.textContent || "")
          .split(",").map((s) => s.trim()).filter(Boolean);
        const discount = Math.abs(parseFloat(promo.getElementsByTagName("ItemPromotionDiscount")[0]?.textContent || "0") || 0);
        if (!ids.length || discount <= 0) continue;
        itemHasPromo = true;
        for (const id of ids) {
          const country = CHANNEL_COUNTRY[channel] || channel.replace(/^amazon\./, "").toUpperCase();
          const key = `${id}|${country}|${currency}`;
          if (!map.has(key)) {
            map.set(key, { id, country, currency, kind: kindOf(id), orders: new Set(), units: 0, sales: 0, discount: 0, skus: {} });
          }
          const r = map.get(key);
          r.orders.add(orderId);
          r.units += qty;
          r.sales += principal / ids.length;
          r.discount += discount / ids.length;
          r.skus[sku] = (r.skus[sku] || 0) + qty;
        }
      }
      if (itemHasPromo) result.promoItems += qty;
    }
  }
  result.rows = Array.from(map.values())
    .map((r) => ({ ...r, orderIds: Array.from(r.orders), orders: r.orders.size }))
    .sort((a, b) => b.units - a.units);
  return result;
}

function PromoTable({ rows, names, short }) {
  const [open, setOpen] = useState({});
  if (!rows.length) return <div style={{ color: "#777", fontSize: 13 }}>No coupons or promotions used.</div>;
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ borderCollapse: "collapse", width: "100%" }}>
        <thead>
          <tr>
            <th style={th}>Coupon / promotion</th>
            {short && <th style={th}>Country</th>}
            <th style={{ ...th, textAlign: "right" }}>Orders</th>
            <th style={{ ...th, textAlign: "right" }}>Units</th>
            <th style={{ ...th, textAlign: "right" }}>Sales after discount</th>
            <th style={{ ...th, textAlign: "right" }}>Discount</th>
            <th style={{ ...th, textAlign: "right" }}>Avg %</th>
            {short && <th style={th}>Order ID</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const key = `${r.id}|${r.country || ""}|${r.currency}`;
            const fullName = names[r.id]?.name || r.name || r.id;
            const name = short ? promoShortLabel(r.id, names, { pct: r.sales ? (100 * r.discount) / r.sales : 0, skus: r.skus }) : fullName;
            const skus = r.products
              ? r.products.map((p) => [p.sku || p.asin, p.units])
              : Object.entries(r.skus || {}).sort((a, b) => b[1] - a[1]);
            return (
              <Fragment key={key}>
                <tr style={{ cursor: "pointer" }} onClick={() => setOpen((o) => ({ ...o, [key]: !o[key] }))}>
                  <td style={td} title={short ? `${fullName}${names[r.id]?.note ? ` (${names[r.id].note})` : ""}\nid: ${r.id}` : undefined}>
                    <KindBadge kind={names[r.id]?.kind || r.kind} />
                    {name} <span style={{ color: "#999", fontSize: 11 }}>{open[key] ? "▲" : "▼"}</span>
                    {r.firstMonth && (
                      <div style={{ color: "#888", fontSize: 11 }}>
                        {r.firstMonth === r.lastMonth ? r.firstMonth : `${r.firstMonth} – ${r.lastMonth}`}
                        {r.marketplaces ? ` · ${r.marketplaces.join(", ").toUpperCase()}` : ""}
                      </div>
                    )}
                  </td>
                  {short && <td style={{ ...td, whiteSpace: "nowrap" }}>{r.country}</td>}
                  <td style={tdNum}>{r.orders}</td>
                  <td style={tdNum}>{r.units}</td>
                  <td style={tdNum}>{money(r.sales - r.discount, r.currency)}</td>
                  <td style={tdNum}>{money(r.discount, r.currency)}</td>
                  <td style={tdNum}>{r.sales ? `${((r.discount / r.sales) * 100).toFixed(1)}%` : "–"}</td>
                  {short && (
                    <td style={{ ...td, fontSize: 11, fontFamily: "monospace", whiteSpace: "nowrap" }}>
                      {(r.orderIds || []).map((o) => <div key={o}>{o}</div>)}
                    </td>
                  )}
                </tr>
                {open[key] && (
                  <tr>
                    <td colSpan={short ? 8 : 6} style={{ ...td, background: "#fafafa", fontSize: 12, color: "#444" }}>
                      {skus.map(([sku, units]) => (
                        <span key={sku} style={{ display: "inline-block", marginRight: 12 }}>
                          {sku} <b>{units}</b>
                        </span>
                      ))}
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

// /report-view: one block per region, from the loaded report payloads.
export function ReportPromotions({ usaPayload, dePayload, selectedMarketplace }) {
  const names = usePromotionNames();
  const sel = (selectedMarketplace || "").toLowerCase();
  const regions = useMemo(() => {
    const pick = (fn) => (ch) => (sel ? ch === sel : fn(ch));
    return [
      { title: "USA", data: extractPromotionsFromXmlPayload(usaPayload, pick(() => true)) },
      { title: "EU", data: extractPromotionsFromXmlPayload(dePayload, pick((ch) => ch !== "amazon.co.uk")) },
      { title: "UK", data: extractPromotionsFromXmlPayload(dePayload, (ch) => ch === "amazon.co.uk") },
    ];
  }, [usaPayload, dePayload, sel]);

  return (
    <CollapsibleSection title="Coupons & Promotions used in this report" defaultOpen={true}>
      {regions.map(({ title, data }) => (
        <div key={title} style={{ marginTop: 12 }}>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>
            {title}
            <span style={{ fontWeight: 400, color: "#666", fontSize: 13 }}>
              {" "}· {data.promoItems} of {data.totalItems} items with a coupon/promotion
              {data.totalItems ? ` (${Math.round((data.promoItems / data.totalItems) * 100)}%)` : ""}
            </span>
          </div>
          <PromoTable rows={data.rows} names={names} short />
        </div>
      ))}
      <div style={{ color: "#888", fontSize: 11, marginTop: 8 }}>
        Click a row for its products, hover the description for the full name. Orders with a coupon/promotion are marked 🏷 in the Last Orders lists. Sales after discount = item price minus the coupon/promotion discount.
      </div>
    </CollapsibleSection>
  );
}

// /sales: monthly history + per-promotion totals for the selected marketplaces.
export function SalesPromotionsCard({ marketplaces }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showAllMonths, setShowAllMonths] = useState(false);
  const key = JSON.stringify(marketplaces || []);

  useEffect(() => {
    setLoading(true);
    setError("");
    fetch(`${LOCAL_API_BASE}/GetPromotionSales`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ marketplaces }),
    })
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d?.error || `HTTP ${r.status}`);
        setData(d);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const cur = data?.currency || "USD";
  const months = data?.monthly || [];
  const shownMonths = showAllMonths ? months : months.slice(0, 12);
  const promos = (data?.promotions || []).map((p) => ({ ...p, currency: cur }));

  return (
    <div style={{ maxWidth: "1400px", marginInline: "auto" }}>
      <CollapsibleSection title="Coupons & Promotions" defaultOpen={false}>
        {loading && <div>Loading…</div>}
        {error && <div style={{ color: "red" }}>{error}</div>}
        {!loading && !error && data && (
          <>
            <div style={{ fontWeight: 600, margin: "8px 0 4px" }}>By month</div>
            {months.length === 0 ? (
              <div style={{ color: "#777", fontSize: 13 }}>No coupon/promotion sales stored for this selection.</div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ borderCollapse: "collapse", width: "100%" }}>
                  <thead>
                    <tr>
                      <th style={th}>Month</th>
                      <th style={{ ...th, textAlign: "right" }}>Orders</th>
                      <th style={{ ...th, textAlign: "right" }}>Units</th>
                      <th style={{ ...th, textAlign: "right" }}>% of all units</th>
                      <th style={{ ...th, textAlign: "right" }}>Sales after discount</th>
                      <th style={{ ...th, textAlign: "right" }}>Coupon discount</th>
                      <th style={{ ...th, textAlign: "right" }}>Promotion discount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shownMonths.map((m) => (
                      <tr key={`${m.year}-${m.month}`}>
                        <td style={td}>{MONTH_NAMES[m.month - 1]} {m.year}</td>
                        <td style={tdNum}>{m.orders}</td>
                        <td style={tdNum}>{m.units}</td>
                        <td style={tdNum}>{m.unitsSharePct == null ? "–" : `${m.unitsSharePct}%`}</td>
                        <td style={tdNum}>{money(m.salesNet, cur)}</td>
                        <td style={tdNum}>{money(m.couponDiscount, cur)}</td>
                        <td style={tdNum}>{money(m.promotionDiscount, cur)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {months.length > 12 && (
                  <button
                    style={{ marginTop: 6, fontSize: 12, background: "none", border: "none", color: "#1976d2", cursor: "pointer" }}
                    onClick={() => setShowAllMonths((v) => !v)}
                  >
                    {showAllMonths ? "Show last 12 months" : `Show all ${months.length} months`}
                  </button>
                )}
              </div>
            )}
            <div style={{ fontWeight: 600, margin: "14px 0 4px" }}>By coupon / promotion</div>
            <PromoTable rows={promos} names={{}} />
            <div style={{ color: "#888", fontSize: 11, marginTop: 8 }}>
              Amounts in {cur}{data.currency === "USD" && (marketplaces || []).length !== 1 ? " (mixed currencies converted at today's rate)" : ""}.
              History since Nov 2024; the daily sales update adds new orders.
            </div>
          </>
        )}
      </CollapsibleSection>
    </div>
  );
}
