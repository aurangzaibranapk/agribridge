import { notFound } from "next/navigation";
import { payrollViewer } from "@/lib/payroll/access";
import QistPlanClient from "./plan-client";

export const dynamic = "force-dynamic";

/** 556: Member ka Qist Plan -- schedule ki halat, kattautiyan, aur Admin ke kaam. */
export default async function QistPlanPage({ params }: { params: { id: string } }) {
  const v = await payrollViewer();
  if (!v) return <div className="p-8 text-center text-slate-500">Login zaroori hai.</div>;
  const sb = v.sb;
  const { data: plan } = await sb.from("v_qist_plan_summary").select("*").eq("id", params.id).maybeSingle();
  if (!plan) notFound();
  const [{ data: inst }, { data: events }, { data: deds }, { data: accounts }, { data: profs }] = await Promise.all([
    sb.from("v_qist_installment_status").select("*").eq("plan_id", params.id).order("seq"),
    sb.from("qist_plan_events").select("*").eq("plan_id", params.id).order("at", { ascending: false }).limit(100),
    sb.from("qist_deductions").select("*").eq("plan_id", params.id).order("created_at", { ascending: false }),
    sb.from("finance_accounts").select("id, name").eq("is_active", true).order("name"),
    sb.from("profiles").select("id, full_name"),
  ]);
  const pm = new Map<string, string>((profs ?? []).map((p: any) => [p.id, p.full_name]));
  return (
    <QistPlanClient
      me={{ id: v.id, approver: v.approver, maker: v.qistMaker }}
      plan={{ ...plan, creator: pm.get(plan.created_by), approverName: pm.get(plan.approved_by) }}
      installments={inst ?? []} accounts={accounts ?? []}
      events={(events ?? []).map((e: any) => ({ ...e, by: pm.get(e.by_profile) }))}
      deductions={deds ?? []}
    />
  );
}
