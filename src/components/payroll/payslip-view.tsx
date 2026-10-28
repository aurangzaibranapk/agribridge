import { notFound } from "next/navigation";
import { payrollViewer } from "@/lib/payroll/access";
import { loadSlip } from "@/lib/payroll/slip-data";
import { siteOrigin } from "@/lib/payroll/site-origin";
import { verifyUrl } from "@/lib/payroll/salary-offer";
import { pkr } from "@/lib/recovery/credit-report";
import { SalarySlipA4 } from "./salary-slip-a4";
import { SlipToolbar } from "./slip-toolbar";
import { LinePaymentForm } from "./salary-forms";

const CARD = "rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-[#111c33]";
const rs = (x: unknown) => `Rs ${pkr(Number(x))}`;

/**
 * 553 payslip + 691 A4 slip. Staff sirf apni (fn_salary_slip / RLS), manzoori ke baad.
 * Neeche purani hazri ki tafseel wese hi -- sirf screen par, print mein nahi.
 */
export async function PayslipView({ id, self }: { id: string; self: boolean }) {
  const v = await payrollViewer();
  if (!v) return <div className="p-8 text-center text-slate-500">Login zaroori hai.</div>;
  const slip = await loadSlip(v.sb, id);
  if (!slip) notFound();
  if (self && slip.profileId !== v.id) notFound();
  if (!v.writer && slip.profileId !== v.id) notFound();
  const sb = v.sb;
  const { data: l } = await sb.from("payroll_lines").select("*").eq("id", id).maybeSingle();
  const { data: plans } = await sb.from("v_qist_plan_summary").select("code, outstanding").eq("party_type", "staff").eq("party_id", slip.profileId).in("status", ["active", "paused"]);
  const advLeft = (plans ?? []).reduce((s: number, x: { outstanding: number }) => s + Number(x.outstanding), 0);
  const origin = siteOrigin();
  const href = slip.verifyCode ? verifyUrl(origin, slip.verifyCode) : null;
  const label = `${origin.replace(/^https?:\/\//, "")}/verify`;
  const Row = ({ k, val }: { k: string; val: React.ReactNode }) => <div className="flex justify-between border-b border-dashed border-slate-200 py-2 text-sm dark:border-white/10"><span>{k}</span><span className="tabular-nums">{val}</span></div>;
  return (
    <div className="space-y-4 bg-gray-200/70 p-4 text-slate-900 dark:bg-[#0b1324] dark:text-slate-100 print:bg-white print:p-0">
      <style>{"@page{size:A4;margin:0}@media print{body *{visibility:hidden}.salary-slip-a4,.salary-slip-a4 *{visibility:visible}.salary-slip-a4{position:absolute;left:0;top:0}}"}</style>
      <SlipToolbar back={self ? "/admin/my-hr" : "/admin/hr/payroll"} pdfHref={`/api/hr/payslip/${id}/pdf`} />
      <SalarySlipA4 slip={slip} verifyHref={href} verifyLabel={label} />
      {l && (
        <div className={`${CARD} mx-auto w-[794px] max-w-full print:hidden`}>
          <h3 className="mb-1 font-semibold">Hazri ki tafseel</h3>
          <div className="grid gap-x-6 md:grid-cols-2">
            <div>
              <Row k="Hazir" val={l.present_days} /><Row k="Paid chhutti" val={l.paid_leave_days} /><Row k="Absent" val={l.absent_days} />
              {Number(l.missing_days) > 0 && <Row k="Bina record (absent gina)" val={l.missing_days} />}
            </div>
            <div>
              {l.unpaid_leave_days > 0 && <Row k="Unpaid chhutti" val={l.unpaid_leave_days} />}<Row k="Half day" val={l.half_days} />
              <Row k="Mahine ke din (hisaab)" val={l.days_basis} />
            </div>
          </div>
          <div className="mt-2 text-xs text-slate-500">Advance baqaya: {rs(advLeft)} · Banaya: {slip.createdBy ?? "—"} · Manzoor: {slip.approvedBy ?? "—"}</div>
          {v.approver && slip.profileId !== v.id && "verify_code" in l && (
            <div className="mt-3"><LinePaymentForm lineId={id} method={l.pay_method ?? null} reference={l.pay_ref ?? null} /></div>
          )}
        </div>
      )}
    </div>
  );
}
