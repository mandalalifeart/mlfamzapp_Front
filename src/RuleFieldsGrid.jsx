import { RULE_FIELDS } from "./bidRules";

// Shared rule-input rendering for AdsBidOptimizerPage and AdsKeywordsPage -
// both pages' "rules" menus drive the exact same RunBidOptimizerDryRun query
// params (see bidRules.js), so the fields themselves render from one place
// too: changing a label, default, or the input markup here reaches both
// pages automatically instead of needing the same edit made twice.
function ruleInputStyle() {
  return {
    padding: "8px 10px",
    borderRadius: "6px",
    border: "1px solid #ccc",
    width: "90px",
    background: "#fff",
    color: "#222",
  };
}

export default function RuleFieldsGrid({ rules, setRules }) {
  return (
    <>
      {RULE_FIELDS.map((f) => (
        <label key={f.key} style={{ display: "flex", flexDirection: "column", gap: "4px", fontSize: "12px", color: "#555" }}>
          {f.label}
          <input
            style={ruleInputStyle()}
            type="number"
            value={rules[f.key]}
            onChange={(e) => setRules((r) => ({ ...r, [f.key]: e.target.value }))}
          />
        </label>
      ))}
    </>
  );
}
