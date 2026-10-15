/**
 * Staff Achievement -- performance, target, bonus (pure; test: npm run test:staff-achievement).
 *
 * Koi qaida code mein nahi: target, bonus aur "kam karkardagi" ki had sab
 * settings tables (migration 530) se aati hain. Setting na ho to NULL --
 * "target set nahi" -- sifar nahi.
 */
export type Period = "daily" | "weekly" | "monthly";
export type Bucket = "cash" | "bank" | "khata";

export function methodBucket(method: string | null | undefined): Bucket {
  const m = String(method ?? "").toLowerCase();
  if (m === "cash") return "cash";
  if (m === "khata" || m === "credit" || m === "udhaar") return "khata";
  return "bank";
}

export function pkDate(d: Date | string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Karachi" }).format(typeof d === "string" ? new Date(d) : d);
}

export function periodRange(period: Period, today: string): { start: string; end: string } {
  const d = new Date(`${today}T00:00:00Z`);
  const add = (x: Date, days: number) => { const y = new Date(x); y.setUTCDate(y.getUTCDate() + days); return y.toISOString().slice(0, 10); };
  if (period === "daily") return { start: today, end: add(d, 1) };
  if (period === "weekly") { const s = new Date(d); s.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7)); return { start: s.toISOString().slice(0, 10), end: add(s, 7) }; }
  const [y, m] = today.split("-").map(Number);
  const ny = m === 12 ? y + 1 : y; const nm = m === 12 ? 1 : m + 1;
  return { start: `${y}-${String(m).padStart(2, "0")}-01`, end: `${ny}-${String(nm).padStart(2, "0")}-01` };
}

export type SaleIn = { id: string; created_by: string | null; total_amount: number | null; khata_amount?: number | null; payment_mode?: string | null; customer_id?: string | null };
export type PaymentIn = { sale_id: string; amount: number | null; payment_method: string | null };
export type CategoryIn = { staff_id: string | null; category_name: string | null; sales_amount: number | null };
export type RecoveryIn = { requested_by: string | null; amount: number | null };
export type TargetIn = { profile_id: string | null; role: string | null; period: Period; target_amount: number };
export type BonusRuleIn = { period: Period; basis: "sales" | "recovery" | "new_customers"; min_achievement_pct: number; bonus_type: "fixed" | "percent_of_sales"; bonus_value: number; title: string };
export type Staff = { id: string; full_name: string; role: string };

export type Row = {
  staff: Staff; sales: number; invoices: number; breakdown: Record<Bucket, number>;
  categories: { name: string; amount: number }[]; recovery: number; newCustomers: number;
  target: number | null; achievementPct: number | null; bonus: number | null; bonusTitles: string[];
  rank: number; lowPerformance: boolean;
};

const n = (v: unknown) => { const x = Number(v ?? 0); return Number.isFinite(x) ? x : 0; };
const r2 = (v: number) => Math.round(v * 100) / 100;

export function saleBreakdown(sale: SaleIn, payments: PaymentIn[]): Record<Bucket, number> {
  const out: Record<Bucket, number> = { cash: 0, bank: 0, khata: 0 };
  const total = Math.max(0, n(sale.total_amount));
  if (payments.length) {
    for (const p of payments) out[methodBucket(p.payment_method)] += Math.max(0, n(p.amount));
    const paid = out.cash + out.bank + out.khata;
    if (paid < total) out.khata += total - paid;
    if (paid > total && out.cash > 0) out.cash = Math.max(0, out.cash - (paid - total));
  } else if (sale.payment_mode && sale.payment_mode !== "split") {
    out[methodBucket(sale.payment_mode)] = total;
  } else {
    out.khata = Math.min(total, Math.max(0, n(sale.khata_amount)));
    out.cash = total - out.khata;
  }
  return { cash: r2(out.cash), bank: r2(out.bank), khata: r2(out.khata) };
}

export function pickTarget(staff: Staff, period: Period, targets: TargetIn[]): number | null {
  const own = targets.find((t) => t.period === period && t.profile_id === staff.id);
  if (own) return n(own.target_amount);
  const byRole = targets.find((t) => t.period === period && !t.profile_id && t.role === staff.role);
  if (byRole) return n(byRole.target_amount);
  const any = targets.find((t) => t.period === period && !t.profile_id && !t.role);
  return any ? n(any.target_amount) : null;
}

export function computeBonus(row: { sales: number; recovery: number; newCustomers: number; achievementPct: number | null }, period: Period, rules: BonusRuleIn[]) {
  const applicable = rules.filter((r) => r.period === period);
  if (!applicable.length) return { bonus: null as number | null, titles: [] as string[] };
  let bonus = 0; const titles: string[] = [];
  for (const basis of ["sales", "recovery", "new_customers"] as const) {
    const hit = applicable
      .filter((r) => r.basis === basis && row.achievementPct != null && row.achievementPct >= n(r.min_achievement_pct))
      .sort((a, b) => n(b.min_achievement_pct) - n(a.min_achievement_pct))[0];
    if (!hit) continue;
    const base = basis === "sales" ? row.sales : basis === "recovery" ? row.recovery : row.newCustomers;
    bonus += hit.bonus_type === "fixed" ? n(hit.bonus_value) : (base * n(hit.bonus_value)) / 100;
    titles.push(hit.title);
  }
  return { bonus: r2(bonus), titles };
}

export function newCustomerOwners(periodSales: (SaleIn & { created_at: string })[], earlierCustomerIds: Set<string>): Map<string, string> {
  const out = new Map<string, string>();
  for (const s of [...periodSales].sort((a, b) => (a.created_at < b.created_at ? -1 : 1))) {
    if (!s.customer_id || !s.created_by || earlierCustomerIds.has(s.customer_id) || out.has(s.customer_id)) continue;
    out.set(s.customer_id, s.created_by);
  }
  return out;
}

export function buildRows(input: {
  staff: Staff[]; period: Period; sales: SaleIn[]; payments: PaymentIn[]; categories: CategoryIn[]; recovery: RecoveryIn[];
  newCustomerIds: Map<string, string>; targets: TargetIn[]; rules: BonusRuleIn[]; lowPerformancePct: number | null;
}): Row[] {
  const payBySale = new Map<string, PaymentIn[]>();
  for (const p of input.payments) payBySale.set(p.sale_id, [...(payBySale.get(p.sale_id) ?? []), p]);
  const rows: Row[] = input.staff.map((s) => {
    const mine = input.sales.filter((x) => x.created_by === s.id);
    const b: Record<Bucket, number> = { cash: 0, bank: 0, khata: 0 };
    for (const sale of mine) { const x = saleBreakdown(sale, payBySale.get(sale.id) ?? []); b.cash += x.cash; b.bank += x.bank; b.khata += x.khata; }
    const sales = r2(mine.reduce((a, x) => a + Math.max(0, n(x.total_amount)), 0));
    const cat = new Map<string, number>();
    for (const c of input.categories) if (c.staff_id === s.id) { const k = c.category_name || "Uncategorized"; cat.set(k, (cat.get(k) ?? 0) + n(c.sales_amount)); }
    const recovery = r2(input.recovery.filter((r) => r.requested_by === s.id).reduce((a, r) => a + n(r.amount), 0));
    const newCustomers = Array.from(input.newCustomerIds.values()).filter((v) => v === s.id).length;
    const target = pickTarget(s, input.period, input.targets);
    const achievementPct = target && target > 0 ? r2((sales / target) * 100) : null;
    const { bonus, titles } = computeBonus({ sales, recovery, newCustomers, achievementPct }, input.period, input.rules);
    return {
      staff: s, sales, invoices: mine.length, breakdown: { cash: r2(b.cash), bank: r2(b.bank), khata: r2(b.khata) },
      categories: Array.from(cat.entries()).map(([name, amount]) => ({ name, amount: r2(amount) })).sort((x, y) => y.amount - x.amount),
      recovery, newCustomers, target, achievementPct, bonus, bonusTitles: titles, rank: 0,
      lowPerformance: input.lowPerformancePct != null && achievementPct != null && achievementPct < input.lowPerformancePct,
    };
  });
  rows.sort((a, b) => b.sales - a.sales || b.recovery - a.recovery);
  let rank = 0; let prev: number | null = null;
  rows.forEach((r, i) => { if (r.sales !== prev) rank = i + 1; prev = r.sales; r.rank = r.sales > 0 ? rank : 0; });
  return rows;
}

export function topPerformer(rows: Row[]): Row | null {
  return rows.find((r) => r.rank === 1 && r.sales > 0) ?? null;
}
