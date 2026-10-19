import { getLanguageFromCookies } from "@/lib/i18n/get-language";
import { t, type TranslationKey } from "@/lib/i18n/translations";
import { todayPk } from "@/lib/portal/dairy-load";
import { PREF_TASKS, TASK_STYLE, groupTasks, type DueTask } from "@/lib/portal/breeding";
import { loadPrefs, loadTasks, markRemindersSeen, unseenReminders } from "@/lib/portal/breeding-load";
import { Card } from "@/components/portal/khata/khata-parts";
import { Footer, HeroBtn } from "@/components/portal/dairy/dairy-parts";
import { AlertRow, BErrorNote, BHero, BKpi, H3 } from "@/components/portal/breeding/breed-parts";
import { prefAction, taskAction } from "../breeding/actions";

export const dynamic = "force-dynamic";
const btn = "rounded-lg border px-2 py-1 text-[11px] font-semibold";

function Actions({ task, lang }: { task: DueTask; lang: "en" | "rm" | "ur" }) {
  if (task.task === "withheld") return null; // dawa ka waqt khud khatam hota hai
  const f = (state: string, label: TranslationKey, cls: string) => (
    <form action={taskAction}>
      <input type="hidden" name="key" value={task.task_key} /><input type="hidden" name="state" value={state} />
      <button className={`${btn} ${cls}`}>{t(label, lang)}</button>
    </form>
  );
  return (
    <>
      {f("done", "bh_a_done", "border-green-600 bg-green-600 text-white")}
      {f("snoozed", "bh_a_snooze", "border-surface-200 text-surface-700 dark:border-surface-700 dark:text-slate-200")}
      {f("not_applicable", "bh_a_na", "border-surface-200 text-surface-500 dark:border-surface-700 dark:text-slate-400")}
    </>
  );
}

export default async function AlertsPage({ searchParams }: { searchParams: Record<string, string | undefined> }) {
  const lang = getLanguageFromCookies();
  const L = (k: TranslationKey) => t(k, lang);
  const asOf = todayPk();
  const [{ tasks }, prefs, unseen] = await Promise.all([loadTasks(30), loadPrefs(), unseenReminders()]);
  if (unseen > 0) await markRemindersSeen(); // sirf app ke andar wali yaad-dehaniyan "dekh li"
  const g = groupTasks(tasks);
  const groups: [keyof typeof g, TranslationKey, string][] = [["overdue", "bh_g_overdue", "text-rose-600 dark:text-rose-300"], ["today", "bh_g_today", "text-amber-600 dark:text-amber-300"], ["week", "bh_g_week", "text-indigo-600 dark:text-indigo-300"], ["later", "bh_g_later", "text-surface-600 dark:text-slate-300"]];

  return (
    <div className="pf-fit mx-auto w-full max-w-[1760px] space-y-5 px-4 py-6 sm:px-6 fit:gap-2.5 fit:space-y-0 fit:py-3">
      <BHero title={<>🔔 {L("bh_alerts_page")} {lang !== "ur" && <>· <span dir="rtl">{t("bh_alerts_page", "ur")}</span></>}</>} sub={`${tasks.length} ${L("bh_alerts_sub")}`}>
        <HeroBtn href="/portal/dairy/breeding">🧬 {L("bh_dash_title")}</HeroBtn>
        <HeroBtn href="/portal/dairy/health">💉 {L("bh_health_title")}</HeroBtn>
      </BHero>
      {searchParams?.ok && <p className="rounded-xl bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-200">{L("bh_saved")}</p>}
      <BErrorNote e={searchParams?.e} lang={lang} />
      <div className="grid grid-cols-2 gap-3.5 xl:grid-cols-4 fit:grid-cols-4 fit:gap-2.5">
        <BKpi tone="rose" k="bh_g_overdue" lang={lang} value={String(g.overdue.length)} sub={L("bh_g_overdue_sub")} />
        <BKpi tone="amber" k="bh_g_today" lang={lang} value={String(g.today.length)} sub={L("bh_g_today_sub")} />
        <BKpi tone="indigo" k="bh_g_week" lang={lang} value={String(g.week.length)} sub={L("bh_g_week_sub")} />
        <BKpi tone="teal" k="bh_g_later" lang={lang} value={String(g.later.length)} sub={L("bh_g_later_sub")} />
      </div>
      <div className="pf-grow pf-grid grid gap-4 lg:grid-cols-[1.7fr_1fr] fit:gap-2.5">
        <Card className="pf-scroll fit:p-3.5">
          {groups.map(([k, label, cls]) => g[k].length > 0 && (
            <section key={k} className="mb-4">
              <h4 className={`mb-2 text-xs font-bold uppercase tracking-wide ${cls}`}>{L(label)} · {g[k].length}</h4>
              {g[k].map((x) => <AlertRow key={x.task_key} task={x} lang={lang} asOf={asOf}><Actions task={x} lang={lang} /></AlertRow>)}
            </section>
          ))}
          {tasks.length === 0 && <p className="py-10 text-center text-sm text-surface-500">✅ {L("bh_no_tasks")}</p>}
        </Card>
        <div className="pf-scroll grid content-start gap-4 fit:gap-2.5">
          <Card className="fit:p-3.5">
            <H3 k="bh_set_title" lang={lang} />
            {PREF_TASKS.map((p) => {
              const on = prefs[p] !== false;
              return (
                <form key={p} action={prefAction} className="flex items-center justify-between gap-3 border-b border-surface-100 py-2.5 text-[13px] last:border-0 dark:border-surface-800">
                  <input type="hidden" name="type" value={p} /><input type="hidden" name="on" value={on ? "0" : "1"} />
                  <span className="text-surface-800 dark:text-slate-200">{TASK_STYLE[p].icon} {L(`bh_t_${p}` as TranslationKey)}</span>
                  <button aria-pressed={on} aria-label={L(`bh_t_${p}` as TranslationKey)} className={`relative h-6 w-11 rounded-full transition ${on ? "bg-green-600" : "bg-surface-300 dark:bg-surface-700"}`}>
                    <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${on ? "start-[22px]" : "start-0.5"}`} />
                  </button>
                </form>
              );
            })}
          </Card>
          <Card className="fit:p-3.5">
            <H3 k="bh_ch_title" lang={lang} />
            <div className="flex items-center justify-between py-2 text-[13px]"><span className="text-surface-800 dark:text-slate-200">📱 {L("bh_ch_app")}</span><span className="rounded-full bg-green-100 px-2.5 py-0.5 text-[11px] font-semibold text-green-700 dark:bg-green-500/20 dark:text-green-200">{L("bh_on")}</span></div>
            <div className="flex items-center justify-between py-2 text-[13px] opacity-60" aria-disabled>
              <span className="text-surface-800 dark:text-slate-200">💬 WhatsApp <span className="block text-[11px] text-surface-500">{L("bh_ch_wa_note")}</span></span>
              <span className="relative h-6 w-11 cursor-not-allowed rounded-full bg-surface-300 dark:bg-surface-700" title={L("bh_ch_wa_note")}><span className="absolute start-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow" /></span>
            </div>
            <p className="mt-2 text-[11.5px] text-surface-500">{L("bh_ch_note")}</p>
          </Card>
        </div>
      </div>
      <Footer lang={lang} />
    </div>
  );
}
