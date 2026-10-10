import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireAction } from "@/lib/access/guard";
import { PageHeader, Card } from "@/components/ui/layout-primitives";
import { loadCustomerAging } from "@/lib/recovery/load-aging";
import { formatRs, formatDatePk } from "@/lib/recovery/aging";

export const dynamic = "force-dynamic";

/** Udhaar aging: 0-15, 15-30, 30+ din (migration 523, FIFO). */
export default async function ReceivableAgingPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const guard = await requireAction("finance.receivable_aging", "view");
  if ("error" in guard) return <div className="p-8 text-center text-surface-400">{guard.error}</div>;

  const { rows, error } = await loadCustomerAging();
  const tot = rows.reduce(
    (a, r) => ({ b1: a.b1 + r.bucket_0_15, b2: a.b2 + r.bucket_15_30, b3: a.b3 + r.bucket_30_plus, all: a.all + r.balance }),
    { b1: 0, b2: 0, b3: 0, all: 0 }
  );

  return (
    <div className="space-y-4">
      <PageHeader title="Udhaar Aging" description="Har gahak ka baqaya umar ke hisaab se. Sab se purana udhaar pehle chukta mana jata hai (FIFO)." />
      {error && <Card className="p-4 text-sm text-red-600">Aging nahi nikal saki: {error} (kya migration 523 laagu hui?)</Card>}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[["0-15 din", tot.b1, "text-emerald-700"], ["15-30 din", tot.b2, "text-amber-700"], ["30+ din", tot.b3, "text-red-700"], ["Kul baqaya", tot.all, ""]].map(
          ([label, v, cls]) => (
            <Card key={label as string} className="p-3">
              <div className="text-xs text-surface-500">{label as string}</div>
              <div className={`text-lg font-bold ${cls}`}>{formatRs(v as number)}</div>
            </Card>
          )
        )}
      </div>
      <Card className="overflow-x-auto p-0">
        <table className="w-full text-xs">
          <thead className="bg-surface-50 text-surface-500 dark:bg-surface-800">
            <tr>
              <th className="px-3 py-2 text-left">Gahak</th>
              <th className="px-3 py-2 text-left">Phone</th>
              <th className="px-3 py-2 text-left">Purana udhaar</th>
              <th className="px-3 py-2 text-right">Din</th>
              <th className="px-3 py-2 text-left">Aakhri tareekh</th>
              <th className="px-3 py-2 text-right">0-15</th>
              <th className="px-3 py-2 text-right">15-30</th>
              <th className="px-3 py-2 text-right">30+</th>
              <th className="px-3 py-2 text-right">Kul</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={9} className="px-3 py-6 text-center text-surface-400">Koi baqaya nahi.</td></tr>
            ) : rows.map((r) => (
              <tr key={r.customer_id} className={`border-t border-surface-100 dark:border-surface-800 ${r.bucket_30_plus > 0 ? "bg-red-50/40" : ""}`}>
                <td className="px-3 py-2 font-semibold">{r.name}</td>
                <td className="px-3 py-2">{r.phone ?? "—"}</td>
                <td className="px-3 py-2">{formatDatePk(r.oldest_unpaid_date)}</td>
                <td className="px-3 py-2 text-right">{r.oldest_days}</td>
                <td className="px-3 py-2">{formatDatePk(r.due_date)}</td>
                <td className="px-3 py-2 text-right">{formatRs(r.bucket_0_15)}</td>
                <td className="px-3 py-2 text-right">{formatRs(r.bucket_15_30)}</td>
                <td className="px-3 py-2 text-right font-semibold text-red-700">{formatRs(r.bucket_30_plus)}</td>
                <td className="px-3 py-2 text-right font-bold">{formatRs(r.balance)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
