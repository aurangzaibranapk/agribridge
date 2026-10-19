import Link from "next/link";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";
import { t, type TranslationKey } from "@/lib/i18n/translations";
import { loadDairy, todayPk } from "@/lib/portal/dairy-load";
import { addDays, daysBetween } from "@/lib/portal/dairy";
import { calendarItems, fertilityStats, herdRepro, monthGrid, priorityTasks, shiftMonth } from "@/lib/portal/breeding";
import { loadBreeding, loadTasks } from "@/lib/portal/breeding-load";
import { Card, shortDate } from "@/components/portal/khata/khata-parts";
import { Donut, Footer, HeroBtn, TagChip } from "@/components/portal/dairy/dairy-parts";
import { AlertRow, BHero, BKpi, Calendar, H3, Legend, Pill, monthLabel , BErrorNote } from "@/components/portal/breeding/breed-parts";
import { ResponsiveTable } from "@/components/portal/responsive-table";

export const dynamic = "force-dynamic";

export default async function BreedingDashboard({ searchParams }: { searchParams: Record<string, string | undefined> }) {
  const lang = getLanguageFromCookies();
  const L = (k: TranslationKey) => t(k, lang);
  const asOf = todayPk();
  const month = /^\d{4}-\d{2}$/.test(searchParams?.m ?? "") ? searchParams!.m! : asOf.slice(0, 7);
  const [{ animals }, { events, health, repro, error }, { tasks }] = await Promise.all([loadDairy(asOf, 1), loadBreeding({ from: addDays(asOf, -400) }), loadTasks(45)]);
  const tag = new Map(animals.map((a) => [a.id, a.tag_no]));
  const tagOf = (id: string | null) => (id && tag.get(id) ? `#${tag.get(id)}` : "");
  const active = animals.filter((a) => a.status !== "sold" && a.status !== "dead").length;
  const t30 = tasks.filter((x) => x.due_date <= addDays(asOf, 30));
  const preg = repro.filter((r) => r.pregnant).sort((a, b) => ((a.expected_calving ?? "") < (b.expected_calving ?? "") ? -1 : 1));
  const calv30 = preg.filter((r) => r.expected_calving && r.expected_calving <= addDays(asOf, 30));
  const pd = repro.filter((r) => r.pd_pending);
  const heat = t30.filter((x) => x.task === "heat_watch" || x.task === "no_heat");
  const heatNow = heat.filter((x) => x.due_date <= addDays(asOf, 3)).length;
  const vac = t30.filter((x) => x.task === "vaccine" || x.task === "vaccine_gap");
  const vacCount = vac.reduce((s, x) => s + Number(x.info.count ?? 0), 0);
  const wd = t30.filter((x) => x.task === "withheld");
  const hr = herdRepro(repro);
  const fs = fertilityStats(events, asOf);
  const repeat = repro.filter((r) => r.repeat_breeder);
  const cells = monthGrid(month);
  const items = calendarItems(events, health, tasks, tagOf).filter((i) => i.date >= cells[0].date && i.date <= cells[cells.length - 1].date);
  const yr = Number(asOf.slice(0, 4));
  const dd = (x: string | null) => (x ? shortDate(x, lang, yr) : "—");
  const days = (x: string | null) => (x ? daysBetween(asOf, x) : 0);

  return (
    <div className="pf-fit mx-auto w-full max-w-[1760px] space-y-5 px-4 py-6 sm:px-6 fit:gap-2.5 fit:space-y-0 fit:py-3">
      <BHero title={<>🧬 {L("bh_dash_title")} {lang !== "ur" && <>· <span dir="rtl">{t("bh_dash_title", "ur")}</span></>}</>} sub={`${L("bh_today")} ${shortDate(asOf, lang)} · ${active} ${L("bh_animals")} · ${L("bh_dash_sub")}`}>
        <HeroBtn href="/portal/dairy/breeding/new?type=ai" primary>➕ {L("bh_btn_ai")}</HeroBtn>
        <HeroBtn href="/portal/dairy/breeding/new?type=heat">🔥 {L("bh_btn_heat")}</HeroBtn>
        <HeroBtn href="/portal/dairy/health#new">💉 {L("bh_btn_health")}</HeroBtn>
      </BHero>
      {searchParams?.ok && <p className="rounded-xl bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-200">{L("bh_saved")}</p>}
      <BErrorNote e={searchParams?.e ?? (error ? "dy_err_generic" : undefined)} lang={lang} />
      <div className="grid grid-cols-2 gap-3.5 md:grid-cols-3 xl:grid-cols-6 fit:grid-cols-6 fit:gap-2.5">
        <BKpi tone="violet" k="bh_k_pregnant" lang={lang} value={String(preg.length)} sub={`${calv30.length} ${L("bh_k_pregnant_sub")}`} />
        <BKpi tone="indigo" k="bh_k_calving" lang={lang} value={String(calv30.length)} sub={calv30.map((r) => `#${r.tag_no} · ${dd(r.expected_calving)}`).join(", ") || "—"} />
        <BKpi tone="sky" k="bh_k_pd" lang={lang} value={String(pd.length)} sub={pd.slice(0, 2).map((r) => `#${r.tag_no} · ${dd(r.pd_from)}-${dd(r.pd_to)}`).join(", ") || "—"} />
        <BKpi tone="rose" k="bh_k_heat" lang={lang} value={String(heat.length)} sub={`${heatNow} ${L("bh_k_heat_now")}, ${heat.length - heatNow} ${L("bh_k_heat_later")}`} />
        <BKpi tone="teal" k="bh_k_vax_due" lang={lang} value={String(vacCount)} sub={vac.map((x) => `${x.info.code} ${dd(x.due_date)}`).join(" · ") || "—"} />
        <BKpi tone="amber" k="bh_k_withheld" lang={lang} value={String(wd.length)} sub={wd.map((x) => `#${x.tag_no} · ${dd(x.due_date)} ${L("bh_until")}`).join(", ") || "—"} />
      </div>

      <div className="pf-grow pf-grid grid gap-4 lg:grid-cols-[1.6fr_1fr] fit:grid-cols-[1.7fr_1fr_1fr] fit:grid-rows-2 fit:gap-2.5">
        <Card className="pf-panel fit:row-span-2 fit:p-3.5">
          <H3 k="bh_cal_title" lang={lang} right={
            <div className="flex items-center gap-1.5">
              <Link href={`/portal/dairy/breeding?m=${shiftMonth(month, -1)}`} className="rounded-full border border-surface-200 px-2.5 py-1 text-xs dark:border-surface-700">‹</Link>
              <span className="rounded-full bg-green-600 px-3 py-1 text-xs font-semibold text-white">{monthLabel(month, lang)}</span>
              <Link href={`/portal/dairy/breeding?m=${shiftMonth(month, 1)}`} className="rounded-full border border-surface-200 px-2.5 py-1 text-xs dark:border-surface-700">›</Link>
            </div>} />
          <div className="pf-body"><Calendar cells={cells} items={items} asOf={asOf} lang={lang} /></div>
          <Legend lang={lang} />
        </Card>
        <Card className="pf-panel fit:p-3.5">
          <H3 k="bh_alerts_title" lang={lang} right={<Link href="/portal/dairy/alerts" className="rounded-xl border border-surface-200 px-3 py-1.5 text-xs font-semibold text-surface-700 dark:border-surface-700 dark:text-slate-200">{L("bh_see_all")} →</Link>} />
          <div className="pf-body">
          {priorityTasks(t30, 6).map((x) => <AlertRow key={x.task_key} task={x} lang={lang} asOf={asOf} />)}
          {t30.length === 0 && <p className="py-8 text-center text-sm text-surface-500">✅ {L("bh_no_tasks")}</p>}
          </div>
        </Card>
        <Card className="pf-panel fit:p-3.5">
          <H3 k="bh_herd_title" lang={lang} />
          <div className="pf-body">
          <Donut centre={hr.total} word={L("bh_animals")} size={150} parts={[
            { label: L("bh_hs_pregnant"), value: hr.pregnant, color: "#a855f7" }, { label: L("bh_hs_pd"), value: hr.pdPending, color: "#0ea5e9" },
            { label: L("bh_hs_open"), value: hr.open, color: "#f43f5e" }, { label: L("bh_hs_young"), value: hr.young, color: "#14b8a6" },
          ].filter((p) => p.value > 0)} />
          </div>
        </Card>
        <Card className="pf-panel fit:p-3.5">
          <H3 k="bh_up_title" lang={lang} right={<span className="text-xs text-surface-500">283 {L("bh_cow")} · 310 {L("bh_buffalo")}</span>} />
          <div className="pf-body">
          <ResponsiveTable className="w-full text-[13px]">
            <thead><tr className="border-b border-surface-200 text-[11px] uppercase tracking-wide text-surface-500 dark:border-surface-800"><th className="py-2 text-start">Tag</th><th className="text-start">{L("bh_c_name")}</th><th className="text-start">{L("bh_c_expected")}</th><th className="text-start">{L("bh_c_days")}</th></tr></thead>
            <tbody>
              {preg.slice(0, 5).map((r) => (
                <tr key={r.animal_id} className="border-b border-surface-100 text-surface-800 dark:border-surface-800 dark:text-slate-200">
                  <td className="py-2"><Link href={`/portal/dairy/breeding/animal/${r.animal_id}`}><TagChip tag={r.tag_no} /></Link></td><td>{r.name ?? "—"}</td><td>{dd(r.expected_calving)}</td>
                  <td><Pill tone={days(r.expected_calving) <= 30 ? "violet" : days(r.expected_calving) <= 90 ? "indigo" : "slate"}>{days(r.expected_calving)} {L("bh_days")}</Pill></td>
                </tr>
              ))}
              {preg.length === 0 && <tr><td colSpan={4} className="py-6 text-center text-surface-500">{L("bh_none_pregnant")}</td></tr>}
            </tbody>
          </ResponsiveTable>
          </div>
        </Card>
        <Card className="pf-panel fit:p-3.5">
          <H3 k="bh_fert_title" lang={lang} />
          <div className="pf-body">
          <div className="grid grid-cols-2 gap-2.5">
            {([["bh_f_conception", fs.conception === null ? "—" : `${fs.conception}%`], ["bh_f_aipp", fs.aiPerPregnancy === null ? "—" : String(fs.aiPerPregnancy)], ["bh_f_ci", fs.calvingIntervalMonths === null ? "—" : `${fs.calvingIntervalMonths} ${L("bh_months")}`], ["bh_f_open", fs.daysOpen === null ? "—" : `${fs.daysOpen} ${L("bh_days")}`]] as [TranslationKey, string][]).map(([k, v]) => (
              <div key={k} className="rounded-xl border border-surface-200 bg-surface-50 p-2.5 text-[11.5px] text-surface-500 dark:border-surface-700 dark:bg-surface-800/60 dark:text-slate-400">{L(k)}<b className="mt-0.5 block text-[15px] text-surface-900 dark:text-white">{v}</b></div>
            ))}
          </div>
          {repeat.length > 0 && (
            <div className="mt-3 rounded-xl border border-dashed border-violet-400 bg-violet-500/5 p-3 text-xs text-surface-700 dark:text-slate-200">
              💡 <b>{L("bh_munshi")}:</b> {repeat.map((r) => `#${r.tag_no} ${r.name ?? ""}`).join(", ")} — {L("bh_munshi_repeat")}
            </div>
          )}
          </div>
        </Card>
      </div>
      <Footer lang={lang} />
    </div>
  );
}
