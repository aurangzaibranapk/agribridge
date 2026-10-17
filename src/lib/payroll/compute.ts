/**
 * Tankhwah ka hisaab -- wahi qaida jo 553 ka fn_payroll_compute chalata hai.
 * Mahina hamesha 30 din ka (31 din wala bhi). Half day = aadha din. Overtime nahi.
 * Bina record din (hazri darj nahi) = ghair-hazir, wahi basic/30 kattauti.
 */
export const DAYS_BASIS = 30;

export function absentDeduction(basic: number, absentDays: number, halfDays: number): number {
  const days = Math.max(absentDays, 0) + Math.max(halfDays, 0) * 0.5;
  return Math.min(basic, Math.round((basic / DAYS_BASIS) * days));
}

/** Kul ghair-hazir din jin par kattauti hoti hai (absent + unpaid + bina record). */
export function chargeableAbsentDays(l: { absent_days?: number; unpaid_leave_days?: number; missing_days?: number }): number {
  return (+(l.absent_days ?? 0)) + (+(l.unpaid_leave_days ?? 0)) + (+(l.missing_days ?? 0));
}

export interface PayLineInput {
  basic: number;
  allowances?: number;
  otherDeductions?: number;
  absentDays: number;
  unpaidLeaveDays?: number;
  /** Hazri darj nahi -- ghair-hazir gina jata hai. */
  missingDays?: number;
  halfDays: number;
  advanceDue?: number;
}

export function computePayLine(i: PayLineInput) {
  const gross = i.basic + (i.allowances ?? 0);
  const absent = absentDeduction(i.basic, i.absentDays + (i.unpaidLeaveDays ?? 0) + (i.missingDays ?? 0), i.halfDays);
  const available = Math.max(gross - absent - (i.otherDeductions ?? 0), 0);
  const advance = Math.min(Math.max(i.advanceDue ?? 0, 0), available);
  return { gross, absentDeduction: absent, otherDeductions: i.otherDeductions ?? 0, advance, net: available - advance };
}

/**
 * Manzoori ka journal. Tankhwahein (6000) sirf kamaya hua hissa (gross - ghair-hazri);
 * advance (1130) aur kattautiyan (2027) alag; baqi Tankhwah baqi (2025).
 */
export function payrollApprovalLines(lines: { gross: number; absentDeduction: number; otherDeductions: number; advance: number; net: number }[]) {
  const sum = (f: (l: (typeof lines)[number]) => number) => Math.round(lines.reduce((s, l) => s + f(l), 0) * 100) / 100;
  return {
    salaries: sum((l) => l.gross - l.absentDeduction),
    advance: sum((l) => l.advance),
    statutory: sum((l) => l.otherDeductions),
    payable: sum((l) => l.net),
  };
}

/** Mulazmat ke poore mahine (aaj tak). */
export function serviceMonths(start: string | null, today: string): number | null {
  if (!start) return null;
  const [y1, m1, d1] = start.split("-").map(Number);
  const [y2, m2, d2] = today.split("-").map(Number);
  let m = (y2 - y1) * 12 + (m2 - m1);
  if (d2 < d1) m -= 1;
  return m;
}

export function advanceEligibility(a: { serviceStart: string | null; today: string; minMonths: number; openAdvances: number; basic: number | null; amount: number; installments: number; capPct: number | null }) {
  const reasons: string[] = [];
  const months = serviceMonths(a.serviceStart, a.today);
  if (months === null) reasons.push("Joining date system mein nahi -- HR pehle hire date darj kare.");
  else if (months < a.minMonths) reasons.push(`Advance ${a.minMonths} mahine ki mulazmat ke baad milta hai.`);
  if (a.openAdvances > 0) reasons.push("Pehle wala advance abhi khula hai.");
  if (a.basic === null) reasons.push("Manzoor shuda salary structure nahi.");
  const installment = a.installments > 0 ? Math.round(a.amount / a.installments) : 0;
  if (a.capPct !== null && a.basic !== null && installment > Math.round((a.basic * a.capPct) / 100)) {
    reasons.push(`Qist basic ke ${a.capPct}% se zyada hai.`);
  }
  return { eligible: reasons.length === 0, months, installment, reasons };
}

export const PAYROLL_STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  submitted: "Manzoori ke liye bheja",
  approved: "Manzoor (Journal)",
  paid: "Ada ho gayi",
  cancelled: "Cancel",
};
export const MONTHS_RU = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
