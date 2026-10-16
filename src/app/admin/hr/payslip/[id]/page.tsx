import Link from "next/link";
import { notFound } from "next/navigation";
import { payrollViewer } from "@/lib/payroll/access";
import { MONTHS_RU } from "@/lib/payroll/compute";
import { pkr } from "@/lib/recovery/credit-report";

export const dynamic = "force-dynamic";
const CARD = "rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-[#111c33]";
const rs = (n: any) => `Rs ${pkr(Number(n))}`;

/** 553: Payslip break-up (payroll line). Staff sirf apni, manzoori ke baad. */
export default async function PayslipPage({ params }: { params: { id: string } }) {
  const v = await payrollViewer();
  if (!v) return <div className="p-8 text-center text-slate-500">Login zaroori hai.</div>;
  const sb = v.sb;
  const { data: l } = await sb.from("payroll_lines").select("*").eq("id", params.id).maybeSingle();
  if (!l) notFound();
  const [{ data: run }, { data: p }, { data: sd }] = await Promise.all([
    sb.from("payroll_runs").select("*").eq("id", l.run_id).single(),
    sb.from("profiles").select("full_name").eq("id", l.profile_id).maybeSingle(),
    sb.from("staff_details").select("designation, hire_date, probation_start_date").eq("profile_id", l.profile_id).maybeSingle(),
  ]);
  const names = await sb.from("profiles").select("id, full_name").in("id", [run.created_by, run.approved_by].filter(Boolean));
  const nm = new Map<string, string>((names.data ?? []).map((x: any) => [x.id, x.full_name]));
  const { data: plans } = await sb.from("v_qist_plan_summary").select("code, outstanding").eq("party_type", "staff").eq("party_id", l.profile_id).in("status", ["active", "paused"]);
  const advLeft = (plans ?? []).reduce((s: number, x: any) => s + Number(x.outstanding), 0);
  const comps: any[] = l.components ?? [];
  const Row = ({ k, v: val, bold }: any) => <div className={`flex justify-between border-b border-dashed border-slate-200 py-2 text-sm dark:border-white/10 ${bold ? "font-semibold" : ""}`}><span>{k}</span><span className="tabular-nums">{val}</span></div>;
  return (
    <div className="space-y-4 bg-[#F6F7FB] p-1 text-slate-900 dark:bg-[#0b1324] dark:text-slate-100 print:bg-white">
      <div className="flex justify-between print:hidden"><Link href={v.writer ? "/admin/hr/payroll" : "/admin/my-hr"} className="text-sm text-slate-500 hover:underline">← Wapas</Link></div>
      <div className={`${CARD} mx-auto w-full max-w-3xl`}>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div><div className="text-lg font-bold">Al Rana Traders — AgriBridge</div><div className="text-sm text-slate-500">Salary Slip · {MONTHS_RU[run.pay_month - 1]} {run.pay_year}</div></div>
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${run.status === "paid" ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300" : "bg-blue-50 text-blue-700 dark:bg-blue-400/10 dark:text-blue-300"}`}>{run.status === "paid" ? `Ada ho gayi · ${String(run.paid_at).slice(0, 10)}` : "Manzoor -- adaigi baqi"}</span>
        </div>
        <div className="my-5 grid grid-cols-2 gap-4 md:grid-cols-4 text-sm">
          <div><div className="text-xs text-slate-500">Naam</div><div className="font-semibold">{p?.full_name}</div></div>
          <div><div className="text-xs text-slate-500">Ohda</div><div className="font-semibold">{sd?.designation ?? "—"}</div></div>
          <div><div className="text-xs text-slate-500">Joining</div><div className="font-semibold">{sd?.hire_date ?? (sd?.probation_start_date ? `${sd.probation_start_date} (probation)` : "—")}</div></div>
          <div><div className="text-xs text-slate-500">Mahine ke din (hisaab)</div><div className="font-semibold">{l.days_basis}</div></div>
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          <div><h3 className="mb-1 font-semibold">Hazri</h3>
            <Row k="Hazir" v={l.present_days} /><Row k="Paid chhutti" v={l.paid_leave_days} /><Row k="Absent" v={l.absent_days} />
            {l.unpaid_leave_days > 0 && <Row k="Unpaid chhutti" v={l.unpaid_leave_days} />}<Row k="Half day" v={l.half_days} />
          </div>
          <div><h3 className="mb-1 font-semibold">Kamai</h3>
            <Row k="Basic" v={rs(l.basic)} />
            {comps.filter((c) => c.kind === "earning").map((c) => <Row key={c.code} k={c.name} v={rs(c.amount)} />)}
            <Row k="Gross" v={rs(l.gross)} bold />
            <h3 className="mb-1 mt-4 font-semibold">Kattautiyan</h3>
            <Row k={`Ghair-hazri (${Number(l.absent_days) + Number(l.unpaid_leave_days) + Number(l.half_days) * 0.5} din)`} v={rs(l.absent_deduction)} />
            {comps.filter((c) => c.kind === "deduction").map((c) => <Row key={c.code} k={c.name} v={rs(c.amount)} />)}
            {Number(l.advance_deduction) > 0 && <Row k="Advance qist" v={rs(l.advance_deduction)} />}
            <Row k="Kul kattauti" v={rs(Number(l.gross) - Number(l.net))} bold />
          </div>
        </div>
        <div className="mt-4 flex justify-between text-xl font-extrabold"><span>Net tankhwah</span><span className="text-emerald-700 dark:text-emerald-300">{rs(l.net)}</span></div>
        <div className="mt-1 text-xs text-slate-500">Advance baqaya: {rs(advLeft)} · Banaya: {nm.get(run.created_by) ?? "—"} · Manzoor: {nm.get(run.approved_by) ?? "—"}</div>
      </div>
    </div>
  );
}
