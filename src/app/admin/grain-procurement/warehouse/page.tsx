import { createClient } from "@/lib/supabase/server";
import { PageHeader, Card, EmptyState } from "@/components/ui/layout-primitives";
import { Warehouse, Wheat, Wallet } from "lucide-react";
import { t, type TranslationKey } from "@/lib/i18n/translations";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";

export const dynamic = "force-dynamic";

const GRAIN: Record<string, TranslationKey> = {
  wheat: "gr_wheat",
  rice: "gr_rice",
  maize: "gr_maize",
};

/**
 * Anaj ka godam.
 *
 * Ab tak kahin nazar nahi aata tha ke godam mein kaunsa anaj kitna para
 * hai. Entries se aata hai, sales se jata hai -- magar dono ka farq kisi
 * safhe par nahi tha. Yani wo sawal jo har subah poochha jata hai
 * ("kitna gandum para hai?") us ka jawab system ke paas tha hi nahi.
 *
 * Wazan aur lagat sath dikhti hai kyunke ek hi sawal ke do rukh hain:
 * kitna para hai, aur us mein kitna paisa phansa hua hai.
 */
export default async function GrainWarehousePage() {
  const supabase = createClient();
  const lang = getLanguageFromCookies("rm");

  const { data } = await supabase
    .from("v_grain_warehouse_stock")
    .select("*")
    .order("warehouse_name")
    .order("grain_type");

  const rows = data ?? [];
  const totalKg = rows.reduce((s, r) => s + Number(r.maujood_kg ?? 0), 0);
  const totalValue = rows.reduce((s, r) => s + Number(r.maujood_ki_lagat ?? 0), 0);

  const byWarehouse = new Map<string, typeof rows>();
  for (const r of rows) {
    const k = (r.warehouse_name as string) ?? "-";
    byWarehouse.set(k, [...(byWarehouse.get(k) ?? []), r]);
  }

  return (
    <div className="space-y-4">
      <PageHeader title={t("gw_title", lang)} description={t("gw_subtitle", lang)} />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card className="p-4">
          <div className="flex items-center gap-2 text-surface-500">
            <Wheat className="h-4 w-4" />
            <span className="text-xs font-medium uppercase tracking-wide">{t("gw_total_kg", lang)}</span>
          </div>
          <p className="mt-2 font-display text-xl font-semibold text-surface-900 dark:text-white">
            {Math.round(totalKg).toLocaleString()} kg
          </p>
          <p className="text-xs text-surface-400">
            {(totalKg / 40).toFixed(1)} {t("gw_maund", lang)}
          </p>
        </Card>
        <Card className="border-brand-200 bg-brand-50 p-4 dark:border-brand-900/40 dark:bg-brand-950/30">
          <div className="flex items-center gap-2 text-brand-600">
            <Wallet className="h-4 w-4" />
            <span className="text-xs font-medium uppercase tracking-wide">{t("gw_stuck_money", lang)}</span>
          </div>
          <p className="mt-2 font-display text-xl font-semibold text-brand-700 dark:text-brand-300">
            Rs {Math.round(totalValue).toLocaleString()}
          </p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-surface-500">
            <Warehouse className="h-4 w-4" />
            <span className="text-xs font-medium uppercase tracking-wide">{t("gw_warehouses", lang)}</span>
          </div>
          <p className="mt-2 font-display text-xl font-semibold text-surface-900 dark:text-white">
            {byWarehouse.size}
          </p>
        </Card>
      </div>

      {rows.length === 0 ? (
        <Card className="p-4">
          <EmptyState title={t("gw_empty", lang)} description={t("gw_empty_note", lang)} />
        </Card>
      ) : (
        Array.from(byWarehouse.entries()).map(([name, list]) => (
          <Card key={name} className="overflow-hidden">
            <div className="flex items-center gap-1.5 border-b border-surface-200 px-4 py-3 text-sm font-semibold text-surface-900 dark:border-surface-800 dark:text-white">
              <Warehouse className="h-4 w-4" /> {name}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[620px] text-sm">
                <thead>
                  <tr className="border-b border-surface-200 text-left text-xs text-surface-500 dark:border-surface-800">
                    <th className="px-4 py-2 font-medium">{t("gw_grain", lang)}</th>
                    <th className="px-4 py-2 text-right font-medium">{t("gw_in", lang)}</th>
                    <th className="px-4 py-2 text-right font-medium">{t("gw_out", lang)}</th>
                    <th className="px-4 py-2 text-right font-medium">{t("gw_on_hand", lang)}</th>
                    <th className="px-4 py-2 text-right font-medium">{t("gw_avg_cost", lang)}</th>
                    <th className="px-4 py-2 text-right font-medium">{t("gw_value", lang)}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-100 dark:divide-surface-800">
                  {list.map((r) => {
                    const onHand = Number(r.maujood_kg ?? 0);
                    return (
                      <tr key={`${r.warehouse_id}-${r.grain_type}`} className={onHand < 0 ? "bg-red-50/60 dark:bg-red-950/10" : ""}>
                        <td className="px-4 py-2 font-medium text-surface-800 dark:text-surface-200">
                          {t(GRAIN[r.grain_type as string] ?? "gr_grain", lang)}
                        </td>
                        <td className="px-4 py-2 text-right tabular-nums text-surface-500">
                          {Math.round(Number(r.aaya_kg ?? 0)).toLocaleString()}
                        </td>
                        <td className="px-4 py-2 text-right tabular-nums text-surface-500">
                          {Math.round(Number(r.gaya_kg ?? 0)).toLocaleString()}
                        </td>
                        <td
                          className={`px-4 py-2 text-right font-semibold tabular-nums ${
                            onHand < 0 ? "text-red-700 dark:text-red-400" : "text-surface-900 dark:text-white"
                          }`}
                        >
                          {Math.round(onHand).toLocaleString()} kg
                          <span className="block text-xs font-normal text-surface-400">
                            {(onHand / 40).toFixed(1)} {t("gw_maund", lang)}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-right tabular-nums text-surface-600 dark:text-surface-400">
                          {r.aausat_lagat_fi_kg != null ? `Rs ${Number(r.aausat_lagat_fi_kg).toLocaleString()}` : "—"}
                        </td>
                        <td className="px-4 py-2 text-right tabular-nums text-surface-900 dark:text-white">
                          Rs {Math.round(Number(r.maujood_ki_lagat ?? 0)).toLocaleString()}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        ))
      )}

      <p className="px-1 text-xs text-surface-400">{t("gw_footer", lang)}</p>
    </div>
  );
}
