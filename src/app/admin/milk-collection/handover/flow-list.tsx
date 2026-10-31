import Link from "next/link";
import { PageHeader, Card } from "@/components/ui/layout-primitives";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";
import { t } from "@/lib/i18n/translations";
import { formatQty, gapKind, lrRecipeLabel, type HandoverDestination } from "@/lib/milk-handover";
import { handoverGate, loadFlowSlips } from "@/lib/milk-handover-page";
import { HandoverTabs } from "./tabs";

const COPY = {
  company: { title: "mh_flow_company", sub: "mh_sub_company", fresh: "mh_new_company" },
  vendor: { title: "mh_flow_vendor", sub: "mh_sub_vendor", fresh: "mh_new_vendor" },
  party: { title: "mh_flow_party", sub: "mh_sub_party", fresh: "mh_new_party" },
} as const;

export async function HandoverFlowList({ destination, dateParam }: { destination: HandoverDestination; dateParam?: string }) {
  const lang = getLanguageFromCookies("rm");
  const gate = await handoverGate("view");
  if ("error" in gate) return <p className="p-8 text-center text-sm text-surface-500">{gate.error}</p>;
  const date = dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : "";
  const branchId = gate.branchId && (gate.role === "manager" || gate.role === "milk_collection") ? gate.branchId : null;
  const loaded = await loadFlowSlips({ destination, date, branchId });
  const copy = COPY[destination];
  const fresh = date ? `/admin/milk-collection/handover/${destination}/new?date=${date}` : `/admin/milk-collection/handover/${destination}/new`;

  return (
    <div>
      <PageHeader
        title={t(copy.title, lang)}
        description={t(copy.sub, lang)}
        actions={
          <div className="flex gap-3 text-sm">
            {gate.canWrite && (
              <Link href={fresh} className="rounded-lg bg-brand-600 px-3 py-2 font-medium text-white">{t(copy.fresh, lang)}</Link>
            )}
            <Link href="/admin/milk-collection/dispatch" className="self-center text-brand-700 underline">{t("mh_dispatch", lang)}</Link>
          </div>
        }
      />
      <HandoverTabs lang={lang} current={destination} date={date} />
      {!loaded.ready && <p className="mb-3 text-sm text-amber-800">{t("mh_migration_729", lang)}</p>}
      <Card className="space-y-3">
        <form className="flex flex-wrap items-end gap-2" method="get">
          <label className="text-sm">
            Date
            <input type="date" name="date" defaultValue={date} className="ml-2 h-10 rounded-lg border border-surface-200 px-2" />
          </label>
          <button type="submit" className="h-10 rounded-lg border border-surface-200 px-3 text-sm">Dekhein</button>
          {date && <Link href={`/admin/milk-collection/handover/${destination}`} className="text-sm text-brand-700 underline">Sab</Link>}
        </form>
        {loaded.error && <p className="text-sm text-surface-600">{loaded.error}</p>}
        {!loaded.error && loaded.rows.length === 0 && <p className="text-sm text-surface-500">{t("mh_none", lang)}</p>}
        {loaded.rows.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-100 text-left text-xs text-surface-500">
                  <th className="py-2 pr-3">Date</th>
                  <th className="py-2 pr-3">MCC</th>
                  {destination === "party" && <th className="py-2 pr-3">{t("mh_party_pick", lang)}</th>}
                  <th className="py-2 pr-3">{t("mh_slip_gross", lang)}</th>
                  <th className="py-2 pr-3">{t("mh_recipe_col", lang)}</th>
                  <th className="py-2 pr-3">{t("mh_slip_receipt", lang)}</th>
                  <th className="py-2 pr-3">{t("mh_slip_gap", lang)}</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody>
                {loaded.rows.map((row) => {
                  const gap = row.receivedL == null ? null : row.grossL - row.receivedL;
                  const kind = gapKind(gap);
                  const gapLabel = kind === "pending"
                    ? t("mh_receipt_pending", lang)
                    : kind === "even"
                      ? t("mh_even", lang)
                      : `${t(kind === "loss" ? "mh_loss" : "mh_gain", lang)} ${formatQty(Math.abs(gap ?? 0))} L`;
                  return (
                    <tr key={row.id} className="border-b border-surface-50">
                      <td className="py-2 pr-3 text-surface-500">
                        {row.date} · {row.shift === "evening" ? t("mh_evening", lang) : t("mh_morning", lang)}
                      </td>
                      <td className="py-2 pr-3">{row.mccName}</td>
                      {destination === "party" && <td className="py-2 pr-3">{row.partyName || "—"}</td>}
                      <td className="py-2 pr-3">{formatQty(row.grossL)}</td>
                      <td className="py-2 pr-3">{lrRecipeLabel(row.lrBaseline)}</td>
                      <td className="py-2 pr-3">{row.receivedL == null ? t("mh_receipt_pending", lang) : formatQty(row.receivedL)}</td>
                      <td className="py-2 pr-3">{gapLabel}</td>
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
