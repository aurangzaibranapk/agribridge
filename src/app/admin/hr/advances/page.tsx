import { payrollViewer } from "@/lib/payroll/access";
import AdvancesClient from "./advances-client";

export const dynamic = "force-dynamic";

/** 552: Staff advance -- mulazmat ki shart, qiston ka plan, maker-checker. */
export default async function AdvancesPage({ searchParams }: { searchParams: { staff?: string; amount?: string; n?: string } }) {
  const v = await payrollViewer();
  if (!v?.writer) return <div className="p-8 text-center text-slate-500">Ijazat nahi -- sirf HR, Finance, Admin ya Owner.</div>;
  const sb = v.sb;
  const [{ data: sd }, { data: profs }, { data: advances }, { data: accounts }] = await Promise.all([
    sb.from("staff_details").select("profile_id, designation").eq("is_active", true),
    sb.from("profiles").select("id, full_name, is_active"),
    sb.from("staff_advances").select("*").order("created_at", { ascending: false }).limit(200),
    sb.from("finance_accounts").select("id, name").eq("is_active", true).order("name"),
  ]);
  const pm = new Map<string, any>((profs ?? []).map((p: any) => [p.id, p]));
  const people = (sd ?? []).filter((s: any) => pm.get(s.profile_id)?.is_active).map((s: any) => ({ id: s.profile_id, name: pm.get(s.profile_id)?.full_name ?? "—", designation: s.designation }));
  const staff = searchParams.staff ?? people[0]?.id ?? null;
  const amount = Number(searchParams.amount ?? 0) || 0;
  const n = Number(searchParams.n ?? 6) || 6;
  const { data: elig } = staff ? await sb.rpc("fn_staff_advance_eligibility", { p_profile: staff, p_amount: amount || 1, p_installments: n }) : { data: null };
  return (
    <AdvancesClient me={{ id: v.id, approver: v.approver }} people={people} staff={staff} amount={amount} n={n} elig={elig} accounts={accounts ?? []}
      advances={(advances ?? []).map((a: any) => ({ ...a, name: pm.get(a.profile_id)?.full_name ?? "—", requester: pm.get(a.requested_by)?.full_name, approverName: pm.get(a.approved_by)?.full_name }))} />
  );
}
