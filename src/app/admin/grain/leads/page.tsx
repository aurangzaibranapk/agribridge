import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { t } from "@/lib/i18n/translations";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";
import { PageHeader, Card } from "@/components/ui/layout-primitives";
import { Badge } from "@/components/ui/form";

export const dynamic = "force-dynamic";

/**
 * Machinery se aayi hui grain ki leads (spec G).
 *
 * Kattai ki booking par ek sawal poochha jata hai: "fasal hamein
 * bechoge?" Jis ne haan kaha, wo grain wale ke liye khabar hai -- magar
 * SAUDA nahi.
 *
 * Ye farq jaan boojh kar rakha gaya hai. Haan keh dene ko khareed bana
 * kar likh dena teen jhoot ek sath likhta hai: rate jo tay nahi hua,
 * wazan jo hua nahi, aur maal jo aaya nahi. Wo teenon phir godam aur
 * P&L dono mein ja kar baithte hain.
 *
 * Is liye yahan koi entry nahi banti. Sirf naam, phone aur kattai ka
 * haal -- taake grain wala khud baat kare aur asal sauda apni jagah
 * likhe.
 */
export default async function GrainLeadsPage() {
  const lang = getLanguageFromCookies("rm");
  const supabase = createClient();

  const { data } = await supabase
    .from("v_grain_leads_from_machinery")
    .select("*")
    .order("kattai_ki_tareekh", { ascending: false, nullsFirst: false });

  const rows = data ?? [];
  const done = rows.filter((r) => r.kattai_mukammal).length;
  const acres = rows.reduce((s, r) => s + Number(r.harvest_area ?? 0), 0);

  return (
    <div className="space-y-4">
      <PageHeader title={t("mgl_title", lang)} description={t("mgl_subtitle", lang)} />

      <div className="rounded-card border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300">
        {t("mgl_not_a_deal", lang)}
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Card>
          <p className="text-xs uppercase tracking-wide text-surface-500">{t("mgl_title", lang)}</p>
          <p className="mt-1 font-display text-xl font-semibold text-surface-900 dark:text-white">{rows.length}</p>
        </Card>
        <Card>
          <p className="text-xs uppercase tracking-wide text-surface-500">{t("mgl_harvest_done", lang)}</p>
          <p className="mt-1 font-display text-xl font-semibold text-surface-900 dark:text-white">{done}</p>
        </Card>
        <Card>
          <p className="text-xs uppercase tracking-wide text-surface-500">{t("mc_acres", lang)}</p>
          <p className="mt-1 font-display text-xl font-semibold text-surface-900 dark:text-white">{acres}</p>
        </Card>
      </div>

      <div className="overflow-x-auto rounded-card border border-surface-200 bg-white shadow-card dark:border-surface-800 dark:bg-surface-900">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-surface-200 bg-surface-50 text-left dark:border-surface-800 dark:bg-surface-800">
              <th className="px-3 py-2 font-medium text-surface-500">{t("mc_farmer", lang)}</th>
              <th className="px-3 py-2 font-medium text-surface-500">{t("mc_crop", lang)}</th>
              <th className="px-3 py-2 text-right font-medium text-surface-500">{t("mc_acres", lang)}</th>
              <th className="px-3 py-2 font-medium text-surface-500">{t("mc_when", lang)}</th>
              <th className="px-3 py-2 font-medium text-surface-500">{t("mgl_harvest_done", lang)}</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.booking_id} className="border-b border-surface-100 last:border-0 dark:border-surface-800">
                <td className="px-3 py-2 font-medium text-surface-800 dark:text-surface-200">
                  {r.farmer_name ?? "-"}
                  <span className="block text-xs text-surface-400">
                    {[r.farmer_code, r.village].filter(Boolean).join(" · ")}
                  </span>
                </td>
                <td className="px-3 py-2 text-surface-600 dark:text-surface-400">{r.crop_type ?? "-"}</td>
                <td className="px-3 py-2 text-right text-surface-600 dark:text-surface-400">
                  {Number(r.kaam_ho_chuka ?? 0)} / {Number(r.harvest_area ?? 0)}
                </td>
                <td className="px-3 py-2 text-surface-600 dark:text-surface-400">{r.kattai_ki_tareekh ?? "-"}</td>
                <td className="px-3 py-2">
                  {r.kattai_mukammal ? (
                    <Badge tone="green">{t("mgl_harvest_done", lang)}</Badge>
                  ) : (
                    <Badge tone="amber">{t("mgl_harvest_running", lang)}</Badge>
                  )}
                </td>
                <td className="px-3 py-2 whitespace-nowrap">
                  {r.farmer_phone && (
                    <a href={`tel:${r.farmer_phone}`} className="text-xs font-medium text-brand-600 hover:underline">
                      {t("mgl_call", lang)}
                    </a>
                  )}
                  {r.booking_id && (
                    <Link
                      href={`/admin/machinery-rental/booking/${r.booking_id}`}
                      className="ml-2 text-xs font-medium text-surface-500 hover:underline"
                    >
                      {t("md_open_page", lang)}
                    </Link>
                  )}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-surface-400">
                  {t("mgl_empty", lang)}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
