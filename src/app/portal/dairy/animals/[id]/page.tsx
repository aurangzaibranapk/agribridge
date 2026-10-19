import { notFound } from "next/navigation";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";
import { t, type TranslationKey } from "@/lib/i18n/translations";
import { loadDairy, todayPk } from "@/lib/portal/dairy-load";
import { ACTIVE_STATUSES, STATUSES, STATUS_TONE, SPECIES_EMOJI, addDays, chartEnd, ageText, avg, dailySeries, dim, r1, rangeDays } from "@/lib/portal/dairy";
import { Badge, Card, longDate, shortDate } from "@/components/portal/khata/khata-parts";
import { ChartLegend, ErrorNote, Footer, Hero, HeroBtn, Kpi, MilkChart, TagChip, Tabs, Tri, fmtL } from "@/components/portal/dairy/dairy-parts";
import { EVENT_COLOR, EVENT_ICON } from "@/lib/portal/breeding";
import { loadBreeding } from "@/lib/portal/breeding-load";
import { TLItem } from "@/components/portal/breeding/breed-parts";
import { PhotoPicker } from "@/components/portal/dairy/photo-picker";
import { signedUrls } from "@/lib/portal/dairy-pl-load";
import { t as tr } from "@/lib/i18n/translations";
import { setStatusAction, uploadPhotoAction } from "../../actions";
import { ResponsiveTable } from "@/components/portal/responsive-table";

export const dynamic = "force-dynamic";

export default async function AnimalDetail({ params, searchParams }: { params: { id: string }; searchParams: Record<string, string | undefined> }) {
  const lang = getLanguageFromCookies();
  const L = (k: TranslationKey) => t(k, lang);
  const asOf = todayPk();
  const [{ animals, yields }, breed] = await Promise.all([loadDairy(asOf, 90), loadBreeding({ animalId: params.id })]);
  const bev = breed.events.filter((e) => e.animal_id === params.id);
  const rp = breed.repro.find((x) => x.animal_id === params.id) ?? null;
  const a = animals.find((x) => x.id === params.id);
  if (!a) notFound(); // RLS: doosre ka janwar milta hi nahi
  const days = rangeDays(searchParams?.r);
  const end = chartEnd(yields.filter((y) => y.animal_id === a.id), asOf);
  const series = dailySeries(yields, addDays(end, -(days - 1)), end, a.id);
  const s30 = dailySeries(yields, addDays(asOf, -29), asOf, a.id);
  const herd30 = dailySeries(yields, addDays(asOf, -29), asOf).reduce((x, d) => x + d.total, 0);
  const today = s30[s30.length - 1];
  const tot30 = r1(s30.reduce((x, d) => x + d.total, 0));
  const last7 = s30.slice(-8, -1).map((d) => d.total).filter((x) => x > 0);
  const prev7 = s30.slice(-15, -8).map((d) => d.total).filter((x) => x > 0);
  const ch = prev7.length && last7.length ? Math.round(((avg(last7) - avg(prev7)) / avg(prev7)) * 100) : null;
  const peak = s30.reduce((b, d) => (d.total > b.total ? d : b), s30[0]);
  const mine = yields.filter((y) => y.animal_id === a.id);
  const recent = Array.from(new Set(mine.map((y) => y.yield_date))).sort().reverse().slice(0, 6).map((d) => {
    const am = mine.find((y) => y.yield_date === d && y.shift === "am"), pm = mine.find((y) => y.yield_date === d && y.shift === "pm");
    return { d, am: am?.liters, pm: pm?.liters, fat: am?.fat ?? pm?.fat ?? null, withheld: !!(am?.withheld || pm?.withheld) };
  });
  const dam = a.dam_id ? animals.find((x) => x.id === a.dam_id) : null;
  const d = dim(a, asOf);
  const facts: [string, React.ReactNode][] = [
    ["Tag no", <>#{a.tag_no}{a.rfid_tag ? ` · RFID ${a.rfid_tag}` : ""}</>],
    [L("dy_d_species"), L(`sp_${a.species}` as TranslationKey)],
    [L("dy_c_breed"), a.breed ?? "—"],
    [L("dy_d_sex"), L(`sx_${a.sex}` as TranslationKey)],
    [L("dy_d_dob"), a.dob ? `${longDate(a.dob, lang)} (${ageText(a.dob, asOf)})` : "—"],
    [L("dy_d_dam"), dam ? `#${dam.tag_no} ${dam.name ?? ""}` : "—"],
    [L("dy_d_source"), L(`src_${a.source}` as TranslationKey)],
    [L("dy_c_status"), <Badge key="s" tone={STATUS_TONE[a.status]}>{L(`st_${a.status}` as TranslationKey)}</Badge>],
    [L("dy_d_lactation"), a.lactation_no ? `${a.lactation_no}${d !== null ? ` · ${d} DIM` : ""}` : "—"],
  ];
  const urls = await signedUrls([a.photo_path]);
  const photoUrl = a.photo_path ? urls[a.photo_path] : null;
  const canMilk = (ACTIVE_STATUSES as readonly string[]).includes(a.status);

  return (
    <div className="pf-fit mx-auto w-full max-w-[1760px] space-y-5 px-4 py-6 sm:px-6 fit:gap-2.5 fit:space-y-0 fit:py-3">
      <Hero title={<span className="flex items-center gap-3">{a.name ?? L(`sp_${a.species}` as TranslationKey)} <TagChip tag={a.tag_no} /></span>} sub={[a.breed, L(`sp_${a.species}` as TranslationKey), ageText(a.dob, asOf), L(`st_${a.status}` as TranslationKey)].filter((x) => x && x !== "—").join(" · ")}>
        {canMilk && <HeroBtn href={`/portal/dairy/milk?a=${a.id}`} primary>🥛 {L("dy_btn_milk")}</HeroBtn>}
        <HeroBtn href="/portal/dairy/animals">🐄 {L("dy_list_title")}</HeroBtn>
      </Hero>
      {searchParams?.ok && <p className="rounded-xl bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-200">{L("dy_saved")}</p>}
      <ErrorNote e={searchParams?.e} lang={lang} />

      <div className="pf-grow pf-grid grid gap-4 lg:grid-cols-[1fr_1.7fr] fit:grid-cols-[minmax(250px,0.8fr)_1.15fr_1fr] fit:grid-rows-2 fit:gap-2.5">
        <Card className="pf-scroll space-y-3 fit:row-span-2 fit:p-3.5">
          <div className="relative h-56 overflow-hidden rounded-2xl fit:h-40 bg-gradient-to-br from-lime-300 via-green-600 to-emerald-800">
            {photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photoUrl} alt={a.name ?? a.tag_no} className="h-full w-full object-cover" />
            ) : (
              <span className="grid h-full place-items-center text-8xl">{SPECIES_EMOJI[a.species]}</span>
            )}
            <span className="absolute start-2.5 top-2.5"><TagChip tag={a.tag_no} /></span>
          </div>
          <form action={uploadPhotoAction} className="space-y-2">
            <input type="hidden" name="id" value={a.id} />
            <PhotoPicker title={photoUrl ? tr("dy2_photo_change", lang) : tr("dy2_photo_new", lang)} hint={tr("dy2_photo_hint", lang)} shrunkWord={tr("dy2_photo_shrunk", lang)} />
            <button className="w-full rounded-xl bg-green-600 py-2 text-sm font-semibold text-white hover:bg-green-700">📤 {tr("dy2_photo_upload", lang)}</button>
            <p className="rounded-xl border border-sky-300/50 bg-sky-50 p-2.5 text-[11px] text-surface-700 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-slate-200">🔒 {tr("dy2_photo_private", lang)}</p>
          </form>
          <ResponsiveTable className="w-full text-[13px]">
            <tbody>{facts.map(([k, v]) => <tr key={k} className="border-b border-surface-100 dark:border-surface-800"><td className="py-2 pe-2 text-surface-500 dark:text-slate-400">{k}</td><td className="py-2 font-semibold text-surface-900 dark:text-white">{v}</td></tr>)}</tbody>
          </ResponsiveTable>
          <form action={setStatusAction} className="flex flex-wrap items-center gap-2">
            <input type="hidden" name="id" value={a.id} />
            <select name="status" defaultValue={a.status} className="flex-1 rounded-xl border border-surface-200 bg-surface-50 px-3 py-2 text-sm text-surface-800 dark:border-surface-700 dark:bg-surface-800 dark:text-slate-100">
              {STATUSES.map((s) => <option key={s} value={s}>{L(`st_${s}` as TranslationKey)}</option>)}
            </select>
            <button className="rounded-xl border border-surface-200 px-3 py-2 text-sm font-semibold text-surface-800 hover:bg-surface-50 dark:border-surface-700 dark:text-slate-100 dark:hover:bg-surface-800">✏️ {L("dy_d_status_save")}</button>
          </form>
          <p className="text-[11px] text-surface-500 dark:text-slate-400">{L("dy_d_nodelete")}</p>
        </Card>
        <div className="space-y-4 fit:col-span-2 fit:flex fit:min-h-0 fit:flex-col fit:gap-2.5 fit:space-y-0">
          <div className="grid grid-cols-2 gap-3.5 xl:grid-cols-4 fit:grid-cols-4 fit:gap-2.5">
            <Kpi tone="sky" label={L("dy_d_today")} value={fmtL(today.total)} sub={`${L("dy_morning")} ${today.am} · ${L("dy_evening")} ${today.pm}`} />
            <Kpi tone="green" label={L("dy_d_avg7")} value={fmtL(r1(avg(last7)))} sub={ch === null ? "—" : `${ch >= 0 ? "▲" : "▼"} ${Math.abs(ch)}%`} />
            <Kpi tone="teal" label={L("dy_d_30")} value={fmtL(tot30)} sub={`${herd30 ? Math.round((tot30 / herd30) * 100) : 0}% ${L("dy_d_share")}`} />
            <Kpi tone="violet" label={L("dy_d_peak")} value={fmtL(peak.total)} sub={shortDate(peak.date, lang)} />
          </div>
          <Card className="pf-panel fit:min-h-0 fit:flex-1 fit:p-3.5">
            <div className="mb-3 flex flex-wrap items-start justify-between gap-3 fit:mb-1">
              <h3 className="text-[15px] font-semibold text-surface-900 dark:text-white"><Tri k="dy_d_chart" lang={lang} /></h3>
              <Tabs items={["7", "30", "90"].map((r) => ({ href: `/portal/dairy/animals/${a.id}?r=${r}`, label: `${r}D`, on: String(days) === r }))} />
            </div>
            <div className="pf-body"><MilkChart series={series} lang={lang} height={200} /></div>
            <ChartLegend lang={lang} />
          </Card>
        </div>

      <div className="grid gap-4 lg:grid-cols-2 fit:contents">
        <Card className="pf-panel fit:p-3.5">
          <div className="mb-3 flex items-start justify-between gap-3">
            <h3 className="text-[15px] font-semibold text-surface-900 dark:text-white"><Tri k="dy_d_recent" lang={lang} /></h3>
            {canMilk && <a href={`/portal/dairy/milk?a=${a.id}`} className="rounded-xl bg-green-600 px-3 py-2 text-sm font-semibold text-white hover:bg-green-700">🥛 {L("dy_d_record")}</a>}
          </div>
          <div className="pf-body">
          <ResponsiveTable className="w-full text-[13px]">
            <thead><tr className="border-b border-surface-200 text-start text-[11px] uppercase text-surface-500 dark:border-surface-800 dark:text-slate-400">
              <th className="py-2">{L("dy_d_date")}</th><th>{L("dy_morning")} (AM)</th><th>{L("dy_evening")} (PM)</th><th>{L("dy_d_total")}</th><th>{L("dy_d_fat")}</th><th>{L("dy_d_note")}</th></tr></thead>
            <tbody>
              {recent.map((r) => (
                <tr key={r.d} className="border-b border-surface-100 text-surface-800 dark:border-surface-800 dark:text-slate-200">
                  <td className="py-2.5">{shortDate(r.d, lang)}</td><td>{r.am ?? "—"}</td><td>{r.pm ?? "—"}</td><td className="font-bold">{fmtL((r.am ?? 0) + (r.pm ?? 0))}</td><td>{r.fat ?? "—"}</td>
                  <td>{r.withheld && <Badge tone="amber">{L("dy_d_withheld")}</Badge>}</td>
                </tr>
              ))}
              {recent.length === 0 && <tr><td colSpan={6} className="py-6 text-center text-surface-500">{L("dy_d_no_milk")}</td></tr>}
            </tbody>
          </ResponsiveTable>
          </div>
        </Card>
        <Card className="pf-panel fit:p-3.5">
          <div className="mb-3 flex items-start justify-between gap-3">
            <h3 className="text-[15px] font-semibold text-surface-900 dark:text-white"><Tri k="dy_d_breed_title" lang={lang} /></h3>
            {rp?.pregnant ? <Badge tone="violet">{L("bh_hs_pregnant")} · {rp.days_pregnant} {L("bh_days")}</Badge> : rp?.pd_pending ? <Badge tone="indigo">{L("bh_hs_pd")}</Badge> : null}
          </div>
          <div className="pf-body">
          <div className="relative space-y-4 ps-6 before:absolute before:bottom-2 before:start-[9px] before:top-2 before:w-0.5 before:bg-surface-200 dark:before:bg-surface-800">
            {bev.slice(0, 4).map((e) => <TLItem key={e.id} color={EVENT_COLOR[e.event_type]} date={shortDate(e.event_date, lang)} title={`${EVENT_ICON[e.event_type]} ${tr(`bh_ty_${e.event_type}` as TranslationKey, lang)}${e.bull_name ? ` · ${e.bull_name}` : ""}${e.pd_result ? ` · ${tr(`bh_pd_${e.pd_result}` as TranslationKey, lang)}` : ""}`} />)}
            {bev.length === 0 && <TL color="bg-green-500" title={`${L("dy_d_lactation")} ${a.lactation_no || "—"}`} sub={a.last_calving_date ? longDate(a.last_calving_date, lang) : "—"} />}
          </div>
          {rp?.pregnant && rp.expected_calving && <p className="mt-3 text-xs text-surface-600 dark:text-slate-300">🍼 {L("bh_d_expected")} <b>{longDate(rp.expected_calving, lang)}</b></p>}
          <a href={`/portal/dairy/breeding/animal/${a.id}`} className="mt-3 block rounded-xl border border-dashed border-violet-400 bg-violet-500/5 p-3 text-xs font-semibold text-violet-700 dark:text-violet-200">🧬 {L("bh_open_tl")} →</a>
          </div>
        </Card>
      </div>
      </div>
      <Footer lang={lang} />
    </div>
  );
}
function TL({ color, title, sub }: { color: string; title: string; sub: string }) {
  return (
    <div className="relative">
      <span className={`absolute -start-[23px] top-1 h-3.5 w-3.5 rounded-full ring-4 ring-white dark:ring-surface-900 ${color}`} />
      <b className="text-[13px] text-surface-900 dark:text-white">{title}</b>
      <p className="text-xs text-surface-500 dark:text-slate-400">{sub}</p>
    </div>
  );
}
