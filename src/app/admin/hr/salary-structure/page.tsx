import { payrollViewer } from "@/lib/payroll/access";
import SalaryStructureClient from "./salary-structure-client";

export const dynamic = "force-dynamic";

/** 551: Tankhwah ka dhancha -- components + har staff ka structure aur history. */
export default async function SalaryStructurePage({ searchParams }: { searchParams: { staff?: string } }) {
  const v = await payrollViewer();
  if (!v?.writer) return <div className="p-8 text-center text-slate-500">Ijazat nahi -- sirf HR, Finance, Admin ya Owner.</div>;
  const sb = v.sb;
  const [{ data: components }, { data: staff }, { data: structures }, { data: settings }] = await Promise.all([
    sb.from("salary_components").select("*").order("sort_order"),
    sb.from("staff_details").select("profile_id, designation, hire_date, probation_start_date, basic_salary").eq("is_active", true),
    sb.from("staff_salary_structures").select("*, staff_salary_structure_items(component_id, amount, pct)").order("effective_from", { ascending: false }),
    sb.from("hr_payroll_settings").select("*").eq("id", 1).maybeSingle(),
  ]);
  const { data: profs } = await sb.from("profiles").select("id, full_name, role, is_active");
  const pm = new Map<string, any>((profs ?? []).map((p: any) => [p.id, p]));
  const people = (staff ?? []).map((s: any) => ({ ...s, profiles: pm.get(s.profile_id) })).filter((s: any) => s.profiles?.is_active).map((s: any) => ({
    id: s.profile_id, name: s.profiles?.full_name ?? "—", designation: s.designation ?? s.profiles?.role ?? "", hireDate: s.hire_date, probationStart: s.probation_start_date,
  })).sort((a: any, b: any) => a.name.localeCompare(b.name));
  const selected = searchParams.staff ?? people[0]?.id ?? null;
  return (
    <SalaryStructureClient
      me={{ id: v.id, approver: v.approver }}
      components={components ?? []}
      people={people}
      selected={selected}
      structures={(structures ?? []).filter((s: any) => s.profile_id === selected).map((s: any) => ({ ...s, creator: pm.get(s.created_by), approver: pm.get(s.approved_by) }))}
      settings={settings ?? { advance_min_service_months: 6, advance_cap_pct: null }}
    />
  );
}
