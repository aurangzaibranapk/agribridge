import Link from "next/link";
import { redirect } from "next/navigation";
import * as Icons from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { loadNav } from "@/lib/access/nav";
import { pendingByDepartment } from "@/lib/access/pending-counts";
import { NeedsAttention } from "@/components/guided/needs-attention";
import { WorkCoachBox } from "@/components/guided/work-coach-box";
import { TrainingBanner } from "@/components/guided/training-banner";
import { departmentForRole } from "@/lib/departments";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";
import { t } from "@/lib/i18n/translations";

export const dynamic = "force-dynamic";

/**
 * Mera Kaam -- staff ka pehla safha.
 *
 * Malik ka faisla: staff ko 100+ features ka sidebar dene ke bajaye
 * CARDS milein, aur sirf wohi jo usay assign hue hon.
 *
 *   Login  ->  Mera Kaam  ->  card  ->  us ka apna kaam  ->  wapas
 *
 * ---------------------------------------------------------------------
 * Card ab KAAM ka hai, department ka nahi (250)
 * ---------------------------------------------------------------------
 * Pehle card department ka tha -- "Finance" par click karo, phir andar
 * fehrist mein se apna safha dhoondo. Counter par khare bande ke liye
 * wo do qadam hain jahan ek chahiye tha: usay "POS" chahiye, "Finance"
 * nahi.
 *
 * Ab har card ek kaam hai (POS, Products, Hazri...), aur department
 * sirf sarkhi reh gaya hai jis ke neeche wo cards baithe hain. Ijazat
 * ka hisaab wohi purana hai -- loadNav() sirf wohi cheezein deta hai jo
 * is bande ko khulti hain. Yahan koi nayi ijazat nahi banti.
 *
 * ---------------------------------------------------------------------
 * Score ka chip
 * ---------------------------------------------------------------------
 * Apna score upar nazar aata hai -- magar wahan SIFAR kabhi nahi likha
 * jata. Engine jab tak hisaab bana raha hai, "Hisaab ban raha hai"
 * likha aata hai; aur agar visibility ka qanoon jawab hi na de to chip
 * hi nahi aata. "Kuch nahi mila" ko sifar samajh lena is project mein
 * teen dafa ghalat adad de chuka hai.
 */

interface ScoreChip {
  score: number | null;
  band: string | null;
  state: string | null;
}

const BAND_TONE: Record<string, string> = {
  platinum: "bg-surface-800 text-white",
  gold: "bg-amber-100 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200",
  silver: "bg-surface-200 text-surface-800 dark:bg-surface-700 dark:text-surface-100",
  bronze: "bg-orange-100 text-orange-900 dark:bg-orange-950/40 dark:text-orange-200",
};

export default async function MyWorkPage() {
  const supabase = createClient();
  const lang = getLanguageFromCookies("rm");

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: me } = await supabase
    .from("profiles")
    .select("full_name, role, training_mode")
    .eq("id", user.id)
    .maybeSingle();
  if (!me) redirect("/login");

  // Training Mode (D): apne department ka module -- pehle N kaam.
  const dept = departmentForRole(me.role);
  const { data: trainingModule } = me.training_mode
    ? await supabase.from("training_modules").select("title, steps, try_route").eq("department_key", dept?.key ?? "").eq("is_active", true).maybeSingle()
    : { data: null };

  const [nav, signals, scoreRes] = await Promise.all([
    loadNav(user.id, me.role, lang),
    pendingByDepartment(),
    // Apna score. Visibility ka faisla database par hai (fn_score_visible)
    // -- yahan sirf jo aaye wo dikhaya jata hai. Kuch na aaye to chip
    // hi nahi banta.
    supabase.rpc("fn_score_for", { p_subject_type: "staff", p_subject_id: user.id }),
  ]);

  const scoreRow = (Array.isArray(scoreRes.data) ? scoreRes.data[0] : null) as ScoreChip | null;

  const groups = nav.groups.filter((g) => g.items.length > 0);
  const totalCards = groups.reduce((n, g) => n + g.items.length, 0);

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold text-surface-900 dark:text-surface-100">
            {t("mw_title", lang)}
          </h1>
          <p className="mt-1 text-sm text-surface-500">
            {me.full_name} — {t("mw_subtitle", lang)}
          </p>
        </div>

        {scoreRow && (
          <div className="rounded-card border border-surface-200 bg-white px-4 py-2 text-right dark:border-surface-700 dark:bg-surface-900">
            <p className="text-[11px] uppercase tracking-wide text-surface-400">{t("mw_my_score", lang)}</p>
            {scoreRow.score == null ? (
              // Sifar nahi. Engine ne abhi faisla kiya hi nahi.
              <p className="mt-0.5 text-sm font-medium text-surface-600 dark:text-surface-300">
                {t("mw_score_building", lang)}
              </p>
            ) : (
              <p className="mt-0.5 flex items-center justify-end gap-2">
                <span className="text-xl font-semibold tabular-nums text-surface-900 dark:text-surface-100">
                  {scoreRow.score}
                </span>
                {scoreRow.band && (
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                      BAND_TONE[scoreRow.band] ?? "bg-surface-100 text-surface-700"
                    }`}
                  >
                    {scoreRow.band}
                  </span>
                )}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Aaj kya baqi hai -- role ke raaston par, click par kaam ke safhe par (B). */}
      <div className="mb-6 space-y-4">
        {me.training_mode && (
          <TrainingBanner
            lang={lang}
            name={me.full_name}
            department={dept?.label ?? null}
            steps={trainingModule?.steps ?? []}
            tryRoute={trainingModule?.try_route ?? null}
            moduleTitle={trainingModule?.title ?? null}
          />
        )}
        {/* "Aaj kya karna hai?" -- Work Coach (C). */}
        <WorkCoachBox />
        <NeedsAttention lang={lang} allowedRoutes={nav.unrestricted ? null : nav.allowedRoutes} />
      </div>

      {totalCards === 0 ? (
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
        <div className="space-y-7">
          {groups.map((group) => {
            const signal = signals[group.key];

            return (
              <section key={group.key}>
                {/* Department ab sarkhi hai, card nahi. Ginti bhi yahin
                    aati hai -- wo department ki hai, kisi ek safhe ki
                    nahi, aur usay ek card par chipka dena jhoot hota. */}
                <div className="mb-2.5 flex flex-wrap items-center gap-2">
                  <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-surface-500">
                    {group.label}
                  </h2>
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

                {/* Mobile par ek card, tablet par do, computer par teen --
                    malik ki apni tajweez. Counter par zyada tar mobile hi
                    hota hai. */}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {group.items.map((item) => {
                    const Icon =
                      (Icons as unknown as Record<string, React.ComponentType<{ className?: string }>>)[
                        item.icon ?? ""
                      ] ?? Icons.LayoutGrid;

                    return (
                      <Link
                        key={`${group.key}-${item.href}`}
                        href={item.href}
                        className="group flex items-start gap-3 rounded-card border border-surface-200 bg-white p-4 shadow-card transition hover:border-brand-400 hover:shadow-lg dark:border-surface-700 dark:bg-surface-900 dark:hover:border-brand-500"
                      >
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-950/40 dark:text-brand-300">
                          <Icon className="h-5 w-5" />
                        </span>
                        <span className="min-w-0">
                          <span className="block font-display text-base font-semibold text-surface-900 dark:text-surface-100">
                            {item.label}
                          </span>
                          {/* Doosra jumla khali ho sakta hai (250). Us
                              jagah kuch bana kar likhna is se bura hota
                              -- ghalat jumla bande ko ghalat safhe par
                              bhejta hai. */}
                          {item.description && (
                            <span className="mt-0.5 block text-sm text-surface-500">{item.description}</span>
                          )}
                        </span>
                      </Link>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
