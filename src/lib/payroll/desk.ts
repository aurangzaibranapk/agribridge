/**
 * Payroll desk ke teeno nazar: Cards, Log, Harkatein.
 * Tankhwah ka formula yahan nahi — `fn_payroll_compute` aur payroll_lines pehle se hain.
 */

export type PayrollDeskView = "cards" | "people" | "tx";

export function payrollDeskView(raw: string | undefined | null): PayrollDeskView {
  if (raw === "cards" || raw === "tx" || raw === "people") return raw;
  return "people";
}

export function labourLabel(input: {
  runStatus: string;
  attendanceFinalized: boolean;
  openItems: number;
}): { label: string; tone: "green" | "amber" | "blue" | "gray" } {
  if (!input.attendanceFinalized || input.openItems > 0) return { label: "Hazri adhoori", tone: "amber" };
  if (input.runStatus === "paid") return { label: "Ada", tone: "green" };
  if (input.runStatus === "approved") return { label: "Manzoor", tone: "blue" };
  if (input.runStatus === "submitted") return { label: "Manzoori baqi", tone: "amber" };
  if (input.runStatus === "draft") return { label: "Draft", tone: "gray" };
  return { label: "—", tone: "gray" };
}

export interface PayAdvance {
  id: string;
  name: string | null;
  amount: number | null;
  status: string;
  reason: string | null;
  firstYear: number | null;
  firstMonth: number | null;
  createdAt: string | null;
  paidAt: string | null;
}

export interface PayAdjustment {
  id: string;
  staff: string;
  fieldLabel: string;
  oldValue: number;
  newValue: number;
  reason: string;
  at: string | null;
}

export interface PayTx {
  id: string;
  title: string;
  kind: string;
  amount: number | null;
  when: string | null;
  status: string;
  href: string;
}

const ADVANCE_STATUS: Record<string, string> = {
  requested: "Manzoori baqi",
  approved: "Manzoor — adaigi baqi",
  rejected: "Rad",
  paid: "Ada — qiston mein",
  closed: "Mukammal",
  cancelled: "Cancel",
};

/** Khula advance hamesha. Is mahine ki ada / pehli qist / rad bhi. */
export function advanceOnDesk(a: PayAdvance, year: number, month: number): boolean {
  if (a.status === "requested" || a.status === "approved") return true;
  if (a.firstYear === year && a.firstMonth === month) return true;
  const ym = `${year}-${String(month).padStart(2, "0")}`;
  if (a.paidAt?.slice(0, 7) === ym) return true;
  if (a.createdAt?.slice(0, 7) === ym && (a.status === "rejected" || a.status === "paid" || a.status === "closed" || a.status === "cancelled")) return true;
  return false;
}

export function payrollTransactions(input: {
  year: number;
  month: number;
  runStatus: string | null;
  payable: number | null;
  runRead: boolean;
  advances: PayAdvance[] | null;
  adjustments: PayAdjustment[] | null;
}): { rows: PayTx[]; advancesUnread: boolean; adjustmentsUnread: boolean } {
  const rows: PayTx[] = [];
  const advancesUnread = input.advances == null;
  const adjustmentsUnread = input.adjustments == null;

  if (input.runRead && (input.runStatus === "approved" || input.runStatus === "paid")) {
    rows.push({
      id: "payroll-post",
      title: input.runStatus === "paid" ? "Tankhwah ada" : "Tankhwah wajib-ul-ada",
      kind: "Payroll",
      amount: input.payable,
      when: null,
      status: input.runStatus === "paid" ? "Ada" : "Manzoor",
      href: "/admin/hr/payroll?view=people",
    });
  }

  for (const a of input.advances ?? []) {
    if (!advanceOnDesk(a, input.year, input.month)) continue;
    rows.push({
      id: a.id,
      title: a.name ? `Advance — ${a.name}` : "Advance",
      kind: a.reason?.trim() ? a.reason.trim() : "Staff advance",
      amount: a.amount == null ? null : -Math.abs(a.amount),
      when: (a.paidAt ?? a.createdAt)?.slice(0, 10) ?? null,
      status: ADVANCE_STATUS[a.status] ?? a.status,
      href: "/admin/hr/advances",
    });
  }

  for (const adj of input.adjustments ?? []) {
    const delta = adj.newValue - adj.oldValue;
    rows.push({
      id: adj.id,
      title: `${adj.staff}: ${adj.fieldLabel}`,
      kind: adj.reason,
      amount: delta,
      when: adj.at?.slice(0, 10) ?? null,
      status: "Line badli",
      href: "/admin/hr/payroll?view=people",
    });
  }

  return { rows, advancesUnread, adjustmentsUnread };
}
