import { payrollViewer } from "@/lib/payroll/access";
import { karachiMonth } from "@/lib/finance/ops-desk";
import { payrollDeskView } from "@/lib/payroll/desk";
import PayrollClient from "./payroll-client";

export const dynamic = "force-dynamic";

/** 553: Mahana payroll -- Draft -> Manzoori -> Journal -> Ada. */
export default async function PayrollPage({ searchParams }: { searchParams: { m?: string; branch?: string; view?: string } }) {
  const v = await payrollViewer();
  if (!v?.writer) return <div className="p-8 text-center text-slate-500">Ijazat nahi -- sirf HR, Finance, Admin ya Owner.</div>;
  const sb = v.sb;
  const km = karachiMonth();
  const [y, m] = (searchParams.m ?? km.prefix).split("-").map(Number);
  const branch = searchParams.branch || null;
  let rq = sb.from("payroll_runs").select("*").eq("pay_year", y).eq("pay_month", m).neq("status", "cancelled");
  rq = branch ? rq.eq("branch_id", branch) : rq.is("branch_id", null);
  const [{ data: run }, { data: branches }, { data: accounts }, { data: profs }] = await Promise.all([
    rq.maybeSingle(),
    sb.from("branches").select("id, name").order("name"),
    sb.from("finance_accounts").select("id, name").eq("is_active", true).order("name"),
    sb.from("profiles").select("id, full_name, role"),
  ]);
  const pm = new Map<string, any>((profs ?? []).map((p: any) => [p.id, p]));
  const { data: lines } = run ? await sb.from("payroll_lines").select("*").eq("run_id", run.id) : { data: [] };
  const [{ data: warns }, { data: adjs }] = run
    ? await Promise.all([
        sb.from("payroll_run_warnings").select("id, profile_id, message").eq("run_id", run.id),
        sb.from("payroll_line_adjustments").select("*").eq("run_id", run.id).order("adjusted_at"),
      ])
    : [{ data: [] }, { data: [] }];
  const { data: sd } = await sb.from("staff_details").select("profile_id, designation");
  const dm = new Map<string, string>((sd ?? []).map((s: any) => [s.profile_id, s.designation]));
  const { data: advanceRows, error: advanceError } = await sb
    .from("staff_advances")
    .select("id, profile_id, amount, status, reason, first_year, first_month, created_at, paid_at")
    .order("created_at", { ascending: false })
    .limit(200);
  const advances = advanceError
    ? null
    : (advanceRows ?? []).map((a: any) => ({
        id: a.id,
        name: pm.get(a.profile_id)?.full_name ?? null,
        amount: a.amount == null ? null : Number(a.amount),
        status: String(a.status ?? ""),
        reason: a.reason ?? null,
        firstYear: a.first_year == null ? null : Number(a.first_year),
        firstMonth: a.first_month == null ? null : Number(a.first_month),
        createdAt: a.created_at ?? null,
        paidAt: a.paid_at ?? null,
      }));
  return (
    <PayrollClient
      me={{ id: v.id, approver: v.approver }}
      year={y} month={m} branch={branch}
      view={payrollDeskView(searchParams.view)}
      advances={advances}
      advancesRead={!advanceError}
      branches={branches ?? []} accounts={accounts ?? []}
      run={run ? { ...run, creator: pm.get(run.created_by)?.full_name, approverName: pm.get(run.approved_by)?.full_name, payer: pm.get(run.paid_by)?.full_name } : null}
      warnings={(warns ?? []).filter((w: any) => !(lines ?? []).some((l: any) => l.profile_id === w.profile_id)).map((w: any) => ({ ...w, name: pm.get(w.profile_id)?.full_name ?? "Staff" }))}
      adjustments={(adjs ?? []).map((a: any) => ({ ...a, staff: pm.get(a.profile_id)?.full_name ?? "—", by: pm.get(a.adjusted_by)?.full_name ?? "—" }))}
      lines={(lines ?? []).map((l: any) => ({ ...l, name: pm.get(l.profile_id)?.full_name ?? "—", designation: dm.get(l.profile_id) ?? pm.get(l.profile_id)?.role ?? "" })).sort((a: any, b: any) => a.name.localeCompare(b.name))}
    />
  );
}
