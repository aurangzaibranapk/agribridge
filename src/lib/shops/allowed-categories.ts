/**
 * Dukan ko HQ godam ki kaunsi qism dikhe (migration 686).
 * Pure helpers: UI ke checkbox se DB rows, aur DB rows se checkbox.
 * Top category chuni = us ki sub-categories khud shamil.
 * Sub-category ka nishan parent se alag ho to override row banti hai.
 */
export type CategoryNode = { id: string; name: string; parent_category_id: string | null };
export type AllowedRow = { category_id: string; include: boolean };

export function splitTree(cats: CategoryNode[]) {
  const tops = cats.filter((c) => !c.parent_category_id || !cats.some((p) => p.id === c.parent_category_id));
  const subsOf = new Map<string, CategoryNode[]>();
  for (const c of cats) {
    if (!c.parent_category_id || !tops.some((t) => t.id === c.parent_category_id)) continue;
    const list = subsOf.get(c.parent_category_id) ?? [];
    list.push(c);
    subsOf.set(c.parent_category_id, list);
  }
  tops.sort((a, b) => a.name.localeCompare(b.name));
  subsOf.forEach((l) => l.sort((a, b) => a.name.localeCompare(b.name)));
  return { tops, subsOf };
}

/** DB rows -> har category par nishan (effective). */
export function effectiveChecked(cats: CategoryNode[], rows: AllowedRow[]): Set<string> {
  const byId = new Map(rows.map((r) => [r.category_id, r.include]));
  const out = new Set<string>();
  for (const c of cats) {
    const own = byId.get(c.id);
    const viaParent = c.parent_category_id ? byId.get(c.parent_category_id) : undefined;
    if (own ?? viaParent ?? false) out.add(c.id);
  }
  return out;
}

/** Form ke nishan -> DB rows (kam se kam). */
export function rowsFromChecks(cats: CategoryNode[], checkedTop: Set<string>, checkedSub: Set<string>): AllowedRow[] {
  const { tops, subsOf } = splitTree(cats);
  const rows: AllowedRow[] = [];
  for (const t of tops) {
    const parentOn = checkedTop.has(t.id);
    if (parentOn) rows.push({ category_id: t.id, include: true });
    for (const s of subsOf.get(t.id) ?? []) {
      const on = checkedSub.has(s.id);
      if (on !== parentOn) rows.push({ category_id: s.id, include: on });
    }
  }
  return rows;
}
