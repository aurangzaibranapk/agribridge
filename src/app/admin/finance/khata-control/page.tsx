import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { loadUserAccess, can } from "@/lib/access/permissions";
import { PageHeader, Card } from "@/components/ui/layout-primitives";
import { Badge } from "@/components/ui/form";
import { ReverseForm } from "@/app/admin/audit-trail/reverse-form";
import { RestorePayableForm } from "./restore-payable-form";
import { Search, ShieldCheck } from "lucide-react";

export const dynamic = "force-dynamic";

type SearchParams = { q?: string; status?: string };

export default async function KhataControlPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const supabase = createClient();
  const service = createServiceClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return <div className="p-8 text-center text-surface-400">Pehle login karein.</div>;
  const access = await loadUserAccess(user.id);
  const canReverse = !!access && can(access, "finance.reversal", "create");
  if (!canReverse) {
    return <div className="p-8 text-center text-surface-400">Khata correction sirf Admin/Finance ke liye hai.</div>;
  }

  const q = String(searchParams.q ?? "").trim().toLowerCase();
  const status = searchParams.status ?? "active";
  const [{ data: rawEntries }, { data: rawReversals }] = await Promise.all([
    service
      .from("journal_entries")
      .select("id, entry_number, entry_date, created_at, description, source_module, is_reversal, reversal_of, created_by, profiles(full_name), journal_lines!inner(account_code, debit, credit, party_type, party_id)")
      .eq("journal_lines.party_type", "customer")
      .order("created_at", { ascending: false })
      .limit(250),
    service.from("journal_entries").select("reversal_of, entry_number").not("reversal_of", "is", null),
  ]);

  const rows = (rawEntries ?? []) as any[];
  const partyIds = [...new Set(rows.flatMap((r) => (r.journal_lines ?? []).map((l: any) => l.party_id).filter(Boolean)))];
  const { data: customers } = partyIds.length
    ? await service.from("customers").select("id, name, phone_number").in("id", partyIds)
    : { data: [] as any[] };
  const customerMap = new Map((customers ?? []).map((c: any) => [c.id, c]));
  const reversedMap = new Map((rawReversals ?? []).map((r: any) => [r.reversal_of, r.entry_number]));

  const entries = rows
    .map((r) => {
      const lines = (r.journal_lines ?? []) as any[];
      const parties = [...new Map(lines.map((l) => [l.party_id, customerMap.get(l.party_id)])).values()].filter(Boolean);
      const amount = lines.reduce((sum, l) => sum + Number(l.debit ?? 0), 0);
        return {
        id: r.id,
        entryNumber: r.entry_number,
        entryDate: r.entry_date,
        createdAt: r.created_at,
        description: r.description,
        sourceModule: r.source_module,
        isReversal: Boolean(r.is_reversal),
        reversedBy: reversedMap.get(r.id) ?? null,
        amount,
        partyNames: parties.map((p: any) => `${p.name}${p.phone_number ? ` (${p.phone_number})` : ""}`).join(", "),
        partyIds: parties.map((p: any) => p.id as string),
      };
    })
    .filter((r) => {
      const matchesSearch = !q || `${r.entryNumber} ${r.description} ${r.sourceModule} ${r.partyNames}`.toLowerCase().includes(q);
      const matchesStatus = status === "all" || (status === "active" ? !r.isReversal && !r.reversedBy : r.isReversal || Boolean(r.reversedBy));
      return matchesSearch && matchesStatus;
    });

  return (
    <div className="space-y-4">
      <PageHeader
        title="Khata Control — Reversal & Corrections"
        description="Customer name, mobile ya entry number se entry dhoondein. Original record delete nahi hota; safe reversal banti hai."
      />

      <Card className="space-y-3">
        <form className="flex flex-wrap items-end gap-3" method="get">
          <div className="min-w-[280px] flex-1">
            <label className="mb-1 block text-xs font-medium text-surface-500">Customer / Entry No / Mobile</label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-400" />
              <input name="q" defaultValue={searchParams.q ?? ""} placeholder="Naam ya POS/TXN number..." className="w-full rounded-lg border border-surface-200 py-2 pl-9 pr-3 text-sm dark:border-surface-700 dark:bg-surface-900" />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-surface-500">Status</label>
            <select name="status" defaultValue={status} className="rounded-lg border border-surface-200 p-2 text-sm dark:border-surface-700 dark:bg-surface-900">
              <option value="active">Active entries</option>
              <option value="all">All entries</option>
              <option value="reversed">Reversed entries</option>
            </select>
          </div>
          <button type="submit" className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">Search</button>
        </form>
        <div className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
          Reversal sirf Admin/Finance permission se hogi. Original sale, payment ya return delete nahi hogi; linked customer balance bhi reverse ke sath update hoga.
        </div>
      </Card>

      <Card className="overflow-hidden p-0">
        {entries.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-surface-500">Is filter ke mutabiq koi customer entry nahi mili.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead className="bg-surface-50 text-left text-xs text-surface-500 dark:bg-surface-800/60">
                <tr>
                  <th className="px-4 py-3">Entry No / Date</th>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Detail</th>
                  <th className="px-4 py-3">Module</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                  <th className="px-4 py-3">Status / Action</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <tr key={entry.id} className="border-t border-surface-100 align-top dark:border-surface-800">
                    <td className="px-4 py-3"><span className="font-mono text-xs font-semibold">{entry.entryNumber}</span><span className="mt-1 block text-xs text-surface-500">{entry.entryDate}</span></td>
                    <td className="px-4 py-3 font-medium">{entry.partyNames || "—"}</td>
                    <td className="max-w-[280px] px-4 py-3 text-xs text-surface-600 dark:text-surface-300">{entry.description}</td>
                    <td className="px-4 py-3 text-xs text-surface-500">{entry.sourceModule}</td>
                    <td className="px-4 py-3 text-right tabular-nums">Rs {Math.round(entry.amount).toLocaleString()}</td>
                    <td className="px-4 py-3">
                      {entry.reversedBy ? <Badge tone="amber">Reversed: {entry.reversedBy}</Badge> : entry.isReversal ? <Badge tone="gray">Reversal entry</Badge> : <>
                        <ReverseForm entryId={entry.id} entryNumber={entry.entryNumber} amount={entry.amount} />
                        {entry.partyIds[0] && <RestorePayableForm entryId={entry.id} customerId={entry.partyIds[0]} defaultAmount={40} />}
                      </>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
