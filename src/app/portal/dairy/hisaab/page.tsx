import { getLanguageFromCookies } from "@/lib/i18n/get-language";
import { t, type TranslationKey } from "@/lib/i18n/translations";
import { todayPk } from "@/lib/portal/dairy-load";
import { addDays } from "@/lib/portal/dairy";
import { categoryShares, changePct, costBasisOf, resolvePeriod, rs, sumPnl, PERIODS, type CostBasisLabel, type PnlRow } from "@/lib/portal/dairy-pl";
import { loadPnl, loadSixMonths } from "@/lib/portal/dairy-pl-load";
import { Card, CardHead } from "@/components/portal/khata/khata-parts";
import { ErrorNote, Footer, Hero, HeroBtn, Kpi, fmtL } from "@/components/portal/dairy/dairy-parts";
import { CategoryRows, Chips, GroupBars, Money } from "@/components/portal/dairy/pl-parts";
import { PrintButton } from "@/components/portal/dairy/print-button";
import { ResponsiveTable } from "@/components/portal/responsive-table";
import { EmptyState } from "@/components/portal/empty-state";

export const dynamic = "force-dynamic";

const monthName = (iso: string, lang: string, long = false) =>
  new Intl.DateTimeFormat(lang === "ur" ? "ur-PK" : "en-GB", { month: long ? "short" : "short", year: long ? "numeric" : undefined, timeZone: "UTC" }).format(new Date(`${iso}T00:00:00Z`));
const days = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000) + 1;

export default async function Hisaab({ searchParams }: { searchParams: Record<string, string | undefined> }) {
  const lang = getLanguageFromCookies();
  const L = (k: TranslationKey) => t(k, lang);
  const asOf = todayPk();
  const per = resolvePeriod(searchParams ?? {}, asOf);
  const len = days(per.from, per.to);
  const [cur, prev, six] = await Promise.all([
    loadPnl(per.from, per.to),
    loadPnl(addDays(per.from, -len), addDays(per.from, -1)),
    loadSixMonths(asOf),
  ]);
  const S = sumPnl(cur.rows), P = sumPnl(prev.rows);
  const cats = categoryShares(S.expense);
  const ch = changePct(S.profit, P.profit);
  const basisKey = (b: CostBasisLabel) => (b === "home" ? "dy2_basis_home" : b === "centre" ? "dy2_basis_centre" : b === "mixed" ? "dy2_basis_mixed" : "dy2_basis_none") as TranslationKey;
  const rowCost = (r: PnlRow) => {
    if (r.cost_per_litre != null) return r.cost_per_litre;
    const b = costBasisOf(r);
    return b.litres > 0 ? Math.round((r.expense_total / b.litres) * 100) / 100 : null;
  };
  const src = [
    { icon: "🥛", k: "dy2_src_centre", detail: `${fmtL(S.income.centre_litres ?? 0)} · ${L("dy2_paid")} ${rs(S.income.centre_paid ?? 0)}`, v: S.income.centre_milk ?? 0, ro: true },
    { icon: "🏠", k: "dy2_src_home", detail: "", v: S.income.home_milk ?? 0 },
    { icon: "🐄", k: "dy2_src_sale", detail: "", v: S.income.animal_sale ?? 0 },
    { icon: "➕", k: "dy2_src_other", detail: "", v: S.income.other ?? 0 },
  ];
  const chip = (k: string) => `/portal/dairy/hisaab?p=${k}`;

  return (
    <div className="pf-fit mx-auto w-full max-w-[1760px] space-y-5 px-4 py-6 sm:px-6 print:max-w-none fit:gap-2.5 fit:space-y-0 fit:py-3">
      <Hero title={<>📒 {L("dy2_title")} {lang !== "ur" && <span dir="rtl" className="font-urdu">· {t("dy2_title", "ur")}</span>}</>} sub={`${monthName(per.from, lang, true)}${per.from.slice(0, 7) !== per.to.slice(0, 7) ? ` – ${monthName(per.to, lang, true)}` : ""} · ${L("dy2_sub")}`}>
        <HeroBtn href="/portal/dairy/hisaab/expense" primary>➕ {L("dy2_btn_exp")}</HeroBtn>
        <HeroBtn href="/portal/dairy/hisaab/income">➕ {L("dy2_btn_inc")}</HeroBtn>
      </Hero>
      {searchParams?.ok && <p className="rounded-xl bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-200">{L("dy2_saved")}</p>}
      <ErrorNote e={searchParams?.e} lang={lang} />
      {cur.error && <ErrorNote e="dy2_err_generic" lang={lang} />}

      <div className="flex flex-wrap items-center gap-2 print:hidden">
        <Chips items={PERIODS.filter((p) => p !== "custom").map((p) => ({ href: chip(p), label: L(`dy2_p_${p}` as TranslationKey), on: per.key === p }))} />
        <form className="flex items-center gap-1.5 text-xs">
          <input type="hidden" name="p" value="custom" />
          <input type="date" name="from" defaultValue={per.from} max={asOf} className="rounded-full border border-surface-200 bg-white px-2.5 py-1 dark:border-surface-700 dark:bg-surface-900 dark:text-slate-100 dark:[color-scheme:dark]" />
          <input type="date" name="to" defaultValue={per.to} max={asOf} className="rounded-full border border-surface-200 bg-white px-2.5 py-1 dark:border-surface-700 dark:bg-surface-900 dark:text-slate-100 dark:[color-scheme:dark]" />
          <button className={`rounded-full border px-3 py-1.5 ${per.key === "custom" ? "border-green-600 bg-green-600 text-white" : "border-surface-200 bg-white text-surface-700 dark:border-surface-700 dark:bg-surface-900 dark:text-slate-200"}`}>📅 {L("dy2_p_custom")}</button>
        </form>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6 fit:grid-cols-6 fit:gap-2.5">
        <Kpi tone="green" label={L("dy2_k_income")} value={rs(S.income_total)} sub={L("dy2_k_income_sub")} />
        <Kpi tone="rose" label={L("dy2_k_expense")} value={rs(S.expense_total)} sub={`${cats.length} ${L("dy2_k_cats")}`} />
        <Kpi tone="violet" label={L(S.profit >= 0 ? "dy2_k_profit" : "dy2_k_loss")} value={`${S.profit < 0 ? "-" : ""}${rs(Math.abs(S.profit))}`} sub={ch === null ? L("dy2_vs_prev") : `${ch >= 0 ? "▲" : "▼"} ${Math.abs(ch)}% ${L("dy2_vs_prev")}`} />
        <Kpi tone="sky" label={L("dy2_k_cpl")} value={S.cost_per_litre === null ? "—" : `Rs ${S.cost_per_litre.toFixed(1)}`} sub={S.cost_per_litre === null ? L("dy2_basis_none") : `${fmtL(S.cost_litres)} · ${L(basisKey(S.cost_basis))}`} />
        <Kpi tone="amber" label={L("dy2_k_feed")} value={S.feed_per_animal === null ? "—" : rs(S.feed_per_animal)} sub={`${S.animals} 🐄`} />
        <Kpi tone="teal" label={L("dy2_k_milk")} value={fmtL(S.cost_basis === "centre" ? S.litres_centre : S.litres_home)} sub={`${L("dy2_home")} ${fmtL(S.litres_home)} · ${L("dy2_centre")} ${fmtL(S.litres_centre)}`} />
      </div>

      <div className="pf-grow pf-grid grid gap-4 lg:grid-cols-2 fit:grid-cols-[1.35fr_1fr_1.15fr] fit:grid-rows-2 fit:gap-2.5">
        <Card className="pf-panel fit:row-span-1 fit:p-3.5">
          <CardHead title={L("dy2_chart_title")} sub={`${L("dy2_income")} vs ${L("dy2_expense")}`} right={<span className="text-xs text-surface-500">Rs</span>} />
          <div className="pf-body"><GroupBars height={210} groups={six.map((r) => ({ label: monthName(r.period, lang), a: r.income_total, b: r.expense_total }))} names={[L("dy2_income"), L("dy2_expense")]} /></div>
        </Card>
        <Card className="pf-panel fit:p-3.5">
          <CardHead title={L("dy2_cat_title")} right={<span className="text-xs text-surface-500">{monthName(per.to, lang)}</span>} />
          <div className="pf-body">{cats.length ? <CategoryRows rows={cats} lang={lang} /> : <p className="py-8 text-center text-sm text-surface-500">{L("dy2_none")}</p>}</div>
        </Card>
        <Card className="pf-panel fit:row-span-2 fit:p-3.5">
          <CardHead title={L("dy2_monthly_title")} right={<PrintButton label={L("dy2_print")} />} />
          <div className="pf-body">
          <ResponsiveTable className="w-full text-[13px] fit:text-[12px] fit:[&_td]:whitespace-nowrap">
            <thead><tr className="border-b border-surface-200 text-[11px] uppercase tracking-wide text-surface-500 dark:border-surface-800"><th className="py-2 text-start">{L("dy2_month")}</th><th className="text-end">{L("dy2_income")}</th><th className="text-end">{L("dy2_expense")}</th><th className="text-end">{L("dy2_k_profit")}</th><th className="text-end">{L("dy2_k_cpl")}</th></tr></thead>
            <tbody>
              {[...six].reverse().map((r) => (
                <tr key={r.period} className="border-b border-surface-100 text-end text-surface-700 dark:border-surface-800 dark:text-slate-200">
                  <td className="py-2.5 text-start">{monthName(r.period, lang, true)}</td><td>{rs(r.income_total)}</td><td>{rs(r.expense_total)}</td><td><Money v={r.profit} /></td><td>{rowCost(r) === null ? "—" : rowCost(r)!.toFixed(1)}{r.cost_basis ? <span className="block text-[10px] font-normal text-surface-500">{L(basisKey(r.cost_basis))}</span> : null}</td>
                </tr>
              ))}
            </tbody>
          </ResponsiveTable>
          </div>
        </Card>
        <Card className="pf-panel fit:col-span-2 fit:p-3.5">
          <CardHead title={L("dy2_src_title")} />
          <div className="pf-body">
          {S.income_total === 0 ? (
            <EmptyState compact icon="🥛" lang={lang} titleKey="ph6_es_income_t" bodyKey="ph6_es_income_b" cta={{ href: "/portal/dairy/hisaab/income", label: `＋ ${L("ph6_es_income_cta")}` }} />
          ) : (
            <ResponsiveTable className="w-full text-[13px]">
              <thead><tr className="border-b border-surface-200 text-start text-[11px] uppercase tracking-wide text-surface-500 dark:border-surface-800"><th className="py-2">{L("dy2_src")}</th><th>{L("dy2_detail")}</th><th className="text-end">{L("dy2_amount")}</th></tr></thead>
              <tbody>
                {src.map((s) => (
                  <tr key={s.k} className="border-b border-surface-100 dark:border-surface-800">
                    <td className="py-2.5 text-surface-800 dark:text-slate-100">{s.icon} {L(s.k as TranslationKey)}</td>
                    <td className="text-surface-600 dark:text-slate-300">{s.ro && <span className="me-1.5 rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-semibold text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-200">{L("dy2_readonly")}</span>}{s.detail}</td>
                    <td className="text-end font-bold text-green-600 dark:text-green-400">{rs(s.v)}</td>
                  </tr>
                ))}
                <tr className="bg-surface-50 font-bold dark:bg-surface-800/60"><td className="py-2.5 text-surface-900 dark:text-white" colSpan={2}>{L("dy2_total_income")}</td><td className="text-end text-surface-900 dark:text-white">{rs(S.income_total)}</td></tr>
              </tbody>
            </ResponsiveTable>
          )}
          </div>
        </Card>
      </div>
      <Footer lang={lang} />
    </div>
  );
}
