import { redirect } from "next/navigation";
import * as Icons from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { loadNav } from "@/lib/access/nav";
import { NeedsAttention } from "@/components/guided/needs-attention";
import { buildMyWork, defaultDashboardForRole } from "@/lib/access/my-work";
import { MyWorkBody } from "@/components/guided/work-cards";
import { loadNeedsAttention, filterAttention } from "@/lib/access/needs-attention";
import { TrainingBanner } from "@/components/guided/training-banner";
import { departmentForRole } from "@/lib/departments";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";
import { t } from "@/lib/i18n/translations";

export const dynamic = "force-dynamic";

/**
 * Mera Kaam -- staff ka pehla safha (Staff Command Center, 277).
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
 * Safha ab lambi fehrist nahi, ek naqsha hai (277)
 * ---------------------------------------------------------------------
 * Malik ka aitraaz: Manager ke login par 50 ek jaise safaid dabbe khul
 * jate the -- har card ki ahmiyat barabar lagti thi, aur wohi feature
 * chaar department mein dobara nazar aata tha.
 *
 *   Kya baqi hai  ->  Aaj ka kaam  ->  Department  ->  us ke auzaar
 *
 * Ginti, tarteeb aur "ek feature ek jagah" ka poora hisaab
 * lib/access/my-work.ts mein hai; kholna/band karna aur haal hi mein
 * khole gaye safhe components/guided/work-cards.tsx mein. Safha khud
 * sirf jorta hai.
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
    ? await supabase.from("training_modules").select("key, title, steps, try_route").eq("department_key", dept?.key ?? "").eq("is_active", true).maybeSingle()
    : { data: null };

  const [nav, scoreRes] = await Promise.all([
    loadNav(user.id, me.role, lang),
    // Apna score. Visibility ka faisla database par hai (fn_score_visible)
    // -- yahan sirf jo aaye wo dikhaya jata hai. Kuch na aaye to chip
    // hi nahi banta.
    supabase.rpc("fn_score_for", { p_subject_type: "staff", p_subject_id: user.id }),
  ]);

  const scoreRow = (Array.isArray(scoreRes.data) ? scoreRes.data[0] : null) as ScoreChip | null;

  const allowed = nav.unrestricted ? null : nav.allowedRoutes;
  const groups = nav.groups.filter((g) => g.items.length > 0);
  const model = await buildMyWork(groups, allowed, me.role, lang);

  // Upar ka jumla: "aaj kitni cheezein tawajjo maang rahi hain". Jis
  // qatar ki ginti hi na mili ho us ki wajah se poora adad jhoota ho
  // jata hai -- is liye us soorat mein adad ke bajaye saaf likha jata
  // hai ke kuch hisaab nahi mila.
  const attentionItems = filterAttention(await loadNeedsAttention(), allowed);
  const unknownCount = attentionItems.some((i) => i.count === null);
  const needCount = attentionItems.reduce((n, i) => n + (i.count ?? 0), 0);

  const hour = new Date().getHours();
  const greetKey = hour < 12 ? "mw_hello_morning" : hour < 17 ? "mw_hello_afternoon" : "mw_hello_evening";

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold text-surface-900 dark:text-surface-100">
            {t(greetKey, lang)}, {me.full_name}
          </h1>
          <p className="mt-1 text-sm text-surface-500">
            {unknownCount
              ? t("mw_need_unknown", lang)
              : needCount > 0
                ? t("mw_need_you", lang).replace("{n}", String(needCount))
                : t("mw_need_none", lang)}
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
            moduleKey={trainingModule?.key ?? null}
          />
        )}
        <NeedsAttention lang={lang} allowedRoutes={nav.unrestricted ? null : nav.allowedRoutes} />
      </div>

      {model.totalCards === 0 ? (
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
        <MyWorkBody lang={lang} quick={model.quick} departments={model.departments} defaultDept={defaultDashboardForRole(me.role)} />
      )}
    </div>
  );
}
