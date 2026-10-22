/* eslint-disable @typescript-eslint/no-explicit-any */
import { MONTHS_RU } from "./compute";
import { amountInWords, maskAccount } from "./salary-offer";
import { BRAND_NAME, BRAND_TAGLINE } from "@/lib/brand";

export const SLIP_COMPANY = { name: BRAND_NAME, tagline: `${BRAND_TAGLINE.en} · Main Office, Multan` };

export interface SlipRow { label: string; amount: number }
export interface SlipData {
  lineId: string; profileId: string; slipNo: string | null; verifyCode: string | null;
  month: string; payYear: number; payMonth: number; runStatus: string;
  staff: { name: string; father: string | null; cnic: string | null; designation: string | null; department: string | null; joining: string | null; bank: string | null; account: string | null; employeeCode: string | null };
  workDays: string; earnings: SlipRow[]; deductions: SlipRow[]; gross: number; totalDeductions: number; net: number; netWords: string;
  paidAt: string | null; payMethod: string | null; payRef: string | null; payAccount: string | null;
  createdBy: string | null; approvedBy: string | null;
}

/** Payroll line se slip ki rows -- RPC ho ya purana rasta, dono yahi istemal karte hain. */
export function buildSlip(l: any, run: any, staff: any, extra: { payAccount?: string | null; createdBy?: string | null; approvedBy?: string | null } = {}): SlipData {
  const comps: any[] = Array.isArray(l.components) ? l.components : [];
  const absentDays = Number(l.absent_days ?? 0) + Number(l.unpaid_leave_days ?? 0) + Number(l.missing_days ?? 0) + Number(l.half_days ?? 0) * 0.5;
  const basis = Number(l.days_basis ?? 30);
  const earnings: SlipRow[] = [{ label: "Basic", amount: Number(l.basic) }, ...comps.filter((c) => c.kind === "earning").map((c) => ({ label: String(c.name), amount: Number(c.amount) }))];
  const deductions: SlipRow[] = [
    { label: `Absent cut (${absentDays} din)`, amount: Number(l.absent_deduction ?? 0) },
    { label: "Advance / Qist", amount: Number(l.advance_deduction ?? 0) },
    ...comps.filter((c) => c.kind === "deduction").map((c) => ({ label: String(c.name), amount: Number(c.amount) })),
  ];
  const gross = Number(l.gross);
  const net = Number(l.net);
  return {
    lineId: l.id, profileId: l.profile_id, slipNo: l.slip_no ?? null, verifyCode: l.verify_code ?? null,
    month: `${MONTHS_RU[run.pay_month - 1]} ${run.pay_year}`, payYear: run.pay_year, payMonth: run.pay_month, runStatus: run.status,
    staff: {
      name: staff?.full_name ?? "—", father: staff?.father_name ?? null, cnic: staff?.cnic ?? null, designation: staff?.designation ?? null,
      department: staff?.department ?? null, joining: staff?.hire_date ?? null, bank: staff?.bank_name ?? null,
      account: staff?.bank_account_masked ?? maskAccount(staff?.bank_account), employeeCode: staff?.employee_code ?? null,
    },
    workDays: `${Math.max(0, basis - absentDays)} / ${basis}`,
    earnings, deductions, gross, totalDeductions: gross - net, net, netWords: amountInWords(net),
    paidAt: (l.paid_at ?? run.paid_at ?? null) ? String(l.paid_at ?? run.paid_at).slice(0, 10) : null,
    payMethod: l.pay_method ?? null, payRef: l.pay_ref ?? (run.pay_txn_id ? `TXN-${String(run.pay_txn_id).slice(0, 8).toUpperCase()}` : null),
    payAccount: extra.payAccount ?? run.pay_account ?? null,
    createdBy: extra.createdBy ?? run.created_by_name ?? null, approvedBy: extra.approvedBy ?? run.approved_by_name ?? null,
  };
}

/**
 * Slip ka data. Pehle fn_salary_slip (691: staff ko bhi apni slip, bank masked);
 * migration na ho to purana rasta (sirf payroll writer ke liye poora chalta hai).
 */
export async function loadSlip(sb: any, lineId: string): Promise<SlipData | null> {
  const rpc = await sb.rpc("fn_salary_slip", { p_line: lineId });
  if (!rpc.error) {
    const d = rpc.data;
    if (!d) return null;
    const run = { ...d.run, created_by_name: d.run.created_by, approved_by_name: d.run.approved_by };
    const staff = { ...d.staff, bank_account_masked: d.staff.bank_account, bank_account: undefined };
    return buildSlip(d.line, run, staff, { payAccount: d.run.pay_account });
  }
  const { data: l } = await sb.from("payroll_lines").select("*").eq("id", lineId).maybeSingle();
  if (!l) return null;
  const [{ data: run }, { data: p }, { data: sd }] = await Promise.all([
    sb.from("payroll_runs").select("*").eq("id", l.run_id).maybeSingle(),
    sb.from("profiles").select("full_name, role").eq("id", l.profile_id).maybeSingle(),
    sb.from("staff_details").select("*").eq("profile_id", l.profile_id).maybeSingle(),
  ]);
  if (!run) return null;
  const ids = [run.created_by, run.approved_by].filter(Boolean);
  const { data: names } = ids.length ? await sb.from("profiles").select("id, full_name").in("id", ids) : { data: [] };
  const nm = new Map<string, string>((names ?? []).map((x: any) => [x.id, x.full_name]));
  return buildSlip(l, run, { ...sd, full_name: p?.full_name, designation: sd?.designation ?? p?.role, hire_date: sd?.hire_date ?? sd?.probation_start_date },
    { createdBy: nm.get(run.created_by) ?? null, approvedBy: nm.get(run.approved_by) ?? null });
}
