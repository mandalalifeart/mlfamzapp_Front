import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { buttonStyle } from "./buttonStyle";

const API_BASE =
  import.meta.env.VITE_API_BASE ||
  "https://us-central1-mlfamzapp.cloudfunctions.net";
// Same narrow key the /wise page uses for its uploads.
const UPLOAD_KEY = import.meta.env.VITE_WISE_REFRESH_KEY || "";

const OSS_TAB = "OSS";
const COUNTRIES_TAB = "COUNTRIES";
const REPORT_EXTS = /\.(csv|txt|xlsx|xls)$/i;


// Per-country tax office login links shown in the country section
// (NL added 2026-10-03; URL exactly as the user gave it).
// Countries whose domestic return is filed per quarter (NL per the user
// 2026-10-03) - their section starts with a quarterly summary.
const QUARTERLY_COUNTRIES = new Set(["NL"]);

function QuarterSummary({ rates, deductible, year, ossFlagged, zeroNet }) {
  const quarters = [1, 2, 3, 4].map((q) => ({
    q,
    months: [0, 1, 2].map((i) => `${year}-${String((q - 1) * 3 + i + 1).padStart(2, "0")}`),
  }));
  const currencies = [...new Set([...rates.map((r) => r.currency), ...Object.values(deductible || {}).flatMap((m) => Object.keys(m))])];
  const sum = (months, f) => months.reduce((s, p) => s + f(p), 0);
  return (
    <div style={{ overflowX: "auto", marginBottom: "12px" }}>
      <div style={{ fontWeight: 700, fontSize: "13px", marginBottom: "4px" }}>Quarterly return (filed per quarter)</div>
      <table style={{ borderCollapse: "collapse", width: "100%" }}>
        <thead>
          <tr>
            <th style={head()}> </th>
            {quarters.map(({ q }) => (
              <th key={q} style={head({ textAlign: "right" })}>Q{q} {year}</th>
            ))}
            <th style={head({ textAlign: "right" })}>Total</th>
          </tr>
        </thead>
        <tbody>
          {currencies.map((cur) => {
            const rs = rates.filter((r) => r.currency === cur);
            const ded = (p) => deductible?.[p]?.[cur] || 0;
            const vat = (p) => rs.reduce((s, r) => s + (r.months[p]?.vat || 0), 0);
            const all = quarters.flatMap((x) => x.months);
            const rows = [
              ...rs.map((r) => [`Net sales ${r.rate}%${currencies.length > 1 ? ` ${cur}` : ""}`, (p) => r.months[p]?.net || 0, {}]),
              ...rs.map((r) => [`VAT ${r.rate}%${currencies.length > 1 ? ` ${cur}` : ""}`, (p) => r.months[p]?.vat || 0, {}]),
              [`Deductible VAT ${cur}`, ded, { background: "#f2fbf4" }],
              [`VAT payable ${cur}`, (p) => vat(p) - ded(p), { fontWeight: 700 }],
            ];
            return rows.map(([label, f, style]) => (
              <tr key={`${cur}-${label}`} style={{ background: style.background }}>
                <td style={cell({ fontWeight: style.fontWeight || 600 })}>{label}</td>
                {quarters.map(({ q, months }) => (
                  <td key={q} style={num({ fontWeight: style.fontWeight })}>{fmt(sum(months, f))}</td>
                ))}
                <td style={num({ fontWeight: 700 })}>{fmt(sum(all, f))}</td>
              </tr>
            ));
          })}
        </tbody>
      </table>
      <ul style={{ margin: "6px 0 0 18px", padding: 0, fontSize: "12px", color: "#555" }}>
        {ossFlagged?.count > 0 && (
          <li>
            Includes {ossFlagged.count} lines Amazon flagged as OSS (net {fmt(ossFlagged.net)}), counted here because you are
            VAT-registered in this country.
          </li>
        )}
        {zeroNet > 0 && <li>Not included: 0% domestic lines (net {fmt(zeroNet)}) - see the bucket table below.</li>}
        <li>Deductible = this country&apos;s VAT on the invoices uploaded on /wise (listed at the bottom of this section).</li>
        <li>A quarter shows 0 until that quarter&apos;s Amazon VAT files are uploaded.</li>
      </ul>
    </div>
  );
}

// UK VAT return in HMRC's 9-box format (2026-10-03, per the user): UK
// quarters Feb-Apr, May-Jul, Aug-Oct, Nov-Jan, computed from the Amazon VAT
// data, side by side with what was actually submitted (CSV files in
// ~/accounting/vat/submitted, e.g. UK_02_03_04_26.csv).
const UK_BOXES = [
  ["1", "VAT due on sales and other outputs"],
  ["2", "VAT due on NI acquisitions from EU"],
  ["3", "Total VAT due"],
  ["4", "VAT reclaimed on purchases and other inputs"],
  ["5", "Net VAT to pay (or reclaim if negative)"],
  ["6", "Total sales and other outputs, excl. VAT"],
  ["7", "Total purchases and other inputs, excl. VAT"],
  ["8", "NI dispatches to EU, excl. VAT"],
  ["9", "NI acquisitions from EU, excl. VAT"],
];

// Exact HMRC box texts, as in the box CSV the UK VAT software exports
// (~/accounting/vat/submitted/UK_MM_MM_MM_YY.csv) - the download uses this format.
const HMRC_BOX_TEXT = {
  1: "VAT due on sales and other outputs",
  2: "VAT due on intra-community acquisitions of goods made in Northern Ireland from EU Member States",
  3: "Total VAT due",
  4: "VAT reclaimed on purchases and other inputs",
  5: "Net VAT to be paid to Customs or reclaimed by you",
  6: "Total value of sales and all other outputs excluding any VAT",
  7: "Total value of purchases and all other inputs excluding any VAT",
  8: "Total value of intra-community dispatches of goods and related costs, excluding any VAT, from Northern Ireland to EU Member States",
  9: "Total value of intra-community acquisitions of goods and related costs, excluding any VAT, made in Northern Ireland from EU Member States",
};

function downloadBoxCsv(fileName, boxes) {
  const q = (t) => (/[",]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t);
  const r2 = (v) => Math.round((Number(v) || 0) * 100) / 100;
  const text = Object.keys(HMRC_BOX_TEXT).map((b) => `BOX ${b},${q(HMRC_BOX_TEXT[b])},${r2(boxes[b])}`).join("\r\n") + "\r\n";
  const url = URL.createObjectURL(new Blob([text], { type: "text/csv" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

function UkVatBoxes({ allRates, deductible, year, submitted, manual }) {
  const quarters = [[2, 3, 4], [5, 6, 7], [8, 9, 10], [11, 12, 13]].map((ms) =>
    ms.map((m) => (m > 12 ? `${Number(year) + 1}-${String(m - 12).padStart(2, "0")}` : `${year}-${String(m).padStart(2, "0")}`))
  );
  const label = (q) => `${q[0].slice(5)}–${q[2].slice(5)} ${q[0].slice(0, 4)}${q[2].slice(0, 4) !== q[0].slice(0, 4) ? `/${q[2].slice(2, 4)}` : ""}`;
  const sumRates = (q, f) => q.reduce((s, p) => s + allRates.reduce((t, r) => t + (r.months[p]?.[f] || 0), 0), 0);
  const ded = (q) => q.reduce((s, p) => s + (deductible?.[p]?.GBP || 0), 0);
  const computed = (q) => {
    const b1 = sumRates(q, "vat");
    const b4 = ded(q);
    // deductible already includes the typed-in import VAT; Box 7 = the import
    // value behind it at the UK standard 20% rate (import VAT / 0.20, per the user)
    const importValue = q.reduce((s, p) => s + (manual?.import_vat?.[p]?.amount || 0), 0) / 0.2;
    return { 1: b1, 2: 0, 3: b1, 4: b4, 5: b1 - b4, 6: sumRates(q, "net"), 7: importValue || null, 8: 0, 9: 0 };
  };
  const filed = (q) => (submitted || []).find((x) => x.months.join() === q.join());
  // Box values as shown in the table (filed Box 4/7 trusted), with 3 = 1 + 2
  // and 5 = 3 - 4 so the file adds up.
  const shown = (q) => {
    const c = computed(q);
    const f = filed(q)?.boxes || {};
    const v = { ...c, 7: c[7] || 0 };
    if (f["4"] !== undefined) v[4] = f["4"];
    if (f["7"] !== undefined) v[7] = f["7"];
    v[3] = v[1] + v[2];
    v[5] = v[3] - v[4];
    return v;
  };
  const fileName = (q) => `UK_${q.map((p) => p.slice(5)).join("_")}_${q[0].slice(2, 4)}.csv`;
  const link = { background: "none", border: "none", padding: 0, color: "#1a5fb4", cursor: "pointer", fontSize: "10px", textDecoration: "underline" };
  return (
    <div style={{ overflowX: "auto", marginBottom: "12px" }}>
      <div style={{ fontWeight: 700, fontSize: "13px", marginBottom: "4px" }}>
        UK VAT return per quarter (HMRC boxes) - computed from the Amazon VAT data vs submitted
      </div>
      <table style={{ borderCollapse: "collapse", width: "100%" }}>
        <thead>
          <tr>
            <th style={head()}>Box</th>
            {quarters.map((q) => (
              <th key={q[0]} style={head({ textAlign: "right" })}>
                {label(q)}
                <div style={{ fontWeight: 400, fontSize: "10px" }}>{filed(q) ? `submitted: ${filed(q).file}` : "not submitted / no file"}</div>
                <div style={{ fontWeight: 400 }}>
                  <button style={link} title="Box CSV with the computed values shown below" onClick={() => downloadBoxCsv(fileName(q), shown(q))}>⬇ computed</button>
                  {filed(q) && (
                    <>
                      {" · "}
                      <button style={link} title="The return as submitted" onClick={() => downloadBoxCsv(filed(q).file, filed(q).boxes)}>⬇ submitted</button>
                    </>
                  )}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {UK_BOXES.map(([box, text]) => (
            <tr key={box}>
              <td style={cell({ fontSize: "12px" })}>
                <strong>Box {box}</strong> {text}
              </td>
              {quarters.map((q) => {
                // Per the user (2026-10-03): the import-VAT numbers they file
                // (Box 4 reclaim, Box 7 purchases - from import/postponed VAT,
                // not on /wise) are trusted as filed, and small VAT gaps (< £5,
                // e.g. the £3.32 in May-Jul) are accepted.
                const f = filed(q)?.boxes?.[box];
                const trustFiled = (box === "4" || box === "7") && f !== undefined;
                const c = trustFiled ? f : computed(q)[box];
                const diff = c !== null && f !== undefined ? Math.round((f - c) * 100) / 100 : null;
                const off = diff !== null && Math.abs(diff) >= 0.05 && !(["1", "3", "5"].includes(box) && Math.abs(diff) < 5);
                return (
                  <td key={q[0]} style={num({ fontSize: "12px", background: off ? "#fdecea" : undefined })}>
                    <div>{c === null ? "–" : fmt(c)}</div>
                    {f !== undefined && (
                      <div style={{ fontSize: "11px", color: off ? "#b00020" : "#1b7f3b", fontWeight: off ? 700 : 400 }}>
                        {trustFiled
                          ? "as filed (import VAT) ✓"
                          : `filed ${fmt(f)}${off ? ` (${diff > 0 ? "+" : ""}${fmt(diff)})` : Math.abs(diff || 0) >= 0.05 ? ` (${diff > 0 ? "+" : ""}${fmt(diff)} accepted) ✓` : " ✓"}`}
                      </div>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <ul style={{ margin: "6px 0 0 18px", padding: 0, fontSize: "12px", color: "#555" }}>
        <li>Box 1 = VAT on your own UK sales (Amazon-collected marketplace sales excluded). Box 6 = all your reportable UK
          sales excl. VAT, including 0% sales and exports.</li>
        <li>Box 4 / Box 7: your filed import VAT and purchases are used as filed (trusted, per you); for a quarter not yet filed
          Box 4 = UK VAT on /wise invoices + the Import VAT you type in below, Box 7 = Import VAT ÷ 20% (the import value). Box 1/3/5 gaps under £5 are accepted.</li>
        <li>Nov–Jan: January belongs to next year, select next year on this page to see it.</li>
      </ul>
    </div>
  );
}

// Countries with editable import rows (DE 2026-10-03, GB the same day):
// import VAT is deductible; for GB the import value (HMRC Box 7) is derived from it.
const IMPORT_VAT_COUNTRIES = new Set(["DE", "GB"]);
const IMPORT_CURRENCY = { DE: "EUR", GB: "GBP" };

function ImportVatInput({ country, month, value, onSaved, entryType = "import_vat" }) {
  const [v, setV] = useState(value || "");
  const [status, setStatus] = useState("");
  useEffect(() => setV(value || ""), [value]);
  async function save() {
    const amount = Number(String(v).replace(",", ".")) || 0;
    if (amount === (value || 0)) return;
    setStatus("saving");
    try {
      const r = await fetch(`${API_BASE}/SetVatManualEntry?key=${encodeURIComponent(UPLOAD_KEY)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ country, month, entryType, amount, currency: IMPORT_CURRENCY[country] || "EUR" }),
      });
      const res = await r.json();
      if (!r.ok || res.error) throw new Error(res.error || `HTTP ${r.status}`);
      setStatus("ok");
      onSaved?.();
    } catch {
      setStatus("error");
    }
  }
  return (
    <input
      value={v}
      onChange={(e) => setV(e.target.value)}
      onBlur={save}
      onKeyDown={(e) => e.key === "Enter" && e.target.blur()}
      placeholder="0"
      style={{
        width: "64px", textAlign: "right", padding: "2px 4px", borderRadius: "4px", fontSize: "12px",
        border: `1px solid ${status === "error" ? "#b00020" : status === "ok" ? "#1b7f3b" : "#bbb"}`,
        background: status === "saving" ? "#fff8e1" : "#fff", color: "#111",
      }}
    />
  );
}

const TAX_PORTALS = {
  DE: { label: "ELSTER - Mein ELSTER", url: "https://www.elster.de" },
  FR: { label: "impots.gouv.fr - Espace professionnel", url: "https://cfspro.impots.gouv.fr/mire/accueil.do" },
  GB: { label: "OpenVAT - HMRC VAT obligations / returns", url: "https://openvat.co.uk/vat/retrieve-vat-obligations/show" },
  NL: { label: "Belastingdienst - Mijn Belastingdienst Zakelijk", url: "https://mijnzakelijk.belastingdienst.nl/tmx-aik-web/index.html?flowId=oyulql5Vtr" },
};

function fmt(n, currency) {
  if (n === null || n === undefined) return "–";
  const num = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
  return currency ? `${num} ${currency}` : num;
}

function cardStyle(extra = {}) {
  return { background: "#fff", border: "1px solid #ddd", borderRadius: "8px", padding: "16px", ...extra };
}
function cell(extra = {}) {
  return { border: "1px solid #ccc", padding: "5px 8px", fontSize: "13px", textAlign: "left", verticalAlign: "top", ...extra };
}
function num(extra = {}) {
  return cell({ textAlign: "right", whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums", ...extra });
}
const head = (extra = {}) => cell({ background: "#f4f4f4", fontWeight: 600, ...extra });

function tabStyle(active) {
  return {
    padding: "8px 14px",
    border: "1px solid #ddd",
    borderBottom: active ? "2px solid #fff" : "1px solid #ddd",
    marginBottom: "-2px",
    background: active ? "#fff" : "#f1f1f1",
    color: "#222",
    fontWeight: active ? 700 : 400,
    borderRadius: "6px 6px 0 0",
    cursor: "pointer",
    fontSize: "14px",
  };
}

function readFileAsBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] || "");
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

function BucketTable({ data, months }) {
  if (!data.buckets?.length) return null;
  return (
    <div style={{ marginTop: "14px", overflowX: "auto" }}>
      <h4 style={{ margin: "0 0 6px", fontSize: "14px" }}>All lines to {data.name} by bucket (net)</h4>
      <table style={{ borderCollapse: "collapse", width: "100%" }}>
        <thead>
          <tr>
            <th style={head({ width: "1%" })}>Bucket</th>
            <th style={head({ width: "1%" })}>Rate</th>
            {months.map((p) => (
              <th key={p} style={head({ textAlign: "right" })}>{p}</th>
            ))}
            <th style={head({ textAlign: "right" })}>Total net</th>
            <th style={head({ textAlign: "right" })}>Total VAT</th>
          </tr>
        </thead>
        <tbody>
          {data.buckets.map((b, i) => (
            <tr key={i} style={{ background: b.bucket === "MARKETPLACE_COLLECTED" ? "#f6f6f6" : b.bucket === "OSS_RETURN" ? "#f3f0ff" : undefined }}>
              <td style={cell({ whiteSpace: "nowrap", fontSize: "12px" })}>{b.bucket}</td>
              <td style={cell({ whiteSpace: "nowrap" })}>
                {b.rate === null ? "?" : `${b.rate}%`} <span style={{ color: "#888", fontSize: "11px" }}>{b.currency}</span>
              </td>
              {months.map((p) => (
                <td key={p} style={num()}>{fmt(b.months[p]?.net || 0)}</td>
              ))}
              <td style={num({ fontWeight: 700 })}>{fmt(b.total.net)}</td>
              <td style={num({ fontWeight: 700 })}>{fmt(b.total.vat)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DeductibleTable({ country, invoices }) {
  const [show, setShow] = useState(false);
  if (!invoices?.length) {
    return (
      <div style={{ color: "#888", fontSize: "12px", marginTop: "10px" }}>
        No deductible {country === "GB" ? "UK" : country} VAT found on the invoices uploaded on /wise for this year.
      </div>
    );
  }
  return (
    <div style={{ marginTop: "10px" }}>
      <button
        onClick={() => setShow((v) => !v)}
        style={{ border: "none", background: "none", color: "#1565c0", cursor: "pointer", padding: 0, fontSize: "12px" }}
      >
        {show ? "▾" : "▸"} Deductible VAT invoices from /wise ({invoices.length})
      </button>
      {show && (
        <div style={{ fontSize: "12px", marginTop: "4px" }}>
          {invoices.map((i) => (
            <div key={i.id}>
              {i.date || i.month} · {i.vendor} {i.number ? `#${i.number}` : ""} · VAT {fmt(i.tax, i.currency)}
              {i.rate ? ` (${i.rate}%)` : ""}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function EeDownloads({ year, months }) {
  return (
    <div style={cardStyle({ marginBottom: "10px", background: "#f5f9ff", borderColor: "#c9dcf5", fontSize: "13px" })}>
      <strong>e-MTA files:</strong>
      <div style={{ marginTop: "6px" }}>
        KMD (monthly XML):{" "}
        {months.map((p) => (
          <a
            key={p}
            href={`${API_BASE}/EeKmdXml?year=${year}&month=${Number(p.slice(5, 7))}`}
            style={{ color: "#1565c0", marginRight: "8px" }}
          >
            ⬇ {p.slice(5, 7)}
          </a>
        ))}
      </div>
      <div style={{ marginTop: "4px" }}>
        KMD invoices (monthly XLSX - Amazon orders as sales, /wise invoices as purchases):{" "}
        {months.map((p) => (
          <a
            key={p}
            href={`${API_BASE}/EeKmdInvoicesXlsx?year=${year}&month=${Number(p.slice(5, 7))}`}
            style={{ color: "#1565c0", marginRight: "8px" }}
          >
            ⬇ {p.slice(5, 7)}
          </a>
        ))}
      </div>
      <div style={{ marginTop: "4px" }}>
        OSS (quarterly, CSV for manual entry - e-MTA has no OSS file import):{" "}
        {[1, 2, 3, 4].map((q) => (
          <a key={q} href={`${API_BASE}/OssReturnCsv?quarter=${year}-Q${q}`} style={{ color: "#1565c0", marginRight: "8px" }}>
            ⬇ Q{q}
          </a>
        ))}
      </div>
      <div style={{ fontSize: "11px", color: "#888", marginTop: "4px" }}>
        KMD XML: EE domestic sales by rate (lines 1/2), reportable 0% (line 3, exports 3.2) and input VAT from the Wise
        invoices (line 5). KMD INF A/B are not included (noSales/noPurchases = true) - check before submitting.
      </div>
    </div>
  );
}

function CountryReturn({ data, year, deductible: wiseDeductible, deductibleInvoices, submitted, manual, onManualSaved }) {
  const [open, setOpen] = useState(false);
  const [showZero, setShowZero] = useState(false);
  // Always all 12 months of the selected year (per the user), even when empty.
  const months = Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, "0")}`);
  // 0% lines are left out of the return table (still in the bucket summary below).
  const rates = data.rates.filter((r) => r.rate !== 0);
  // Import VAT typed in by the user (DE, 2026-10-03) counts as deductible
  // input VAT on top of the VAT found on /wise invoices.
  const hasImportVat = IMPORT_VAT_COUNTRIES.has(data.country);
  const importVat = useMemo(() => manual?.import_vat || {}, [manual]);
  const deductible = useMemo(() => {
    const out = {};
    Object.entries(wiseDeductible || {}).forEach(([p, curs]) => (out[p] = { ...curs }));
    Object.entries(importVat).forEach(([p, e]) => {
      if (!e.amount) return;
      out[p] = { ...(out[p] || {}) };
      out[p][e.currency] = (out[p][e.currency] || 0) + e.amount;
    });
    return out;
  }, [wiseDeductible, importVat]);
  const currency = data.currencies.join(", ");
  return (
    <div style={cardStyle()}>
      <h3 onClick={() => setOpen((v) => !v)} style={{ margin: 0, fontSize: "16px", cursor: "pointer" }}>
        {open ? "▾" : "▸"} {data.name} ({data.country === "GB" ? "UK" : data.country}){" "}
        {currency && <span style={{ color: "#888", fontWeight: 400 }}>· {currency}</span>}
        <span style={{ color: "#555", fontWeight: 400, fontSize: "13px", marginLeft: "12px" }}>
          VAT {data.rates.length ? [...new Set(data.rates.map((r) => r.currency))].map((cur) => fmt(data.rates.filter((r) => r.currency === cur).reduce((s, r) => s + r.total.vat, 0), cur)).join(" + ") : "–"}
        </span>
      </h3>
      {open && (
      <>
      <div style={{ height: "8px" }} />
      {TAX_PORTALS[data.country] && (
        <div style={{ marginBottom: "10px", fontSize: "13px" }}>
          <strong>Tax office login:</strong>{" "}
          <a href={TAX_PORTALS[data.country].url} target="_blank" rel="noopener noreferrer" style={{ color: "#1565c0" }}>
            {TAX_PORTALS[data.country].label}
          </a>
        </div>
      )}
      {data.country === "EE" && <EeDownloads year={year} months={months} />}
      <div style={{ fontSize: "12px", color: "#888", marginBottom: "10px" }}>
        Domestic sales/refunds to {data.name} that you report on your local return (marketplace-collected sales excluded
        {data.marketplaceCollected ? ` - ${data.marketplaceCollected} lines collected by Amazon` : ""}), plus the
        reportable 0% lines (local 0% sales and non-EU exports departing {data.country}).
        {data.ossFlagged?.count > 0 &&
          ` Includes ${data.ossFlagged.count} line(s) the report flags as Union-OSS (VAT ${fmt(data.ossFlagged.vat)}) - reported here because you are VAT-registered in ${data.name}.`}
      </div>
      {data.country === "GB" && (
        <UkVatBoxes allRates={data.rates} deductible={deductible} year={year} submitted={submitted} manual={manual} />
      )}
      {QUARTERLY_COUNTRIES.has(data.country) && rates.length > 0 && (
        <QuarterSummary rates={rates} deductible={deductible} year={year} ossFlagged={data.ossFlagged} zeroNet={data.buckets.filter((b) => b.rate === 0 && b.bucket === "DOMESTIC_RETURN").reduce((s, b) => s + (b.total?.net || 0), 0)} />
      )}
      {rates.length === 0 ? (
        <div style={{ color: "#888" }}>Nothing to report for {data.name} in the uploaded months.</div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ borderCollapse: "collapse", width: "100%" }}>
            <thead>
              <tr>
                <th style={head({ width: "1%" })}>Rate</th>
                <th style={head({ width: "1%" })}>Amount</th>
                {months.map((p) => (
                  <th key={p} style={head({ textAlign: "right" })}>{p}</th>
                ))}
                <th style={head({ textAlign: "right" })}>Total</th>
              </tr>
            </thead>
            <tbody>
              {rates.map((r) =>
                ["net", "vat", "gross"].map((metric, i) => (
                  <tr key={`${r.rate}-${metric}`} style={{ background: metric === "vat" ? "#f7fbff" : undefined }}>
                    {i === 0 && (
                      <td style={cell({ fontWeight: 700, whiteSpace: "nowrap" })} rowSpan={3}>
                        {r.rate === null ? "?" : `${r.rate}%`}
                        {data.currencies.length > 1 && <div style={{ fontWeight: 400, fontSize: "11px", color: "#888" }}>{r.currency}</div>}
                      </td>
                    )}
                    <td style={cell({ color: "#555" })}>{metric === "net" ? "Net" : metric === "vat" ? "VAT" : "Gross"}</td>
                    {months.map((p) => (
                      <td key={p} style={num({ fontWeight: metric === "vat" ? 600 : 400 })}>
                        {fmt(r.months[p]?.[metric] || 0)}
                      </td>
                    ))}
                    <td style={num({ fontWeight: 700 })}>{fmt(r.total[metric])}</td>
                  </tr>
                ))
              )}
              {[...new Set(rates.map((r) => r.currency))].map((cur) => {
                const rs = rates.filter((r) => r.currency === cur);
                return (
                  <tr key={`total-${cur}`}>
                    <td style={cell({ fontWeight: 700 })} colSpan={2}>VAT total {cur}</td>
                    {months.map((p) => (
                      <td key={p} style={num({ fontWeight: 700 })}>{fmt(rs.reduce((s, r) => s + (r.months[p]?.vat || 0), 0))}</td>
                    ))}
                    <td style={num({ fontWeight: 700 })}>{fmt(rs.reduce((s, r) => s + r.total.vat, 0))}</td>
                  </tr>
                );
              })}
              {hasImportVat &&
                [
                  ["import_vat", "Import VAT", data.country === "DE" ? "Import VAT (EUSt)" : "Import VAT (reclaimable)"],
                ].map(([type, , title]) => {
                  const entries = manual?.[type] || {};
                  const cur = IMPORT_CURRENCY[data.country] || "EUR";
                  return (
                    <tr key={type} style={{ background: "#fffbe6" }}>
                      <td style={cell({ fontWeight: 600 })} colSpan={2}>
                        {title} {cur}
                        <div style={{ fontWeight: 400, fontSize: "11px", color: "#888" }}>type the amount, saved on leaving the field</div>
                      </td>
                      {months.map((p) => (
                        <td key={p} style={num()}>
                          <ImportVatInput country={data.country} month={p} entryType={type} value={entries[p]?.amount || 0} onSaved={onManualSaved} />
                        </td>
                      ))}
                      <td style={num({ fontWeight: 700 })}>{fmt(months.reduce((s, p) => s + (entries[p]?.amount || 0), 0))}</td>
                    </tr>
                  );
                })}
              {[...new Set([...rates.map((r) => r.currency), ...Object.values(deductible || {}).flatMap((m) => Object.keys(m))])]
                .filter((cur) => Object.values(deductible || {}).some((m) => m[cur]))
                .map((cur) => {
                  const rs = rates.filter((r) => r.currency === cur);
                  const ded = (p) => deductible?.[p]?.[cur] || 0;
                  const vat = (p) => rs.reduce((s, r) => s + (r.months[p]?.vat || 0), 0);
                  const wded = (p) => wiseDeductible?.[p]?.[cur] || 0;
                  return [
                    hasImportVat && (
                      <tr key={`wded-${cur}`}>
                        <td style={cell()} colSpan={2}>Input VAT {cur} from /wise invoices</td>
                        {months.map((p) => (
                          <td key={p} style={num()}>{fmt(wded(p))}</td>
                        ))}
                        <td style={num({ fontWeight: 700 })}>{fmt(months.reduce((s, p) => s + wded(p), 0))}</td>
                      </tr>
                    ),
                    <tr key={`ded-${cur}`} style={{ background: "#f2fbf4" }}>
                      <td style={cell({ fontWeight: 600 })} colSpan={2}>
                        Deductible VAT {cur}
                        {hasImportVat && <div style={{ fontWeight: 400, fontSize: "11px", color: "#888" }}>/wise invoices + import VAT</div>}
                      </td>
                      {months.map((p) => (
                        <td key={p} style={num()}>{fmt(ded(p))}</td>
                      ))}
                      <td style={num({ fontWeight: 700 })}>{fmt(months.reduce((s, p) => s + ded(p), 0))}</td>
                    </tr>,
                    <tr key={`pay-${cur}`}>
                      <td style={cell({ fontWeight: 700 })} colSpan={2}>VAT payable {cur}</td>
                      {months.map((p) => (
                        <td key={p} style={num({ fontWeight: 700 })}>{fmt(vat(p) - ded(p))}</td>
                      ))}
                      <td style={num({ fontWeight: 700 })}>{fmt(months.reduce((s, p) => s + vat(p) - ded(p), 0))}</td>
                    </tr>,
                  ];
                })}
            </tbody>
          </table>
        </div>
      )}
      {data.zeroRated.length > 0 && (
        <div style={{ marginTop: "12px" }}>
          <button
            onClick={() => setShowZero((v) => !v)}
            style={{ border: "none", background: "none", color: "#1565c0", cursor: "pointer", padding: 0, fontSize: "13px" }}
          >
            {showZero ? "▾" : "▸"} Reportable 0% transactions ({data.zeroRated.length})
          </button>
          {showZero && (
            <div style={{ overflowX: "auto", marginTop: "6px" }}>
              <table style={{ borderCollapse: "collapse", width: "100%" }}>
                <thead>
                  <tr>
                    {["Period", "Transaction", "Type", "Component", "From", "To", "Tax calc date", "Net", "VAT", "Gross", "Currency"].map((h) => (
                      <th key={h} style={head()}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.zeroRated.map((z, i) => (
                    <tr key={i}>
                      <td style={cell()}>{z.period}</td>
                      <td style={cell({ fontSize: "11px" })}>{z.tx_id}</td>
                      <td style={cell()}>{z.transaction_type}</td>
                      <td style={cell()}>{z.component}</td>
                      <td style={cell()}>{z.sale_depart}</td>
                      <td style={cell()}>{z.dest}</td>
                      <td style={cell()}>{z.tax_calc_date}</td>
                      <td style={num()}>{fmt(z.net)}</td>
                      <td style={num()}>{fmt(z.vat)}</td>
                      <td style={num()}>{fmt(z.gross)}</td>
                      <td style={cell()}>{z.currency}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
      <BucketTable data={data} months={months} />
      <DeductibleTable country={data.country} invoices={deductibleInvoices} />
      </>
      )}
    </div>
  );
}

function OssReturn({ lines }) {
  const quarters = useMemo(() => {
    const map = new Map();
    for (const l of lines) {
      const key = `${l.quarter}|${l.scheme}`;
      if (!map.has(key)) map.set(key, { quarter: l.quarter, scheme: l.scheme, lines: [] });
      map.get(key).lines.push(l);
    }
    return [...map.values()];
  }, [lines]);

  return (
    <div style={cardStyle()}>
      <h3 style={{ margin: "0 0 4px", fontSize: "16px" }}>OSS return (filed via Estonia)</h3>
      <div style={{ fontSize: "12px", color: "#888", marginBottom: "10px" }}>
        Per calendar quarter, per member state of consumption and VAT rate. Excludes marketplace-collected sales and
        destinations where you hold a local VAT registration (those go on the country returns).
      </div>
      {quarters.length === 0 && <div style={{ color: "#888" }}>No OSS sales in the uploaded months.</div>}
      {quarters.map((q) => {
        const eurLines = q.lines.filter((l) => !l.currency || l.currency === "EUR");
        const other = q.lines.filter((l) => l.currency && l.currency !== "EUR");
        return (
          <div key={`${q.quarter}-${q.scheme}`} style={{ marginBottom: "16px", overflowX: "auto" }}>
            <h4 style={{ margin: "6px 0", fontSize: "14px" }}>
              {q.quarter} · {q.scheme}
            </h4>
            <table style={{ borderCollapse: "collapse", width: "100%" }}>
              <thead>
                <tr>
                  {["Country", "Code", "VAT rate", "Taxable amount (net)", "VAT", "Gross", "Currency", "Lines", "Note"].map((h, i) => (
                    <th key={h} style={head({ textAlign: i >= 3 && i <= 5 ? "right" : "left" })}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {q.lines.map((l, i) => (
                  <tr key={i}>
                    <td style={cell()}>{l.country}</td>
                    <td style={cell()}>{l.countryCode}</td>
                    <td style={cell()}>{l.rate === null ? "?" : `${l.rate}%`}</td>
                    <td style={num()}>{fmt(l.net)}</td>
                    <td style={num({ fontWeight: 600 })}>{fmt(l.vat)}</td>
                    <td style={num()}>{fmt(l.gross)}</td>
                    <td style={cell()}>{l.currency}</td>
                    <td style={num({ color: "#888" })}>{l.count}</td>
                    <td style={cell({ fontSize: "11px", color: "#b26a00" })}>{l.fxNote}</td>
                  </tr>
                ))}
                <tr>
                  <td style={cell({ fontWeight: 700 })} colSpan={3}>Total (EUR lines)</td>
                  <td style={num({ fontWeight: 700 })}>{fmt(eurLines.reduce((s, l) => s + l.net, 0))}</td>
                  <td style={num({ fontWeight: 700 })}>{fmt(eurLines.reduce((s, l) => s + l.vat, 0))}</td>
                  <td style={num({ fontWeight: 700 })}>{fmt(eurLines.reduce((s, l) => s + l.gross, 0))}</td>
                  <td style={cell()}>EUR</td>
                  <td style={cell()} colSpan={2}>
                    {other.length > 0 && (
                      <span style={{ fontSize: "11px", color: "#b26a00" }}>
                        + {other.map((l) => `${l.countryCode} ${fmt(l.vat, l.currency)} VAT`).join(", ")} - convert before filing
                      </span>
                    )}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
}

// "All till now" (per the user 2026-11-02): VAT to pay per country (rows) per
// year (columns) = VAT on the return lines - deductible input VAT (/wise
// invoices + typed-in import VAT). Negative = refund. One line per currency.
function AllYearsTable({ data }) {
  const years = data.years || [];
  const rows = [
    ...(data.countries || []).map((c) => ({ key: c.country, label: `${c.name} (${c.country === "GB" ? "UK" : c.country})`, years: c.years })),
    {
      key: "OSS",
      label: "OSS (other EU countries)",
      years: Object.fromEntries(
        Object.entries(data.oss || {}).map(([y, curs]) => [y, Object.fromEntries(Object.entries(curs).map(([cur, v]) => [cur, { vat: v, deductible: 0, payable: v }]))])
      ),
    },
  ];
  const currencies = (r) => [...new Set(Object.values(r.years || {}).flatMap((c) => Object.keys(c)))].sort();
  const totals = {};
  rows.forEach((r) =>
    Object.entries(r.years || {}).forEach(([y, curs]) =>
      Object.entries(curs).forEach(([cur, v]) => {
        totals[cur] = totals[cur] || {};
        totals[cur][y] = (totals[cur][y] || 0) + v.payable;
      })
    )
  );
  return (
    <div style={cardStyle({ overflowX: "auto" })}>
      <h3 style={{ margin: "0 0 8px", fontSize: "16px" }}>VAT to pay per year</h3>
      <table style={{ borderCollapse: "collapse", width: "100%", minWidth: "700px" }}>
        <thead>
          <tr>
            <th style={head()}>Country</th>
            <th style={head({ width: "1%" })}>Cur.</th>
            {years.map((y) => (
              <th key={y} style={head({ textAlign: "right" })}>{y}</th>
            ))}
            <th style={head({ textAlign: "right" })}>Total</th>
          </tr>
        </thead>
        <tbody>
          {rows.flatMap((r) => {
            const curs = currencies(r);
            if (!curs.length)
              return [
                <tr key={r.key}>
                  <td style={cell({ fontWeight: 600 })}>{r.label}</td>
                  <td style={cell({ color: "#888" })} colSpan={years.length + 2}>nothing to report</td>
                </tr>,
              ];
            return curs.map((cur, i) => (
              <tr key={`${r.key}-${cur}`}>
                {i === 0 && (
                  <td style={cell({ fontWeight: 600, whiteSpace: "nowrap" })} rowSpan={curs.length}>{r.label}</td>
                )}
                <td style={cell({ color: "#555" })}>{cur}</td>
                {years.map((y) => {
                  const v = r.years?.[y]?.[cur];
                  return (
                    <td
                      key={y}
                      style={num({ color: v && v.payable < 0 ? "#1b7f3b" : undefined })}
                      title={v ? `VAT on sales ${fmt(v.vat)} - deductible ${fmt(v.deductible)}` : ""}
                    >
                      {v ? fmt(v.payable) : "–"}
                    </td>
                  );
                })}
                <td style={num({ fontWeight: 700 })}>{fmt(years.reduce((s, y) => s + (r.years?.[y]?.[cur]?.payable || 0), 0))}</td>
              </tr>
            ));
          })}
          {Object.keys(totals).sort().map((cur) => (
            <tr key={`total-${cur}`} style={{ background: "#f7fbff" }}>
              <td style={cell({ fontWeight: 700 })}>Total</td>
              <td style={cell({ fontWeight: 700 })}>{cur}</td>
              {years.map((y) => (
                <td key={y} style={num({ fontWeight: 700 })}>{totals[cur][y] ? fmt(totals[cur][y]) : "–"}</td>
              ))}
              <td style={num({ fontWeight: 700 })}>{fmt(Object.values(totals[cur]).reduce((s, v) => s + v, 0))}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ fontSize: "12px", color: "#666", marginTop: "8px" }}>
        VAT on your own return lines (Amazon-collected sales excluded) minus deductible VAT from /wise invoices and typed-in
        import VAT; green = refund. Hover a number for the split. Years only cover the months uploaded; IT/ES/PL/CZ/IE
        before Taxually are as the reports show them.
      </div>
    </div>
  );
}

export default function VatPage() {
  const [year, setYear] = useState("");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState(COUNTRIES_TAB);
  const [uploads, setUploads] = useState([]);
  const [dragOver, setDragOver] = useState(false);
  const fileInput = useRef(null);

  useEffect(() => {
    const root = document.getElementById("root");
    root?.classList.add("full-bleed");
    return () => root?.classList.remove("full-bleed");
  }, []);

  // silent = refresh data without the loading screen (keeps open sections open)
  async function load(y = year, silent = false) {
    if (!silent) setLoading(true);
    setError("");
    try {
      const response = await fetch(`${API_BASE}/VatReportSummary${y ? `?year=${y}` : ""}`);
      const result = await response.json();
      if (!response.ok || result.error) throw new Error(result?.error || `HTTP ${response.status}`);
      setData(result);
      if (!y) setYear(result.year);
    } catch (err) {
      setError(err.message || "Failed to load VAT data");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load(year);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year]);

  async function uploadOne(name, blob) {
    const id = `${Date.now()}-${name}`;
    setUploads((u) => [{ id, name, status: "uploading" }, ...u]);
    try {
      const contentBase64 = await readFileAsBase64(blob);
      const response = await fetch(`${API_BASE}/UploadVatReport?key=${encodeURIComponent(UPLOAD_KEY)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: name, contentBase64 }),
      });
      const result = await response.json();
      if (!response.ok || result.error) throw new Error(result?.error || `HTTP ${response.status}`);
      const s = result.stored?.[0] || {};
      setUploads((u) =>
        u.map((x) =>
          x.id === id
            ? s.error
              ? { ...x, status: "error", message: s.error }
              : { ...x, status: "done", message: s.processing ? `${s.period} · saved, processing (refresh in a minute)` : `${s.period} · ${s.rows} VAT lines` }
            : x
        )
      );
    } catch (err) {
      setUploads((u) => u.map((x) => (x.id === id ? { ...x, status: "error", message: err.message || String(err) } : x)));
    }
  }

  async function handleFiles(fileList) {
    const files = [...fileList];
    for (const f of files) {
      if (/\.zip$/i.test(f.name)) {
        // Big multi-month zips are unpacked here and sent one report at a time
        // (a 70MB zip in one request would hit the tunnel's request size limit).
        const { default: JSZip } = await import("jszip");
        const zip = await JSZip.loadAsync(f);
        const entries = Object.values(zip.files).filter(
          (e) => !e.dir && REPORT_EXTS.test(e.name) && !e.name.split("/").pop().startsWith(".") && !e.name.includes("__MACOSX")
        );
        for (const e of entries) {
          const blob = await e.async("blob");
          await uploadOne(e.name.split("/").pop(), blob);
        }
      } else if (REPORT_EXTS.test(f.name)) {
        await uploadOne(f.name, f);
      }
    }
    await load(year);
  }

  const periods = data?.periods || [];
  const countries = data?.countries || [];

  return (
    <div style={{ padding: "20px 24px", fontFamily: "Arial, sans-serif", minHeight: "100vh", background: "#fafafa", textAlign: "left", colorScheme: "light", color: "#222" }}>
      <h2 style={{ textAlign: "center", marginBottom: "6px" }}>VAT (Amazon VAT Transactions Report)</h2>
      <p style={{ textAlign: "center", fontSize: "13px", color: "#555", marginBottom: "16px" }}>
        Local VAT returns for EE, DE, FR, IT, ES, PL, CZ, IE, NL and UK, and the OSS return - built from the monthly
        Amazon VAT Transactions Reports you upload.
      </p>

      <div style={{ display: "flex", justifyContent: "center", gap: "10px", marginBottom: "12px" }}>
        <select value={year} onChange={(e) => setYear(e.target.value)} style={{ padding: "6px 8px", color: "#222" }}>
          {(data?.years?.length ? data.years : [year]).filter(Boolean).map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
          <option value="all">All till now</option>
        </select>
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          handleFiles(e.dataTransfer.files || []);
        }}
        onClick={() => fileInput.current?.click()}
        style={{
          ...cardStyle({ marginBottom: "16px", textAlign: "center", cursor: "pointer" }),
          border: `2px dashed ${dragOver ? "#1565c0" : "#bbb"}`,
          background: dragOver ? "#e8f0fe" : "#fcfcfc",
          color: "#555",
          fontSize: "14px",
        }}
      >
        <strong>📥 Upload VAT Transactions Reports</strong> - drop monthly report files (csv / txt / xlsx) or a zip with
        several months. Each is filed by the month it covers; re-uploading a month replaces it.
        <input
          ref={fileInput}
          type="file"
          multiple
          accept=".csv,.txt,.xlsx,.xls,.zip"
          style={{ display: "none" }}
          onChange={(e) => {
            handleFiles(e.target.files || []);
            e.target.value = "";
          }}
        />
        {uploads.length > 0 && (
          <div style={{ marginTop: "10px", textAlign: "left", fontSize: "12px" }} onClick={(e) => e.stopPropagation()}>
            {uploads.map((u) => (
              <div key={u.id} style={{ color: u.status === "error" ? "#b00020" : u.status === "done" ? "#1b7f3b" : "#1565c0" }}>
                {u.status === "uploading" ? "⏳" : u.status === "done" ? "✅" : "❌"} {u.name} {u.message ? `- ${u.message}` : ""}
              </div>
            ))}
          </div>
        )}
      </div>

      {error && <div style={{ color: "#b00020", textAlign: "center", marginBottom: "12px" }}>{error}</div>}
      {loading && <p style={{ textAlign: "center" }}>Loading...</p>}

      {!loading && data?.allYears && <AllYearsTable data={data.allYears} />}

      {!loading && data && !data.allYears && (
        <>
          <div style={{ fontSize: "12px", color: "#555", marginBottom: "10px" }}>
            Months loaded for {data.year}: {periods.length ? periods.join(", ") : "none yet"}
            {data.files?.length ? ` · ${data.files.length} file(s)` : ""}
          </div>
          {data.departureWarnings?.length > 0 && (
            <div style={cardStyle({ marginBottom: "12px", background: "#fff8e6", borderColor: "#f0d48a", fontSize: "12px" })}>
              <strong>⚠ Departure check:</strong> sales departing from countries without a local VAT registration:
              {data.departureWarnings.map((w, i) => (
                <div key={i}>
                  {w.period} · {w.country} ({w.column}): {w.count} line(s){w.orders?.length ? ` - e.g. ${w.orders.slice(0, 5).join(", ")}` : ""}
                </div>
              ))}
            </div>
          )}

          <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "12px", borderBottom: "2px solid #ddd" }}>
            <button onClick={() => setTab(COUNTRIES_TAB)} style={tabStyle(tab === COUNTRIES_TAB)}>
              VAT countries ({countries.map((c) => (c.country === "GB" ? "UK" : c.country)).join(", ")})
            </button>
            <button onClick={() => setTab(OSS_TAB)} style={tabStyle(tab === OSS_TAB)}>
              OSS (other EU countries)
            </button>
          </div>

          {tab === OSS_TAB ? (
            <OssReturn lines={data.oss || []} />
          ) : (
            <>
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", fontSize: "12px", marginBottom: "10px" }}>
                Jump to:
                {countries.map((c) => (
                  <a key={c.country} href={`#vat-${c.country}`} style={{ color: "#1565c0" }}>
                    {c.country === "GB" ? "UK" : c.country}
                  </a>
                ))}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                {countries.map((c) => (
                  <div key={c.country} id={`vat-${c.country}`}>
                    <CountryReturn
                      data={c}
                      year={data.year}
                      deductible={data.deductible?.[c.country]}
                      deductibleInvoices={data.deductibleInvoices?.[c.country]}
                      submitted={data.submittedReturns?.[c.country]}
                      manual={data.manualEntries?.[c.country]}
                      onManualSaved={() => load(year, true)}
                    />
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}

      <div style={{ display: "flex", justifyContent: "center", gap: "10px", padding: "16px 0" }}>
        <Link style={buttonStyle()} to="/">Home</Link>
        <Link style={buttonStyle()} to="/wise">Wise</Link>
      </div>
    </div>
  );
}
