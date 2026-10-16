import Link from "next/link";
import { requireAction } from "@/lib/access/guard";
import { createServiceClient } from "@/lib/supabase/service";
import { PageHeader, Card } from "@/components/ui/layout-primitives";
import { updateCreditPolicy } from "@/actions/credit-policy";

export const dynamic = "force-dynamic";

/** Settings › Udhaar Policy (538): aam din ki hadd, override wajah ki list, alag hadd wale gahak. */
export default async function CreditPolicyPage() {
  const guard = await requireAction("system.receivable_reminders", "view");
  if ("error" in guard) return <div className="p-8 text-center text-surface-400">{guard.error}</div>;
  const canEdit = guard.caller.unrestricted;
  const service = createServiceClient() as any;
  const [{ data: s }, { data: special }] = await Promise.all([
    service.from("receivable_recovery_settings").select("*").eq("id", true).maybeSingle(),
    service.from("customers").select("id,name,overdue_block_days,overdue_block_exempt,overdue_block_until,overdue_block_reason")
      .or("overdue_block_days.not.is.null,overdue_block_exempt.eq.true").order("name").limit(200),
  ]);
  const reasons: string[] = s?.override_reasons ?? [];
  return (
    <div className="space-y-4">
      <PageHeader title="Udhaar Policy" description="Purane baqaye par naya udhaar band -- aam hadd, override wajah, aur alag hadd wale gahak. Naqad bikri hamesha khuli." />
      <Card className="p-5">
        {canEdit ? (
          <form action={updateCreditPolicy} className="space-y-4 text-sm">
            <label className="flex items-center gap-2 font-semibold"><input type="checkbox" name="block_overdue_credit" defaultChecked={Boolean(s?.block_overdue_credit)} /> Purane baqaye par naya udhaar band</label>
            <div className="grid gap-4 md:grid-cols-3">
              <label>Aam hadd (din)<input name="due_days" type="number" min={1} max={365} defaultValue={s?.due_days ?? 30} className="input mt-1 w-full" /></label>
              <label>Kam az kam baqaya (Rs)<input name="min_amount" defaultValue={s?.min_amount ?? 0.01} className="input mt-1 w-full" /></label>
              <label>Policy start<input name="effective_from" type="date" defaultValue={s?.effective_from ?? ""} className="input mt-1 w-full" /></label>
            </div>
            <label className="block">Override ki wajah ki list (har line ek wajah)<textarea name="override_reasons" rows={5} defaultValue={reasons.join("\n")} className="input mt-1 w-full" /></label>
            <button type="submit" className="btn-primary rounded-md px-4 py-2">Mehfooz karein</button>
          </form>
        ) : (
          <p className="text-sm">Aam hadd: <b>{s?.due_days ?? 30} din</b> · Rok: {s?.block_overdue_credit ? "Chalu" : "Band"} (badalne ke liye Admin/Owner)</p>
        )}
      </Card>
      <Card className="p-5 text-sm">
        <div className="mb-2 flex items-center justify-between"><b>Alag hadd wale gahak ({(special ?? []).length})</b><Link href="/admin/receivable-reminders/overrides" className="text-brand-700 underline">Override Log</Link></div>
        {(special ?? []).length === 0 ? <p className="text-surface-400">Sab gahak aam setting par hain.</p> : (
          <table className="w-full text-xs"><thead className="text-surface-500"><tr><th className="text-left">Gahak</th><th className="text-left">Hadd</th><th className="text-left">Kab tak</th><th className="text-left">Wajah</th></tr></thead>
            <tbody>{(special ?? []).map((c: any) => (
              <tr key={c.id} className="border-t border-surface-100"><td className="py-1.5"><Link className="underline" href={`/admin/crm/${c.id}/credit`}>{c.name}</Link></td><td>{c.overdue_block_exempt ? "Koi hadd nahi" : `${c.overdue_block_days} din`}</td><td>{c.overdue_block_until ?? "—"}</td><td>{c.overdue_block_reason ?? ""}</td></tr>
            ))}</tbody></table>
        )}
      </Card>
    </div>
  );
}
