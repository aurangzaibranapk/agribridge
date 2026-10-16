import Link from "next/link";
import { requireAction } from "@/lib/access/guard";
import { createServiceClient } from "@/lib/supabase/service";
import { PageHeader, Card } from "@/components/ui/layout-primitives";
import { CreditPositionStrip } from "@/components/recovery/credit-position-strip";
import { loadCreditPosition } from "@/lib/recovery/credit-block";
import { setCustomerOverduePolicy } from "@/actions/credit-policy";

export const dynamic = "force-dynamic";

const rs = (n: unknown) => (n == null ? "—" : "Rs " + Math.round(Number(n)).toLocaleString("en-PK"));

/** Gahak khata › Udhaar hadd (538): teen adad, din ki hadd, waade. */
export default async function CustomerCreditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const guard = await requireAction("system.receivable_reminders", "view");
  if ("error" in guard) return <div className="p-8 text-center text-surface-400">{guard.error}</div>;
  const canEdit = guard.caller.unrestricted;
  const service = createServiceClient() as any;
  const [{ data: c }, { data: s }, { data: promises }, position] = await Promise.all([
    service.from("customers").select("id,name,overdue_block_days,overdue_block_exempt,overdue_block_until,overdue_block_reason").eq("id", id).maybeSingle(),
    service.from("receivable_recovery_settings").select("due_days").eq("id", true).maybeSingle(),
    service.from("payment_promises").select("id,promise_date,promised_amount,fulfilled_amount,status,notes,created_at").eq("party_type", "customer").eq("party_id", id).order("created_at", { ascending: false }).limit(20),
    loadCreditPosition(id),
  ]);
  if (!c) return <div className="p-8 text-center text-surface-400">Gahak nahi mila.</div>;
  const mode = c.overdue_block_exempt ? "exempt" : c.overdue_block_days != null ? "party" : "global";
  const today = new Date(Date.now() + 5 * 3600_000).toISOString().slice(0, 10);
  return (
    <div className="space-y-4">
      <PageHeader title={`${c.name} — Udhaar hadd`} description="Kul baqaya, late raqam, aur udhaar bahal karne ke liye raqam." />
      <div className="flex gap-3 text-sm"><Link className="underline" href={`/admin/crm/${id}/statement`}>Khata statement</Link><Link className="underline" href={`/admin/finance/recovery?customer=${id}`}>Wasooli / Waada</Link></div>
      <Card className="p-4">{position ? <CreditPositionStrip position={position} /> : <p className="text-sm text-surface-400">Udhaar halat abhi nahi mil saki (migration 538 live nahi?).</p>}</Card>
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="space-y-2 p-5 text-sm">
          <b>Is gahak ki din ki hadd</b>
          {canEdit ? (
            <form action={setCustomerOverduePolicy} className="space-y-2">
              <input type="hidden" name="customer_id" value={id} />
              <label className="flex gap-2"><input type="radio" name="mode" value="global" defaultChecked={mode === "global"} /> Aam setting ({s?.due_days ?? 30} din)</label>
              <label className="flex items-center gap-2"><input type="radio" name="mode" value="party" defaultChecked={mode === "party"} /> Apni hadd: <input name="days" type="number" min={1} max={365} defaultValue={c.overdue_block_days ?? ""} className="input w-20" /> din</label>
              <label className="flex gap-2"><input type="radio" name="mode" value="exempt" defaultChecked={mode === "exempt"} /> Koi hadd nahi (kabhi band na ho)</label>
              <label className="block">Wajah (lazmi)<input name="reason" defaultValue={c.overdue_block_reason ?? ""} className="input mt-1 w-full" /></label>
              <label className="block">Kab tak (ikhtiyari)<input name="until" type="date" defaultValue={c.overdue_block_until ?? ""} className="input mt-1 w-48" /></label>
              <button className="btn-primary rounded-md px-4 py-2">Mehfooz karein</button>
              <p className="text-xs text-surface-500">Sirf Admin/Owner badal sakta hai.</p>
            </form>
          ) : <p>{mode === "exempt" ? "Koi hadd nahi" : mode === "party" ? `${c.overdue_block_days} din (apni hadd)` : `Aam setting (${s?.due_days ?? 30} din)`}</p>}
        </Card>
        <Card className="p-5 text-sm">
          <div className="flex justify-between"><b>Waade (Promise to Pay)</b><Link href={`/admin/finance/recovery?customer=${id}&promise=1`} className="font-semibold text-orange-700">+ Naya waada</Link></div>
          <table className="mt-2 w-full text-xs"><thead className="text-surface-500"><tr><th className="text-left">Tareekh</th><th>Raqam</th><th>Mila</th><th>Halat</th></tr></thead>
            <tbody>{(promises ?? []).map((p: any) => {
              const state = p.status === "open" && p.promise_date < today ? "Toota" : p.status === "open" ? "Khula" : p.status === "fulfilled" ? "Poora" : p.status;
              return <tr key={p.id} className="border-t border-surface-100"><td className="py-1">{p.promise_date}</td><td className="text-center">{rs(p.promised_amount)}</td><td className="text-center">{rs(p.fulfilled_amount)}</td><td className={state === "Toota" ? "font-semibold text-red-600" : ""}>{state}</td></tr>;
            })}{(promises ?? []).length === 0 && <tr><td colSpan={4} className="py-3 text-center text-surface-400">Koi waada nahi</td></tr>}</tbody></table>
        </Card>
      </div>
    </div>
  );
}
