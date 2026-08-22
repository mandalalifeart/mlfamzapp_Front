import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

const API_BASE =
  import.meta.env.VITE_API_BASE ||
  "https://us-central1-mlfamzapp.cloudfunctions.net";

const IMAGE_BASE = "https://storage.googleapis.com/mlf-amz-images/";

const MAIN_SKU_WIDTH = "144px";
const SAVE_ERROR_COLOR = "#b00020";

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
    padding: "6px 8px",
    textAlign: "left",
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
function EditableCell({ item, field, onSave }) {
  const [value, setValue] = useState(item[field] ?? 0);
  const [status, setStatus] = useState("idle"); // idle | saving | error

  async function commit() {
    const numeric = Number(value);
    const nextValue = Number.isFinite(numeric) && numeric >= 0 ? numeric : 0;
    setValue(nextValue);
    if (nextValue === (item[field] ?? 0)) return;

    setStatus("saving");
    try {
      await onSave(item.sku, field, nextValue);
      setStatus("idle");
    } catch {
      setStatus("error");
    }
  }

  return (
    <input
      type="number"
      min="0"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.target.blur();
      }}
      style={{
        width: "72px",
        padding: "4px 6px",
        textAlign: "right",
        borderRadius: "4px",
        border: `1px solid ${status === "error" ? SAVE_ERROR_COLOR : "#bbb"}`,
        background: status === "saving" ? "#fff8e1" : "#fff",
      }}
    />
  );
}

function TableHeader() {
  return (
    <thead>
      <tr>
        <th style={tableCellStyle({ background: "#f4f4f4" })}>Image</th>
        <th style={tableCellStyle({ background: "#f4f4f4", width: MAIN_SKU_WIDTH })}>SKU</th>
        <th style={tableCellStyle({ background: "#f4f4f4" })}>ASIN</th>
        <th style={numberCellStyle({ background: "#f4f4f4" })}>UK Balance</th>
        <th style={numberCellStyle({ background: "#f4f4f4" })}>UK On The Way</th>
        <th style={numberCellStyle({ background: "#f4f4f4" })}>UK Next Shipment</th>
        <th style={numberCellStyle({ background: "#f4f4f4" })}>DE Balance</th>
        <th style={numberCellStyle({ background: "#f4f4f4" })}>DE On The Way</th>
        <th style={numberCellStyle({ background: "#f4f4f4" })}>DE Next Shipment</th>
        <th style={numberCellStyle({ background: "#f4f4f4" })}>USA Balance</th>
        <th style={numberCellStyle({ background: "#f4f4f4" })}>USA On The Way</th>
        <th style={numberCellStyle({ background: "#f4f4f4" })}>USA Next Shipment</th>
        <th style={numberCellStyle({ background: "#f4f4f4" })}>Malani Balance</th>
        <th style={numberCellStyle({ background: "#f4f4f4" })}>Malani Order</th>
        <th style={numberCellStyle({ background: "#f4f4f4" })}>Needed</th>
        <th style={numberCellStyle({ background: "#f4f4f4" })}>Missing</th>
        <th style={numberCellStyle({ background: "#f4f4f4" })}>Next Order</th>
      </tr>
    </thead>
  );
}

function ItemRow({ item, onSave }) {
  const needed = computeNeeded(item);
  const missing = computeMissing(item);

  return (
    <tr>
      <td style={tableCellStyle({ width: "70px" })}>
        <img
          src={`${IMAGE_BASE}${encodeURIComponent(item.sku)}.jpg`}
          alt={item.sku}
          style={{ width: "50px", height: "50px", objectFit: "cover", borderRadius: "6px" }}
        />
      </td>
      <td style={tableCellStyle({ fontWeight: 600, width: MAIN_SKU_WIDTH })}>{item.sku}</td>
      <td style={tableCellStyle({ fontFamily: "monospace" })}>{item.asin}</td>

      <td style={numberCellStyle()}>{formatUnits(item.uk_balance)}</td>
      <td style={numberCellStyle()}>{formatUnits(item.uk_on_the_way)}</td>
      <td style={numberCellStyle()}>
        <EditableCell item={item} field="uk_next_shipment" onSave={onSave} />
      </td>

      <td style={numberCellStyle()}>{formatUnits(item.de_balance)}</td>
      <td style={numberCellStyle()}>{formatUnits(item.de_on_the_way)}</td>
      <td style={numberCellStyle()}>
        <EditableCell item={item} field="de_next_shipment" onSave={onSave} />
      </td>

      <td style={numberCellStyle()}>{formatUnits(item.usa_balance)}</td>
      <td style={numberCellStyle()}>{formatUnits(item.usa_on_the_way)}</td>
      <td style={numberCellStyle()}>
        <EditableCell item={item} field="usa_next_shipment" onSave={onSave} />
      </td>

      <td style={numberCellStyle()}>{formatUnits(item.malani_balance)}</td>
      <td style={numberCellStyle()}>{formatUnits(item.malani_order)}</td>

      <td style={numberCellStyle({ fontWeight: 700 })}>{formatUnits(needed)}</td>
      <td style={numberCellStyle({ fontWeight: 700, color: missing > 0 ? SAVE_ERROR_COLOR : undefined })}>
        {formatUnits(missing)}
      </td>

      <td style={numberCellStyle()}>
        <EditableCell item={item} field="next_order" onSave={onSave} />
      </td>
    </tr>
  );
}

function GroupSection({ group, expanded, onToggle, onSave }) {
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
          <table style={{ borderCollapse: "collapse", width: "100%", minWidth: "1500px" }}>
            <TableHeader />
            <tbody>
              {group.items.map((item) => (
                <ItemRow key={item.sku} item={item} onSave={onSave} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function NextOrderPage() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [groups, setGroups] = useState([]);
  const [collapsedGroups, setCollapsedGroups] = useState({});

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
          <div style={{ display: "flex", gap: "10px" }}>
            <button style={ghostButtonStyle()} onClick={expandAll}>
              Expand All Groups
            </button>
            <button style={ghostButtonStyle()} onClick={collapseAll}>
              Collapse All Groups
            </button>
          </div>

          {groups.map((group) => (
            <GroupSection
              key={group.group}
              group={group}
              expanded={!collapsedGroups[group.group]}
              onToggle={() => toggleGroup(group.group)}
              onSave={saveField}
            />
          ))}
        </div>
      )}

      <div style={bottomNavStyle()}>
        <button style={blueButtonStyle()} onClick={() => navigate("/")}>
          Home
        </button>
        <button style={blueButtonStyle()} onClick={() => navigate("/sales")}>
          Sales
        </button>
      </div>
    </div>
  );
}
