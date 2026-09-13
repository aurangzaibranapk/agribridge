import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";
import { t } from "@/lib/i18n/translations";

export const dynamic = "force-dynamic";

/**
 * Kis ke paas kitna cash hai.
 *
 * Ye safha us sawal ka jawab hai jo roz shaam ko poochha jata hai aur
 * jis ka jawab ab tak kisi ke paas nahi tha: "aaj ka cash kis kis ke
 * paas para hai?"
 *
 * Adad kahin rakha nahi jata -- seedha ledger (1030) se nikalta hai.
 * Rakha hua adad us din jhoot ban jata hai jis din koi entry seedhi
 * ledger mein jati hai aur ye update karna bhool jata hai.
 */
export default async function CashCustodyPage() {
  const lang = getLanguageFromCookies("rm");
  const supabase = createClient();

  const { data: rows } = await supabase
    .from("v_cash_custody")
    .select("*")
    .order("cash_paas_hai", { ascending: false });

  const people = rows ?? [];
  const total = people.reduce((s, r) => s + Number(r.cash_paas_hai ?? 0), 0);

  return (
    <div className="space-y-4">
      <div>
        <Link href="/admin/cash-handover" className="text-sm text-surface-500 hover:text-brand-700">
          ← {t("ch_title", lang)}
        </Link>
        <h1 className="mt-1 font-display text-xl font-semibold text-surface-900 dark:text-white">
          {t("mcus_title", lang)}
        </h1>
        <p className="text-sm text-surface-500">{t("mcus_subtitle", lang)}</p>
      </div>

      <div className="rounded-card border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/40 dark:bg-amber-950/30">
        <p className="text-xs font-medium uppercase tracking-wide text-amber-700 dark:text-amber-300">
          {t("cc_total", lang)}
        </p>
        <p className="mt-1 font-display text-2xl font-semibold text-amber-800 dark:text-amber-200">
          Rs {total.toLocaleString()}
        </p>
      </div>

      <div className="overflow-hidden rounded-card border border-surface-200 bg-white shadow-card dark:border-surface-800 dark:bg-surface-900">
        {people.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-surface-400">{t("cc_empty", lang)}</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-200 text-left dark:border-surface-800">
                <th className="px-4 py-2 text-xs font-medium uppercase tracking-wide text-surface-500">
                  {t("cc_person", lang)}
                </th>
                <th className="px-4 py-2 text-right text-xs font-medium uppercase tracking-wide text-surface-500">
                  {t("cc_amount", lang)}
                </th>
                <th className="px-4 py-2 text-xs font-medium uppercase tracking-wide text-surface-500">
                  {t("cc_last_move", lang)}
                </th>
              </tr>
            </thead>
            <tbody>
              {people.map((r) => (
                <tr key={r.profile_id as string} className="border-b border-surface-100 last:border-0 dark:border-surface-800">
                  <td className="px-4 py-3">
                    <p className="font-medium text-surface-800 dark:text-surface-200">{r.full_name ?? "—"}</p>
                    <p className="text-xs text-surface-400">{r.role ?? ""}</p>
                  </td>
                  <td className="px-4 py-3 text-right font-display font-semibold text-amber-700 dark:text-amber-300">
                    Rs {Number(r.cash_paas_hai ?? 0).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-xs text-surface-500">
                    {r.aakhri_harkat ? new Date(r.aakhri_harkat as string).toLocaleDateString() : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
