import { buttonStyle } from "./buttonStyle";

function inputStyle() {
  return {
    padding: "8px 10px",
    borderRadius: "6px",
    border: "1px solid #ccc",
    background: "#fff",
    color: "#222",
  };
}

// Shared "load / delete / save as" row for a saved rules profile - used by
// both AdsBidOptimizerPage and AdsKeywordsPage's Rules panel, paired with
// useBidRuleProfiles.js for the actual fetch logic.
export default function ProfileControls({
  savedProfiles,
  selectedProfile,
  onLoad,
  onClear,
  profileNameInput,
  setProfileNameInput,
  onSave,
  onDelete,
  error,
}) {
  return (
    <div style={{ marginTop: "16px", display: "flex", flexWrap: "wrap", gap: "10px", alignItems: "center", justifyContent: "center" }}>
      <select
        style={{ ...inputStyle(), width: "auto" }}
        value={selectedProfile}
        onChange={(e) => (e.target.value ? onLoad(e.target.value) : onClear())}
      >
        <option value="">Load saved profile...</option>
        {Object.keys(savedProfiles).map((name) => (
          <option key={name} value={name}>
            {name}
          </option>
        ))}
      </select>
      {selectedProfile && (
        <button
          style={{ ...buttonStyle(), minWidth: "auto", background: "#b00020", padding: "8px 12px", fontSize: "13px" }}
          onClick={onDelete}
        >
          Delete
        </button>
      )}
      <input
        style={{ ...inputStyle(), width: "160px" }}
        type="text"
        placeholder="Profile name"
        value={profileNameInput}
        onChange={(e) => setProfileNameInput(e.target.value)}
      />
      <button style={buttonStyle(!profileNameInput.trim())} disabled={!profileNameInput.trim()} onClick={onSave}>
        Save as...
      </button>
      {error && <span style={{ color: "#b00020", fontSize: "13px" }}>{error}</span>}
    </div>
  );
}
