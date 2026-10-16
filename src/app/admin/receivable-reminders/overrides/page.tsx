import Link from "next/link";
import { requireAction } from "@/lib/access/guard";
import { createServiceClient } from "@/lib/supabase/service";
import { PageHeader, Card } from "@/components/ui/layout-primitives";

export const dynamic = "force-dynamic";

const rs = (n: unknown) => "Rs " + Math.round(Number(n ?? 0)).toLocaleString("en-PK");

/** Udhaar Override Log (credit_block_overrides) -- kis ne, kab, kis gahak ko, kyun. */
export default async function OverrideLogPage({ searchParams }: { searchParams: Promise<{ q?: string; days?: string }> }) {
  const guard = await requireAction("system.receivable_reminders", "view");
  if ("error" in guard) return <div className="p-8 text-center text-surface-400">{guard.error}</div>;
  const sp = await searchParams;
  const days = Math.max(1, Math.min(365, Number(sp.days) || 30));
  const since = new Date(Date.now() - days * 86400000).toISOString();
  const service = createServiceClient() as any;
  const { data: rows } = await service.from("credit_block_overrides").select("*").gte("created_at", since).order("created_at", { ascending: false }).limit(500);
  const custIds = Array.from(new Set((rows ?? []).map((r: any) => r.customer_id).filter(Boolean)));
  const userIds = Array.from(new Set((rows ?? []).map((r: any) => r.overridden_by).filter(Boolean)));
  const [{ data: custs }, { data: users }] = await Promise.all([
    custIds.length ? service.from("customers").select("id,name").in("id", custIds) : { data: [] },
    userIds.length ? service.from("profiles").select("id,full_name").in("id", userIds) : { data: [] },
  ]);
  const cn = new Map((custs ?? []).map((c: any) => [c.id, c.name]));
  const un = new Map((users ?? []).map((u: any) => [u.id, u.full_name]));
  const q = (sp.q ?? "").trim().toLowerCase();
  const list = (rows ?? []).filter((r: any) => !q || String(cn.get(r.customer_id) ?? "").toLowerCase().includes(q));
  return (
    <div className="space-y-4">
      <PageHeader title="Udhaar Override Log" description="Har woh bill jo purane baqaye ke bawajood Admin/Owner ki ijazat se udhaar par bana." />
      <form className="flex flex-wrap gap-2 text-sm">
        <input name="q" defaultValue={sp.q ?? ""} placeholder="Gahak talash" className="input" />
        <select name="days" defaultValue={String(days)} className="input"><option value="7">7 din</option><option value="30">30 din</option><option value="90">90 din</option><option value="365">Saal</option></select>
        <button className="btn-primary rounded-md px-3">Dekhein</button>
        <Link href="/admin/settings/credit-policy" className="ml-auto self-center text-brand-700 underline">Udhaar Policy</Link>
      </form>
      <Card className="overflow-x-auto p-0">
        <table className="w-full text-xs">
          <thead className="bg-surface-50 text-surface-500 dark:bg-surface-800"><tr>{["Waqt (PKT)", "Gahak", "Jagah", "Naya udhaar", "Late raqam", "Din", "Wajah", "Kis ne"].map((h) => <th key={h} className="px-3 py-2 text-left">{h}</th>)}</tr></thead>
          <tbody>
            {list.length === 0 && <tr><td colSpan={8} className="px-3 py-6 text-center text-surface-400">Is muddat mein koi override nahi.</td></tr>}
            {list.map((r: any) => (
              <tr key={r.id} className="border-t border-surface-100 dark:border-surface-800">
                <td className="px-3 py-2">{new Date(r.created_at).toLocaleString("en-PK", { timeZone: "Asia/Karachi" })}</td>
                <td className="px-3 py-2 font-semibold">{r.customer_id ? <Link className="underline" href={`/admin/crm/${r.customer_id}/credit`}>{String(cn.get(r.customer_id) ?? "—")}</Link> : "Branch"}</td>
                <td className="px-3 py-2">{r.context}</td>
                <td className="px-3 py-2">{rs(r.amount)}</td>
                <td className="px-3 py-2">{rs(r.overdue_amount)}</td>
                <td className="px-3 py-2">{r.oldest_days ?? "—"}</td>
                <td className="px-3 py-2">{r.reason}</td>
                <td className="px-3 py-2">{String(un.get(r.overridden_by) ?? r.overridden_role ?? "")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
