/**
 * Qist Plan ka schedule aur kattauti -- 556 ke engine ka TS aaina (UI preview + tests).
 */
export type QistFrequency = "monthly" | "milk_weekly" | "custom";
export type QistSource = "milk" | "salary" | "grain" | "supplier_bill" | "cash";
export type QistParty = "staff" | "farmer" | "customer" | "dealer" | "supplier";

export const SOURCE_LABEL: Record<QistSource, string> = {
  milk: "Doodh ki adaigi",
  salary: "Tankhwah",
  grain: "Anaj / fasal ki adaigi",
  supplier_bill: "Supplier bill",
  cash: "Naqad wasooli",
};
export const PARTY_LABEL: Record<QistParty, string> = { staff: "Staff", farmer: "Kisan / Doodh", customer: "Customer", dealer: "Dealer", supplier: "Supplier" };
export const FREQ_LABEL: Record<QistFrequency, string> = { monthly: "Mahana", milk_weekly: "Har hafte (doodh)", custom: "Apni tareekhein" };
export const PLAN_STATUS_LABEL: Record<string, string> = {
  draft: "Draft", submitted: "Manzoori baqi", active: "Chalu", paused: "Ruka hua", completed: "Mukammal", written_off: "Maaf (write-off)", cancelled: "Cancel",
};

export interface ScheduleRow { seq: number; dueDate: string; amount: number }

function addDays(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
function addMonths(iso: string, n: number): string {
  const [y, m, day] = iso.split("-").map(Number);
  const target = new Date(Date.UTC(y, m - 1 + n, 1));
  const last = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(day, last));
  return target.toISOString().slice(0, 10);
}

/** Barabar qistein: aakhri qist rounding ka farq leti hai. */
export function equalAmounts(total: number, count: number): number[] {
  if (count <= 0 || total <= 0) return [];
  const each = Math.round(total / count);
  const out = Array.from({ length: count }, () => each);
  out[count - 1] = Math.round((total - each * (count - 1)) * 100) / 100;
  return out;
}

export function buildSchedule(a: { total: number; count: number; frequency: QistFrequency; start: string; amounts?: number[]; dates?: string[] }): ScheduleRow[] {
  const amounts = a.amounts && a.amounts.length === a.count ? a.amounts : equalAmounts(a.total, a.count);
  return amounts.map((amount, i) => ({
    seq: i + 1,
    amount,
    dueDate:
      a.frequency === "custom" && a.dates?.[i] ? a.dates[i]
      : a.frequency === "milk_weekly" ? addDays(a.start, 7 * i)
      : addMonths(a.start, i),
  }));
}

export function scheduleError(total: number, rows: ScheduleRow[]): string | null {
  if (rows.length === 0) return "Schedule khali hai.";
  if (rows.some((r) => !(r.amount > 0))) return "Har qist sifar se zyada ho.";
  if (rows.some((r) => !/^\d{4}-\d{2}-\d{2}$/.test(r.dueDate))) return "Har qatar ki tareekh zaroori hai.";
  const sum = Math.round(rows.reduce((s, r) => s + r.amount, 0) * 100) / 100;
  if (Math.abs(sum - total) > 0.009) return `Schedule ka jama (Rs ${sum}) kul raqam (Rs ${total}) ke barabar nahi.`;
  return null;
}

/** Had ke saath kitna katega (556 fn_qist_preview jaisa). */
export function deductionFor(a: { due: number; payout: number; capPct?: number | null; capAmount?: number | null }): { deduct: number; shortfall: number } {
  let cap = a.due;
  if (a.capPct != null) cap = Math.min(cap, Math.round((a.payout * a.capPct) / 100));
  if (a.capAmount != null) cap = Math.min(cap, a.capAmount);
  const deduct = Math.max(Math.min(cap, Math.max(a.payout, 0)), 0);
  return { deduct, shortfall: Math.max(a.due - deduct, 0) };
}

/** Khate ka GL: kis party ka advance/udhaar kis khate mein. */
export function receivableAccount(party: QistParty, origin: string): string {
  if (party === "staff") return "1130";
  if (party === "farmer") return origin === "advance" ? "1140" : "1150";
  if (party === "supplier") return "1120";
  return "1100";
}
/** Adaigi ka khata jis se qist kati (hamara dena). */
export function payoutAccount(source: QistSource): string | null {
  if (source === "milk" || source === "grain") return "2010";
  if (source === "supplier_bill") return "2000";
  if (source === "salary") return "2025";
  return null;
}
