import { redirect } from "next/navigation";
import * as Icons from "lucide-react";
import { CalendarDays } from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { loadNav, routeAllowed } from "@/lib/access/nav";
import { loadNeedsAttention, filterAttention } from "@/lib/access/needs-attention";
import { NeedsAttention } from "@/components/guided/needs-attention";
import { buildMyWork, defaultDashboardForRole, loadFourthKpi, loadRecentActivity } from "@/lib/access/my-work";
import { MyWorkBody } from "@/components/guided/work-cards";
import { InPageWorkspace } from "@/components/guided/in-page-workspace";
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

export default async function MyWorkPage({ searchParams }: { searchParams?: { all?: string } }) {
  const supabase = createClient();
  const lang = getLanguageFromCookies("rm");

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: me } = await supabase
    .from("profiles")
    .select("full_name, role, training_mode, branch_id")
    .eq("id", user.id)
    .maybeSingle();
  if (!me) redirect("/login");

  // Training Mode (D): apne department ka module -- pehle N kaam.
  const dept = departmentForRole(me.role);

  // Role ka naam bande ki zaban mein. Database mein wo "sales_staff"
  // jaisa likha hota hai -- wo nizam ke liye theek hai, magar safhe par
  // wohi likh dena us bande ko apna hi laqab ajnabi lagta hai.
  const roleLabel = me.role
    ? me.role
        .split("_")
        .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ")
    : null;
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

  // "Needs attention" -- pehle teen alag dabbon mein tha, ab MyWorkBody
  // ki chhoti patti ka pehla hissa hai (malik, 7 September). Tarteeb
  // wahi jo pehle NeedsAttention component ke andar thi.
  const attentionOrder = { red: 0, amber: 1, blue: 2, gray: 3 } as const;
  const attentionItems = filterAttention(await loadNeedsAttention(), allowed).sort(
    (a, b) => attentionOrder[a.tone] - attentionOrder[b.tone]
  );
  const showAllAttention = searchParams?.all === "1";
  const attentionTop = (showAllAttention ? attentionItems : attentionItems.slice(0, 4)).map((it) => ({
    key: it.key,
    label: t(it.label, lang),
    count: it.count,
    tone: it.tone,
    href: it.href,
  }));

  const { data: branch } = me.branch_id
    ? await supabase.from("branches").select("name").eq("id", me.branch_id).maybeSingle()
    : { data: null };
  const branchName = branch?.name ?? null;

  // KPI patti (7 September ka spec): teen fixed + ek role-specific khana.
  // Pehli teen wahi Needs Attention ke rang se nikalti hain -- koi nayi
  // ginti nahi banti, sirf usi asal data ko chaar chhote number mein
  // dobara dikhaya ja raha hai.
  const [fourthKpi, recentActivity] = await Promise.all([
    loadFourthKpi(me.branch_id, allowed, lang),
    loadRecentActivity(me.branch_id, allowed),
  ]);
  const kpis: { key: string; label: string; value: number | null }[] = [
    { key: "approvals", label: t("mw_kpi_pending_approvals", lang), value: attentionItems.filter((i) => i.tone === "amber").length },
    { key: "open", label: t("mw_kpi_open_tasks", lang), value: attentionItems.length },
    { key: "urgent", label: t("mw_kpi_urgent_today", lang), value: attentionItems.filter((i) => i.tone === "red").length },
    ...(fourthKpi ? [fourthKpi] : []),
  ];

  // Quick Actions -- sirf wo shortcut jin ka safha is bande ko khulta
  // hai. Koi nayi ijazat nahi banti, sirf maujooda raaston ka chhota
  // chuna hua raasta.
  const canRoute = (path: string) => allowed === null || routeAllowed(allowed, path);
  type QuickAction = { href: string; label: string; icon: string };
  const quickActions: QuickAction[] = [
    canRoute("/admin/pos") ? { href: "/admin/pos", label: t("mw_qa_new_sale", lang), icon: "ShoppingCart" } : null,
    canRoute("/admin/farmers") ? { href: "/admin/farmers", label: t("mw_qa_add_farmer", lang), icon: "UserPlus" } : null,
    canRoute("/admin/kharche") ? { href: "/admin/kharche", label: t("mw_qa_add_expense", lang), icon: "Receipt" } : null,
    canRoute("/admin/agri-orders/new") ? { href: "/admin/agri-orders/new", label: t("mw_qa_create_order", lang), icon: "ClipboardPlus" } : null,
    canRoute("/admin/load-bill") ? { href: "/admin/load-bill", label: t("mw_qa_receive_payment", lang), icon: "Banknote" } : null,
  ].filter((x): x is QuickAction => x !== null);

  const now = new Date();
  const nowDate = new Intl.DateTimeFormat(lang === "ur" ? "ur-PK" : "en-GB", {
    timeZone: "Asia/Karachi", day: "2-digit", month: "short", year: "numeric",
  }).format(now);
  const nowTime = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Karachi", hour: "2-digit", minute: "2-digit", hour12: true,
  }).format(now);

  const hour = new Date().getHours();
  const greetKey = hour < 12 ? "mw_hello_morning" : hour < 17 ? "mw_hello_afternoon" : "mw_hello_evening";

  return (
    <InPageWorkspace>
    <div className="mx-auto w-full max-w-[1100px]">
      {/* Malik (7 September): safhe ka oopri hissa bahut jagah khata tha --
          greeting, date/time aur score teen alag boxon mein. Ab ek hi
          patti: naam+role+branch baayen, tareekh/waqt/score daayen, ek
          satar mein -- taake neeche asal kaam ke liye jagah bache. */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-card border border-surface-200 bg-white px-5 py-3 dark:border-surface-700 dark:bg-surface-900">
        <div className="min-w-0">
          <h1 className="font-display text-[19px] font-semibold leading-tight text-surface-900 dark:text-surface-100">
            {t(greetKey, lang)}, {me.full_name}
          </h1>
          {/* Naam ke neeche: banda kaun hai, kis department mein hai, aur
              kis shaakh par. Malik ka usool (5 September): "Neeche uska
              Role + Department + Branch."

              Jo hissa maloom na ho wo LIKHA HI NAHI jata -- khali jagah
              bhar dene ke liye "—" ya koi bana hua naam daal dena us
              bande ko ghalat maloomat deta hai. */}
          <p className="mt-0.5 truncate text-[13px] text-surface-500">
            {[roleLabel, dept?.label ?? null, branchName].filter(Boolean).join(" · ")}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-4">
          {scoreRow && (
            <div className="text-right">
              <p className="text-[10px] uppercase tracking-wide text-surface-400">{t("mw_my_score", lang)}</p>
              {scoreRow.score == null ? (
                // Sifar nahi. Engine ne abhi faisla kiya hi nahi.
                <p className="text-[13px] font-medium text-surface-600 dark:text-surface-300">
                  {t("mw_score_building", lang)}
                </p>
              ) : (
                <p className="flex items-center justify-end gap-1.5">
                  <span className="text-base font-semibold tabular-nums text-surface-900 dark:text-surface-100">
                    {scoreRow.score}
                  </span>
                  {scoreRow.band && (
                    <span
                      className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
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
          {/* Waqt Pakistan ka -- server kahin bhi ho, banda apni ghari se
              milata hai. */}
          <div className="flex items-center gap-2 border-l border-surface-200 pl-4 dark:border-surface-700">
            <CalendarDays className="h-4 w-4 shrink-0 text-surface-400" />
            <p className="whitespace-nowrap text-[13px] font-medium text-surface-700 dark:text-surface-200">
              {nowDate} · {nowTime}
            </p>
          </div>
        </div>
      </div>

      {me.training_mode && (
        <div className="mb-4">
          <TrainingBanner
            lang={lang}
            name={me.full_name}
            department={dept?.label ?? null}
            steps={trainingModule?.steps ?? []}
            tryRoute={trainingModule?.try_route ?? null}
            moduleTitle={trainingModule?.title ?? null}
            moduleKey={trainingModule?.key ?? null}
          />
        </div>
      )}

      {/* KPI patti -- teen fixed + ek role-specific. Ginti na mile to
          "—", jhooti sifar nahi (project ka locked usool). */}
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {kpis.map((k) => (
          <div key={k.key} className="rounded-card border border-surface-200 bg-white px-4 py-3 dark:border-surface-700 dark:bg-surface-900">
            <p className="text-2xl font-semibold tabular-nums text-surface-900 dark:text-surface-100">{k.value ?? "—"}</p>
            <p className="mt-0.5 text-[12px] text-surface-500">{k.label}</p>
          </div>
        ))}
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
        <MyWorkBody
          lang={lang}
          quick={model.quick}
          // Jis banday ki ijazat mehdood hai, us ka HAR kaam sidebar ki
          // "Quick Access" mein ek hi flat fehrist mein pehle se hai
          // (admin/layout.tsx). Yahan wohi cheezein department cards mein
          // dobara dikhana ("AgriBridge Ordering" sidebar mein bhi, yahan
          // bhi) sirf duplicate aur confusion banata hai (malik, 11
          // September). Department cards sirf un ke liye jin ke paas
          // itna kaam hai ke browse karna zaroori ho -- Owner/Admin/
          // Manager.
          departments={nav.unrestricted ? model.departments : []}
          defaultDept={defaultDashboardForRole(me.role)}
          attention={attentionTop}
          attentionTotal={attentionItems.length}
          attentionAllHref={showAllAttention ? null : "/admin/my-work?all=1"}
        />
      )}

      {/* Aaj ke kaam (poori fehrist) + Jaldi wale kaam, aur Haal ka
          len-den -- maujooda systems (Needs Attention, permitted routes,
          asal transactions) se, koi nayi table nahi. */}
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="rounded-card border border-surface-200 bg-white dark:border-surface-800 dark:bg-surface-900">
          <h2 className="flex items-center gap-2 border-b border-surface-100 px-5 py-3 font-display text-[13px] font-semibold uppercase tracking-wide text-surface-500 dark:border-surface-800">
            <Icons.ClipboardList className="h-4 w-4" /> {t("mw_tasks_title", lang)}
          </h2>
          {/* Malik (8 September): "page kabhi scroll na karni paRe." Is
              fehrist ki lambai yahan tak seemit -- agar zyada items hon
              to sirf ISI dabbe ke andar scroll ho, poora safha nahi. */}
          <div className="overflow-y-auto p-4" style={{ maxHeight: "min(50vh, 420px)" }}>
            <NeedsAttention lang={lang} allowedRoutes={allowed} variant="list" compact />
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <div className="rounded-card border border-surface-200 bg-white dark:border-surface-800 dark:bg-surface-900">
            <h2 className="flex items-center gap-2 border-b border-surface-100 px-5 py-3 font-display text-[13px] font-semibold uppercase tracking-wide text-surface-500 dark:border-surface-800">
              <Icons.Zap className="h-4 w-4" /> {t("mw_quick_actions_title", lang)}
            </h2>
            <div className="grid grid-cols-2 gap-2.5 p-4 sm:grid-cols-3">
              {quickActions.map((qa) => {
                const QaIcon = (Icons as unknown as Record<string, React.ComponentType<{ className?: string }>>)[qa.icon] ?? Icons.LayoutGrid;
                return (
                  <Link
                    key={qa.href}
                    href={qa.href}
                    className="flex flex-col items-center gap-1.5 rounded-xl border border-surface-200 px-3 py-3 text-center transition hover:border-brand-300 hover:bg-brand-50/40 dark:border-surface-800 dark:hover:bg-brand-950/20"
                  >
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-950/40 dark:text-brand-300">
                      <QaIcon className="h-[18px] w-[18px]" />
                    </span>
                    <span className="text-[12px] font-medium text-surface-700 dark:text-surface-200">{qa.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>

          <div className="rounded-card border border-surface-200 bg-white dark:border-surface-800 dark:bg-surface-900">
            <h2 className="flex items-center gap-2 border-b border-surface-100 px-5 py-3 font-display text-[13px] font-semibold uppercase tracking-wide text-surface-500 dark:border-surface-800">
              <Icons.Activity className="h-4 w-4" /> {t("mw_activity_title", lang)}
            </h2>
            <div className="divide-y divide-surface-100 overflow-y-auto dark:divide-surface-800" style={{ maxHeight: "min(35vh, 300px)" }}>
              {recentActivity.length === 0 ? (
                <p className="px-5 py-4 text-sm text-surface-400">{t("mw_activity_empty", lang)}</p>
              ) : (
                recentActivity.map((a) => (
                  <div key={a.key} className="flex items-center justify-between gap-3 px-5 py-3">
                    <div className="min-w-0">
                      <p className="text-[13.5px] font-medium text-surface-800 dark:text-surface-100">{t(a.labelKey, lang)}</p>
                      <p className="truncate text-[12px] text-surface-500">
                        {[a.subtitle, relativeTime(a.createdAt, lang)].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                    {a.amount != null && (
                      <span className="shrink-0 text-[13.5px] font-semibold tabular-nums text-surface-900 dark:text-surface-100">
                        Rs {a.amount.toLocaleString()}
                      </span>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
    </InPageWorkspace>
  );
}

/** "5 minute pehle" jaisa halka jumla -- koi library nahi, chhota hisaab. */
function relativeTime(iso: string, lang: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const min = Math.max(0, Math.round(diffMs / 60000));
  const isUrdu = lang === "ur";
  if (min < 1) return isUrdu ? "ابھی" : "abhi";
  if (min < 60) return isUrdu ? `${min} منٹ پہلے` : `${min} minute pehle`;
  const hrs = Math.round(min / 60);
  if (hrs < 24) return isUrdu ? `${hrs} گھنٹے پہلے` : `${hrs} ghante pehle`;
  const days = Math.round(hrs / 24);
  return isUrdu ? `${days} دن پہلے` : `${days} din pehle`;
}
