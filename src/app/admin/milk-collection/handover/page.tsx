import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, Card } from "@/components/ui/layout-primitives";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";
import { t } from "@/lib/i18n/translations";
import { formatQty } from "@/lib/milk-handover";
import { handoverGate } from "@/lib/milk-handover-page";

export const dynamic = "force-dynamic";

export default async function MilkHandoverList({ searchParams }: { searchParams?: { date?: string } }) {
  const lang = getLanguageFromCookies("rm");
  const gate = await handoverGate("view");
  if ("error" in gate) return <p className="p-8 text-center text-sm text-surface-500">{gate.error}</p>;

  const date = searchParams?.date && /^\d{4}-\d{2}-\d{2}$/.test(searchParams.date) ? searchParams.date : "";
  const supabase = createClient();
  let query = supabase
    .from("milk_dispatches")
    .select("id, dispatch_date, shift, mcc_name, dispatched_liters, accepted, received_liters, branch_id, branches(name)")
    .order("dispatch_date", { ascending: false })
    .order("shift")
    .limit(40);
  if (date) query = query.eq("dispatch_date", date);
  if (gate.branchId && (gate.role === "manager" || gate.role === "milk_collection")) {
    query = query.eq("branch_id", gate.branchId);
  }
  const { data, error } = await query;

  return (
    <div>
      <PageHeader
        title={t("mh_title", lang)}
        description={t("mh_subtitle", lang)}
        actions={
          <div className="flex gap-3 text-sm">
            {gate.canWrite && (
              <Link href={date ? `/admin/milk-collection/handover/new?date=${date}` : "/admin/milk-collection/handover/new"} className="rounded-lg bg-brand-600 px-3 py-2 font-medium text-white">
                {t("mh_new", lang)}
              </Link>
            )}
            <Link href="/admin/milk-collection/dispatch" className="self-center text-brand-700 underline">{t("mh_dispatch", lang)}</Link>
          </div>
        }
      />
      <p className="mb-3 text-sm text-surface-500">{t("mh_backfill", lang)}</p>
      <Card className="space-y-3">
        <form className="flex flex-wrap items-end gap-2" method="get">
          <label className="text-sm">
            Date
            <input type="date" name="date" defaultValue={date} className="ml-2 h-10 rounded-lg border border-surface-200 px-2" />
          </label>
          <button type="submit" className="h-10 rounded-lg border border-surface-200 px-3 text-sm">Dekhein</button>
          {date && <Link href="/admin/milk-collection/handover" className="text-sm text-brand-700 underline">Sab</Link>}
        </form>

        {error && (
          <p className="text-sm text-surface-600">
            Milk Handover Certificate ka table abhi nahi. Migration 725 pehle Testing par chalao — Live se pehle backup.
          </p>
        )}
        {!error && (data ?? []).length === 0 && <p className="text-sm text-surface-500">{t("mh_none", lang)}</p>}
        {!error && (data ?? []).length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-100 text-left text-xs text-surface-500">
                  <th className="py-2 pr-3">Date</th>
                  <th className="py-2 pr-3">MCC</th>
                  <th className="py-2 pr-3">Gross (L)</th>
                  <th className="py-2 pr-3">Accepted</th>
                  <th className="py-2 pr-3">Raseed</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody>
                {(data ?? []).map((row) => {
                  const branchName = (row.branches as { name?: string } | null)?.name;
                  return (
                    <tr key={row.id} className="border-b border-surface-50">
                      <td className="py-2 pr-3 text-surface-500">
                        {row.dispatch_date} · {row.shift === "evening" ? t("mh_evening", lang) : t("mh_morning", lang)}
                      </td>
                      <td className="py-2 pr-3">{row.mcc_name || branchName || "—"}</td>
                      <td className="py-2 pr-3">{formatQty(Number(row.dispatched_liters))}</td>
                      <td className="py-2 pr-3">
                        {row.accepted == null ? t("mh_pending", lang) : row.accepted ? "YES" : "NO"}
                      </td>
                      <td className="py-2 pr-3">{row.received_liters == null ? "—" : formatQty(Number(row.received_liters))}</td>
                      <td className="py-2 text-right">
                        <Link href={`/admin/milk-collection/handover/${row.id}`} className="text-brand-700 underline">{t("mh_open", lang)}</Link>
                        {" · "}
                        <Link href={`/admin/milk-collection/handover/${row.id}/print`} className="text-brand-700 underline">{t("mh_print", lang)}</Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
