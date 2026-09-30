// Shared button sizing so every page's nav/action buttons render at the same
// width and height regardless of label length ("Home" vs "Batch Update") or
// which page defined the style - previously each page had its own copy of
// this with slightly different padding/font-size, which is what made
// buttons look inconsistent from one page to the next.
// minWidth is the deliberate width-consistency fix (see module comment) -
// a call site that genuinely needs a smaller/compact button (a table-row
// action, a tight inline control) should override minWidth explicitly
// alongside width, since plain CSS width alone can't shrink below it.
const BASE = {
  minWidth: "150px",
  boxSizing: "border-box",
  padding: "10px 18px",
  fontSize: "14px",
  fontWeight: 600,
  borderRadius: "8px",
  textAlign: "center",
  textDecoration: "none",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
};

export function buttonStyle(disabled = false) {
  return {
    ...BASE,
    border: "none",
    background: disabled ? "#9bbcf7" : "#1976d2",
    color: "#fff",
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.6 : 1,
  };
}

export function ghostButtonStyle(disabled = false) {
  return {
    ...BASE,
    border: "1px solid #1976d2",
    background: "#fff",
    color: "#1976d2",
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.6 : 1,
  };
}

export function dangerButtonStyle(disabled = false) {
  return {
    ...BASE,
    border: "1px solid #b00020",
    background: "#fff",
    color: "#b00020",
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.5 : 1,
  };
}
