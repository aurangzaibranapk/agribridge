/**
 * Admin dashboard ke "dhyan dein" issues. Pure: database nahi chhoota.
 * Har issue ke saath wo link hai jahan se theek hoga.
 */

export interface MasterChiller {
  branchId: string;
  branchName: string;
  name: string;
}

export interface TotalRow {
  branchId: string;
  entryDate: string;
  shift: "morning" | "evening";
  chillerNo: string;
  grossL: number;
}

export interface DispatchRow {
  id: string;
  branchId: string;
  dispatchDate: string;
  shift: "morning" | "evening";
  grossL: number;
  receivedL: number | null;
  destination: string;
  carrierId?: string | null;
}

export interface Issue {
  key: string;
  level: "bad" | "warn" | "info";
  title: string;
  detail: string;
  href: string;
}

const SHIFTS = ["morning", "evening"] as const;
const SHIFT_LABEL: Record<string, string> = { morning: "Subah", evening: "Shaam" };

/** Aaj ki tareekh par chiller total, zyada bheja aur raseed ke issues. */
export function buildIssues(input: {
  date: string;
  masters: MasterChiller[];
  totals: TotalRow[];
  dispatches: DispatchRow[];
}): Issue[] {
  const issues: Issue[] = [];
  const branches = new Map<string, string>();
  for (const m of input.masters) branches.set(m.branchId, m.branchName);

  for (const [branchId, branchName] of branches) {
    const names = input.masters.filter((m) => m.branchId === branchId).map((m) => m.name);
    for (const shift of SHIFTS) {
      const dayTotals = input.totals.filter((t) => t.branchId === branchId && t.entryDate === input.date && t.shift === shift);
      const hasAny = dayTotals.length > 0;
      // Chiller total nahi: sirf wahan jahan us shift ka koi total darj hua ho ya dispatch ho.
      const dispatchedHere = input.dispatches.some((d) => d.branchId === branchId && d.dispatchDate === input.date && d.shift === shift);
      if (hasAny || dispatchedHere) {
        for (const name of names) {
          if (!dayTotals.some((t) => t.chillerNo === name)) {
            issues.push({
              key: `missing-${branchId}-${shift}-${name}`,
              level: "bad",
              title: `${branchName} · Chiller ${name}: total nahi`,
              detail: `${SHIFT_LABEL[shift]} shift ka total darj nahi.`,
              href: `/admin/milk-collection/chiller?date=${input.date}&shift=${shift}&branch=${branchId}`,
            });
          }
        }
      }
    }
    // Raseed baqi: dispatch jis ki raseed ek din se purani hai.
    for (const d of input.dispatches) {
      if (d.branchId !== branchId || d.receivedL != null) continue;
      if (d.dispatchDate >= input.date) continue;
      issues.push({
        key: `receipt-${d.id}`,
        level: "warn",
        title: `${branchName} · ${d.destination} raseed baqi`,
        detail: `${d.dispatchDate} · ${SHIFT_LABEL[d.shift]} · ${d.grossL.toFixed(3)} L`,
        href: `/admin/milk-collection/handover`,
      });
    }
  }
  return issues;
}
