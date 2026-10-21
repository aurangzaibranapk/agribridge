/** 696: Mahine ke aakhri din (Pakistan waqt) payroll draft. Pure -- test ho sakta hai. */
export function pktParts(now: Date) {
  const d = new Date(now.getTime() + 5 * 3600 * 1000);
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
}
export function isLastDayOfMonthPkt(now: Date): boolean {
  const { year, month, day } = pktParts(now);
  return day === new Date(Date.UTC(year, month, 0)).getUTCDate();
}
export const PAYROLL_NOTIFY_ROLES = ["owner", "super_admin", "admin", "hr"];

export function payrollDraftMessage(r: { lines?: number; warnings?: number; incomplete?: boolean }, monthLabel: string): string {
  const parts = [`${monthLabel} ka payroll draft tayyar hai: ${r.lines ?? 0} staff.`];
  if (r.warnings) parts.push(`${r.warnings} staff ki tankhwah darj nahi.`);
  if (r.incomplete) parts.push("Hazri adhoori hai.");
  parts.push("Dekh kar zarurat ho to badlein, phir manzoori ke liye bhejein.");
  return parts.join(" ");
}

export const ADJUSTABLE_FIELDS = {
  allowances: "Allowance / bonus",
  other_deductions: "Doosri kattauti",
  advance_deduction: "Advance qist",
  absent_deduction: "Ghair-hazri kattauti",
} as const;
export type AdjustableField = keyof typeof ADJUSTABLE_FIELDS;

/** UI preview: badlao ke baad gross/net (SQL fn_payroll_line_adjust jaisa). */
export function previewAdjust(l: { basic: number; allowances: number; absent_deduction: number; other_deductions: number; advance_deduction: number }, field: AdjustableField, value: number) {
  const n = { ...l, [field]: value };
  const gross = n.basic + n.allowances;
  const net = gross - n.absent_deduction - n.other_deductions - n.advance_deduction;
  return { gross, net, ok: value >= 0 && net >= 0 };
}
