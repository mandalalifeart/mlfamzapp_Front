import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { buttonStyle } from "./buttonStyle";

const API_BASE =
  import.meta.env.VITE_API_BASE ||
  "https://us-central1-mlfamzapp.cloudfunctions.net";
// Narrow key (not ADMIN_KEY) - gates refresh, statement upload and
// classification-rule writes on this page only.
const WISE_REFRESH_KEY = import.meta.env.VITE_WISE_REFRESH_KEY || "";

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function formatMoney(amount, currency) {
  if (amount === null || amount === undefined) return "–";
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency, minimumFractionDigits: 2 }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}

function cardStyle(extra = {}) {
  return { background: "#fff", border: "1px solid #ddd", borderRadius: "8px", padding: "16px", ...extra };
}

function tableCellStyle(extra = {}) {
  return { border: "1px solid #ccc", padding: "6px 8px", textAlign: "left", fontSize: "13px", verticalAlign: "top", ...extra };
}

function numberCellStyle(extra = {}) {
  return tableCellStyle({ textAlign: "right", whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums", ...extra });
}

const ALL_TAB = "ALL";

function tabStyle(active) {
  return {
    padding: "8px 16px",
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

const headStyle = (extra = {}) => tableCellStyle({ background: "#f4f4f4", fontWeight: 600, ...extra });

function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] || "");
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function SourceMark({ row }) {
  if (row.source === "statement") {
    return <span title="Confirmed by the uploaded Wise statement" style={{ color: "#1b7f3b" }}>✓</span>;
  }
  if (row.monthConfirmed) {
    return (
      <span title="From the API, but NOT in the uploaded statement for this month - check it" style={{ color: "#b00020" }}>
        ⚠
      </span>
    );
  }
  return <span title="From the Wise API - not yet confirmed by a statement" style={{ color: "#999" }}>api</span>;
}

function docUrl(id) {
  return `${API_BASE}/GetWiseDocument?id=${encodeURIComponent(id)}&key=${encodeURIComponent(WISE_REFRESH_KEY)}`;
}

const ACCEPT_DOCS = ".pdf,.jpg,.jpeg,.png,.heic,.webp,.doc,.docx,.xlsx,.xls,.csv,.txt,.eml,.zip";

// Where an upload for this row goes: Amazon payouts share one document per
// currency per month (groupKey + month); everything else is per transaction.
function uploadTarget(row) {
  return row.invoiceGroup ? { groupKey: row.invoiceGroup, month: row.date.slice(0, 7) } : { ledgerKey: row.key };
}

function targetId(target) {
  return target.ledgerKey || `${target.groupKey}@${target.month}`;
}

function InvoiceCell({ row, onUpload, onDelete, uploadingKey }) {
  const [dragOver, setDragOver] = useState(false);
  const target = uploadTarget(row);
  const busy = uploadingKey === targetId(target);
  const doc = row.invoices[0];
  const missing = row.invoiceRequired && !doc;
  const notNeeded = !row.invoiceRequired && !doc;

  function onDrop(e) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file && !busy) onUpload(target, file);
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={onDrop}
      title="Drop a file here to attach / replace the invoice"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "2px",
        minWidth: "110px",
        padding: "2px 4px",
        borderRadius: "4px",
        outline: dragOver ? "2px dashed #1565c0" : "none",
        background: dragOver ? "#e8f0fe" : undefined,
      }}
    >
      {(row.invoiceGroup ? row.invoices.slice(0, 1) : row.invoices).map((doc) => (
        <span key={doc.id} style={{ whiteSpace: "nowrap", fontSize: "12px" }}>
          <a href={docUrl(doc.id)} target="_blank" rel="noopener noreferrer" title={doc.filename} style={{ color: "#1565c0" }}>
            📎 {row.invoiceGroup ? `${groupPlatform(row.invoiceGroup)} invoice ${doc.number || `${row.currency} ${row.date.slice(0, 7)}`}` : doc.filename.replace(/^\d{4}-\d{2}-\d{2}_[^_]*_[^_]*_/, "").slice(0, 18)}
          </a>{" "}
          <button
            onClick={() => window.confirm(`Remove ${doc.filename}?`) && onDelete(doc.id)}
            title="Remove this document"
            style={{ border: "none", background: "none", color: "#b00020", cursor: "pointer", padding: 0, fontSize: "11px" }}
          >
            ✕
          </button>
        </span>
      ))}
      {row.invoiceGroup && (
        <span style={{ fontSize: "10px", color: "#888" }}>your monthly invoice to {groupPlatform(row.invoiceGroup)} ({row.currency}) covers all payouts</span>
      )}
      {row.report && (
        <a
          href={docUrl(row.report.id)}
          target="_blank"
          rel="noopener noreferrer"
          title="Generated payouts report (supporting document, not an invoice)"
          style={{ color: "#666", fontSize: "11px" }}
        >
          📄 payouts report
        </a>
      )}
      <span style={{ display: "flex", gap: "6px", alignItems: "center" }}>
        {missing && <span style={{ color: "#b00020", fontSize: "11px", fontWeight: 700 }}>⚠ missing</span>}
        {notNeeded && (
          <span
            style={{ fontSize: "11px", color: "#aaa" }}
            title="No invoice needed (cashback / own-balance conversion / reversed card check / running-balance supplier)"
          >
            not needed
          </span>
        )}
        <label style={{ cursor: "pointer", fontSize: "12px", color: "#1565c0", whiteSpace: "nowrap" }}>
          {busy ? "uploading..." : doc ? "↻ replace" : "➕ add"}
          <input
            type="file"
            accept={ACCEPT_DOCS}
            style={{ display: "none" }}
            disabled={busy}
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) onUpload(target, file);
            }}
          />
        </label>
        {doc && !row.invoiceGroup && (
          <label style={{ cursor: "pointer", fontSize: "12px", color: "#1565c0", whiteSpace: "nowrap" }} title="Another invoice paid by this same transaction">
            ➕ another
            <input
              type="file"
              accept={ACCEPT_DOCS}
              style={{ display: "none" }}
              disabled={busy}
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (file) onUpload({ ...target, add: true }, file);
              }}
            />
          </label>
        )}
      </span>
    </div>
  );
}

// "etsy|USD" -> "Etsy", "amazon|EUR" -> "Amazon" (group invoice labels).
function groupPlatform(group) {
  const p = String(group || "").split("|")[0];
  return p ? p.charAt(0).toUpperCase() + p.slice(1) : "Amazon";
}

const LEDGER_SORTS = {
  date: (r) => r.date || "",
  counterparty: (r) => (r.counterparty || "").toLowerCase(),
  amount: (r) => r.eurAmount ?? r.amount ?? 0,
  classification: (r) => (r.classification || "").toLowerCase(),
};

function LedgerTable({ title, rows: unsortedRows, currency, direction, classes, otherClasses, onClassify, savingKey, invoiceProps, onMoveToBalance, onNoDocument }) {
  const counterpartyLabel = direction === "in" ? "Payer" : direction === "out" ? "Payee" : "Payer / Payee";
  // Sortable columns (per the user 2026-10-03): click a header, click again to reverse.
  const [sort, setSort] = useState({ key: "date", dir: "desc" });
  const rows = useMemo(() => {
    const f = LEDGER_SORTS[sort.key];
    return [...unsortedRows].sort((a, b) => {
      const va = f(a);
      const vb = f(b);
      const c = typeof va === "number" ? va - vb : String(va).localeCompare(String(vb));
      return sort.dir === "asc" ? c : -c;
    });
  }, [unsortedRows, sort]);
  const sortHead = (key, label, style) => (
    <th
      style={headStyle({ cursor: "pointer", userSelect: "none", ...style })}
      onClick={() => setSort((s) => ({ key, dir: s.key === key && s.dir === "asc" ? "desc" : "asc" }))}
      title="Click to sort"
    >
      {label}
      {sort.key === key ? (sort.dir === "asc" ? " ▲" : " ▼") : " ⇅"}
    </th>
  );
  return (
    <div style={{ overflowX: "auto" }}>
      <h3 style={{ margin: "0 0 8px", fontSize: "16px" }}>
        {title} <span style={{ fontWeight: 400, color: "#888", fontSize: "13px" }}>({rows.length})</span>
      </h3>
      <table style={{ borderCollapse: "collapse", width: "100%" }}>
        <thead>
          <tr>
            {sortHead("date", "Date", { width: "1%", whiteSpace: "nowrap" })}
            {sortHead("counterparty", counterpartyLabel, {})}
            {sortHead("amount", "Amount", { width: "1%", textAlign: "right", whiteSpace: "nowrap" })}
            {sortHead("classification", "Classification", { width: "1%", whiteSpace: "nowrap" })}
            <th style={headStyle({ width: "1%" })}>Invoice</th>
            <th style={headStyle({ width: "1%" })} title="✓ = confirmed by statement">✓</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key}>
              <td style={tableCellStyle({ whiteSpace: "nowrap" })}>
                {row.date.slice(0, 10)}
                {direction === "mixed" && (
                  <div style={{ fontSize: "11px", color: row.direction === "in" ? "#1b7f3b" : "#b00020" }}>
                    {row.direction === "in" ? "⬇ in" : "⬆ out"}
                  </div>
                )}
              </td>
              <td style={tableCellStyle()} title={row.description}>
                <div style={{ fontWeight: 600, fontStyle: row.counterpartyInferred ? "italic" : "normal" }}>
                  {row.counterparty || "–"}
                </div>
                {row.reference && row.detailsType !== "CONVERSION" && (
                  <div style={{ fontSize: "11px", color: "#888", wordBreak: "break-all" }}>{row.reference}</div>
                )}
                {row.detailsType === "CARD" && <div style={{ fontSize: "11px", color: row.isAtm ? "#b45309" : "#888" }}>{row.isAtm ? "ATM" : "Card"}</div>}
              </td>
              <td style={numberCellStyle({ fontWeight: 600 })}>
                {formatMoney(row.amount, row.currency || currency)}
                {row.netted && (
                  <div style={{ fontSize: "11px", color: "#888", fontWeight: 400 }}>charge, netted</div>
                )}
                {row.fee > 0 && (
                  <div style={{ fontSize: "11px", color: "#888", fontWeight: 400 }}>incl. fee {formatMoney(row.fee, row.currency || currency)}</div>
                )}
                {row.exchangeCurrency && row.exchangeAmount > 0 && (
                  <div style={{ fontSize: "11px", color: "#888", fontWeight: 400 }}>
                    {direction === "out" ? "→ " : "← "}
                    {formatMoney(row.exchangeAmount, row.exchangeCurrency)}
                  </div>
                )}
              </td>
              <td style={tableCellStyle({ whiteSpace: "nowrap" })}>
                <select
                  value={row.classification}
                  disabled={!row.counterparty || savingKey === `${row.direction}|${row.counterparty}`}
                  title={`Applies to every ${row.direction === "in" ? "payment from" : "payment to"} "${row.counterparty}"`}
                  onChange={(e) =>
                    onClassify(row.direction, row.counterparty, e.target.value, row.classificationSource === "row" ? row.key : "")
                  }
                  style={{
                    padding: "2px 4px",
                    fontSize: "12px",
                    color: "#222",
                    background: row.classification === "Unclassified" ? "#fff4d6" : "#fff",
                    fontWeight: row.classificationSource === "rule" ? 600 : 400,
                  }}
                >
                  {(direction === "mixed"
                    ? row.direction === "in" ? classes : otherClasses
                    : row.direction === direction ? classes : otherClasses
                  ).map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </td>
              <td style={tableCellStyle({ background: row.invoiceRequired && row.invoices.length === 0 ? "#fff0f0" : undefined })}>
                <InvoiceCell row={row} {...invoiceProps} />
                {onNoDocument && (
                  <button
                    onClick={() => onNoDocument(row)}
                    title="This transaction needs no document at all (it leaves the missing list)"
                    style={{ border: "none", background: "none", color: "#555", cursor: "pointer", padding: 0, fontSize: "11px", textAlign: "left", display: "block", marginTop: "4px" }}
                  >
                    ✓ no document needed
                  </button>
                )}
                {/* Tax payments/refunds always need their tax document (per the
                    user 2026-10-03) - never offered for the Other expenses balance. */}
                {onMoveToBalance && row.direction === "out" && !/tax/i.test(row.classification || "") && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "2px", marginTop: "4px" }}>
                    <button
                      onClick={() => onMoveToBalance(row, "Other expense")}
                      title="This payment is covered by the Other expenses running balance (no invoice per payment)"
                      style={{ border: "none", background: "none", color: "#6a1b9a", cursor: "pointer", padding: 0, fontSize: "11px", textAlign: "left" }}
                    >
                      → Other expenses balance
                    </button>
                  </div>
                )}
              </td>
              <td style={tableCellStyle({ textAlign: "center" })}>
                <SourceMark row={row} />
              </td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td style={tableCellStyle({ color: "#888" })} colSpan={6}>No transactions.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function addToBucket(byClass, name, cur, native, eur, row) {
  const b = byClass.get(name) || { name, native: {}, eur: 0, count: 0, missingKeys: new Set(), docs: {}, monthTotals: {}, monthEur: {} };
  b.native[cur] = (b.native[cur] || 0) + native;
  b.eur += eur || 0;
  b.count += 1;
  if (row) {
    // Monthly per-currency invoices (Amazon/Etsy) count once per group, not per payout.
    const missKey = row.invoiceGroup ? `${row.invoiceGroup}@${row.date.slice(0, 7)}` : row.key;
    if (row.invoiceRequired && row.invoices.length === 0) b.missingKeys.add(missKey);
    if (row.invoiceGroup) {
      const list = (b.docs[cur] = b.docs[cur] || {});
      const month = row.date.slice(0, 7);
      if (!(month in list)) list[month] = row.invoices[0] || null;
      // Monthly Amazon/Etsy invoices are verified against this table's total.
      const mt = (b.monthTotals[cur] = b.monthTotals[cur] || {});
      mt[month] = (mt[month] || 0) + native;
      const me = (b.monthEur[cur] = b.monthEur[cur] || {});
      me[month] = (me[month] || 0) + (eur || 0);
    }
  }
  byClass.set(name, b);
}

// Checks a monthly Amazon/Etsy invoice against this table. An invoice can
// cover several currencies (coveredGroups); the other currencies are converted
// to the invoice currency at the ECB rate of each payout, so a small FX
// difference (<= 2% of the converted part) is accepted and shown separately.
function verifyGroupDoc(b, cur, m, doc) {
  const covered = doc.coveredGroups || [doc.groupKey];
  const primaryCur = (doc.groupKey || "").split("|")[1] || cur;
  if (cur !== primaryCur) return { status: "secondary", primaryCur };
  if (doc.total == null) return { status: "unread" };
  if (doc.currency && doc.currency !== cur) return { status: "currency" };
  const own = b.monthTotals[cur]?.[m] ?? 0;
  const others = covered.map((g) => g.split("|")[1]).filter((c) => c && c !== cur);
  if (!others.length) {
    const diff = doc.total - own;
    return { status: Math.abs(diff) < 0.01 ? "ok" : "mismatch", expected: own, diff, accepted: !!doc.differenceAccepted };
  }
  const ownEur = b.monthEur[cur]?.[m] ?? 0;
  const rate = cur === "EUR" ? 1 : ownEur ? own / ownEur : 1;
  const converted = others.reduce((s, c) => s + (b.monthEur[c]?.[m] ?? 0), 0) * rate;
  const expected = own + converted;
  const diff = doc.total - expected;
  const ok = Math.abs(diff) <= Math.max(0.02, 0.02 * Math.abs(converted));
  return { status: ok ? (Math.abs(diff) < 0.01 ? "ok" : "fx") : "mismatch", expected, diff, others, converted, accepted: !!doc.differenceAccepted };
}

function CurrencySummaryTable({ title, rows, direction, currencies, feesClass, onSetCoverage }) {
  // One row per classification, one column per currency (native amounts),
  // plus a € total (each transaction converted at its own date's ECB rate).
  const { list, totals } = useMemo(() => {
    const byClass = new Map();
    for (const r of rows) {
      const fee = direction === "out" ? r.fee || 0 : 0;
      const eurFee = direction === "out" ? r.eurFee || 0 : 0;
      addToBucket(byClass, r.classification, r.currency, r.amount - fee, (r.eurAmount ?? 0) - eurFee, r);
      if (fee > 0) addToBucket(byClass, feesClass, r.currency, fee, eurFee, null);
    }
    const sorted = [...byClass.values()].sort((a, b) => (a.name === feesClass) - (b.name === feesClass) || b.eur - a.eur);
    const t = { native: {}, eur: 0, missing: 0 };
    for (const b of sorted) {
      b.missing = b.missingKeys.size;
      b.mismatches = 0;
      for (const [cur, months] of Object.entries(b.docs)) {
        for (const [m, doc] of Object.entries(months)) {
          const v = doc ? verifyGroupDoc(b, cur, m, doc) : null;
          if (v && ((v.status === "mismatch" && !v.accepted) || v.status === "unread" || v.status === "currency")) b.mismatches += 1;
        }
      }
      for (const [c, v] of Object.entries(b.native)) t.native[c] = (t.native[c] || 0) + v;
      t.eur += b.eur;
      t.missing += b.missing;
    }
    return { list: sorted, totals: t };
  }, [rows, direction, feesClass]);

  return (
    <div style={{ overflowX: "auto" }}>
      <h4 style={{ margin: "0 0 6px", fontSize: "14px" }}>{title}</h4>
      <table style={{ borderCollapse: "collapse", width: "100%" }}>
        <thead>
          <tr>
            <th style={headStyle()}>Classification</th>
            {currencies.map((c) => (
              <th key={c} style={headStyle({ width: "1%", textAlign: "right" })}>{c}</th>
            ))}
            <th style={headStyle({ width: "1%", textAlign: "right", whiteSpace: "nowrap" })}>Total €</th>
            <th style={headStyle({ width: "1%", textAlign: "right", whiteSpace: "nowrap" })}>Missing invoices</th>
          </tr>
        </thead>
        <tbody>
          {list.map((b) => (
            <tr key={b.name} style={{ background: b.name === "Unclassified" ? "#fff8e6" : undefined }}>
              <td style={tableCellStyle()}>{b.name}</td>
              {currencies.map((c) => (
                <td key={c} style={numberCellStyle({ color: b.native[c] ? undefined : "#ccc" })}>
                  {b.native[c] ? formatMoney(b.native[c], c) : "–"}
                  {b.docs[c] &&
                    Object.entries(b.docs[c]).map(([m, doc]) => (
                      <div key={m} style={{ fontSize: "11px", fontWeight: 400 }}>
                        {doc ? (
                          <>
                            <a href={docUrl(doc.id)} target="_blank" rel="noopener noreferrer" style={{ color: "#1565c0" }} title={doc.filename}>
                              🧾 {doc.number || "invoice"}
                              {Object.keys(b.docs[c]).length > 1 ? ` (${m})` : ""}
                            </a>
                            {(() => {
                              const v = verifyGroupDoc(b, c, m, doc);
                              if (v.status === "secondary")
                                return <div style={{ color: "#1b7f3b" }}>✓ included in the {v.primaryCur} invoice</div>;
                              if (v.status === "unread") return <div style={{ color: "#b26a00" }}>⚠ amount not read</div>;
                              if (v.status === "currency") return <div style={{ color: "#b00020" }}>⚠ invoice is in {doc.currency}</div>;
                              if (v.status === "ok")
                                return (
                                  <span style={{ color: "#1b7f3b" }}>
                                    {" "}✓{v.others ? ` incl. ${v.others.join(" + ")}` : ""}
                                  </span>
                                );
                              if (v.status === "fx")
                                return (
                                  <div style={{ color: "#1b7f3b" }} title={`Expected ${formatMoney(v.expected, c)} with ${v.others.join("+")} at ECB rates`}>
                                    ✓ incl. {v.others.join(" + ")} (FX diff {formatMoney(v.diff, c)})
                                  </div>
                                );
                              // A difference the user accepted (2026-10-03) shows as OK.
                              if (doc.differenceAccepted)
                                return (
                                  <div style={{ color: "#1b7f3b" }} title={`Invoice ${formatMoney(doc.total, c)} vs Wise ${formatMoney(v.expected, c)}`}>
                                    ✓ difference {v.diff > 0 ? "+" : ""}{formatMoney(v.diff, c)} accepted
                                  </div>
                                );
                              return (
                                <div style={{ color: "#b00020", fontWeight: 600 }} title={`Invoice ${formatMoney(doc.total, c)} vs Wise ${formatMoney(v.expected, c)}`}>
                                  ⚠ invoice {formatMoney(doc.total, c)} ({v.diff > 0 ? "+" : ""}
                                  {formatMoney(v.diff, c)})
                                  {onSetCoverage && (
                                    <a
                                      href="#"
                                      onClick={(e) => {
                                        e.preventDefault();
                                        onSetCoverage(doc.id, null, { differenceAccepted: true });
                                      }}
                                      style={{ marginLeft: "6px", color: "#1565c0", fontWeight: 400 }}
                                    >
                                      ignore
                                    </a>
                                  )}
                                </div>
                              );
                            })()}
                          </>
                        ) : (
                          <span style={{ color: "#b00020" }}>
                            ⚠ no invoice{Object.keys(b.docs[c]).length > 1 ? ` (${m})` : ""}
                            {onSetCoverage &&
                              Object.entries(b.docs)
                                .filter(([oc, months]) => oc !== c && months[m])
                                .map(([oc, months]) => {
                                  const other = months[m];
                                  const group = (other.groupKey || "").split("|")[0];
                                  return (
                                    <button
                                      key={oc}
                                      title={`Mark that the ${oc} invoice also covers the ${c} payouts of ${m}`}
                                      onClick={() =>
                                        onSetCoverage(other.id, [...(other.coveredGroups || [other.groupKey]).slice(1), `${group}|${c}`])
                                      }
                                      style={{ display: "block", border: "none", background: "none", color: "#1565c0", cursor: "pointer", padding: 0, fontSize: "11px", marginLeft: "auto" }}
                                    >
                                      ↳ included in {oc} invoice {other.number}
                                    </button>
                                  );
                                })}
                          </span>
                        )}
                      </div>
                    ))}
                </td>
              ))}
              <td style={numberCellStyle({ fontWeight: 600 })}>{formatMoney(b.eur, "EUR")}</td>
              <td style={numberCellStyle({ color: b.missing || b.mismatches ? "#b00020" : "#1b7f3b", fontWeight: b.missing || b.mismatches ? 700 : 400 })}>
                {b.name === feesClass ? "–" : b.missing ? `⚠ ${b.missing}` : b.mismatches ? "" : "✓"}
                {b.mismatches > 0 && <div style={{ fontSize: "11px" }}>⚠ {b.mismatches} amount mismatch</div>}
              </td>
            </tr>
          ))}
          <tr>
            <td style={tableCellStyle({ fontWeight: 700 })}>Total</td>
            {currencies.map((c) => (
              <td key={c} style={numberCellStyle({ fontWeight: 700 })}>{totals.native[c] ? formatMoney(totals.native[c], c) : "–"}</td>
            ))}
            <td style={numberCellStyle({ fontWeight: 700 })}>{formatMoney(totals.eur, "EUR")}</td>
            <td style={numberCellStyle({ fontWeight: 700, color: totals.missing ? "#b00020" : "#1b7f3b" })}>
              {totals.missing ? `⚠ ${totals.missing}` : "✓"}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function BulkUpload({ onAttach, onUnattach, missingRows, onFinished, period, groupRows = [], occupiedKeys = new Set() }) {
  // Manual targets for monthly Amazon/Etsy invoices in the selected period.
  const groupTargets = [];
  const seenGroups = new Set();
  for (const r of groupRows) {
    const m = r.date.slice(0, 7);
    const value = `group:${r.invoiceGroup}:${m}`;
    if (seenGroups.has(value)) continue;
    seenGroups.add(value);
    const [platform, cur] = r.invoiceGroup.split("|");
    groupTargets.push({ value, label: `${platform[0].toUpperCase()}${platform.slice(1)} ${cur} invoice for ${m}${r.invoices.length ? " (replace)" : ""}` });
  }
  const [items, setItems] = useState([]);
  const [dragOver, setDragOver] = useState(false);
  const [running, setRunning] = useState(false);
  const fileInput = useRef(null);

  function update(id, patch) {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  }

  async function processFiles(files) {
    const queued = [...files].map((file, i) => ({ id: `${Date.now()}-${i}`, file, status: "queued" }));
    if (!queued.length) return;
    setItems((prev) => [...queued, ...prev]);
    setRunning(true);
    let attached = 0;
    for (const it of queued) {
      if (await matchOne(it)) attached += 1;
    }
    setRunning(false);
    if (attached) onFinished();
  }

  // Reads one file and attaches / imports it. Returns true if something was stored.
  async function matchOne(it, noAutoAttach = false, replace = false, add = false) {
    let attached = 0;
    {
      update(it.id, { status: "reading" });
      try {
        const contentBase64 = await readFileAsBase64(it.file);
        // Wise monthly statement (zip of per-currency xlsx, or a single xlsx)
        // goes to the statement import instead of invoice matching.
        if (/statement/i.test(it.file.name) && /\.(zip|xlsx|pdf)$/i.test(it.file.name)) {
          const response = await fetch(`${API_BASE}/ImportWiseStatement?key=${encodeURIComponent(WISE_REFRESH_KEY)}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ filename: it.file.name, contentBase64, period }),
          });
          const result = await response.json();
          if (!response.ok || result.error) throw new Error(result?.error || `HTTP ${response.status}`);
          if (result.acceptedInBackground) {
            update(it.id, { status: "error", error: "Still reading the PDF statement - reload the page in a minute." });
            return false;
          }
          attached += 1;
          update(it.id, { status: "statement", result });
          return true;
        }
        const response = await fetch(`${API_BASE}/AutoMatchWiseInvoice?key=${encodeURIComponent(WISE_REFRESH_KEY)}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ filename: it.file.name, contentBase64, noAutoAttach, replace, add, period }),
        });
        const result = await response.json();
        if (!response.ok || result.error) throw new Error(result?.error || `HTTP ${response.status}`);
        if (result.acceptedInBackground) {
          update(it.id, { status: "error", error: "Took too long - reload the page in a minute to see if it was attached." });
        } else if (result.duplicate) {
          update(it.id, { status: "duplicate", result });
        } else if (result.matched) {
          attached += 1;
          update(it.id, { status: "matched", result });
        } else {
          update(it.id, { status: "choose", result, choice: result.candidates?.[0]?.key || "" });
        }
      } catch (err) {
        update(it.id, { status: "error", error: err.message || String(err) });
      }
    }
    return attached > 0;
  }

  async function unattachAndRematch(it) {
    update(it.id, { status: "reading" });
    await onUnattach(it.result.duplicate.id);
    onFinished();
    await matchOne(it, true);
  }

  async function attachManually(it) {
    if (!it.choice) return;
    update(it.id, { status: "attaching" });
    const target = it.choice.startsWith("supplier|")
      ? { groupKey: it.choice }
      : it.choice.startsWith("group:")
        ? { groupKey: it.choice.split(":")[1], month: it.choice.split(":")[2] }
        : { ledgerKey: it.choice, extraLedgerKeys: (it.extraChoices || []).filter((k) => k && k !== it.choice) };
    if (target.ledgerKey && occupiedKeys.has(target.ledgerKey)) {
      // Several invoices can be paid by one transaction - ask instead of silently replacing.
      target.add = window.confirm(
        "This transaction already has an invoice.\n\nOK = add this one as an ADDITIONAL invoice (both stay)\nCancel = REPLACE the existing invoice"
      );
    }
    const ok = await onAttach(target, it.file);
    update(it.id, { status: ok ? "attached" : "choose" });
  }

  const describe = (c) => `${c.date} · ${c.counterparty} · ${formatMoney(c.amount, c.currency)}`;

  return (
    <div style={cardStyle({ marginBottom: "16px" })}>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          processFiles(e.dataTransfer.files || []);
        }}
        onClick={() => fileInput.current?.click()}
        style={{
          border: `2px dashed ${dragOver ? "#1565c0" : "#bbb"}`,
          background: dragOver ? "#e8f0fe" : "#fcfcfc",
          borderRadius: "8px",
          padding: "16px",
          textAlign: "center",
          cursor: "pointer",
          color: "#555",
          fontSize: "14px",
        }}
      >
        <strong>📥 Bulk upload for {period}</strong> - drop invoices and/or the Wise statement for this period here (or
        click to choose several). Invoices are read automatically (supplier, date, amount) and attached to the matching
        Wise transaction of {period}; a statement (statement_….zip / .xlsx / .pdf) confirms the month. Files for other
        months are refused - switch the month above first.
        {running && <div style={{ marginTop: "6px", color: "#1565c0" }}>Reading invoices...</div>}
        <input
          ref={fileInput}
          type="file"
          multiple
          accept={ACCEPT_DOCS}
          style={{ display: "none" }}
          onChange={(e) => {
            processFiles(e.target.files || []);
            e.target.value = "";
          }}
        />
      </div>
      {items.length > 0 && (
        <table style={{ borderCollapse: "collapse", width: "100%", marginTop: "10px" }}>
          <tbody>
            {items.map((it) => {
              const ex = it.result?.extracted;
              const candidates = it.result?.candidates || [];
              const candidateKeys = new Set(candidates.map((c) => c.key));
              return (
                <tr key={it.id}>
                  <td style={tableCellStyle({ width: "25%", wordBreak: "break-all" })}>{it.file.name}</td>
                  <td style={tableCellStyle({ fontSize: "12px", color: "#555" })}>
                    {ex ? `${ex.vendor || "?"} · ${ex.invoice_date || "?"} · ${ex.total ?? "?"} ${ex.currency || ""}` : "–"}
                  </td>
                  <td style={tableCellStyle()}>
                    {it.status === "queued" && <span style={{ color: "#888" }}>waiting...</span>}
                    {it.status === "reading" && <span style={{ color: "#1565c0" }}>reading...</span>}
                    {it.status === "attaching" && <span style={{ color: "#1565c0" }}>attaching...</span>}
                    {it.status === "matched" && (
                      <span style={{ color: "#1b7f3b" }}>
                        ✅{" "}
                        {it.result.groupLabel
                          ? `attached as ${it.result.groupLabel}`
                          : it.result.supplierBalance
                            ? `added to ${it.result.supplierBalance} balance`
                            : `${it.result.added ? "added (additional invoice) to" : "attached to"} ${describe(it.result.transaction)}${
                                it.result.alsoCovers?.length ? ` + ${it.result.alsoCovers.map(describe).join(" + ")}` : ""
                              }`}
                      </span>
                    )}
                    {it.status === "attached" && <span style={{ color: "#1b7f3b" }}>✅ attached</span>}
                    {it.status === "ignored" && <span style={{ color: "#888" }}>⏭ ignored - not uploaded</span>}
                    {it.status === "statement" && (
                      <span style={{ color: "#1b7f3b" }}>
                        📄 Statement imported ({(it.result.periods || []).map((p) => `${p.from} → ${p.to}`).join(", ") || "period unknown"}):{" "}
                        {it.result.rows} transactions - {it.result.alreadyKnown} matched API data, {it.result.created} new
                        {it.result.alreadyStored ? " (this statement file was already on file)" : ""}
                      </span>
                    )}
                    {it.status === "duplicate" && (
                      <span style={{ color: "#8a5a00", background: "#fff4d6", padding: "2px 6px", borderRadius: "4px" }}>
                        ♻ Already uploaded - attached to {it.result.duplicate.attachedTo}{" "}
                        <a href={docUrl(it.result.duplicate.id)} target="_blank" rel="noopener noreferrer" style={{ color: "#1565c0" }}>
                          (open)
                        </a>
                        . Not uploaded again.{" "}
                        <button
                          style={{ ...buttonStyle(), padding: "2px 8px", fontSize: "12px" }}
                          title="Remove it from that transaction and match this file again"
                          onClick={() =>
                            window.confirm(`Unattach from ${it.result.duplicate.attachedTo} and match this file again?`) &&
                            unattachAndRematch(it)
                          }
                        >
                          Unattach
                        </button>
                      </span>
                    )}
                    {it.status === "error" && <span style={{ color: "#b00020" }}>❌ {it.error}</span>}
                    {it.status === "choose" && (
                      <span style={{ display: "flex", gap: "6px", flexWrap: "wrap", alignItems: "center" }}>
                        {it.result?.conflict && (
                          <div style={{ color: "#b00020", fontSize: "12px", width: "100%" }}>
                            ⚠ {it.result.conflict}{" "}
                            {it.result.canAdd && (
                              <button
                                style={{ ...buttonStyle(), padding: "2px 8px", fontSize: "12px", marginRight: "6px" }}
                                title="Both invoices were paid by this one transaction"
                                onClick={async () => {
                                  if (await matchOne(it, false, false, true)) onFinished();
                                }}
                              >
                                Add as additional invoice
                              </button>
                            )}
                            {it.result.canReplace && (
                              <button
                                style={{ ...buttonStyle(), padding: "2px 8px", fontSize: "12px", background: "#b26a00" }}
                                onClick={async () => {
                                  if (!window.confirm("Replace the existing document with this file? The old file will be deleted.")) return;
                                  if (await matchOne(it, false, true)) onFinished();
                                }}
                              >
                                Replace
                              </button>
                            )}
                          </div>
                        )}
                        {it.result?.extractError && (
                          <div style={{ color: "#b00020", fontSize: "12px", width: "100%" }}>
                            ⚠ The invoice could not be read automatically
                            {/credit balance/i.test(it.result.extractError) ? " (Anthropic API credit is empty)" : ""} - choose the
                            transaction manually.
                          </div>
                        )}
                        <span style={{ color: "#b26a00" }}>❓ which transaction?</span>
                        <select
                          value={it.choice}
                          onChange={(e) => update(it.id, { choice: e.target.value })}
                          style={{ fontSize: "12px", maxWidth: "420px", color: "#222" }}
                        >
                          <option value="">- choose -</option>
                          {candidates.length > 0 && (
                            <optgroup label="Best matches">
                              {candidates.map((c) => (
                                <option key={c.key} value={c.key}>{describe(c)}</option>
                              ))}
                            </optgroup>
                          )}
                          {groupTargets.length > 0 && (
                            <optgroup label={`Monthly Amazon / Etsy invoice (${period})`}>
                              {groupTargets.map((g) => (
                                <option key={g.value} value={g.value}>
                                  {g.label}
                                </option>
                              ))}
                            </optgroup>
                          )}
                          <optgroup label="Running balance">
                            <option value="supplier|malani">➕ Add to Malani balance</option>
                            <option value="supplier|acacia">➕ Add to Acacia balance</option>
                            <option value="supplier|owner">➕ Add to Owner (Rafi / Refael Tamir) balance</option>
                            <option value="supplier|other">➕ Add to Other expenses balance</option>
                          </optgroup>
                          <optgroup label="Missing an invoice (this view)">
                            {missingRows
                              .filter((r) => !candidateKeys.has(r.key))
                              .map((r) => (
                                <option key={r.key} value={r.key}>
                                  {describe({ date: r.date.slice(0, 10), counterparty: r.counterparty, amount: r.amount, currency: r.currency })}
                                </option>
                              ))}
                          </optgroup>
                        </select>
                        {it.choice && !it.choice.startsWith("supplier|") && !it.choice.startsWith("group:") && (
                          <>
                            {(it.extraChoices || []).map((ek, idx) => (
                              <select
                                key={idx}
                                value={ek}
                                onChange={(e) => {
                                  const next = [...(it.extraChoices || [])];
                                  next[idx] = e.target.value;
                                  update(it.id, { extraChoices: next });
                                }}
                                style={{ fontSize: "12px", maxWidth: "420px", color: "#222" }}
                              >
                                <option value="">- also paid by... -</option>
                                {[...candidates.map((c) => ({ key: c.key, label: describe(c) })),
                                  ...missingRows
                                    .filter((r) => !candidateKeys.has(r.key))
                                    .map((r) => ({
                                      key: r.key,
                                      label: describe({ date: r.date.slice(0, 10), counterparty: r.counterparty, amount: r.amount, currency: r.currency }),
                                    }))]
                                  .filter((o) => o.key !== it.choice)
                                  .map((o) => (
                                    <option key={o.key} value={o.key}>{o.label}</option>
                                  ))}
                              </select>
                            ))}
                            <button
                              onClick={() => update(it.id, { extraChoices: [...(it.extraChoices || []), ""] })}
                              title="This invoice was paid in more than one transaction"
                              style={{ border: "none", background: "none", color: "#1565c0", cursor: "pointer", fontSize: "12px" }}
                            >
                              ➕ also paid by another transaction
                            </button>
                          </>
                        )}
                        <button style={buttonStyle()} disabled={!it.choice} onClick={() => attachManually(it)}>
                          Attach
                        </button>
                        <button
                          style={{ ...buttonStyle(), background: "#888" }}
                          onClick={() => update(it.id, { status: "ignored" })}
                          title="Skip this file - nothing is uploaded"
                        >
                          Ignore
                        </button>
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

// The supplier's own statement of our account (e.g. Acacia's ledger,
// 2026-10-03) next to our balance on the same date. Each of their lines is
// matched to our invoices/Wise payments; a charge with no uploaded invoice
// PDF is shown in red (per the user).
function SupplierLedgerCheck({ ledger }) {
  const [open, setOpen] = useState(false);
  const cur = ledger.currency;
  const missing = ledger.entries.filter((e) => e.match?.status === "missing_invoice");
  const statusText = (e) => {
    const m = e.match || {};
    if (m.status === "opening") return "opening balance";
    if (m.status === "invoice") return `our invoice ${m.number} (${m.date})`;
    if (m.status === "payment") return `Wise payment ${m.date} ${formatMoney(m.amount, cur)}${m.combined ? " (one payment, split by supplier)" : ""}`;
    if (m.status === "missing_invoice") return "❌ invoice PDF missing";
    return "❌ no matching Wise payment";
  };
  return (
    <div style={{ border: "1px solid #e0e6ef", background: "#f7f9fc", borderRadius: "6px", padding: "8px", marginBottom: "8px", fontSize: "12px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: "8px", flexWrap: "wrap" }}>
        <strong>Supplier&apos;s ledger ({ledger.from} – {ledger.asOf})</strong>
        <a href="#" onClick={(e) => { e.preventDefault(); setOpen((v) => !v); }} style={{ color: "#1565c0" }}>
          {open ? "hide lines" : `show ${ledger.entries.length} lines`}
        </a>
      </div>
      <div style={{ marginTop: "4px" }}>
        They say: <strong style={{ color: ledger.closing < 0 ? "#b00020" : "#1b7f3b" }}>{formatMoney(ledger.closing, cur)}</strong>{" "}
        · ours on {ledger.asOf}: <strong>{formatMoney(ledger.ourBalanceAsOf, cur)}</strong>{" "}
        · difference:{" "}
        <strong style={{ color: Math.abs(ledger.difference) < 1 ? "#1b7f3b" : "#b00020" }}>{formatMoney(ledger.difference, cur)}</strong>
        {missing.length > 0 && (
          <span style={{ color: "#b00020", fontWeight: 700 }}> · {missing.length} invoice PDF(s) missing</span>
        )}
      </div>
      {ledger.notes?.length > 0 && (
        <ul style={{ margin: "6px 0 0 16px", padding: 0, color: "#555" }}>
          {ledger.notes.map((n, i) => <li key={i}>{n}</li>)}
        </ul>
      )}
      {open && (
        <table style={{ borderCollapse: "collapse", width: "100%", marginTop: "6px" }}>
          <thead>
            <tr>
              <th style={headStyle()}>Date</th>
              <th style={headStyle()}>Their entry</th>
              <th style={headStyle({ textAlign: "right" })}>Charged</th>
              <th style={headStyle({ textAlign: "right" })}>Received</th>
              <th style={headStyle()}>On our side</th>
            </tr>
          </thead>
          <tbody>
            {ledger.entries.map((e, i) => {
              const bad = e.match?.status?.startsWith("missing");
              const color = bad ? "#b00020" : undefined;
              return (
                <tr key={i} style={{ background: e.match?.status === "missing_invoice" ? "#fdecea" : undefined }}>
                  <td style={tableCellStyle({ color })}>{e.date}</td>
                  <td style={tableCellStyle({ color })}>{e.type}{e.no ? ` (${e.no})` : ""}</td>
                  <td style={numberCellStyle({ color })}>{e.debit ? formatMoney(e.debit, cur) : ""}</td>
                  <td style={numberCellStyle({ color })}>{e.credit ? formatMoney(e.credit, cur) : ""}</td>
                  <td style={tableCellStyle({ color, fontWeight: bad ? 700 : 400 })}>{statusText(e)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

// One year of a running balance (per the user 2026-10-03: "show only the
// selected year"): opening = previous closing, + paid - invoiced that year.
// A currency with history but no activity this year carries its balance.
function balanceYearView(sup, year) {
  const y = String(year);
  const rows = [];
  for (const cur of [...new Set((sup.years || []).map((r) => r.currency))]) {
    const own = (sup.years || []).filter((r) => r.currency === cur);
    const hit = own.find((r) => r.year === y);
    if (hit) {
      rows.push(hit);
      continue;
    }
    const before = own.filter((r) => r.year < y).pop();
    if (before) rows.push({ currency: cur, year: y, opening: before.closing, paid: 0, invoiced: 0, closing: before.closing });
  }
  return {
    rows,
    payments: sup.payments.filter((p) => (p.date || "").startsWith(y)),
    invoices: sup.invoices.filter((i) => (i.date || "").startsWith(y)),
  };
}

function SupplierBalances({ onUploaded, onDelete, year }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [dragId, setDragId] = useState("");
  const [drafts, setDrafts] = useState({});

  async function load() {
    try {
      const response = await fetch(`${API_BASE}/GetWiseSupplierBalances`);
      const result = await response.json();
      if (!response.ok || result.error) throw new Error(result?.error || `HTTP ${response.status}`);
      setData(result);
    } catch (err) {
      setError(err.message || "Failed to load supplier balances");
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function upload(supplier, files) {
    setBusy(supplier.id);
    try {
      for (const file of files) {
        const contentBase64 = await readFileAsBase64(file);
        const response = await fetch(`${API_BASE}/UploadWiseInvoice?key=${encodeURIComponent(WISE_REFRESH_KEY)}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ groupKey: supplier.groupKey, filename: file.name, contentBase64 }),
        });
        const result = await response.json();
        if (!response.ok || result.error) throw new Error(result?.error || `HTTP ${response.status}`);
      }
      await load();
      onUploaded?.();
    } catch (err) {
      setError(`Upload failed: ${err.message || err}`);
    } finally {
      setBusy("");
    }
  }

  async function saveOpening(supplier) {
    const d = drafts[supplier.id] || {};
    setBusy(supplier.id);
    try {
      const response = await fetch(`${API_BASE}/SetWiseSupplierOpening?key=${encodeURIComponent(WISE_REFRESH_KEY)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supplierId: supplier.id,
          startDate: d.startDate ?? supplier.startDate,
          openingBalance: Number(d.openingBalance ?? supplier.openingBalance) || 0,
          currency: d.currency ?? (supplier.openingCurrency || "USD"),
        }),
      });
      const result = await response.json();
      if (!response.ok || result.error) throw new Error(result?.error || `HTTP ${response.status}`);
      setDrafts((prev) => ({ ...prev, [supplier.id]: {} }));
      await load();
    } catch (err) {
      setError(`Saving failed: ${err.message || err}`);
    } finally {
      setBusy("");
    }
  }

  async function remove(id) {
    await onDelete(id);
    await load();
  }

  const setDraft = (id, field, value) => setDrafts((prev) => ({ ...prev, [id]: { ...prev[id], [field]: value } }));

  return (
    <div style={cardStyle()}>
      <h3 style={{ margin: "0 0 4px", fontSize: "16px" }}>🏭 Running balances {year} - suppliers, owner, other expenses</h3>
      <div style={{ fontSize: "12px", color: "#888", marginBottom: "10px" }}>
        Running balance = payments sent − invoices received (amounts in the currency the supplier received).
        Positive = advance paid, negative = you owe. Set a start date + opening balance so older history
        without invoices doesn't distort it.
      </div>
      {error && <div style={{ color: "#b00020", marginBottom: "8px" }}>{error}</div>}
      {!data && !error && <div>Loading...</div>}
      {/* One balance per row, full width (per the user 2026-10-03). */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "16px" }}>
        {(data?.suppliers || []).map((sup) => {
          const d = drafts[sup.id] || {};
          const v = balanceYearView(sup, year);
          return (
            <div
              key={sup.id}
              onDragOver={(e) => {
                e.preventDefault();
                setDragId(sup.id);
              }}
              onDragLeave={() => setDragId("")}
              onDrop={(e) => {
                e.preventDefault();
                setDragId("");
                upload(sup, [...(e.dataTransfer.files || [])]);
              }}
              style={{
                border: `1px ${dragId === sup.id ? "dashed #1565c0" : "solid #e3e3e3"}`,
                background: dragId === sup.id ? "#e8f0fe" : "#fcfcfc",
                borderRadius: "8px",
                padding: "12px",
              }}
            >
              {/* Collapsed by default (per the user 2026-10-03); the summary line keeps the balance visible. */}
              <details>
              <summary style={{ cursor: "pointer", display: "flex", gap: "12px", alignItems: "baseline", flexWrap: "wrap" }}>
                <strong style={{ fontSize: "15px" }}>▸ {sup.name}</strong>
                {v.rows.map((t) => (
                  <span key={t.currency} style={{ fontSize: "13px", fontWeight: 600, color: t.closing >= 0 ? "#1b7f3b" : "#b00020" }}>
                    {formatMoney(t.closing, t.currency)}
                  </span>
                ))}
                <span style={{ fontSize: "12px", color: "#888" }}>
                  {year}: {v.payments.length} payments · {v.invoices.length} invoices
                </span>
              </summary>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px", flexWrap: "wrap", marginTop: "8px" }}>
                <strong style={{ fontSize: "15px" }}>{sup.name}</strong>
                <label style={{ ...buttonStyle(), cursor: "pointer" }}>
                  {busy === sup.id ? "Working..." : `➕ Add invoice to ${sup.name.split(" ")[0]} balance`}
                  <input
                    type="file"
                    multiple
                    accept={ACCEPT_DOCS}
                    style={{ display: "none" }}
                    onChange={(e) => {
                      const files = [...(e.target.files || [])];
                      e.target.value = "";
                      if (files.length) upload(sup, files);
                    }}
                  />
                </label>
              </div>
              <div style={{ fontSize: "11px", color: "#888", margin: "4px 0 8px" }}>or drop invoices on this box</div>
              <table style={{ borderCollapse: "collapse", width: "100%", marginBottom: "8px" }}>
                <thead>
                  <tr>
                    <th style={headStyle()}>{year}</th>
                    <th style={headStyle({ textAlign: "right" })}>Opening</th>
                    <th style={headStyle({ textAlign: "right" })}>Paid</th>
                    <th style={headStyle({ textAlign: "right" })}>Invoiced</th>
                    <th style={headStyle({ textAlign: "right" })}>Closing</th>
                  </tr>
                </thead>
                <tbody>
                  {v.rows.map((t) => (
                    <tr key={t.currency}>
                      <td style={tableCellStyle()}>{t.currency}</td>
                      <td style={numberCellStyle({ color: "#888" })}>{formatMoney(t.opening, t.currency)}</td>
                      <td style={numberCellStyle()}>{formatMoney(t.paid, t.currency)}</td>
                      <td style={numberCellStyle()}>{formatMoney(t.invoiced, t.currency)}</td>
                      <td style={numberCellStyle({ fontWeight: 700, color: t.closing >= 0 ? "#1b7f3b" : "#b00020" })}>
                        {formatMoney(t.closing, t.currency)}
                        <div style={{ fontSize: "10px", fontWeight: 400 }}>{t.closing >= 0 ? "advance paid" : "owed to supplier"}</div>
                      </td>
                    </tr>
                  ))}
                  {v.rows.length === 0 && (
                    <tr>
                      <td style={tableCellStyle({ color: "#888" })}>No activity in {year}.</td>
                    </tr>
                  )}
                </tbody>
              </table>
              {sup.supplierLedger && <SupplierLedgerCheck ledger={sup.supplierLedger} />}
              {sup.unreadInvoices > 0 && (
                <div style={{ fontSize: "11px", color: "#b26a00", marginBottom: "6px" }}>
                  ⚠ {sup.unreadInvoices} invoice(s) without a readable total - not counted in "Invoiced".
                </div>
              )}
              <div style={{ display: "flex", gap: "6px", alignItems: "center", flexWrap: "wrap", fontSize: "12px", marginBottom: "8px" }}>
                <span>Count from</span>
                <input
                  type="date"
                  value={d.startDate ?? sup.startDate}
                  onChange={(e) => setDraft(sup.id, "startDate", e.target.value)}
                  style={{ fontSize: "12px", color: "#222" }}
                />
                <span>opening balance</span>
                <input
                  type="number"
                  step="0.01"
                  value={d.openingBalance ?? sup.openingBalance}
                  onChange={(e) => setDraft(sup.id, "openingBalance", e.target.value)}
                  style={{ width: "100px", fontSize: "12px", color: "#222" }}
                />
                <select
                  value={d.currency ?? (sup.openingCurrency || "USD")}
                  onChange={(e) => setDraft(sup.id, "currency", e.target.value)}
                  style={{ fontSize: "12px", color: "#222" }}
                >
                  {["USD", "EUR", "GBP", "ILS", "INR"].map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
                <button style={buttonStyle()} disabled={busy === sup.id} onClick={() => saveOpening(sup)}>
                  Save
                </button>
              </div>
              <details>
                <summary style={{ cursor: "pointer", fontSize: "13px" }}>Invoices ({v.invoices.length})</summary>
                <table style={{ borderCollapse: "collapse", width: "100%", marginTop: "6px" }}>
                  <tbody>
                    {v.invoices.map((inv) => (
                      <tr key={inv.id}>
                        <td style={tableCellStyle({ whiteSpace: "nowrap" })}>{inv.date}</td>
                        <td style={tableCellStyle()}>
                          <a href={docUrl(inv.id)} target="_blank" rel="noopener noreferrer" style={{ color: "#1565c0" }}>
                            📎 {inv.number || inv.filename}
                          </a>
                        </td>
                        <td style={numberCellStyle()}>
                          {inv.total ? formatMoney(inv.total, inv.currency || "USD") : "?"}
                          {inv.convertedFrom && <div style={{ fontSize: "10px", color: "#888" }}>from {inv.convertedFrom}</div>}
                        </td>
                        <td style={tableCellStyle({ width: "1%" })}>
                          <button
                            onClick={() => window.confirm(`Remove ${inv.filename}?`) && remove(inv.id)}
                            style={{ border: "none", background: "none", color: "#b00020", cursor: "pointer" }}
                          >
                            ✕
                          </button>
                        </td>
                      </tr>
                    ))}
                    {v.invoices.length === 0 && (
                      <tr>
                        <td style={tableCellStyle({ color: "#888" })}>No invoices yet.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </details>
              <details>
                <summary style={{ cursor: "pointer", fontSize: "13px" }}>Payments ({v.payments.length})</summary>
                <div style={{ overflowX: "auto" }}>
                <table style={{ borderCollapse: "collapse", width: "100%", marginTop: "6px" }}>
                  <thead>
                    <tr>
                      {["Date", "Paid to", "Type", "Details", "Amount", "Taken from Wise", "Wise fee"].map((h) => (
                        <th key={h} style={tableCellStyle({ fontWeight: 600, fontSize: "12px", textAlign: "left" })}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {v.payments.map((p) => (
                      <tr key={p.key}>
                        <td style={tableCellStyle({ whiteSpace: "nowrap" })}>
                          {p.date}
                          {p.time && <div style={{ fontSize: "11px", color: "#888" }}>{p.time}</div>}
                        </td>
                        <td style={tableCellStyle()}>{p.counterparty || "—"}</td>
                        <td style={tableCellStyle({ fontSize: "12px", color: p.type === "ATM" ? "#b45309" : "#555" })}>{p.type}</td>
                        <td style={tableCellStyle({ fontSize: "11px", color: "#666" })}>
                          {p.description}
                          {p.reference && <div>Ref: {p.reference}</div>}
                          <div style={{ color: "#aaa" }}>{p.key.split("|")[0]}</div>
                        </td>
                        <td style={numberCellStyle()}>
                          {formatMoney(p.amount, p.currency)}
                          {p.convertedFrom && <div style={{ fontSize: "10px", color: "#888" }}>ECB rate, from {p.convertedFrom}</div>}
                        </td>
                        <td style={numberCellStyle({ fontSize: "12px", color: "#666" })}>
                          {p.paidFrom}
                          {p.original && !p.original.endsWith(p.paidFrom.split(" ")[1]) && (
                            <div style={{ fontSize: "10px", color: "#888" }}>= {p.original}</div>
                          )}
                        </td>
                        <td style={numberCellStyle({ fontSize: "12px", color: "#666" })}>{p.fee ? formatMoney(p.fee, p.feeCurrency) : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
              </details>
              </details>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Stock value at a date for the accounts (per the user 2026-11-03: the
// year-end stock in the annual report was never counted). Backend:
// StockValuation.py, one saved valuation per date (stock_valuations).
function StockValuation() {
  const [list, setList] = useState(null);
  const [asOf, setAsOf] = useState("");
  const [snap, setSnap] = useState(null);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const [section, setSection] = useState("all");

  useEffect(() => {
    fetch(`${API_BASE}/GetStockValuations`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) throw new Error(d.error);
        setList(d.snapshots || []);
        if (d.snapshots?.length) setAsOf(d.snapshots[0].asOf);
      })
      .catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    if (!asOf) return;
    setSnap(null);
    fetch(`${API_BASE}/GetStockValuations?as_of=${asOf}`)
      .then((r) => r.json())
      .then((d) => (d.error ? setError(d.error) : setSnap(d)))
      .catch((e) => setError(e.message));
  }, [asOf]);

  const rows = (snap?.rows || []).filter((r) => section === "all" || r.section === section);
  const t = snap?.totals || {};

  function downloadCsv() {
    const head = ["SKU", "ASIN", "Group", "Section", "Units", "Units now", "Sold since", "Invoiced since", "FBA US", "FBA EU", "FBA UK",
      "Price USD", "Price source", "Value USD", "Value EUR", "With duty+freight USD", "With duty+freight EUR"];
    const lines = [head, ...rows.map((r) => [r.sku, r.asin, r.group, r.section, r.units, r.unitsNow, r.soldSince, r.invoicedSince,
      r.fbaUS, r.fbaEU, r.fbaUK, r.price, r.priceSource, r.valueUsd, r.valueEur, r.landedUsd, r.landedEur])];
    const csv = lines.map((l) => l.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `stock-value-${asOf}.csv`;
    a.click();
  }

  return (
    <div style={cardStyle({ marginTop: "16px" })}>
      <h3 style={{ marginTop: 0 }}>📦 Stock value (for the accounts)</h3>
      {error && <div style={{ color: "#c0392b" }}>{error}</div>}
      {list && !list.length && <div>No stock valuation yet.</div>}
      {list && list.length > 0 && (
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center", marginBottom: "10px", fontSize: "14px" }}>
          <label>Date{" "}
            <select value={asOf} onChange={(e) => setAsOf(e.target.value)} style={{ padding: "4px" }}>
              {list.map((s) => <option key={s.asOf + s.method} value={s.asOf}>{s.asOf} ({s.method === "backcalc" ? "worked back" : "snapshot"})</option>)}
            </select>
          </label>
          {snap && <button onClick={downloadCsv} style={{ ...buttonStyle(), padding: "4px 10px", fontSize: "13px", width: "auto", margin: 0 }}>Download CSV</button>}
        </div>
      )}
      {asOf && !snap && !error && <div>Loading…</div>}
      {snap && (
        <>
          <div style={{ display: "flex", gap: "18px", flexWrap: "wrap", fontSize: "14px", marginBottom: "8px" }}>
            <div>Units: <b>{Math.round(t.units).toLocaleString()}</b></div>
            <div>At invoice price: <b>{formatMoney(t.valueEur, "EUR")}</b> <span style={{ color: "#777" }}>({formatMoney(t.valueUsd, "USD")})</span></div>
            <div>With import duty + freight: <b>{formatMoney(t.landedEur, "EUR")}</b></div>
            {Object.entries(t.bySection || {}).map(([k, v]) => (
              <div key={k}>{k === "home" ? "Home decor" : k === "pareo" ? "Pareo" : k}: {Math.round(v.units).toLocaleString()} units, {formatMoney(v.valueEur, "EUR")}</div>
            ))}
          </div>
          <div style={{ fontSize: "12px", color: "#666", lineHeight: 1.5, marginBottom: "8px" }}>
            {snap.method === "backcalc"
              ? <>Units on {snap.asOf} = units today (FBA + AWD + Lagerpark + on the way, all regions) + units sold after that date − units on supplier invoices dated after it.</>
              : <>Units on {snap.asOf} = stock in every location that day (FBA + AWD + Lagerpark + on the way).</>}
            {" "}Value = units × purchase price on the last Malani/Acacia invoice dated on or before {snap.asOf}; EUR at the ECB rate of that day
            ({snap.eurPerUsd ? `1 USD = ${snap.eurPerUsd.toFixed(4)} EUR` : "–"}). Amazon's own ledger for that day shows FBA units
            US {t.fbaUS ?? 0} · EU {t.fbaEU ?? 0} · UK {t.fbaUK ?? 0} (FBA warehouses only). Stock still at Malani (not invoiced) is not counted.
            {t.medianPriced > 0 && ` ${Math.round(t.medianPriced)} units have no invoice price and use the median price of their section.`}
          </div>
          <button onClick={() => setOpen((o) => !o)} style={{ ...buttonStyle(), padding: "4px 10px", fontSize: "13px", width: "auto", margin: "0 8px 8px 0" }}>
            {open ? "Hide products" : `Show ${snap.rows.length} products`}
          </button>
          {open && (
            <>
              <select value={section} onChange={(e) => setSection(e.target.value)} style={{ padding: "4px", marginBottom: "8px" }}>
                <option value="all">All</option>
                <option value="home">Home decor</option>
                <option value="pareo">Pareo</option>
              </select>
              <div style={{ overflowX: "auto" }}>
                <table style={{ borderCollapse: "collapse", width: "100%" }}>
                  <thead>
                    <tr>
                      {["SKU", "Units", "Now / sold since / invoiced since", "FBA US/EU/UK", "Price", "Invoice", "Value €", "With duty+freight €"].map((h) => (
                        <th key={h} style={tableCellStyle({ background: "#f6f8fb", fontSize: "12px" })}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.asin}>
                        <td style={tableCellStyle()}>{r.sku}{r.endOfLife && <span style={{ color: "#b03a2e", fontSize: "10px", marginLeft: "4px" }}>EOL</span>}<div style={{ fontSize: "11px", color: "#888" }}>{r.group}</div></td>
                        <td style={numberCellStyle({ fontWeight: 600 })}>{r.units}{r.clipped && <span title="Calculation went below 0 - set to 0" style={{ color: "#c0392b" }}> ⚠</span>}</td>
                        <td style={numberCellStyle({ color: "#666" })}>{r.unitsNow} / {r.soldSince} / {r.invoicedSince}</td>
                        <td style={numberCellStyle({ color: "#666" })}>{r.fbaUS} / {r.fbaEU} / {r.fbaUK}</td>
                        <td style={numberCellStyle()}>{formatMoney(r.price, "USD")}</td>
                        <td style={tableCellStyle({ fontSize: "12px", color: "#666" })}>{r.priceSource}</td>
                        <td style={numberCellStyle()}>{formatMoney(r.valueEur, "EUR")}</td>
                        <td style={numberCellStyle({ color: "#666" })}>{formatMoney(r.landedEur, "EUR")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

function VatSummary({ rows, notRead, periodLabel }) {
  const kinds = [...new Set(rows.map((r) => r.kind))];
  return (
    <div style={cardStyle()}>
      <h3 style={{ margin: "0 0 4px", fontSize: "16px" }}>🧾 VAT / GST paid · {periodLabel}</h3>
      <div style={{ fontSize: "12px", color: "#888", marginBottom: "10px" }}>
        Read from the uploaded invoices. "Input VAT on purchases" = tax charged by suppliers/services;
        "Paid to tax office" = documents attached to your VAT/tax payments.
        {notRead > 0 && ` ${notRead} uploaded document(s) could not be read (Word/Excel/zip) and are not included.`}
      </div>
      {rows.length === 0 && <div style={{ color: "#888", fontSize: "13px" }}>No VAT/GST found in this period's uploaded invoices.</div>}
      {kinds.map((kind) => {
        const list = rows.filter((r) => r.kind === kind);
        const totalEur = list.reduce((s, r) => s + r.eur, 0);
        return (
          <div key={kind} style={{ marginBottom: "12px", overflowX: "auto" }}>
            <h4 style={{ margin: "6px 0", fontSize: "14px" }}>{kind}</h4>
            <table style={{ borderCollapse: "collapse", width: "100%" }}>
              <thead>
                <tr>
                  <th style={headStyle({ width: "1%" })}>Country</th>
                  <th style={headStyle({ width: "1%" })}>Tax</th>
                  <th style={headStyle({ width: "1%", textAlign: "right" })}>#</th>
                  <th style={headStyle({ width: "1%", textAlign: "right" })}>Amount</th>
                  <th style={headStyle({ width: "1%", textAlign: "right" })}>€</th>
                  <th style={headStyle()}>Invoices</th>
                </tr>
              </thead>
              <tbody>
                {list.map((r) => (
                  <tr key={`${r.country}-${r.taxType}-${r.currency}`}>
                    <td style={tableCellStyle({ fontWeight: 600 })}>{r.country}</td>
                    <td style={tableCellStyle()}>{r.taxType}</td>
                    <td style={numberCellStyle({ color: "#888" })}>{r.count}</td>
                    <td style={numberCellStyle()}>{formatMoney(r.tax, r.currency || "EUR")}</td>
                    <td style={numberCellStyle({ fontWeight: 600 })}>
                      {formatMoney(r.eur, "EUR")}
                      {r.eurMissing > 0 && <span title="no ECB rate for this currency"> *</span>}
                    </td>
                    <td style={tableCellStyle({ fontSize: "12px" })}>
                      {r.invoices.map((inv) => (
                        <div key={inv.id}>
                          <a href={docUrl(inv.id)} target="_blank" rel="noopener noreferrer" style={{ color: "#1565c0" }}>
                            📎 {inv.vendor || "invoice"}
                          </a>{" "}
                          <span style={{ color: "#888" }}>
                            {inv.date} · {formatMoney(inv.tax, r.currency || "EUR")}
                            {inv.rate ? ` (${inv.rate}%)` : ""}
                          </span>
                        </div>
                      ))}
                    </td>
                  </tr>
                ))}
                <tr>
                  <td style={tableCellStyle({ fontWeight: 700 })} colSpan={4}>Total</td>
                  <td style={numberCellStyle({ fontWeight: 700 })}>{formatMoney(totalEur, "EUR")}</td>
                  <td style={tableCellStyle()} />
                </tr>
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
}

function MissingAlert({ count, total, currency }) {
  if (!count) return <span style={{ color: "#1b7f3b", fontWeight: 600 }}>✓ All invoices attached</span>;
  return (
    <span style={{ color: "#b00020", fontWeight: 700 }}>
      ⚠ {count} transaction{count === 1 ? "" : "s"} missing invoices ({formatMoney(total, currency)})
    </span>
  );
}

function SummaryTable({ title, rows, currency, direction, feesClass }) {
  const summary = useMemo(() => {
    const buckets = new Map();
    let fees = 0;
    let feeCount = 0;
    for (const r of rows) {
      // Outgoing amounts include Wise's fee - book the fee separately so the
      // classification totals are the real cost and "Wise fees" stands alone.
      const net = direction === "out" ? r.amount - (r.fee || 0) : r.amount; // netted rows arrive already negative
      if (direction === "out" && r.fee > 0) {
        fees += r.fee;
        feeCount += 1;
      }
      const b = buckets.get(r.classification) || { total: 0, count: 0, missing: 0 };
      b.total += net;
      b.count += 1;
      if (r.invoiceRequired && r.invoices.length === 0) b.missing += 1;
      buckets.set(r.classification, b);
    }
    const list = [...buckets.entries()].map(([name, b]) => ({ name, ...b })).sort((a, b) => b.total - a.total);
    if (fees > 0) list.push({ name: feesClass, total: fees, count: feeCount, missing: 0 });
    const total = list.reduce((s, x) => s + x.total, 0);
    const missing = list.reduce((s, x) => s + x.missing, 0);
    return { list, total, missing };
  }, [rows, direction, feesClass]);

  return (
    <div>
      <h4 style={{ margin: "16px 0 6px", fontSize: "14px" }}>{title}</h4>
      <table style={{ borderCollapse: "collapse", width: "100%" }}>
        <thead>
          <tr>
            <th style={headStyle()}>Classification</th>
            <th style={headStyle({ width: "1%", textAlign: "right" })}>#</th>
            <th style={headStyle({ width: "1%", textAlign: "right" })}>Total</th>
            <th style={headStyle({ width: "1%", textAlign: "right" })}>%</th>
            <th style={headStyle({ width: "1%", textAlign: "right", whiteSpace: "nowrap" })}>Missing invoices</th>
          </tr>
        </thead>
        <tbody>
          {summary.list.map((s) => (
            <tr key={s.name} style={{ background: s.name === "Unclassified" ? "#fff8e6" : undefined }}>
              <td style={tableCellStyle()}>{s.name}</td>
              <td style={numberCellStyle({ color: "#888" })}>{s.count}</td>
              <td style={numberCellStyle()}>{formatMoney(s.total, currency)}</td>
              <td style={numberCellStyle({ color: "#888" })}>
                {summary.total ? `${((s.total / summary.total) * 100).toFixed(1)}%` : "–"}
              </td>
              <td style={numberCellStyle({ color: s.missing ? "#b00020" : "#1b7f3b", fontWeight: s.missing ? 700 : 400 })}>
                {s.missing ? `⚠ ${s.missing}` : "✓"}
              </td>
            </tr>
          ))}
          <tr>
            <td style={tableCellStyle({ fontWeight: 700 })}>Total</td>
            <td style={numberCellStyle({ fontWeight: 700 })}>{rows.length}</td>
            <td style={numberCellStyle({ fontWeight: 700 })}>{formatMoney(summary.total, currency)}</td>
            <td style={numberCellStyle()} />
            <td style={numberCellStyle({ fontWeight: 700, color: summary.missing ? "#b00020" : "#1b7f3b" })}>
              {summary.missing ? `⚠ ${summary.missing}` : "✓"}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

export default function WisePage() {
  // Opens on the current month (per the user 2026-10-03; was the previous one).
  const now = new Date();
  const initial = { year: now.getFullYear(), month: now.getMonth() + 1 };
  const [year, setYear] = useState(initial.year);
  const [month, setMonth] = useState(initial.month);
  const [currency, setCurrency] = useState(ALL_TAB);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [note, setNote] = useState("");
  const [savingKey, setSavingKey] = useState("");
  const [uploadingKey, setUploadingKey] = useState("");
  const [hideAmazon, setHideAmazon] = useState(false);
  const [classFilter, setClassFilter] = useState("");

  useEffect(() => {
    const root = document.getElementById("root");
    root?.classList.add("full-bleed");
    return () => root?.classList.remove("full-bleed");
  }, []);

  async function load(y = year, m = month, quiet = false) {
    if (!quiet) setLoading(true);
    setError("");
    try {
      const response = await fetch(`${API_BASE}/GetWiseLedger?year=${y}&month=${m}`);
      const result = await response.json();
      if (!response.ok || result.error) throw new Error(result?.error || `HTTP ${response.status}`);
      setData(result);
    } catch (err) {
      setError(err.message || "Failed to load Wise ledger");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load(year, month);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, month]);

  async function refresh() {
    setBusy("refresh");
    setNote("");
    try {
      const response = await fetch(`${API_BASE}/UpdateWiseFinances?key=${encodeURIComponent(WISE_REFRESH_KEY)}`);
      const result = await response.json();
      if (!response.ok || result.error) throw new Error(result?.error || `HTTP ${response.status}`);
      if (result.acceptedInBackground) {
        setNote("Refresh is still running in the background - reload the page in a minute.");
      } else {
        const r = result.regions?.business || {};
        setNote(`Refreshed from Wise: ${r.ledgerCreated ?? 0} new, ${r.ledgerUpdated ?? 0} updated transaction(s).`);
      }
      await load(year, month, true);
    } catch (err) {
      setNote(`Refresh failed: ${err.message || err}`);
    } finally {
      setBusy("");
    }
  }

  async function uploadInvoice(target, file) {
    setUploadingKey(targetId(target));
    try {
      const contentBase64 = await readFileAsBase64(file);
      const response = await fetch(`${API_BASE}/UploadWiseInvoice?key=${encodeURIComponent(WISE_REFRESH_KEY)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...target, filename: file.name, contentBase64 }),
      });
      const result = await response.json();
      if (!response.ok || result.error) throw new Error(result?.error || `HTTP ${response.status}`);
      await load(year, month, true);
      return true;
    } catch (err) {
      setNote(`Invoice upload failed: ${err.message || err}`);
      return false;
    } finally {
      setUploadingKey("");
    }
  }

  // extra = {differenceAccepted: true} accepts a small invoice/payout difference
  async function setCoverage(id, extraGroupKeys, extra = null) {
    try {
      const response = await fetch(`${API_BASE}/SetWiseDocumentCoverage?key=${encodeURIComponent(WISE_REFRESH_KEY)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(extra ? { id, ...extra } : { id, extraGroupKeys }),
      });
      const result = await response.json();
      if (!response.ok || result.error) throw new Error(result?.error || `HTTP ${response.status}`);
      await load(year, month, true);
    } catch (err) {
      setNote(`Saving failed: ${err.message || err}`);
    }
  }

  // Per the user (2026-10-03): some transactions need no document at all.
  async function markNoDocument(row) {
    try {
      const response = await fetch(`${API_BASE}/SetWiseNoDocument?key=${encodeURIComponent(WISE_REFRESH_KEY)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ledgerKey: row.key, noDocument: true }),
      });
      const result = await response.json();
      if (!response.ok || result.error) throw new Error(result?.error || `HTTP ${response.status}`);
      await load(year, month, true);
    } catch (err) {
      setNote(`Saving failed: ${err.message || err}`);
    }
  }

  async function deleteDocument(id) {
    try {
      const response = await fetch(`${API_BASE}/DeleteWiseDocument?key=${encodeURIComponent(WISE_REFRESH_KEY)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const result = await response.json();
      if (!response.ok || result.error) throw new Error(result?.error || `HTTP ${response.status}`);
      await load(year, month, true);
    } catch (err) {
      setNote(`Removing invoice failed: ${err.message || err}`);
    }
  }

  async function classify(direction, counterparty, classification, ledgerKey = "") {
    const key = `${direction}|${counterparty}`;
    setSavingKey(key);
    try {
      const response = await fetch(`${API_BASE}/SetWiseClassificationRule?key=${encodeURIComponent(WISE_REFRESH_KEY)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ direction, counterparty, classification, ...(ledgerKey ? { ledgerKey } : {}) }),
      });
      const result = await response.json();
      if (!response.ok || result.error) throw new Error(result?.error || `HTTP ${response.status}`);
      await load(year, month, true);
    } catch (err) {
      setNote(`Saving classification failed: ${err.message || err}`);
    } finally {
      setSavingKey("");
    }
  }

  const rows = data?.rows || [];
  const periods = data?.periods || [];
  const years = useMemo(() => [...new Set(periods.map((p) => p.year))].sort((a, b) => b - a), [periods]);
  const monthsForYear = useMemo(
    () => periods.filter((p) => p.year === year).map((p) => p.month).sort((a, b) => a - b),
    [periods, year]
  );

  const currencies = useMemo(() => {
    const counts = new Map();
    for (const r of rows) counts.set(r.currency, (counts.get(r.currency) || 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([c]) => c);
  }, [rows]);

  const showAll = currency === ALL_TAB || !currencies.includes(currency);
  const activeCurrency = showAll ? "" : currency;
  // Outgoing rows classified into a "net against income" class (Amazon card
  // charges -> Amazon payout) are shown on the Incoming side as negatives, so
  // the Amazon payout total is net of them instead of booking them as expenses.
  const nettedClasses = data?.netAgainstIncomeClasses || [];
  const isNetted = (r) => r.direction === "out" && nettedClasses.includes(r.classification);
  // Optional filter on the currency tabs: hide everything Amazon-related
  // (payouts, Amazon card charges/refunds netted into them).
  const HIDDEN_WITH_AMAZON = ["Amazon payout", "Cashback"];
  const amazonFilter = (r) =>
    (!hideAmazon || !HIDDEN_WITH_AMAZON.includes(r.classification)) && (!classFilter || r.classification === classFilter);
  const incoming = rows
    .filter((r) => r.currency === activeCurrency && (r.direction === "in" || isNetted(r)) && amazonFilter(r))
    .map((r) => (isNetted(r) ? { ...r, amount: -r.amount, netted: true } : r));
  const outgoing = rows.filter((r) => r.currency === activeCurrency && r.direction === "out" && !isNetted(r) && amazonFilter(r));
  // "All (€)" tab: every currency, each row converted to EUR at the ECB rate
  // on its own date (eurAmount/eurFee computed server-side).
  const toEur = (r) => ({ ...r, amount: r.eurAmount, fee: r.eurFee || 0 });
  // Conversions between own balances are hidden from the € view (per the user) -
  // they're just money moving between balances, not income or expense.
  const eurRows = rows.filter(
    (r) => r.eurAmount !== null && r.eurAmount !== undefined && r.detailsType !== "CONVERSION"
  );
  const eurMissing = rows.filter((r) => (r.eurAmount === null || r.eurAmount === undefined) && r.detailsType !== "CONVERSION").length;
  // Amazon/Etsy payouts (and their netted card charges) are covered by the
  // monthly platform invoices tracked in the summary table - never listed as
  // missing per transaction (per the user 2026-10-07, all currencies).
  const GROUP_INVOICE_CLASSES = ["Amazon payout", "Etsy payout"];
  const missingInvoice = (r) => r.invoiceRequired && r.invoices.length === 0 && !GROUP_INVOICE_CLASSES.includes(r.classification);
  const allMissing = eurRows.filter(missingInvoice);
  const allMissingEur = allMissing.reduce((s, r) => s + (r.eurAmount || 0), 0);
  const invoiceProps = { onUpload: uploadInvoice, onDelete: deleteDocument, uploadingKey };
  // Native-currency rows for the per-currency summary table (conversions
  // hidden; netted Amazon card charges shown negative on the incoming side).
  const nativeIncoming = rows
    .filter((r) => r.detailsType !== "CONVERSION" && (r.direction === "in" || isNetted(r)))
    .map((r) => (isNetted(r) ? { ...r, amount: -r.amount, eurAmount: r.eurAmount == null ? null : -r.eurAmount, fee: 0, eurFee: 0 } : r));
  const nativeOutgoing = rows.filter((r) => r.detailsType !== "CONVERSION" && r.direction === "out" && !isNetted(r));
  const allIncoming = eurRows
    .filter((r) => r.direction === "in" || isNetted(r))
    .map((r) => (isNetted(r) ? { ...toEur(r), amount: -r.eurAmount, netted: true } : toEur(r)));
  const allOutgoing = eurRows.filter((r) => r.direction === "out" && !isNetted(r)).map(toEur);
  const allIn = allIncoming.reduce((s, r) => s + r.amount, 0);
  const allOut = allOutgoing.reduce((s, r) => s + r.amount, 0);
  const allConfirmed = currencies.every((c) => {
    const conf = data?.confirmation?.[c];
    return conf && conf.partialMonths.length === 0 && conf.confirmedMonths.length > 0;
  });
  const totalIn = incoming.reduce((s, r) => s + r.amount, 0);
  const totalOut = outgoing.reduce((s, r) => s + r.amount, 0);
  const confirmation = data?.confirmation?.[activeCurrency];
  const isConfirmed = confirmation && confirmation.partialMonths.length === 0 && confirmation.confirmedMonths.length > 0;

  const periodLabel = month ? `${MONTH_NAMES[month - 1]} ${year}` : `${year} (all months)`;

  return (
    // colorScheme "light": index.css declares `color-scheme: light dark`, so under an OS dark-mode
    // preference native <select>/<option> render white text on this page's forced-white background.
    <div style={{ padding: "20px 24px", fontFamily: "Arial, sans-serif", minHeight: "100vh", background: "#fafafa", textAlign: "left", colorScheme: "light", color: "#222" }}>
      <h2 style={{ textAlign: "center", marginBottom: "6px" }}>Wise Accounting (Mandala Life ART OÜ)</h2>
      <p style={{ textAlign: "center", fontSize: "13px", color: "#555", marginBottom: "16px" }}>
        Every transaction on every Wise balance. During the month the data comes from the Wise API (partial);
        uploading the monthly statement confirms it.
      </p>

      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "10px", flexWrap: "wrap", marginBottom: "12px" }}>
        <select value={year} onChange={(e) => setYear(Number(e.target.value))} style={{ padding: "6px 8px" }}>
          {(years.length ? years : [year]).map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
        <select value={month} onChange={(e) => setMonth(Number(e.target.value))} style={{ padding: "6px 8px" }}>
          <option value={0}>📅 Whole year</option>
          {MONTH_NAMES.map((name, i) => (
            <option key={name} value={i + 1} disabled={monthsForYear.length > 0 && !monthsForYear.includes(i + 1)}>
              {name}
            </option>
          ))}
        </select>
        <button style={buttonStyle()} onClick={refresh} disabled={!!busy}>
          {busy === "refresh" ? "Refreshing..." : "Refresh from Wise"}
        </button>

      </div>
      {note && <p style={{ textAlign: "center", fontSize: "13px", color: "#555", marginBottom: "12px" }}>{note}</p>}
      {data?.statements?.length > 0 && (
        <p style={{ textAlign: "center", fontSize: "12px", color: "#555", marginBottom: "12px" }}>
          Statement{data.statements.length === 1 ? "" : "s"} on file:{" "}
          {data.statements.map((st) => (
            <a key={st.id} href={docUrl(st.id)} style={{ color: "#1565c0", marginRight: "10px" }}>
              📄 {st.month} · {st.filename}
            </a>
          ))}
        </p>
      )}
      {error && <div style={{ marginBottom: "16px", color: "#b00020", textAlign: "center" }}>{error}</div>}

      {(data?.balances || []).some((b) => b.amount) && (
        <div style={{ ...cardStyle(), marginBottom: "16px", display: "flex", gap: "24px", flexWrap: "wrap", alignItems: "baseline" }}>
          <span style={{ fontSize: "12px", color: "#888", textTransform: "uppercase" }}>Current balances</span>
          {data.balances
            .filter((b) => b.amount)
            .map((b) => (
              <span key={b.currency} style={{ fontSize: "18px", fontWeight: 700 }}>
                {formatMoney(b.amount, b.currency)}
              </span>
            ))}
        </div>
      )}

      {loading && <p style={{ textAlign: "center" }}>Loading...</p>}

      {!loading && !error && data && (
        <BulkUpload
          onAttach={uploadInvoice}
          onUnattach={deleteDocument}
          groupRows={rows.filter((r) => r.invoiceGroup)}
          occupiedKeys={new Set(rows.filter((r) => !r.invoiceGroup && r.invoices.length).map((r) => r.key))}
          period={month ? `${year}-${String(month).padStart(2, "0")}` : String(year)}
          missingRows={rows.filter((r) => r.invoiceRequired && r.invoices.length === 0 && !r.invoiceGroup)}
          onFinished={() => load(year, month, true)}
        />
      )}

      {!loading && !error && (
        <>
          <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "12px", borderBottom: "2px solid #ddd" }}>
            {currencies.length > 0 && (
              <button onClick={() => setCurrency(ALL_TAB)} style={tabStyle(showAll)}>
                All (€) {allConfirmed ? "✅" : "⏳"}
              </button>
            )}
            {currencies.map((c) => {
              const conf = data?.confirmation?.[c];
              const ok = conf && conf.partialMonths.length === 0 && conf.confirmedMonths.length > 0;
              const active = c === activeCurrency;
              return (
                <button key={c} onClick={() => setCurrency(c)} style={tabStyle(active)}>
                  {c} {ok ? "✅" : "⏳"}
                </button>
              );
            })}
            {currencies.length === 0 && <span style={{ color: "#888", padding: "8px" }}>No transactions in {periodLabel}.</span>}
          </div>

          {showAll && currencies.length > 0 && (
            <>
              <div
                style={{
                  ...cardStyle({ padding: "10px 16px" }),
                  marginBottom: "16px",
                  background: allConfirmed ? "#eef8f0" : "#fff8e6",
                  borderColor: allConfirmed ? "#9fd3ad" : "#f0d48a",
                  display: "flex",
                  gap: "24px",
                  flexWrap: "wrap",
                  alignItems: "center",
                }}
              >
                <strong>
                  All currencies in EUR · {periodLabel} · {allConfirmed ? "✅ Confirmed by statement" : "⏳ Partial (from API)"}
                </strong>
                <span>In: <strong style={{ color: "#1b7f3b" }}>{formatMoney(allIn, "EUR")}</strong></span>
                <span>Out: <strong style={{ color: "#b00020" }}>{formatMoney(allOut, "EUR")}</strong></span>
                <span>Net: <strong>{formatMoney(allIn - allOut, "EUR")}</strong></span>
                <MissingAlert count={allMissing.length} total={allMissingEur} currency="EUR" />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "16px" }}>
                <div style={cardStyle()}>
                  <CurrencySummaryTable
                    onSetCoverage={setCoverage}
                    title="⬇ Incoming by classification"
                    rows={nativeIncoming}
                    direction="in"
                    currencies={currencies}
                    feesClass={data.feesClass}
                  />
                </div>
                <div style={cardStyle()}>
                  <CurrencySummaryTable
                    title="⬆ Outgoing by classification"
                    rows={nativeOutgoing}
                    direction="out"
                    currencies={currencies}
                    feesClass={data.feesClass}
                  />
                </div>
                {allMissing.length > 0 && (
                  <div style={cardStyle({ borderColor: "#f3b3b3" })}>
                    <LedgerTable
                      title="⚠ Missing invoices (all currencies)"
                      onMoveToBalance={(row, cls) => classify(row.direction, row.counterparty, cls, row.key)}
                      onNoDocument={markNoDocument}
                      rows={rows.filter((r) => r.detailsType !== "CONVERSION" && missingInvoice(r))}
                      currency="EUR"
                      direction="mixed"
                      classes={data.incomeClasses}
                      otherClasses={data.expenseClasses}
                      onClassify={classify}
                      savingKey={savingKey}
                      invoiceProps={invoiceProps}
                    />
                  </div>
                )}
                <VatSummary rows={data.vatSummary || []} notRead={data.invoicesNotRead || 0} periodLabel={periodLabel} />
                <SupplierBalances onDelete={deleteDocument} year={year} />
                <StockValuation />
              </div>
              <p style={{ fontSize: "11px", color: "#999", marginTop: "12px" }}>
                Each transaction is converted to EUR at the ECB reference rate on its own date (weekends use the
                previous business day). Conversions between your own balances are not shown here.
                {eurMissing > 0 && ` ${eurMissing} transaction(s) in a currency without an ECB rate are not included.`}
              </p>
            </>
          )}

          {activeCurrency && (
            <>
              <label style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "13px", marginBottom: "8px", marginRight: "20px" }}>
                Classification:
                <select value={classFilter} onChange={(e) => setClassFilter(e.target.value)} style={{ fontSize: "13px", color: "#222" }}>
                  <option value="">All</option>
                  {[...new Set(rows.filter((r) => r.currency === activeCurrency).map((r) => r.classification))].sort().map((c) => (
                    <option key={c} value={c}>
                      {c} ({rows.filter((r) => r.currency === activeCurrency && r.classification === c).length})
                    </option>
                  ))}
                </select>
                {classFilter && (
                  <button
                    onClick={() => setClassFilter("")}
                    style={{ border: "none", background: "none", color: "#1565c0", cursor: "pointer", fontSize: "12px" }}
                  >
                    ✕ clear
                  </button>
                )}
              </label>
              <label style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "13px", marginBottom: "8px", cursor: "pointer" }}>
                <input type="checkbox" checked={hideAmazon} onChange={(e) => setHideAmazon(e.target.checked)} />
                Hide Amazon transactions + cashback (payouts, Amazon card charges/refunds, Wise cashback)
                {hideAmazon && (
                  <span style={{ color: "#b26a00" }}>
                    {" "}- {rows.filter((r) => r.currency === activeCurrency && !amazonFilter(r)).length} hidden; totals below exclude them
                  </span>
                )}
              </label>
              <div
                style={{
                  ...cardStyle({ padding: "10px 16px" }),
                  marginBottom: "16px",
                  background: isConfirmed ? "#eef8f0" : "#fff8e6",
                  borderColor: isConfirmed ? "#9fd3ad" : "#f0d48a",
                  display: "flex",
                  gap: "24px",
                  flexWrap: "wrap",
                  alignItems: "center",
                }}
              >
                <strong>
                  {activeCurrency} · {periodLabel} ·{" "}
                  {isConfirmed
                    ? "✅ Confirmed by statement"
                    : confirmation?.confirmedMonths?.length
                      ? `⏳ Partial - confirmed: ${confirmation.confirmedMonths.map((m) => MONTH_NAMES[m - 1]).join(", ")}`
                      : "⏳ Partial (from API) - upload the statement to confirm"}
                </strong>
                <span>In: <strong style={{ color: "#1b7f3b" }}>{formatMoney(totalIn, activeCurrency)}</strong></span>
                <span>Out: <strong style={{ color: "#b00020" }}>{formatMoney(totalOut, activeCurrency)}</strong></span>
                <span>Net: <strong>{formatMoney(totalIn - totalOut, activeCurrency)}</strong></span>
                <MissingAlert
                  count={[...incoming, ...outgoing].filter(missingInvoice).length}
                  total={[...incoming, ...outgoing].filter(missingInvoice).reduce((s, r) => s + Math.abs(r.amount), 0)}
                  currency={activeCurrency}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "16px" }}>
                <div style={cardStyle()}>
                  <LedgerTable
                    title="⬇ Incoming"
                    rows={incoming}
                    currency={activeCurrency}
                    direction="in"
                    classes={data.incomeClasses}
                    otherClasses={data.expenseClasses}
                    onClassify={classify}
                    savingKey={savingKey}
                    invoiceProps={invoiceProps}
                  />
                  <SummaryTable title="Incoming by classification" rows={incoming} currency={activeCurrency} direction="in" feesClass={data.feesClass} />
                </div>
                <div style={cardStyle()}>
                  <LedgerTable
                    title="⬆ Outgoing"
                    rows={outgoing}
                    currency={activeCurrency}
                    direction="out"
                    classes={data.expenseClasses}
                    otherClasses={data.incomeClasses}
                    onClassify={classify}
                    savingKey={savingKey}
                    invoiceProps={invoiceProps}
                  />
                  <SummaryTable title="Outgoing by classification" rows={outgoing} currency={activeCurrency} direction="out" feesClass={data.feesClass} />
                </div>
              </div>
              <p style={{ fontSize: "11px", color: "#999", marginTop: "12px" }}>
                Changing a classification applies to every transaction with that payer/payee (past and future).
                ✓ = confirmed by statement · api = from the Wise API, not yet confirmed · ⚠ = in the API but missing from
                this month's uploaded statement. Italic payer = inferred from the payment reference (older deposits where
                Wise's API doesn't give the payer name). Outgoing totals by classification exclude Wise's fee, which is
                listed separately as "{data.feesClass}".
              </p>
            </>
          )}
        </>
      )}

      <div style={{ display: "flex", justifyContent: "center", gap: "10px", padding: "16px 0" }}>
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
