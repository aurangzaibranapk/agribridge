import Link from "next/link";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";
import { t, type TranslationKey } from "@/lib/i18n/translations";
import { todayPk } from "@/lib/portal/dairy-load";
import { addMonths, categoryShares, resolvePeriod, rs, sumPnl } from "@/lib/portal/dairy-pl";
import { isDairyAdmin, loadAdminFarmer } from "@/lib/portal/dairy-admin-load";
import { Card, CardHead } from "@/components/portal/khata/khata-parts";
import { Hero, Kpi, TagChip, fmtL } from "@/components/portal/dairy/dairy-parts";
import { CategoryRows, GroupBars } from "@/components/portal/dairy/pl-parts";
import { SheetsButton } from "@/components/portal/dairy/sheets-button";
import { PrintButton } from "@/components/portal/dairy/print-button";
import { Denied } from "@/components/portal/dairy/denied";
import { ResponsiveTable } from "@/components/portal/responsive-table";

export const dynamic = "force-dynamic";
const mon = (iso: string) => new Intl.DateTimeFormat("en-GB", { month: "short", timeZone: "UTC" }).format(new Date(`${iso}T00:00:00Z`));
const day = (iso: string) => new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${iso.slice(0, 10)}T00:00:00Z`));

export default async function AdminDairyFarmer({ params, searchParams }: { params: { farmerId: string }; searchParams: Record<string, string | undefined> }) {
  const lang = getLanguageFromCookies();
  const L = (k: TranslationKey) => t(k, lang);
  if (!(await isDairyAdmin()) || !/^[0-9a-f-]{36}$/i.test(params.farmerId)) return <Denied lang={lang} />;
  const asOf = todayPk();
  const per = resolvePeriod(searchParams ?? {}, asOf);
  const [d, six] = await Promise.all([
    loadAdminFarmer(params.farmerId, per.from, per.to),
    loadAdminFarmer(params.farmerId, addMonths(`${asOf.slice(0, 7)}-01`, -5), asOf),
  ]);
  if (!d?.farmer) return <Denied lang={lang} />;
  const S = sumPnl(d.pnl);
  const cats = categoryShares(S.expense);
  const back = `/admin/dairy?p=${per.key}`;
  const catLabel = (c: string) => t((["home_milk", "animal_sale"].includes(c) ? `inc_${c}` : `cat_${c}`) as TranslationKey, lang);

  return (
    <div className="mx-auto max-w-7xl space-y-5 px-4 py-6 sm:px-6">
      <Hero title={<>{d.farmer.farmer_code} · {d.farmer.full_name} — {L("dy2_title")}</>} sub={`${d.farmer.village ?? ""} · ${d.animals.length} 🐄 · ${per.from} → ${per.to}`}>
        <Link href={back} className="rounded-xl border border-white/35 bg-white/15 px-3 py-2 text-xs font-semibold text-white">← {L("ad_back")}</Link>
        <SheetsButton href={`/admin/dairy/export?p=${per.key}&q=${encodeURIComponent(d.farmer.farmer_code ?? "")}`} label={L("ad_sheets")} help={L("ad_sheets_help")} />
        <PrintButton label={L("dy2_print")} />
      </Hero>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Kpi tone="sky" label={L("ad_k_animals")} value={String(d.animals.filter((a) => a.status !== "sold" && a.status !== "dead").length)} sub={`${d.animals.filter((a) => a.status === "milking").length} ${L("ad_milking")}`} />
        <Kpi tone="teal" label={L("dy2_k_milk")} value={fmtL(S.litres)} sub={`${L("dy2_centre")} ${fmtL(S.income.centre_litres ?? 0)}`} />
        <Kpi tone="rose" label={L("dy2_expense")} value={rs(S.expense_total)} sub={`${cats.length} ${L("dy2_k_cats")}`} />
        <Kpi tone="green" label={L("dy2_income")} value={rs(S.income_total)} sub={L("dy2_k_income_sub")} />
        <Kpi tone="violet" label={L(S.profit >= 0 ? "dy2_k_profit" : "dy2_k_loss")} value={`${S.profit < 0 ? "-" : ""}${rs(Math.abs(S.profit))}`} sub={per.key} />
        <Kpi tone="amber" label={L("dy2_k_cpl")} value={S.cost_per_litre === null ? "—" : `Rs ${Math.round(S.cost_per_litre)}`} sub={`${L("dy2_k_feed")} ${S.feed_per_animal === null ? "—" : rs(S.feed_per_animal)}`} />
      </div>
      <div className="grid gap-4 lg:grid-cols-[1.45fr_1fr]">
        <Card><CardHead title={L("dy2_chart_title")} /><GroupBars height={220} groups={(six?.pnl ?? []).map((r) => ({ label: mon(r.period), a: r.income_total, b: r.expense_total }))} names={[L("dy2_income"), L("dy2_expense")]} /></Card>
        <Card><CardHead title={L("dy2_cat_title")} />{cats.length ? <CategoryRows rows={cats} lang={lang} showPct={false} /> : <p className="py-6 text-center text-sm text-surface-500">{L("dy2_none")}</p>}</Card>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHead title={L("ad_per_animal")} />
          <ResponsiveTable className="w-full text-[13px]">
            <thead><tr className="border-b border-surface-200 text-[11px] uppercase tracking-wide text-surface-500 dark:border-surface-800"><th className="py-2 text-start">Tag</th><th className="text-start">{L("ad_c_name")}</th><th className="text-end">{L("dy2_k_milk")}</th><th className="text-end">{L("ad_own_exp")}</th></tr></thead>
            <tbody>{d.animals.map((a) => (
              <tr key={a.id} className="border-b border-surface-100 text-surface-700 dark:border-surface-800 dark:text-slate-200"><td className="py-2.5"><TagChip tag={a.tag_no} /></td><td>{a.name ?? "—"}</td><td className="text-end">{fmtL(a.litres)}</td><td className="text-end">{rs(a.expense)}</td></tr>
            ))}</tbody>
          </ResponsiveTable>
        </Card>
        <Card>
          <CardHead title={L("ad_recent")} right={<span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-semibold text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-200">{L("dy2_readonly")}</span>} />
          <ResponsiveTable className="w-full text-[13px]">
            <thead><tr className="border-b border-surface-200 text-[11px] uppercase tracking-wide text-surface-500 dark:border-surface-800"><th className="py-2 text-start">{L("dy2_f_date")}</th><th className="text-start">{L("dy2_f_cat")}</th><th className="text-start">{L("dy2_detail")}</th><th className="text-end">{L("dy2_amount")}</th></tr></thead>
            <tbody>{d.recent.map((r, i) => (
              <tr key={i} className="border-b border-surface-100 text-surface-700 dark:border-surface-800 dark:text-slate-200">
                <td className="py-2.5">{day(r.date)}</td><td>{catLabel(r.cat)}</td><td>{r.detail}{r.source === "erp_pos" ? ` (${L("ad_from_shop")})` : ""}</td>
                <td className={`text-end font-bold ${r.amount < 0 ? "text-rose-600 dark:text-rose-400" : "text-green-600 dark:text-green-400"}`}>{r.amount < 0 ? "-" : "+"}{rs(Math.abs(r.amount))}</td>
              </tr>
            ))}</tbody>
          </ResponsiveTable>
          {d.recent.length === 0 && <p className="py-6 text-center text-sm text-surface-500">{L("dy2_none")}</p>}
        </Card>
      </div>
      <p className="text-center text-[11px] text-surface-500 dark:text-slate-400">🔒 {L("ad_only")}</p>
    </div>
  );
}
