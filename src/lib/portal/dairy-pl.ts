/**
 * Dairy Hisaab (Phase 3b) -- khalis hisaab: muddat, P&L parsing, kharcha/aamdani validation, CSV.
 */
import { addDays } from "./dairy";

export const EXPENSE_CATS = ["chara", "wanda", "khal", "tori", "minerals", "vets", "labour", "other"] as const;
export const FEED_CATS = ["chara", "wanda", "khal", "tori", "minerals"] as const;
export const CHARA_TYPES = ["green", "silage", "toori", "bhoosa"] as const;
export const UNITS = ["maund", "kg", "bori", "bag", "din", "litre", "other"] as const;
export const PAYMENTS = ["cash", "udhaar", "bank"] as const;
export const INCOME_KINDS = ["home_milk", "animal_sale", "other"] as const;
export type ExpenseCat = (typeof EXPENSE_CATS)[number];
export type IncomeKind = (typeof INCOME_KINDS)[number];
export const CAT_COLOR: Record<ExpenseCat, string> = {
  chara: "#22c55e", wanda: "#f59e0b", khal: "#a855f7", tori: "#eab308", minerals: "#14b8a6", vets: "#f43f5e", labour: "#0ea5e9", other: "#94a3b8",
};
export const CAT_ICON: Record<ExpenseCat, string> = { chara: "🌿", wanda: "🌾", khal: "🟤", tori: "🟡", minerals: "🧂", vets: "💉", labour: "👷", other: "➕" };

export const PERIODS = ["week", "month", "last", "3m", "year", "custom"] as const;
export type PeriodKey = (typeof PERIODS)[number];
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const monthStart = (iso: string) => `${iso.slice(0, 7)}-01`;
const monthEnd = (iso: string) => addDays(addMonths(monthStart(iso), 1), -1);
export function addMonths(iso: string, n: number): string {
  const [y, m] = iso.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1 + n, 1));
  return t.toISOString().slice(0, 10);
}
/** Muddat: from/to + chart ke liye 6 maheene. */
export function resolvePeriod(sp: Record<string, string | undefined>, asOf: string): { key: PeriodKey; from: string; to: string } {
  const key = (PERIODS as readonly string[]).includes(sp.p ?? "") ? (sp.p as PeriodKey) : "month";
  if (key === "week") {
    const [y, m, d] = asOf.split("-").map(Number);
    const dow = (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7; // Monday = 0
    return { key, from: addDays(asOf, -dow), to: asOf };
  }
  if (key === "last") { const s = addMonths(monthStart(asOf), -1); return { key, from: s, to: monthEnd(s) }; }
  if (key === "3m") return { key, from: addMonths(monthStart(asOf), -2), to: asOf };
  if (key === "year") return { key, from: `${asOf.slice(0, 4)}-01-01`, to: asOf };
  if (key === "custom" && sp.from && sp.to && ISO.test(sp.from) && ISO.test(sp.to) && sp.from <= sp.to && sp.to <= asOf) {
    const from = sp.from < addDays(sp.to, -730) ? addDays(sp.to, -730) : sp.from;
    return { key, from, to: sp.to };
  }
  return { key: key === "custom" ? "month" : key, from: monthStart(asOf), to: asOf };
}

export type CostBasis = "home" | "centre" | null;
export type CostBasisLabel = CostBasis | "mixed";
export interface PnlRow {
  period: string; period_end: string; income: Record<string, number>; income_total: number; expense: Partial<Record<ExpenseCat, number>>;
  expense_total: number; profit: number; litres: number; litres_home: number; litres_centre: number; cost_basis: CostBasis;
  cost_per_litre: number | null; feed_per_animal: number | null; animals: number;
}
const n = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const nn = (v: unknown) => (v === null || v === undefined ? null : Number.isFinite(Number(v)) ? Number(v) : null);
const pick = (v: unknown): number | null => (v == null || v === "" || !Number.isFinite(Number(v)) ? null : Number(v));
/** Ghar ka yield (`litres`) agar > 0, warna centre. Dono jama nahi — dohra count nahi. */
export function costBasisOf(r: { litres?: number; litres_home?: number; litres_centre?: number; centre_litres?: number; income?: Record<string, number>; cost_basis?: string | null }): { home: number; centre: number; basis: CostBasis; litres: number } {
  const home = pick(r.litres) ?? pick(r.litres_home) ?? 0;
  const centre = pick(r.litres_centre) ?? pick(r.centre_litres) ?? pick(r.income?.centre_litres) ?? 0;
  if (home > 0) return { home, centre, basis: "home", litres: home };
  if (centre > 0) return { home, centre, basis: "centre", litres: centre };
  return { home, centre, basis: null, litres: 0 };
}
function asBasis(v: unknown, derived: CostBasis): CostBasis {
  if (derived == null) return null;
  if ((v === "home" || v === "centre") && v === derived) return v;
  return derived;
}
export function parsePnl(raw: unknown): PnlRow[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((r: Record<string, unknown>) => {
    const inc: Record<string, number> = {};
    for (const [k, v] of Object.entries((r.income as Record<string, unknown>) ?? {})) inc[k] = n(v);
    const exp: Partial<Record<ExpenseCat, number>> = {};
    for (const [k, v] of Object.entries((r.expense as Record<string, unknown>) ?? {})) if ((EXPENSE_CATS as readonly string[]).includes(k)) exp[k as ExpenseCat] = n(v);
    const litres = n(r.litres);
    const derived = costBasisOf({ litres, litres_home: r.litres_home as number | undefined, litres_centre: r.litres_centre as number | undefined, income: inc, cost_basis: null });
    const row: PnlRow = {
      period: String(r.period).slice(0, 10), period_end: String(r.period_end ?? r.period).slice(0, 10), income: inc, income_total: n(r.income_total),
      expense: exp, expense_total: n(r.expense_total), profit: n(r.profit), litres, litres_home: derived.home, litres_centre: derived.centre,
      cost_basis: asBasis(r.cost_basis, derived.basis), cost_per_litre: nn(r.cost_per_litre),
      feed_per_animal: nn(r.feed_per_animal), animals: n(r.animals),
    };
    return row;
  });
}
/** Kai period jor kar ek total (cost/L aur feed/animal dobara hisaab). */
export function sumPnl(rows: PnlRow[]) {
  const income: Record<string, number> = {}, expense: Partial<Record<ExpenseCat, number>> = {};
  let it = 0, et = 0, lit = 0;
  for (const r of rows) {
    for (const [k, v] of Object.entries(r.income)) income[k] = (income[k] ?? 0) + v;
    for (const [k, v] of Object.entries(r.expense)) expense[k as ExpenseCat] = (expense[k as ExpenseCat] ?? 0) + (v ?? 0);
    it += r.income_total; et += r.expense_total; lit += r.litres;
  }
  const animals = rows.length ? rows[rows.length - 1].animals : 0;
  const feed = FEED_CATS.reduce((s, c) => s + (expense[c] ?? 0), 0);
  let home = 0, centre = 0;
  const used = new Set<Exclude<CostBasis, null>>();
  for (const r of rows) {
    const b = costBasisOf(r);
    home += b.home; centre += b.centre;
    if (b.basis) used.add(b.basis);
  }
  const cost_basis: CostBasisLabel = used.size === 0 ? null : used.size === 1 ? [...used][0] : "mixed";
  const costRows = rows.map((r) => ({ ...r, expense: r.expense_total }));
  return {
    income, expense, income_total: r2(it), expense_total: r2(et), profit: r2(it - et), litres: r2(lit),
    litres_home: r2(home), litres_centre: r2(centre), cost_basis, cost_litres: r2(costRows.reduce((a, r) => a + costBasisOf(r).litres, 0)),
    cost_per_litre: costPerLitre(costRows), feed_per_animal: animals > 0 ? r2(feed / animals) : null, animals,
    centre_litres: income.centre_litres ?? 0,
  };
}
export const r2 = (x: number) => Math.round(x * 100) / 100;
export function changePct(cur: number, prev: number): number | null {
  return prev ? Math.round(((cur - prev) / Math.abs(prev)) * 100) : null;
}
export function categoryShares(expense: Partial<Record<ExpenseCat, number>>) {
  const total = EXPENSE_CATS.reduce((s, c) => s + (expense[c] ?? 0), 0);
  return EXPENSE_CATS.map((c) => ({ cat: c, amount: expense[c] ?? 0, pct: total ? Math.round(((expense[c] ?? 0) / total) * 100) : 0 })).filter((x) => x.amount > 0).sort((a, b) => b.amount - a.amount);
}
export const rs = (v: number) => `Rs ${Math.round(v).toLocaleString("en-IN")}`;

// --- Form validation ---
type FD = { get(k: string): FormDataEntryValue | null };
const s = (v: FormDataEntryValue | null) => (typeof v === "string" ? v.trim() : "");
const num = (v: string) => (v === "" ? null : Number(v.replace(/,/g, "")));
const UUID = /^[0-9a-f-]{36}$/i;
export interface ExpenseInput { expense_date: string; category: ExpenseCat; sub_type: string | null; qty: number | null; unit: string | null; rate: number | null; amount: number; animal_id: string | null; paid_to: string | null; payment: string; note: string | null }
export function validateExpense(fd: FD, asOf: string): { ok: true; value: ExpenseInput } | { ok: false; error: string } {
  const category = s(fd.get("category")) as ExpenseCat;
  if (!(EXPENSE_CATS as readonly string[]).includes(category)) return { ok: false, error: "dy2_err_cat" };
  const d = s(fd.get("expense_date"));
  if (!ISO.test(d) || d > asOf || d < addDays(asOf, -400)) return { ok: false, error: "dy2_err_date" };
  const qty = num(s(fd.get("qty"))), rate = num(s(fd.get("rate")));
  let amount = num(s(fd.get("amount")));
  if (qty !== null && (!Number.isFinite(qty) || qty <= 0)) return { ok: false, error: "dy2_err_qty" };
  if (rate !== null && (!Number.isFinite(rate) || rate < 0)) return { ok: false, error: "dy2_err_rate" };
  if (qty !== null && rate !== null) amount = r2(qty * rate); // raqam hamesha qty × rate
  if (amount === null || !Number.isFinite(amount) || amount <= 0 || amount > 10_000_000) return { ok: false, error: "dy2_err_amount" };
  const sub = s(fd.get("sub_type"));
  const animal = s(fd.get("animal_id"));
  if (animal && !UUID.test(animal)) return { ok: false, error: "dy2_err_generic" };
  const unit = s(fd.get("unit")), pay = s(fd.get("payment"));
  return {
    ok: true,
    value: {
      expense_date: d, category, sub_type: category === "chara" && (CHARA_TYPES as readonly string[]).includes(sub) ? sub : null,
      qty: qty !== null && rate !== null ? qty : null, unit: qty !== null && rate !== null && (UNITS as readonly string[]).includes(unit) ? unit : null,
      rate: qty !== null && rate !== null ? rate : null, amount, animal_id: animal || null,
      paid_to: s(fd.get("paid_to")).slice(0, 80) || null, payment: (PAYMENTS as readonly string[]).includes(pay) ? pay : "cash", note: s(fd.get("note")).slice(0, 300) || null,
    },
  };
}
export interface IncomeInput { income_date: string; kind: IncomeKind; qty: number | null; rate: number | null; amount: number; animal_id: string | null; buyer: string | null; note: string | null }
export function validateIncome(fd: FD, asOf: string): { ok: true; value: IncomeInput } | { ok: false; error: string } {
  const kind = s(fd.get("kind")) as IncomeKind;
  if (!(INCOME_KINDS as readonly string[]).includes(kind)) return { ok: false, error: "dy2_err_cat" };
  const d = s(fd.get("income_date"));
  if (!ISO.test(d) || d > asOf || d < addDays(asOf, -400)) return { ok: false, error: "dy2_err_date" };
  const qty = num(s(fd.get("qty"))), rate = num(s(fd.get("rate")));
  let amount = num(s(fd.get("amount")));
  if (qty !== null && (!Number.isFinite(qty) || qty <= 0)) return { ok: false, error: "dy2_err_qty" };
  if (rate !== null && (!Number.isFinite(rate) || rate < 0)) return { ok: false, error: "dy2_err_rate" };
  if (qty !== null && rate !== null) amount = r2(qty * rate);
  if (amount === null || !Number.isFinite(amount) || amount <= 0 || amount > 10_000_000) return { ok: false, error: "dy2_err_amount" };
  const animal = s(fd.get("animal_id"));
  if (animal && !UUID.test(animal)) return { ok: false, error: "dy2_err_generic" };
  if (kind === "animal_sale" && !animal) return { ok: false, error: "dy2_err_animal" };
  return {
    ok: true,
    value: { income_date: d, kind, qty: qty !== null && rate !== null ? qty : null, rate: qty !== null && rate !== null ? rate : null, amount,
      animal_id: animal || null, buyer: s(fd.get("buyer")).slice(0, 80) || null, note: s(fd.get("note")).slice(0, 300) || null },
  };
}

// --- Admin export (CSV, Google Sheets mein seedha khulti hai) ---
export interface AdminRow { farmer_id: string; farmer_code: string | null; full_name: string | null; village: string | null; customer_name: string | null; animals: number; milking: number; litres: number; centre_litres: number; litres_home: number; litres_centre: number; cost_basis: CostBasis; expense: number; income: number; profit: number; cost_per_litre: number | null }
export function parseAdminRows(raw: unknown): AdminRow[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((r: Record<string, unknown>) => {
    const litres = n(r.litres);
    const centre_litres = n(r.centre_litres);
    const b = costBasisOf({ litres, centre_litres, litres_home: r.litres_home as number | undefined, litres_centre: r.litres_centre as number | undefined });
    return {
      farmer_id: String(r.farmer_id), farmer_code: (r.farmer_code as string) ?? null, full_name: (r.full_name as string) ?? null, village: (r.village as string) ?? null,
      customer_name: (r.customer_name as string) ?? null, animals: n(r.animals), milking: n(r.milking), litres, centre_litres,
      litres_home: b.home, litres_centre: b.centre, cost_basis: asBasis(r.cost_basis, b.basis),
      expense: n(r.expense), income: n(r.income), profit: n(r.profit), cost_per_litre: nn(r.cost_per_litre),
    };
  });
}
type MilkRow = { litres: number; expense: number; litres_home?: number; litres_centre?: number; centre_litres?: number; income?: Record<string, number>; cost_basis?: string | null };
/** Jis period/kisan ka litre-basis > 0 (ghar, warna centre). */
export function withMilk<T extends MilkRow>(rows: T[]): T[] {
  return rows.filter((r) => costBasisOf(r).litres > 0);
}
/** Kul lagat/L = (basis wale kharche) / (un ka basis litre). Koi litre nahi to null. */
export function costPerLitre(rows: MilkRow[]): number | null {
  const m = withMilk(rows).map((r) => ({ litres: costBasisOf(r).litres, expense: Number.isFinite(r.expense) ? r.expense : 0 }));
  const lit = m.reduce((a, r) => a + r.litres, 0);
  return lit > 0 ? r2(m.reduce((a, r) => a + r.expense, 0) / lit) : null;
}
/** Kisanon ki lagat/L ka seedha average -- jis ka basis litre nahi, wo shamil nahi. */
export function avgCostPerLitre(rows: MilkRow[]): number | null {
  const m = withMilk(rows).map((r) => ({ litres: costBasisOf(r).litres, expense: Number.isFinite(r.expense) ? r.expense : 0 }));
  return m.length ? r2(m.reduce((a, r) => a + r.expense / r.litres, 0) / m.length) : null;
}
export function grandTotal(rows: AdminRow[]) {
  const t = rows.reduce((a, r) => ({ animals: a.animals + r.animals, milking: a.milking + r.milking, litres: a.litres + r.litres, centre_litres: a.centre_litres + r.centre_litres,
    expense: a.expense + r.expense, income: a.income + r.income, profit: a.profit + r.profit }), { animals: 0, milking: 0, litres: 0, centre_litres: 0, expense: 0, income: 0, profit: 0 });
  const bases = new Set(rows.map((r) => costBasisOf(r).basis).filter((b): b is "home" | "centre" => b != null));
  const cost_basis: CostBasisLabel = bases.size === 0 ? null : bases.size === 1 ? [...bases][0] : "mixed";
  return { ...t, litres: r2(t.litres), centre_litres: r2(t.centre_litres), expense: r2(t.expense), income: r2(t.income), profit: r2(t.profit),
    cost_per_litre: costPerLitre(rows), avg_cost_per_litre: avgCostPerLitre(rows), cost_basis, milk_farmers: withMilk(rows).length, losses: rows.filter((r) => r.profit < 0).length };
}
export function adminFilter(rows: AdminRow[], f: string, q: string): AdminRow[] {
  let out = rows;
  if (f === "profit") out = out.filter((r) => r.profit >= 0);
  if (f === "loss") out = out.filter((r) => r.profit < 0);
  if (f === "customer") out = out.filter((r) => r.customer_name);
  const t = q.trim().toLowerCase();
  if (t) out = out.filter((r) => `${r.farmer_code} ${r.full_name} ${r.customer_name ?? ""} ${r.village ?? ""}`.toLowerCase().includes(t));
  return out;
}
/** CSV cell: formula injection se bachao (=,+,-,@ se shuru ho to ' lagao). */
export function csvCell(v: unknown): string {
  let t = v === null || v === undefined ? "" : String(v);
  if (/^[=+\-@\t\r]/.test(t) && !/^-?\d+(\.\d+)?$/.test(t)) t = `'${t}`;
  return /[",\n\r]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
}
export function adminCsv(rows: AdminRow[], from: string, to: string): string {
  const head = ["Farmer code", "Name", "Village", "Customer", "Animals", "Milking", "Milk home (L)", "Milk centre (L)", "Expense (Rs)", "Income (Rs)", "Profit/Loss (Rs)", "Cost per litre (Rs)", "Cost basis"];
  const lines = [`Dairy Hisaab ${from} to ${to}`, head.map(csvCell).join(",")];
  for (const r of rows) lines.push([r.farmer_code, r.full_name, r.village, r.customer_name, r.animals, r.milking, r.litres, r.centre_litres, r.expense, r.income, r.profit, r.cost_per_litre ?? "", r.cost_basis ?? ""].map(csvCell).join(","));
  const g = grandTotal(rows);
  lines.push(["GRAND TOTAL", "", "", "", g.animals, g.milking, g.litres, g.centre_litres, g.expense, g.income, g.profit, g.cost_per_litre ?? "", g.cost_basis ?? ""].map(csvCell).join(","));
  return "\uFEFF" + lines.join("\r\n") + "\r\n";
}

// --- Photo limits ---
export const PHOTO_MAX_BYTES = 900_000;   // resize ke baad (server action ki had)
export const PHOTO_MAX_PX = 1600;
export const THUMB_PX = 320;
export const PHOTO_TYPES = ["image/webp", "image/jpeg", "image/png"];
export function photoOk(f: { size: number; type: string } | null): boolean {
  return !!f && f.size > 0 && f.size <= PHOTO_MAX_BYTES && PHOTO_TYPES.includes(f.type);
}
export function photoPath(farmerId: string, animalId: string, id: string, thumb = false): string {
  return `${farmerId}/${animalId}/${id}${thumb ? "_thumb" : ""}.webp`;
}
/** Kitna chhota karein (lambi taraf max px). */
export function fitSize(w: number, h: number, max: number): { w: number; h: number } {
  if (w <= max && h <= max) return { w, h };
  const k = max / Math.max(w, h);
  return { w: Math.round(w * k), h: Math.round(h * k) };
}
