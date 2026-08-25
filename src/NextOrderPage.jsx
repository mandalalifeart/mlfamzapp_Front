import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

function productLink(item) {
  return `/product?asin=${encodeURIComponent(item.asin)}&sku=${encodeURIComponent(item.sku)}`;
}

const API_BASE =
  import.meta.env.VITE_API_BASE ||
  "https://us-central1-mlfamzapp.cloudfunctions.net";

const IMAGE_BASE = "https://storage.googleapis.com/mlf-amz-images/";

const SAVE_ERROR_COLOR = "#b00020";
const SAVE_OK_COLOR = "#2e7d32";

// Percentages sum to 100 - table uses table-layout:fixed so these are exact
// column widths, keeping all columns inside one screen width with no
// horizontal scroll needed on a normal laptop/desktop viewport.
const COLUMN_WIDTHS_WITH_ASIN = [4, 13, 6, 5, 5, 6, 5, 5, 6, 5, 5, 6, 5, 5, 6, 6, 7];
// ASIN's 6% folded into SKU when the column is hidden.
const COLUMN_WIDTHS_NO_ASIN = [4, 19, 5, 5, 6, 5, 5, 6, 5, 5, 6, 5, 5, 6, 6, 7];

function cardStyle() {
  return {
    background: "#fff",
    border: "1px solid #ddd",
    borderRadius: "8px",
    padding: "16px",
  };
}

function blueButtonStyle(disabled = false) {
  return {
    padding: "10px 18px",
    fontSize: "14px",
    cursor: disabled ? "not-allowed" : "pointer",
    borderRadius: "8px",
    border: "none",
    background: disabled ? "#9bbcf7" : "#1976d2",
    color: "#ffffff",
    fontWeight: "600",
    opacity: disabled ? 0.6 : 1,
    textDecoration: "none",
    display: "inline-block",
  };
}

function ghostButtonStyle() {
  return {
    padding: "8px 14px",
    fontSize: "13px",
    cursor: "pointer",
    borderRadius: "8px",
    border: "1px solid #1976d2",
    background: "#fff",
    color: "#1976d2",
    fontWeight: "600",
  };
}

function tableCellStyle(extra = {}) {
  return {
    border: "1px solid #ccc",
    padding: "3px 4px",
    textAlign: "left",
    fontSize: "11px",
    overflow: "hidden",
    textOverflow: "ellipsis",
    ...extra,
  };
}

function numberCellStyle(extra = {}) {
  return tableCellStyle({
    textAlign: "right",
    whiteSpace: "nowrap",
    ...extra,
  });
}

// Larger, bolder font for the actual values (as opposed to headers), used on
// every read-only number cell.
function valueCellStyle(extra = {}) {
  return numberCellStyle({
    fontSize: "16px",
    padding: "3px 2px",
    ...extra,
  });
}

function bottomNavStyle() {
  return {
    display: "flex",
    justifyContent: "center",
    gap: "10px",
    marginTop: "28px",
    paddingBottom: "16px",
    flexWrap: "wrap",
  };
}

function formatUnits(value) {
  return Math.round(value || 0).toLocaleString();
}

// needed = sum of the three "next shipment" quantities being planned across markets.
function computeNeeded(item) {
  return (item.uk_next_shipment || 0) + (item.de_next_shipment || 0) + (item.usa_next_shipment || 0);
}

// missing = needed - malani_balance + malani_order, exactly as specified:
// what's still short after the factory's on-hand stock, offset by what's already on order there.
function computeMissing(item) {
  return computeNeeded(item) - (item.malani_balance || 0) + (item.malani_order || 0);
}

// Uncontrolled-by-prop on purpose: the input owns its text while the user is
// typing, and only pushes a value up (recomputing Needed/Missing) once they
// commit it on blur/Enter - syncing from item[field] on every prop change
// would fight the user's keystrokes and needs an effect-driven setState.
const STATUS_BORDER = {
  idle: "#bbb",
  saving: "#bbb",
  saved: SAVE_OK_COLOR,
  error: SAVE_ERROR_COLOR,
};

function EditableCell({ item, field, onSave }) {
  const [value, setValue] = useState(item[field] ?? 0);
  const [status, setStatus] = useState("idle"); // idle | saving | saved | error

  async function commit() {
    const numeric = Number(value);
    const nextValue = Number.isFinite(numeric) && numeric >= 0 ? numeric : 0;
    setValue(nextValue);
    if (nextValue === (item[field] ?? 0)) return;

    setStatus("saving");
    try {
      await onSave(item.sku, field, nextValue);
      setStatus("saved");
      setTimeout(() => setStatus((s) => (s === "saved" ? "idle" : s)), 1200);
    } catch {
      setStatus("error");
    }
  }

  return (
    <input
      type="number"
      min="0"
      className="no-spinner"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.target.blur();
      }}
      style={{
        width: "38px",
        padding: "2px 2px",
        textAlign: "right",
        borderRadius: "4px",
        fontSize: "15px",
        fontWeight: 600,
        colorScheme: "light",
        color: "#111",
        border: `1px solid ${STATUS_BORDER[status]}`,
        background: status === "saving" ? "#fff8e1" : "#fff",
      }}
    />
  );
}

const HEADER_LABELS_WITH_ASIN = [
  "Image", "SKU", "ASIN",
  "UK Bal", "UK OTW", "UK Next",
  "DE Bal", "DE OTW", "DE Next",
  "USA Bal", "USA OTW", "USA Next",
  "Malani Bal", "Malani Ord",
  "Needed", "Missing", "Next Order",
];
const HEADER_LABELS_NO_ASIN = HEADER_LABELS_WITH_ASIN.filter((l) => l !== "ASIN");
const LEADING_COLS_WITH_ASIN = 3; // Image, SKU, ASIN
const LEADING_COLS_NO_ASIN = 2; // Image, SKU

function ColGroup({ showAsin }) {
  const widths = showAsin ? COLUMN_WIDTHS_WITH_ASIN : COLUMN_WIDTHS_NO_ASIN;
  return (
    <colgroup>
      {widths.map((w, i) => (
        <col key={i} style={{ width: `${w}%` }} />
      ))}
    </colgroup>
  );
}

function TableHeader({ showAsin }) {
  const labels = showAsin ? HEADER_LABELS_WITH_ASIN : HEADER_LABELS_NO_ASIN;
  const leadingCols = showAsin ? LEADING_COLS_WITH_ASIN : LEADING_COLS_NO_ASIN;
  return (
    <thead>
      <tr>
        {labels.map((label, i) => (
          <th
            key={label}
            style={
              i < leadingCols
                ? tableCellStyle({ background: "#f4f4f4" })
                : numberCellStyle({ background: "#f4f4f4" })
            }
          >
            {label}
          </th>
        ))}
      </tr>
    </thead>
  );
}

function ItemRow({ item, showAsin, onSave }) {
  const needed = computeNeeded(item);
  const missing = computeMissing(item);

  return (
    <tr>
      <td style={tableCellStyle({ padding: "2px" })}>
        <Link to={productLink(item)} target="_blank" rel="noopener noreferrer">
          <img
            src={`${IMAGE_BASE}${encodeURIComponent(item.sku)}.jpg`}
            alt={item.sku}
            style={{ width: "26px", height: "26px", objectFit: "cover", borderRadius: "4px", display: "block" }}
          />
        </Link>
      </td>
      <td style={tableCellStyle({ fontWeight: 600, wordBreak: "break-word", whiteSpace: "normal" })}>
        <Link to={productLink(item)} target="_blank" rel="noopener noreferrer" style={{ color: "inherit", textDecoration: "none" }}>
          {item.sku}
        </Link>
      </td>
      {showAsin && (
        <td style={tableCellStyle({ fontFamily: "monospace", fontSize: "10px" })}>{item.asin}</td>
      )}

      <td style={valueCellStyle()}>{formatUnits(item.uk_balance)}</td>
      <td style={valueCellStyle()}>{formatUnits(item.uk_on_the_way)}</td>
      <td style={numberCellStyle()}>
        <EditableCell item={item} field="uk_next_shipment" onSave={onSave} />
      </td>

      <td style={valueCellStyle()}>{formatUnits(item.de_balance)}</td>
      <td style={valueCellStyle()}>{formatUnits(item.de_on_the_way)}</td>
      <td style={numberCellStyle()}>
        <EditableCell item={item} field="de_next_shipment" onSave={onSave} />
      </td>

      <td style={valueCellStyle()}>{formatUnits(item.usa_balance)}</td>
      <td style={valueCellStyle()}>{formatUnits(item.usa_on_the_way)}</td>
      <td style={numberCellStyle()}>
        <EditableCell item={item} field="usa_next_shipment" onSave={onSave} />
      </td>

      <td style={valueCellStyle()}>{formatUnits(item.malani_balance)}</td>
      <td style={valueCellStyle()}>{formatUnits(item.malani_order)}</td>

      <td style={valueCellStyle({ fontWeight: 700 })}>{formatUnits(needed)}</td>
      <td style={valueCellStyle({ fontWeight: 700, color: missing > 0 ? SAVE_ERROR_COLOR : undefined })}>
        {formatUnits(missing)}
      </td>

      <td style={numberCellStyle()}>
        <EditableCell item={item} field="next_order" onSave={onSave} />
      </td>
    </tr>
  );
}

function GroupSection({ group, showAsin, expanded, onToggle, onSave }) {
  return (
    <div style={cardStyle()}>
      <div
        onClick={onToggle}
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          cursor: "pointer",
        }}
      >
        <h3 style={{ margin: 0 }}>
          {expanded ? "▾" : "▸"} {group.group}
        </h3>
        <div style={{ color: "#555", fontSize: "13px" }}>
          {group.items.length} product{group.items.length === 1 ? "" : "s"}
        </div>
      </div>

      {expanded && (
        <div style={{ overflowX: "auto", marginTop: "12px" }}>
          <table style={{ borderCollapse: "collapse", width: "100%", tableLayout: "fixed" }}>
            <ColGroup showAsin={showAsin} />
            <TableHeader showAsin={showAsin} />
            <tbody>
              {group.items.map((item) => (
                <ItemRow key={item.sku} item={item} showAsin={showAsin} onSave={onSave} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function NextOrderPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [groups, setGroups] = useState([]);
  const [collapsedGroups, setCollapsedGroups] = useState({});
  const [showAsin, setShowAsin] = useState(false);
  const [onlyMissing, setOnlyMissing] = useState(false);

  async function loadData() {
    setLoading(true);
    setError("");

    try {
      const response = await fetch(`${API_BASE}/GetNextOrderData`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || `HTTP ${response.status}`);
      }

      setGroups(data.groups || []);

      const allCollapsed = {};
      (data.groups || []).forEach((g) => {
        allCollapsed[g.group] = true;
      });
      setCollapsedGroups(allCollapsed);
    } catch (err) {
      setError(err.message || "Failed to load next order data");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    const root = document.getElementById("root");
    root?.classList.add("full-bleed");
    return () => root?.classList.remove("full-bleed");
  }, []);

  async function saveField(sku, field, value) {
    const response = await fetch(`${API_BASE}/UpdateNextOrderField`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sku, field, value }),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data?.error || `HTTP ${response.status}`);
    }

    setGroups((prev) =>
      prev.map((g) => ({
        ...g,
        items: g.items.map((item) => (item.sku === sku ? { ...item, [field]: value } : item)),
      }))
    );
  }

  function toggleGroup(name) {
    setCollapsedGroups((prev) => ({ ...prev, [name]: !prev[name] }));
  }

  function expandAll() {
    setCollapsedGroups({});
  }

  function collapseAll() {
    const next = {};
    groups.forEach((g) => {
      next[g.group] = true;
    });
    setCollapsedGroups(next);
  }

  function toggleOnlyMissing() {
    setOnlyMissing((v) => {
      const next = !v;
      if (next) expandAll(); // surface the filtered rows immediately instead of leaving groups collapsed
      return next;
    });
  }

  const visibleGroups = useMemo(() => {
    if (!onlyMissing) return groups;
    return groups
      .map((g) => ({ ...g, items: g.items.filter((item) => computeMissing(item) > 0) }))
      .filter((g) => g.items.length > 0);
  }, [groups, onlyMissing]);

  return (
    <div
      style={{
        padding: "10px",
        fontFamily: "Arial, sans-serif",
        minHeight: "100vh",
        background: "#fafafa",
      }}
    >
      <h2 style={{ textAlign: "center", marginBottom: "20px" }}>Next Order</h2>

      {error && (
        <div
          style={{
            maxWidth: "1400px",
            marginInline: "auto",
            marginBottom: "20px",
            color: "#b00020",
            background: "#fff1f1",
            border: "1px solid #f0caca",
            padding: "10px",
            borderRadius: "8px",
            textAlign: "center",
          }}
        >
          {error}
        </div>
      )}

      {loading && <div style={{ marginBottom: "20px", textAlign: "center" }}>Loading...</div>}

      {!loading && groups.length > 0 && (
        <div style={{ display: "grid", gap: "18px" }}>
          <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
            <button style={ghostButtonStyle()} onClick={expandAll}>
              Expand All Groups
            </button>
            <button style={ghostButtonStyle()} onClick={collapseAll}>
              Collapse All Groups
            </button>
            <label style={{ display: "flex", alignItems: "center", gap: "6px", marginLeft: "auto", fontSize: "14px" }}>
              <input type="checkbox" checked={onlyMissing} onChange={toggleOnlyMissing} />
              Only show Missing &gt; 0
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "14px" }}>
              <input type="checkbox" checked={showAsin} onChange={() => setShowAsin((v) => !v)} />
              Show ASIN column
            </label>
          </div>

          {onlyMissing && visibleGroups.length === 0 && (
            <div style={{ textAlign: "center", color: "#555" }}>No rows with Missing &gt; 0.</div>
          )}

          {visibleGroups.map((group) => (
            <GroupSection
              key={group.group}
              group={group}
              showAsin={showAsin}
              expanded={!collapsedGroups[group.group]}
              onToggle={() => toggleGroup(group.group)}
              onSave={saveField}
            />
          ))}
        </div>
      )}

      <div style={bottomNavStyle()}>
        <Link style={blueButtonStyle()} to="/">
          Home
        </Link>
        <Link style={blueButtonStyle()} to="/sales">
          Sales
        </Link>
      </div>
    </div>
  );
}
