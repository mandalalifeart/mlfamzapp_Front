// Product families (2026-09-30, per the user): Pareo and Home Decor groups
// each live in their own collapsible section (collapsed by default) on the
// Sales and Next Order pages, and get separate Best/Worst Sellers rankings
// on Sales. Matched on the asin_group_mapping group name prefix, so a new
// PAREO_*/COVER_* group joins its family automatically. "Home Decor" (named
// by the user) = pouf covers plus VELVET (velvet pouf covers + stools) and
// STUFFED (stuffed poufs).
export const FAMILIES = [
  { key: "pareo", label: "Pareo", match: (name) => /^pareo/i.test(name) },
  // VELVET shown first inside Home Decor (2026-10-03, per the user).
  { key: "pouf", label: "Home Decor", match: (name) => /^(cover_|velvet|stuffed)/i.test(name), first: ["VELVET"] },
];

// Moves a family's "first" groups to the top, keeping everything else in
// the order the page already chose (alphabetical, by sales, ...).
export function orderFamilyGroups(familyKey, groups, nameOf = (g) => g.group) {
  const first = (FAMILIES.find((f) => f.key === familyKey)?.first || []).map((n) => n.toUpperCase());
  if (!first.length) return groups;
  const rank = (g) => {
    const i = first.indexOf(String(nameOf(g) || "").toUpperCase());
    return i === -1 ? first.length : i;
  };
  return [...groups].sort((a, b) => rank(a) - rank(b));
}

export function familyOf(groupName) {
  return FAMILIES.find((f) => f.match(groupName || ""))?.key || null;
}
