// Normalises get_business_report output for the Daily Briefing cards.
// The report returns top_branch as an array of { branch, sales } and
// payment_mode_breakdown keyed by POS payment_mode (cash/khata/bank/kisan_card/split).
export type BriefingTopBranch = { name: string; total: number } | null;

export function pickTopBranch(raw: unknown): BriefingTopBranch {
  const first: any = Array.isArray(raw) ? raw[0] : raw;
  if (!first || typeof first !== "object") return null;
  const name = first.branch ?? first.branch_name ?? first.name ?? null;
  const total = Number(first.sales ?? first.total ?? 0);
  if (!name) return null;
  return { name: String(name), total: Number.isFinite(total) ? total : 0 };
}

export function paymentSplit(raw: unknown): { cash: number; online: number; credit: number } {
  const m: Record<string, unknown> = raw && typeof raw === "object" ? (raw as any) : {};
  const n = (k: string) => {
    const v = Number(m[k] ?? 0);
    return Number.isFinite(v) ? v : 0;
  };
  return {
    cash: n("cash"),
    online: n("bank") + n("kisan_card") + n("online"),
    credit: n("khata") + n("credit"),
  };
}
