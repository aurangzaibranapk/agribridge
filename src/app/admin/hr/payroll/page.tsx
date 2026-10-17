import { payrollViewer } from "@/lib/payroll/access";
import PayrollClient from "./payroll-client";

export const dynamic = "force-dynamic";

/** 553: Mahana payroll -- Draft -> Manzoori -> Journal -> Ada. */
export default async function PayrollPage({ searchParams }: { searchParams: { m?: string; branch?: string } }) {
  const v = await payrollViewer();
  if (!v?.writer) return <div className="p-8 text-center text-slate-500">Ijazat nahi -- sirf HR, Finance, Admin ya Owner.</div>;
  const sb = v.sb;
  const now = new Date(Date.now() + 5 * 3600 * 1000);
  const [y, m] = (searchParams.m ?? `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`).split("-").map(Number);
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
  const { data: sd } = await sb.from("staff_details").select("profile_id, designation");
  const dm = new Map<string, string>((sd ?? []).map((s: any) => [s.profile_id, s.designation]));
  return (
    <PayrollClient
      me={{ id: v.id, approver: v.approver }}
      year={y} month={m} branch={branch}
      branches={branches ?? []} accounts={accounts ?? []}
      run={run ? { ...run, creator: pm.get(run.created_by)?.full_name, approverName: pm.get(run.approved_by)?.full_name, payer: pm.get(run.paid_by)?.full_name } : null}
      lines={(lines ?? []).map((l: any) => ({ ...l, name: pm.get(l.profile_id)?.full_name ?? "—", designation: dm.get(l.profile_id) ?? pm.get(l.profile_id)?.role ?? "" })).sort((a: any, b: any) => a.name.localeCompare(b.name))}
    />
  );
}
