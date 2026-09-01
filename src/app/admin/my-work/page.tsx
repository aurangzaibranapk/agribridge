import Link from "next/link";
import { redirect } from "next/navigation";
import * as Icons from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { loadNav } from "@/lib/access/nav";
import { pendingByDepartment } from "@/lib/access/pending-counts";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";
import { t } from "@/lib/i18n/translations";

export const dynamic = "force-dynamic";

/**
 * Mera Kaam -- staff ka pehla safha.
 *
 * Malik ka faisla: staff ko 100+ features ka sidebar dene ke bajaye
 * DEPARTMENT CARDS milein, aur sirf wohi jo usay assign hue hon.
 *
 *   Login  ->  Mera Kaam  ->  Department card  ->  us ka apna kaam
 *
 * Yahan koi nayi ijazat nahi banti. loadNav() pehle se wohi department
 * deta hai jin ka koi feature is bande ko khulta hai -- yani "sirf apne
 * cards" ka qanoon pehle se chal raha tha, bas us ki shakl fehrist ki
 * thi. Machinery wale ko sirf Machinery ka card aayega; agar usay diesel
 * aur cash lene ki bhi ijazat hai to Finance ka card bhi aa jayega.
 * Kuch bhi yahan alag se likhne ki zaroorat nahi -- ijazat badalte hi
 * card khud aa jata ya chala jata hai.
 *
 * Malik aur admin ko ye safha bhi milta hai magar un ka asal ghar
 * Command Center hai, jahan sab kuch ek sath nazar aata hai.
 */
export default async function MyWorkPage() {
  const supabase = createClient();
  const lang = getLanguageFromCookies("rm");

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: me } = await supabase
    .from("profiles")
    .select("full_name, role")
    .eq("id", user.id)
    .maybeSingle();
  if (!me) redirect("/login");

  const [nav, signals] = await Promise.all([loadNav(user.id, me.role, lang), pendingByDepartment()]);

  const cards = nav.groups.filter((g) => g.items.length > 0);

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6">
        <h1 className="font-display text-2xl font-semibold text-surface-900 dark:text-surface-100">
          {t("mw_title", lang)}
        </h1>
        <p className="mt-1 text-sm text-surface-500">
          {me.full_name} — {t("mw_subtitle", lang)}
        </p>
      </div>

      {cards.length === 0 ? (
        // Ye soorat chhupai nahi jati. Khali safha dekh kar banda samajhta
        // hai ke nizam kharab hai; asal baat ye hoti hai ke usay abhi tak
        // kuch assign hi nahi hua -- aur us ka hal us ke manager ke paas
        // hai, us ke paas nahi.
        <div className="rounded-card border border-amber-200 bg-amber-50 p-6 text-center dark:border-amber-900/40 dark:bg-amber-950/20">
          <Icons.Inbox className="mx-auto h-8 w-8 text-amber-600" />
          <p className="mt-3 font-medium text-amber-900 dark:text-amber-200">{t("mw_nothing_assigned", lang)}</p>
          <p className="mt-1 text-sm text-amber-800 dark:text-amber-300">{t("mw_nothing_assigned_hint", lang)}</p>
        </div>
      ) : (
        /* Mobile par ek card, tablet par do, computer par teen -- malik ki
           apni tajweez. Counter par zyada tar mobile hi hota hai. */
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((group) => {
            const signal = signals[group.key];
            const Icon =
              (Icons as unknown as Record<string, React.ComponentType<{ className?: string }>>)[group.icon ?? ""] ??
              Icons.LayoutGrid;

            // Card us department ke PEHLE khulne wale safhe par le jata
            // hai -- department ka apna dashboard bhi ho sakta hai aur
            // nahi bhi (us par bhi ijazat lagti hai).
            const href = group.items[0].href;

            return (
              <Link
                key={group.key}
                href={href}
                className="group flex flex-col rounded-card border border-surface-200 bg-white p-5 shadow-card transition hover:border-brand-400 hover:shadow-lg dark:border-surface-700 dark:bg-surface-900 dark:hover:border-brand-500"
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-950/40 dark:text-brand-300">
                    <Icon className="h-5 w-5" />
                  </span>

                  {/* Ginti "kaam baqi hai" kehti hai, alert "kuch ghalat
                      hai". Do alag baatein, is liye do alag nishan. */}
                  <div className="flex flex-col items-end gap-1">
                    {signal?.pending ? (
                      <span className="rounded-full bg-brand-600 px-2 py-0.5 text-xs font-semibold text-white">
                        {signal.pending} {t("mw_pending", lang)}
                      </span>
                    ) : null}
                    {signal?.alert ? (
                      <span className="rounded-full bg-red-600 px-2 py-0.5 text-xs font-semibold text-white">
                        {signal.alert} {t("mw_alert", lang)}
                      </span>
                    ) : null}
                  </div>
                </div>

                <h2 className="mt-3 font-display text-lg font-semibold text-surface-900 dark:text-surface-100">
                  {group.label}
                </h2>
                {group.description && <p className="mt-0.5 text-sm text-surface-500">{group.description}</p>}

                <p className="mt-3 text-xs text-surface-400">
                  {group.items.length} {t("mw_features", lang)}
                </p>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
