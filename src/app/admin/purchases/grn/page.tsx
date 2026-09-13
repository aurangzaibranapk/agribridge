import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, Card, EmptyState } from "@/components/ui/layout-primitives";
import { Badge } from "@/components/ui/form";
import { ClipboardCheck, AlertTriangle, Wallet } from "lucide-react";
import { t, type TranslationKey } from "@/lib/i18n/translations";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";

export const dynamic = "force-dynamic";

/**
 * GRN ki qatar.
 *
 * Ye safha isi liye bana ke GRN ab tak order ke detail safhe ke andar
 * chhupa hua tha: khulta tabhi tha jab koi us khaas order tak pahunche.
 * Yani "kaunsa maal aa chuka hai magar gina nahi gaya" ka jawab kisi ek
 * jagah nahi milta tha -- aur jo maal gina na jaye, us ki kami kabhi
 * saamne nahi aati.
 *
 * Qataron ki tarteeb wohi hai jo asal silsile ki hai: pehle wo jahan
 * kuch hua hi nahi, phir wo jahan farq nikla aur kisi ki nazar ka
 * intezar hai.
 */
const ORDER = ["grn_banana", "godam_ki_nazar", "finance_ki_nazar"] as const;

const TITLE: Record<string, TranslationKey> = {
  grn_banana: "grn_q_make",
  godam_ki_nazar: "grn_q_warehouse",
  finance_ki_nazar: "grn_q_finance",
};
const HINT: Record<string, TranslationKey> = {
  grn_banana: "grn_q_make_hint",
  godam_ki_nazar: "grn_q_warehouse_hint",
  finance_ki_nazar: "grn_q_finance_hint",
};
const ICON: Record<string, typeof ClipboardCheck> = {
  grn_banana: ClipboardCheck,
  godam_ki_nazar: AlertTriangle,
  finance_ki_nazar: Wallet,
};

export default async function GrnQueuePage() {
  const supabase = createClient();
  const lang = getLanguageFromCookies("rm");

  const { data } = await supabase
    .from("v_grn_queue")
    .select("*")
    .order("din_purani", { ascending: false });

  const rows = data ?? [];
  const byQueue = new Map<string, typeof rows>();
  for (const r of rows) {
    const k = r.queue ?? "grn_banana";
    byQueue.set(k, [...(byQueue.get(k) ?? []), r]);
  }

  return (
    <div className="space-y-4">
      <PageHeader title={t("grn_q_title", lang)} description={t("grn_q_subtitle", lang)} />

      {rows.length === 0 ? (
        <Card className="p-4">
          <EmptyState title={t("grn_q_empty", lang)} description={t("grn_q_empty_note", lang)} />
        </Card>
      ) : (
        ORDER.filter((q) => (byQueue.get(q) ?? []).length > 0).map((q) => {
          const list = byQueue.get(q) ?? [];
          const Icon = ICON[q];
          return (
            <Card key={q} className="overflow-hidden">
              <div className="flex items-center justify-between gap-2 border-b border-surface-200 px-4 py-3 dark:border-surface-800">
                <div>
                  <h2 className="flex items-center gap-1.5 text-sm font-semibold text-surface-900 dark:text-white">
                    <Icon className="h-4 w-4" /> {t(TITLE[q], lang)}
                  </h2>
                  <p className="text-xs text-surface-500">{t(HINT[q], lang)}</p>
                </div>
                <Badge tone={q === "grn_banana" ? "blue" : "amber"}>{list.length}</Badge>
              </div>

              <ul className="divide-y divide-surface-100 dark:divide-surface-800">
                {list.map((r) => (
                  <li key={r.dispatch_id as string}>
                    <Link
                      href={`/admin/agri-orders/${r.order_id}`}
                      className="flex flex-wrap items-start justify-between gap-2 px-4 py-3 hover:bg-surface-50 dark:hover:bg-surface-800"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-surface-900 dark:text-white">
                          {r.order_number} — {r.shop_dealer_name ?? "-"}
                        </p>
                        <p className="text-xs text-surface-500">
                          {r.dispatch_number}
                          {r.vehicle_no ? ` • ${r.vehicle_no}` : ""}
                          {r.driver_name ? ` • ${r.driver_name}` : ""}
                        </p>
                        {/* Farq wali qataron mein wohi adad dikhta hai jis par
                            faisla hona hai -- baqi tafseel order ke safhe par. */}
                        {q !== "grn_banana" && (
                          <p className="mt-0.5 text-xs text-amber-700 dark:text-amber-400">
                            {t("grn_q_shortage", lang)} Rs {Number(r.shortage_amount ?? 0).toLocaleString()}
                            {" • "}
                            {t("grn_q_damage", lang)} Rs {Number(r.damage_amount ?? 0).toLocaleString()}
                          </p>
                        )}
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-sm font-semibold text-surface-900 dark:text-white">
                          Rs {Number(r.grand_total ?? 0).toLocaleString()}
                        </p>
                        <p
                          className={`text-xs ${
                            Number(r.din_purani ?? 0) >= 3
                              ? "font-medium text-red-700 dark:text-red-400"
                              : "text-surface-400"
                          }`}
                        >
                          {Number(r.din_purani ?? 0) === 0
                            ? t("grn_q_today", lang)
                            : `${r.din_purani} ${t("grn_q_days", lang)}`}
                        </p>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          );
        })
      )}

      <p className="px-1 text-xs text-surface-400">{t("grn_q_footer", lang)}</p>
    </div>
  );
}
