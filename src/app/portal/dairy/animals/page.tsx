import Link from "next/link";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";
import { t, type TranslationKey } from "@/lib/i18n/translations";
import { loadDairy, todayPk } from "@/lib/portal/dairy-load";
import { STATUS_TONE, SPECIES_EMOJI, ageText, animalStats, sortByTag, statusFilter } from "@/lib/portal/dairy";
import { Badge, Card } from "@/components/portal/khata/khata-parts";
import { Footer, Hero, HeroBtn, Kpi, Spark, TagChip, Tabs, Thumb } from "@/components/portal/dairy/dairy-parts";
import { signedUrls } from "@/lib/portal/dairy-pl-load";

export const dynamic = "force-dynamic";

export default async function AnimalList({ searchParams }: { searchParams: Record<string, string | undefined> }) {
  const lang = getLanguageFromCookies();
  const L = (k: TranslationKey) => t(k, lang);
  const asOf = todayPk();
  const { animals, yields } = await loadDairy(asOf, 7);
  const f = searchParams?.s ?? "all";
  const q = (searchParams?.q ?? "").trim().toLowerCase();
  const stats = animalStats(animals, yields, asOf);
  let rows = sortByTag(statusFilter(animals, f));
  if (q) rows = rows.filter((a) => a.tag_no.toLowerCase().includes(q) || (a.name ?? "").toLowerCase().includes(q));
  const urls = await signedUrls(rows.map((a) => a.photo_thumb_path ?? a.photo_path));
  const count = (s: string) => statusFilter(animals, s).length;
  const active = statusFilter(animals, "all");
  const milkingNow = active.filter((a) => a.status === "milking" || a.status === "pregnant").length;
  const tabs = [["all", L("dy_f_all")], ["milking", L("st_milking")], ["pregnant", L("st_pregnant")], ["dry", L("st_dry")], ["young", L("dy_f_young")], ["gone", L("dy_f_gone")]] as const;

  return (
    <div className="mx-auto max-w-7xl space-y-5 px-4 py-6 sm:px-6">
      <Hero title={<>🐄 {L("dy_list_title")}</>} sub={`${active.length} ${L("dy_list_sub").split(" · ")[0]} · ${milkingNow} ${L("dy_list_sub").split(" · ").slice(1).join(" · ")}`}>
        <HeroBtn href="/portal/dairy/animals/new" primary>➕ {L("dy_btn_add")}</HeroBtn>
        <HeroBtn href="/portal/dairy/milk">🥛 {L("dy_btn_milk")}</HeroBtn>
      </Hero>
      <Card>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <Tabs items={tabs.map(([k, label]) => ({ href: `/portal/dairy/animals?s=${k}`, label: `${label} (${count(k)})`, on: f === k }))} />
          <form className="flex"><input type="hidden" name="s" value={f} />
            <input name="q" defaultValue={q} placeholder={`🔍 ${L("dy_search")}`} className="rounded-full border border-surface-200 bg-surface-50 px-3 py-1.5 text-xs text-surface-800 dark:border-surface-700 dark:bg-surface-800 dark:text-slate-100" />
          </form>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-surface-200 text-left text-[11px] uppercase tracking-wide text-surface-500 dark:border-surface-800 dark:text-slate-400">
                {(["dy_c_tag", "dy_c_name", "dy_c_breed", "dy_c_age", "dy_c_status", "dy_c_today", "dy_c_trend", "dy_c_breeding"] as const).map((k) => <th key={k} className="px-2 py-2.5 font-semibold">{L(k)}</th>)}
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((a) => {
                const s = stats.get(a.id);
                return (
                  <tr key={a.id} className="border-b border-surface-100 text-surface-800 dark:border-surface-800 dark:text-slate-200">
                    <td className="px-2 py-2.5"><TagChip tag={a.tag_no} /></td>
                    <td className="px-2 py-2.5"><div className="flex items-center gap-2.5"><Thumb url={urls[(a.photo_thumb_path ?? a.photo_path) ?? ""]} emoji={SPECIES_EMOJI[a.species]} /><b>{a.name ?? "—"}</b></div></td>
                    <td className="px-2 py-2.5">{a.breed ?? "—"}</td>
                    <td className="px-2 py-2.5">{ageText(a.dob, asOf)}</td>
                    <td className="px-2 py-2.5"><Badge tone={STATUS_TONE[a.status]}>{L(`st_${a.status}` as TranslationKey)}</Badge></td>
                    <td className="px-2 py-2.5 font-bold">{s && s.today > 0 ? `${s.today} L` : "—"}</td>
                    <td className="px-2 py-2.5"><Spark values={s?.last7 ?? []} /></td>
                    <td className="px-2 py-2.5 text-xs text-surface-500 dark:text-slate-400">{a.status === "pregnant" ? L("st_pregnant") : "—"}</td>
                    <td className="px-2 py-2.5"><Link href={`/portal/dairy/animals/${a.id}`} className="rounded-lg border border-surface-200 px-3 py-1.5 text-xs font-semibold hover:bg-surface-50 dark:border-surface-700 dark:hover:bg-surface-800">{L("dy_view")} →</Link></td>
                  </tr>
                );
              })}
              {rows.length === 0 && <tr><td colSpan={9} className="py-8 text-center text-surface-500">{animals.length ? L("dy_none_filter") : L("dy_empty_body")}</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>
      <div className="grid grid-cols-2 gap-3.5 md:grid-cols-4">
        <Kpi tone="green" label={L("st_milking")} value={String(count("milking"))} sub={L("dy_animals_word")} />
        <Kpi tone="violet" label={L("st_pregnant")} value={String(count("pregnant"))} sub={L("dy_animals_word")} />
        <Kpi tone="amber" label={L("st_dry")} value={String(count("dry"))} sub={L("dy_animals_word")} />
        <Kpi tone="sky" label={L("dy_f_young")} value={String(count("young"))} sub={L("dy_animals_word")} />
      </div>
      <Footer lang={lang} />
    </div>
  );
}
