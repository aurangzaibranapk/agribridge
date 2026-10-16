/**
 * Gahak ki udhaar halat (migration 537, fn_customer_credit_position).
 * Khalis hisaab -- database nahi chhoota, is liye test ho sakta hai.
 */
export type PromiseState = "open" | "broken" | "fulfilled" | null;
export type LimitSource = "global" | "party" | "exempt";

export interface CreditPosition {
  kulBaqaya: number;
  lateAmount: number;
  bahaliAmount: number;
  oldestDays: number | null;
  limitDays: number;
  limitSource: LimitSource;
  exempt: boolean;
  promiseId: string | null;
  promiseDate: string | null;
  promiseAmount: number | null;
  promiseState: PromiseState;
  blocked: boolean;
}

export interface CreditBlockInfo extends CreditPosition {
  customerId: string;
  name: string;
  billKhata: number;
  canOverride: boolean;
  overrideReasons: string[];
}

const num = (v: unknown) => (v == null ? 0 : Number(v));

export function mapCreditPosition(row: any): CreditPosition | null {
  if (!row) return null;
  return {
    kulBaqaya: num(row.kul_baqaya),
    lateAmount: num(row.late_amount),
    bahaliAmount: num(row.bahali_amount),
    oldestDays: row.oldest_days == null ? null : Number(row.oldest_days),
    limitDays: Number(row.limit_days ?? 30),
    limitSource: (row.limit_source ?? "global") as LimitSource,
    exempt: Boolean(row.exempt),
    promiseId: row.promise_id ?? null,
    promiseDate: row.promise_date ?? null,
    promiseAmount: row.promise_amount == null ? null : Number(row.promise_amount),
    promiseState: (row.promise_state ?? null) as PromiseState,
    blocked: Boolean(row.blocked),
  };
}

/** SQL wala hisaab TypeScript mein -- tests aur offline preview ke liye. */
export function evaluatePosition(input: {
  balance: number;
  openDebits: { date: string; amount: number }[];
  asOf: string;
  globalDays: number;
  partyDays?: number | null;
  exempt?: boolean;
  exemptUntil?: string | null;
  blockEnabled?: boolean;
  minAmount?: number;
  promise?: { date: string; amount: number | null; fulfilled: number; status: "open" | "broken"; allowsCredit?: boolean } | null;
}): CreditPosition {
  const ex = Boolean(input.exempt) && (!input.exemptUntil || input.exemptUntil >= input.asOf);
  const limitDays = input.partyDays ?? input.globalDays;
  const days = (d: string) => Math.round((Date.parse(input.asOf) - Date.parse(d)) / 86400000);
  const bal = Math.max(0, input.balance);
  let late = bal <= 0.009 ? 0 : input.openDebits.filter((d) => days(d.date) >= limitDays).reduce((a, d) => a + d.amount, 0);
  const oldest = input.openDebits.filter((d) => d.amount > 0.009).map((d) => d.date).sort()[0] ?? null;
  let state: PromiseState = null;
  const p = input.promise;
  if (p) {
    if (bal <= 0.009 || (p.amount != null && p.fulfilled >= p.amount)) state = "fulfilled";
    else if (p.date >= input.asOf && p.allowsCredit !== false && p.status === "open") state = "open";
    else { state = "broken"; late = Math.max(late, Math.min(bal, p.amount ?? bal)); }
  }
  late = Math.round(late * 100) / 100;
  const blocked = input.blockEnabled !== false && !ex && late > 0.009 && late >= (input.minAmount ?? 0.01) && state !== "open";
  return {
    kulBaqaya: bal, lateAmount: late, bahaliAmount: blocked ? late : 0,
    oldestDays: oldest ? days(oldest) : null, limitDays,
    limitSource: ex ? "exempt" : input.partyDays != null ? "party" : "global", exempt: ex,
    promiseId: null, promiseDate: p?.date ?? null, promiseAmount: p?.amount ?? null, promiseState: state, blocked,
  };
}

/** Staff ke waade ke usool: 1 khula waada, max 30 din, toote ke baad sirf Admin. */
export function promiseRuleError(input: {
  isAdmin: boolean; days: number; hasOpenPromise: boolean; lastBroken: boolean;
}): string | null {
  if (!(input.days >= 1)) return "Waade ke din 1 ya zyada hon.";
  if (input.isAdmin) return input.days > 365 ? "Waada 365 din se zyada nahi." : null;
  if (input.lastBroken) return "Pichhla waada toot chuka hai -- naya waada sirf Admin/Owner darj kar sakta hai.";
  if (input.hasOpenPromise) return "Is gahak ka ek waada pehle se khula hai.";
  if (input.days > 30) return "Staff zyada se zyada 30 din ka waada darj kar sakta hai.";
  return null;
}

export function limitLabel(p: Pick<CreditPosition, "limitSource" | "limitDays">): string {
  if (p.limitSource === "exempt") return "Koi hadd nahi (chhoot)";
  return `${p.limitDays} din · ${p.limitSource === "party" ? "is gahak ki apni hadd" : "aam setting"}`;
}

export function addDaysIso(d: string, n: number): string {
  const t = new Date(d + "T00:00:00Z"); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10);
}
