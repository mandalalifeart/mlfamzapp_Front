// Shared "why this bid" breakdown row for AdsBidOptimizerPage and
// AdsKeywordsPage - renders as a second table row directly under a
// proposal's main row, spanning the full table width. Shows the This
// Year/Last Year x Year/60d/30d/7d comparison table (centered), each cell
// carrying the same level of detail (spend/clicks/sales/ACOS/contribution)
// that used to live in a separate set of period-summary lines above it -
// those lines were removed as duplicates once the table covered the same
// ground, per the user's request (2026-08-31). Then the step-by-step
// calculation trail, any last-applied-change effect, and the final
// recommendation. Font is 25% larger than the table's base 12px.
function contributionText(contribution) {
  if (!contribution) return "no sales in this window";
  const { suggestedChangePct } = contribution;
  if (Math.abs(suggestedChangePct) < 0.05) return "on its own, suggests holding";
  const direction = suggestedChangePct > 0 ? "raising" : "lowering";
  return `on its own, suggests ${direction} ${Math.abs(suggestedChangePct).toFixed(1)}%`;
}

const YOY_ROWS = [
  { key: "year", label: "Year" },
  { key: "60d", label: "Last 60 days" },
  { key: "30d", label: "Last 30 days" },
  { key: "7d", label: "Last 7 days" },
];

function yoyCellStyle(extra = {}) {
  return { border: "1px solid #ddd", padding: "5px 10px", textAlign: "left", ...extra };
}

function yoyCellText(cell) {
  if (!cell) return "no data";
  const acos = cell.acos != null ? `${cell.acos}% ACOS` : "no sales";
  const cpc = cell.cpc != null ? `$${cell.cpc.toFixed(2)} CPC` : "no CPC";
  return `$${cell.spend.toFixed(2)} spend · ${cell.clicks} clicks (${cpc}) · $${cell.sales.toFixed(2)} sales · ${acos} — ${contributionText(cell.contribution)}`;
}

function YearOverYearTable({ yoy }) {
  if (!yoy) return null;
  return (
    <table style={{ borderCollapse: "collapse", margin: "4px auto 0" }}>
      <thead>
        <tr>
          <th style={yoyCellStyle({ background: "#eee" })}></th>
          <th style={yoyCellStyle({ background: "#eee" })}>This Year</th>
          <th style={yoyCellStyle({ background: "#eee" })}>Last Year</th>
        </tr>
      </thead>
      <tbody>
        {YOY_ROWS.map(({ key, label }) => (
          <tr key={key}>
            <td style={yoyCellStyle({ fontWeight: 600 })}>{label}</td>
            <td style={yoyCellStyle()}>{yoyCellText(yoy[key]?.thisYear)}</td>
            <td style={yoyCellStyle()}>{yoyCellText(yoy[key]?.lastYear)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function ReasonBreakdownRow({ proposal, colSpan }) {
  if (!proposal) return null;

  return (
    <tr>
      <td
        colSpan={colSpan}
        style={{
          border: "1px solid #ccc",
          borderTop: "none",
          padding: "8px 12px 12px",
          background: "#fafafa",
          fontSize: "15px",
          color: "#555",
        }}
      >
        <div style={{ textAlign: "center", fontWeight: 600, color: "#333" }}>
          Current bid: ${proposal.currentBid.toFixed(2)}
        </div>

        {proposal.yearOverYear ? (
          <YearOverYearTable yoy={proposal.yearOverYear} />
        ) : (
          <div>Single-window evaluation - no comparison table available.</div>
        )}

        {proposal.calculation?.length > 0 && (
          <div style={{ marginTop: "6px" }}>
            <div style={{ color: "#333", fontWeight: 600 }}>How the final recommendation was calculated:</div>
            {proposal.calculation.map((step, i) => (
              <div key={i}>
                {i + 1}. {step}
              </div>
            ))}
          </div>
        )}

        {proposal.lastChangeNote && <div style={{ color: "#8a6d00", marginTop: "4px" }}>Last change effect: {proposal.lastChangeNote}</div>}
        <div style={{ marginTop: "6px", fontWeight: 600, color: "#333" }}>Recommendation: {proposal.reason}</div>
      </td>
    </tr>
  );
}
