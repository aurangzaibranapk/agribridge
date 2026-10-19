import Link from "next/link";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";
import { t, type TranslationKey } from "@/lib/i18n/translations";
import { dairyContext, loadDairy, todayPk } from "@/lib/portal/dairy-load";
import { addDays, animalStats, chartEnd, dailySeries, dropAlerts, herdSummary, rangeDays, reconcile, SPECIES_EMOJI } from "@/lib/portal/dairy";
import { Badge, Card } from "@/components/portal/khata/khata-parts";
import { ChartLegend, Donut, Footer, Hero, HeroBtn, Kpi, MilkChart, STATUS_COLOR, TagChip, Tabs, Tri, fmtL } from "@/components/portal/dairy/dairy-parts";

export const dynamic = "force-dynamic";

export default async function DairyDashboard({ searchParams }: { searchParams: Record<string, string | undefined> }) {
  const lang = getLanguageFromCookies();
  const L = (k: TranslationKey) => t(k, lang);
  const asOf = todayPk();
  const ctx = await dairyContext();
  const { animals, yields, collection } = await loadDairy(asOf, 90);
  const days = rangeDays(searchParams?.r);
  const end = chartEnd(yields, asOf);
  const series = dailySeries(yields, addDays(end, -(days - 1)), end);
  const h = herdSummary(animals, yields, asOf);
  const stats = animalStats(animals, yields, asOf);
  const alerts = dropAlerts(animals, stats).slice(0, 2);
  const top = animals.map((a) => ({ a, v: stats.get(a.id)?.today ?? 0 })).filter((x) => x.v > 0).sort((x, y) => y.v - x.v).slice(0, 5);
  const maxTop = Math.max(1, ...top.map((x) => x.v));
  const centreToday = collection.find((c) => c.date === asOf)?.total ?? 0;
  const rec = reconcile(h.today.total, centreToday);
  const pregnant = animals.filter((a) => a.status === "pregnant").length;
  const pending = h.pendingAm + h.pendingPm;
  const tasks = pending > 0 ? 1 : 0;
  const statusLabel = (s: string) => L(`st_${s}` as TranslationKey);
  const pct = h.change === null ? "—" : `${h.change >= 0 ? "▲" : "▼"} ${Math.abs(h.change)}%`;

  return (
    <div className="mx-auto max-w-7xl space-y-5 px-4 py-6 sm:px-6">
      <Hero title={<>🐄 {L("dy_dash_title")}</>} sub={`${L("dy_dash_sub")} · ${ctx?.farmer?.farmer_code ?? ""}`}>
        <HeroBtn href="/portal/dairy/milk" primary>🥛 {L("dy_btn_milk")}</HeroBtn>
        <HeroBtn href="/portal/dairy/animals/new">➕ {L("dy_btn_add")}</HeroBtn>
      </Hero>

      <div className="grid grid-cols-2 gap-3.5 md:grid-cols-3 xl:grid-cols-6">
        <Kpi tone="sky" label={L("dy_k_today")} value={fmtL(h.today.total)} sub={`${L("dy_morning")} ${h.today.am} · ${L("dy_evening")} ${h.today.pm}`} />
        <Kpi tone="green" label={L("dy_k_milking")} value={`${h.milking} / ${h.active}`} sub={`${pregnant} ${L("dy_pregnant_too")}`} />
        <Kpi tone="violet" label={L("dy_k_percow")} value={fmtL(h.perCow)} sub={`${pct} ${L("dy_vs_last_week")}`} />
        <Kpi tone="amber" label={L("dy_k_30")} value={fmtL(h.total30)} sub={`${addDays(asOf, -29).slice(5)} → ${asOf.slice(5)}`} />
        <Kpi tone="teal" label={L("dy_k_centre")} value={fmtL(centreToday)} sub={`ERP · ${L("dy_today_entries")}`} />
        <Kpi tone="rose" label={L("dy_k_tasks")} value={String(tasks + alerts.length)} sub={`${pending} ${L("dy_tasks_sub")}`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <Card>
          <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
            <h3 className="text-[15px] font-semibold text-surface-900 dark:text-white"><Tri k="dy_trend_title" lang={lang} /></h3>
            <Tabs items={["7", "30", "90"].map((r) => ({ href: `/portal/dairy?r=${r}`, label: `${r}D`, on: String(days) === r }))} />
          </div>
          <MilkChart series={series} lang={lang} />
          <ChartLegend lang={lang} />
        </Card>
        <Card>
          <h3 className="mb-3 text-[15px] font-semibold text-surface-900 dark:text-white"><Tri k="dy_status_title" lang={lang} /></h3>
          <Donut centre={h.active} word={L("dy_animals_word")} parts={h.byStatus.map((s) => ({ label: statusLabel(s.status), value: s.count, color: STATUS_COLOR[s.status] ?? "#94a3b8" }))} />
          <div className="mt-4 rounded-xl border border-sky-300/50 bg-sky-50 p-3 text-xs text-surface-700 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-slate-200">
            <b>🔗 {L("dy_erp_title")}</b>
            <div className="mt-1">
              {L("dy_erp_home")}: <b>{fmtL(rec.home)}</b> · {L("dy_erp_centre")}: <b>{fmtL(rec.centre)}</b> · {L("dy_erp_diff")}: <b>{fmtL(rec.diff)}</b> ({L("dy_erp_diff_note")})
            </div>
            {collection.length === 0 && <div className="mt-1 text-surface-500 dark:text-slate-400">{L("dy_erp_none")}</div>}
          </div>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <div className="mb-2 flex items-start justify-between"><h3 className="text-[15px] font-semibold text-surface-900 dark:text-white"><Tri k="dy_top_title" lang={lang} /></h3><span className="text-xs text-surface-500">{L("dy_litre")}</span></div>
          {top.length === 0 && <p className="py-6 text-center text-sm text-surface-500">{L("dy_d_no_milk")}</p>}
          {top.map(({ a, v }) => (
            <Link key={a.id} href={`/portal/dairy/animals/${a.id}`} className="flex items-start gap-3 border-b border-surface-100 py-2.5 last:border-0 dark:border-surface-800">
              <span className="grid h-9 w-9 place-items-center rounded-xl border border-surface-200 bg-surface-50 text-lg dark:border-surface-700 dark:bg-surface-800">{SPECIES_EMOJI[a.species]}</span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 text-sm"><b className="text-surface-900 dark:text-white">{a.name ?? "—"}</b><TagChip tag={a.tag_no} /></div>
                <div className="text-xs text-surface-500 dark:text-slate-400">{a.breed ?? ""}</div>
                <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-surface-100 dark:bg-surface-800"><div className="h-full rounded-full bg-gradient-to-r from-green-500 to-sky-500" style={{ width: `${(v / maxTop) * 100}%` }} /></div>
              </div>
              <b className="text-sm text-surface-900 dark:text-white">{fmtL(v)}</b>
            </Link>
          ))}
        </Card>
        <Card>
          <h3 className="mb-2 text-[15px] font-semibold text-surface-900 dark:text-white"><Tri k="dy_alerts_title" lang={lang} /></h3>
          {alerts.map(({ a, s }) => (
            <Row key={a.id} icon="📉" bg="bg-rose-100 dark:bg-rose-500/20" title={`${a.name ?? ""} #${a.tag_no} ${L("dy_alert_drop")} ${Math.abs(s.dropPct ?? 0)}%`} sub={`${s.last7.find((x) => x > 0)} → ${s.today} L · ${L("dy_alert_drop_sub")}`} badge={<Badge tone="amber">{L("dy_tag_watch")}</Badge>} />
          ))}
          {pending > 0 && <Row icon="✍️" bg="bg-amber-100 dark:bg-amber-500/20" title={`${pending} ${L("dy_alert_pending")}`} sub={L("dy_alert_pending_sub")} badge={<Badge tone="indigo">{L("dy_tag_today")}</Badge>} />}
          {alerts.length === 0 && pending === 0 && <Row icon="✅" bg="bg-emerald-100 dark:bg-emerald-500/20" title={L("dy_all_good")} sub="" badge={null} />}
          <Row icon="🧬" bg="bg-violet-100 dark:bg-violet-500/20" title={L("dy_alert_p4")} sub={L("dy_alert_p4_sub")} badge={<Badge tone="violet">{L("dy_tag_soon")}</Badge>} />
          <div className="mt-3 grid grid-cols-3 gap-2.5">
            <Quick href="/portal/dairy/milk" icon="🥛" bg="bg-emerald-100 dark:bg-emerald-500/20" label={L("dy_btn_milk")} />
            <Quick href="/portal/dairy/animals/new" icon="➕" bg="bg-sky-100 dark:bg-sky-500/20" label={L("dy_btn_add")} />
            <Quick href="/portal/dairy/animals" icon="🐄" bg="bg-violet-100 dark:bg-violet-500/20" label={L("dy_list_title")} />
          </div>
        </Card>
      </div>
      {animals.length === 0 && (
        <Card className="text-center"><p className="text-lg font-semibold text-surface-900 dark:text-white">{L("dy_empty_title")}</p><p className="mt-1 text-sm text-surface-500">{L("dy_empty_body")}</p></Card>
      )}
      <Footer lang={lang} />
    </div>
  );
}

function Row({ icon, bg, title, sub, badge }: { icon: string; bg: string; title: string; sub: string; badge: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 border-b border-surface-100 py-2.5 text-[13px] last:border-0 dark:border-surface-800">
      <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full ${bg}`}>{icon}</span>
      <div className="flex-1"><b className="text-surface-900 dark:text-white">{title}</b>{sub && <div className="text-xs text-surface-500 dark:text-slate-400">{sub}</div>}</div>
      {badge}
    </div>
  );
}
function Quick({ href, icon, bg, label }: { href: string; icon: string; bg: string; label: string }) {
  return (
    <Link href={href} className="flex items-center gap-2.5 rounded-xl border border-surface-200 bg-surface-50 p-3 text-[13px] font-semibold text-surface-800 hover:bg-surface-100 dark:border-surface-700 dark:bg-surface-800 dark:text-slate-100">
      <span className={`grid h-8 w-8 place-items-center rounded-lg ${bg}`}>{icon}</span>{label}
    </Link>
  );
}
