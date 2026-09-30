// Product families (2026-09-30, per the user): Pareo and Home Decor groups
// each live in their own collapsible section (collapsed by default) on the
// Sales and Next Order pages, and get separate Best/Worst Sellers rankings
// on Sales. Matched on the asin_group_mapping group name prefix, so a new
// PAREO_*/COVER_* group joins its family automatically. "Home Decor" (named
// by the user) = pouf covers plus VELVET (velvet pouf covers + stools) and
// STUFFED (stuffed poufs).
export const FAMILIES = [
  { key: "pareo", label: "Pareo", match: (name) => /^pareo/i.test(name) },
  { key: "pouf", label: "Home Decor", match: (name) => /^(cover_|velvet|stuffed)/i.test(name) },
];

export function familyOf(groupName) {
  return FAMILIES.find((f) => f.match(groupName || ""))?.key || null;
}
