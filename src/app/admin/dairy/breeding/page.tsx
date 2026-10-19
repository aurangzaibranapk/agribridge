import Link from "next/link";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";
import { t, type TranslationKey } from "@/lib/i18n/translations";
import { todayPk } from "@/lib/portal/dairy-load";
import { adminBreedFilter, adminBreedTotal } from "@/lib/portal/breeding";
import { isBreedAdmin, loadAdminBreed, loadAdminUpcoming } from "@/lib/portal/breeding-load";
import { rs } from "@/lib/portal/dairy-pl";
import { Card, shortDate } from "@/components/portal/khata/khata-parts";
import { Chips } from "@/components/portal/dairy/pl-parts";
import { SheetsButton } from "@/components/portal/dairy/sheets-button";
import { Denied } from "@/components/portal/dairy/denied";
import { BErrorNote, BHero, BKpi, Bar, H3, Pill } from "@/components/portal/breeding/breed-parts";

export const dynamic = "force-dynamic";
const pc = (v: number | null) => (v === null ? "—" : `${v}%`);
const tone = (v: number | null) => (v === null ? "#94a3b8" : v >= 80 ? "#22c55e" : v >= 50 ? "#f59e0b" : "#e11d48");

export default async function AdminBreeding({ searchParams }: { searchParams: Record<string, string | undefined> }) {
  const lang = getLanguageFromCookies();
  const L = (k: TranslationKey) => t(k, lang);
  if (!(await isBreedAdmin())) return <Denied lang={lang} />;
  const asOf = todayPk();
  const yr = Number(asOf.slice(0, 4));
  const f = ["all", "overdue", "lowvax", "calving"].includes(searchParams?.f ?? "") ? searchParams!.f! : "all";
  const q = (searchParams?.q ?? "").slice(0, 60);
  const [{ rows: all, error }, upcoming] = await Promise.all([loadAdminBreed(asOf), loadAdminUpcoming(asOf, 30)]);
  const rows = adminBreedFilter(all, f, q);
  const g = adminBreedTotal(rows);
  const qs = (o: Record<string, string>) => "?" + new URLSearchParams({ f, ...(q ? { q } : {}), ...o }).toString();
  const csvHref = `/admin/dairy/breeding/export${qs({})}`;

  return (
    <div className="mx-auto max-w-7xl space-y-5 px-4 py-6 sm:px-6">
      <BHero admin title={<>🧬 {L("bh_ad_title")} {lang !== "ur" && <>· <span dir="rtl">{t("bh_ad_title", "ur")}</span></>}</>} sub={`${shortDate(asOf, lang)} · ${L("bh_ad_sub")}`}>
        <Link href="/admin/dairy" className="rounded-xl border border-white/30 bg-white/10 px-3.5 py-2 text-xs font-semibold text-white">🐄 {L("bh_ad_pl")}</Link>
        <SheetsButton href={csvHref} label={L("ad_sheets")} help={L("ad_sheets_help")} />
      </BHero>
      {error && <BErrorNote e="bh_err_generic" lang={lang} />}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <BKpi tone="green" k="bh_ad_k_farmers" lang={lang} value={String(g.farmers)} sub={`${g.animals} ${L("bh_animals")}`} />
        <BKpi tone="violet" k="bh_k_pregnant" lang={lang} value={String(g.pregnant)} sub={`${g.calvings_30} ${L("bh_ad_calv30")}`} />
        <BKpi tone="indigo" k="bh_f_conception" lang={lang} value={pc(g.conception)} sub={L("bh_ad_conc_sub")} />
        <BKpi tone="teal" k="bh_ad_k_fmd" lang={lang} value={pc(g.fmd)} sub={`${g.fmd_missing} ${L("bh_d_missing")}`} />
        <BKpi tone="rose" k="bh_ad_k_overdue" lang={lang} value={String(g.overdue)} sub={`${g.overdueFarmers} ${L("bh_ad_farmers")}`} />
        <BKpi tone="amber" k="bh_ad_k_vets" lang={lang} value={rs(g.vets_cost)} sub={`${g.withheld} ${L("bh_ad_withheld")}`} />
      </div>
      <div className="grid gap-4 xl:grid-cols-[2fr_1fr]">
        <Card>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <Chips items={(["all", "overdue", "lowvax", "calving"] as const).map((k) => ({ href: `/admin/dairy/breeding${qs({ f: k })}`, label: L(`bh_ad_f_${k}` as TranslationKey), on: f === k }))} />
            <div className="flex items-center gap-2">
              <form className="flex"><input type="hidden" name="f" value={f} /><input name="q" defaultValue={q} placeholder={`🔍 ${L("ad_search")}`} className="w-40 rounded-full border border-surface-200 bg-white px-3 py-1.5 text-xs dark:border-surface-700 dark:bg-surface-900 dark:text-slate-100" /></form>
              <a href={csvHref} className="rounded-xl border border-surface-200 bg-white px-3 py-2 text-xs font-semibold text-surface-700 dark:border-surface-700 dark:bg-surface-900 dark:text-slate-200">⬇ CSV</a>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-[13px]">
              <thead><tr className="border-b border-surface-200 text-[11px] uppercase tracking-wide text-surface-500 dark:border-surface-800">
                <th className="py-2 text-start">{L("ad_c_code")}</th><th className="text-start">{L("ad_c_name")}</th><th className="text-end">{L("bh_animals")}</th><th className="text-end">{L("bh_hs_pregnant")}</th><th className="text-end">Conc.</th><th className="w-28 text-start">FMD</th><th className="w-28 text-start">HS</th><th className="text-end">{L("bh_ad_c_overdue")}</th><th className="text-end">{L("bh_ad_c_vets")}</th><th />
              </tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.farmer_id} className="border-b border-surface-100 text-surface-700 dark:border-surface-800 dark:text-slate-200">
                    <td className="py-2.5"><span className="rounded border border-amber-300 bg-amber-50 px-1.5 py-0.5 font-mono text-[11px] text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200">{r.farmer_code ?? "—"}</span></td>
                    <td className="font-semibold text-surface-900 dark:text-white">{r.full_name}{r.customer_name ? ` (${r.customer_name})` : ""}<div className="text-[11px] font-normal text-surface-500">{r.village ?? ""}</div></td>
                    <td className="text-end">{r.animals}</td><td className="text-end">{r.pregnant}{r.calvings_30 ? <span className="text-[11px] text-violet-600"> · {r.calvings_30}🍼</span> : null}</td><td className="text-end">{pc(r.conception_pct)}</td>
                    <td><div className="flex items-center gap-1.5"><div className="flex-1"><Bar pct={r.fmd_pct ?? 0} color={tone(r.fmd_pct)} /></div><span className="w-9 text-end text-[11px]">{pc(r.fmd_pct)}</span></div></td>
                    <td><div className="flex items-center gap-1.5"><div className="flex-1"><Bar pct={r.hs_pct ?? 0} color={tone(r.hs_pct)} /></div><span className="w-9 text-end text-[11px]">{pc(r.hs_pct)}</span></div></td>
                    <td className="text-end">{r.overdue ? <Pill tone="rose">{r.overdue}</Pill> : <Pill tone="green">0</Pill>}</td><td className="text-end">{rs(r.vets_cost)}</td>
                    <td className="text-end"><Link href={`/admin/dairy/${r.farmer_id}`} className="rounded-lg border border-surface-200 px-2.5 py-1 text-xs font-semibold dark:border-surface-700">{L("ad_open")} →</Link></td>
                  </tr>
                ))}
                {rows.length === 0 && <tr><td colSpan={10} className="py-8 text-center text-surface-500">{L("bh_ad_empty")}</td></tr>}
                <tr className="bg-surface-50 font-bold text-surface-900 dark:bg-surface-800/60 dark:text-white">
                  <td className="py-2.5" colSpan={2}>{L("ad_grand")}</td><td className="text-end">{g.animals}</td><td className="text-end">{g.pregnant}</td><td className="text-end">{pc(g.conception)}</td><td>{pc(g.fmd)}</td><td>{pc(g.hs)}</td><td className="text-end">{g.overdue}</td><td className="text-end">{rs(g.vets_cost)}</td><td />
                </tr>
              </tbody>
            </table>
          </div>
        </Card>
        <div className="grid content-start gap-4">
          <Card>
            <H3 k="bh_ad_up" lang={lang} />
            {upcoming.slice(0, 10).map((u, i) => (
              <div key={i} className="flex items-center justify-between border-b border-surface-100 py-2 text-[12.5px] last:border-0 dark:border-surface-800">
                <span className="text-surface-800 dark:text-slate-200"><b>#{u.tag_no}</b> {u.animal_name ?? ""} · <span className="text-surface-500">{u.full_name} ({u.farmer_code ?? "—"})</span></span>
                <Pill tone="violet">{shortDate(u.expected_calving, lang, yr)}</Pill>
              </div>
            ))}
            {upcoming.length === 0 && <p className="py-4 text-center text-sm text-surface-500">{L("bh_none_pregnant")}</p>}
          </Card>
          <Card>
            <H3 k="bh_ad_vax" lang={lang} />
            {([["FMD", g.fmd], ["HS", g.hs], ["LSD", g.lsd], ["BQ", g.bq]] as [string, number | null][]).map(([c, v]) => (
              <div key={c} className="mb-2 grid grid-cols-[48px_1fr_44px] items-center gap-2 text-[12.5px] text-surface-700 dark:text-slate-200"><b>{c}</b><Bar pct={v ?? 0} color={tone(v)} /><span className="text-end">{pc(v)}</span></div>
            ))}
            <p className="mt-2 text-[11.5px] text-surface-500">{L("bh_ad_note")}</p>
          </Card>
        </div>
      </div>
    </div>
  );
}
