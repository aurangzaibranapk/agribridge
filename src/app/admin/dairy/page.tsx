import Link from "next/link";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";
import { t, type TranslationKey } from "@/lib/i18n/translations";
import { todayPk } from "@/lib/portal/dairy-load";
import { adminFilter, categoryShares, grandTotal, resolvePeriod, rs, PERIODS, type ExpenseCat } from "@/lib/portal/dairy-pl";
import { isDairyAdmin, loadAdminFarmer, loadAdminTotals } from "@/lib/portal/dairy-admin-load";
import { Card, CardHead } from "@/components/portal/khata/khata-parts";
import { ErrorNote, Hero, Kpi, fmtL } from "@/components/portal/dairy/dairy-parts";
import { CategoryRows, Chips, GroupBars, Money } from "@/components/portal/dairy/pl-parts";
import { SheetsButton } from "@/components/portal/dairy/sheets-button";
import { Denied } from "@/components/portal/dairy/denied";
import { EmptyState } from "@/components/portal/empty-state";
import { ResponsiveTable } from "@/components/portal/responsive-table";

export const dynamic = "force-dynamic";


export default async function AdminDairy({ searchParams }: { searchParams: Record<string, string | undefined> }) {
  const lang = getLanguageFromCookies();
  const L = (k: TranslationKey) => t(k, lang);
  if (!(await isDairyAdmin())) return <Denied lang={lang} />;
  const asOf = todayPk();
  const per = resolvePeriod(searchParams ?? {}, asOf);
  const f = ["all", "profit", "loss", "customer"].includes(searchParams?.f ?? "") ? searchParams!.f! : "all";
  const q = (searchParams?.q ?? "").slice(0, 60);
  const { rows: all, error } = await loadAdminTotals(per.from, per.to);
  const rows = adminFilter(all, f, q);
  const g = grandTotal(rows);
  // category totals: har kisan ka drill (top 25 tak) jor kar
  const drills = await Promise.all(rows.slice(0, 25).map((r) => loadAdminFarmer(r.farmer_id, per.from, per.to)));
  const catSum: Partial<Record<ExpenseCat, number>> = {};
  for (const d of drills) for (const p of d?.pnl ?? []) for (const [k, v] of Object.entries(p.expense)) catSum[k as ExpenseCat] = (catSum[k as ExpenseCat] ?? 0) + (v ?? 0);
  const top = [...rows].sort((a, b) => b.profit - a.profit).slice(0, 6);
  const qs = (o: Record<string, string>) => "?" + new URLSearchParams({ p: per.key, ...(per.key === "custom" ? { from: per.from, to: per.to } : {}), f, ...(q ? { q } : {}), ...o }).toString();
  const csvHref = `/admin/dairy/export${qs({})}`;
  const code = (r: { farmer_code: string | null }) => r.farmer_code ?? "—";

  return (
    <div className="mx-auto max-w-7xl space-y-5 px-4 py-6 sm:px-6">
      <Hero title={<>🐄 {L("ad_title")} {lang !== "ur" && <span dir="rtl">· {t("ad_title", "ur")}</span>}</>} sub={`${per.from} → ${per.to} · ${L("ad_sub")}`}>
        <Link href="/admin/dairy/breeding" className="rounded-xl border border-white/30 bg-white/10 px-3.5 py-2 text-xs font-semibold text-white">🧬 {L("bh_ad_title")}</Link>
        <SheetsButton href={csvHref} label={L("ad_sheets")} help={L("ad_sheets_help")} />
      </Hero>
      {error && <ErrorNote e="dy2_err_generic" lang={lang} />}
      <Chips items={PERIODS.filter((p) => p !== "custom").map((p) => ({ href: `/admin/dairy?p=${p}&f=${f}`, label: L(`dy2_p_${p}` as TranslationKey), on: per.key === p }))} />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Kpi tone="sky" label={L("ad_k_farmers")} value={String(rows.length)} sub={L("ad_k_farmers_sub")} />
        <Kpi tone="green" label={L("ad_k_animals")} value={String(g.animals)} sub={`${g.milking} ${L("ad_milking")}`} />
        <Kpi tone="teal" label={L("dy2_k_milk")} value={fmtL(g.litres)} sub={`${L("ad_home_record")} · ${L("dy2_centre")} ${fmtL(g.centre_litres)}`} />
        <Kpi tone="rose" label={L("dy2_expense")} value={rs(g.expense)} sub={L("ad_all")} />
        <Kpi tone="amber" label={L("dy2_income")} value={rs(g.income)} sub={L("dy2_k_income_sub")} />
        <Kpi tone="violet" label={L("dy2_k_profit")} value={`${g.profit < 0 ? "-" : ""}${rs(Math.abs(g.profit))}`} sub={`${g.losses} ${L("ad_losses")}`} />
      </div>
      <Card>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <Chips items={(["all", "profit", "loss", "customer"] as const).map((k) => ({ href: `/admin/dairy${qs({ f: k })}`, label: L(`ad_f_${k}` as TranslationKey), on: f === k }))} />
          <div className="flex items-center gap-2">
            <form className="flex"><input type="hidden" name="p" value={per.key} /><input type="hidden" name="f" value={f} /><input name="q" defaultValue={q} placeholder={`🔍 ${L("ad_search")}`} className="w-40 rounded-full border border-surface-200 bg-white px-3 py-1.5 text-xs dark:border-surface-700 dark:bg-surface-900 dark:text-slate-100" /></form>
            <a href={csvHref} className="rounded-xl border border-surface-200 bg-white px-3 py-2 text-xs font-semibold text-surface-700 dark:border-surface-700 dark:bg-surface-900 dark:text-slate-200">⬇ {L("ad_csv")}</a>
            <SheetsButton href={csvHref} label={L("ad_sheets")} help={L("ad_sheets_help")} />
          </div>
        </div>
        {rows.length === 0 ? (
          <EmptyState icon="🥛" lang={lang} titleKey="ph6_es_adm_dairy_t" bodyKey="ph6_es_adm_dairy_b"
            cta={f !== "all" || q ? { href: `/admin/dairy?p=${per.key}`, label: L("ph6_es_clear") } : undefined} />
        ) : (
          <ResponsiveTable className="w-full text-[13px] sm:min-w-[860px]" titleCol={1}>
            <thead><tr className="border-b border-surface-200 text-[11px] uppercase tracking-wide text-surface-500 dark:border-surface-800">
              <th className="py-2 text-start">{L("ad_c_code")}</th><th className="text-start">{L("ad_c_name")}</th><th className="text-start">{L("ad_c_village")}</th><th className="text-end">{L("ad_c_animals")}</th><th className="text-end">{L("ad_c_milk")}</th><th className="text-end">{L("dy2_expense")}</th><th className="text-end">{L("dy2_income")}</th><th className="text-end">{L("ad_c_pl")}</th><th className="text-end">{L("ad_c_cpl")}</th><th />
            </tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.farmer_id} className="border-b border-surface-100 text-surface-700 dark:border-surface-800 dark:text-slate-200">
                  <td className="py-2.5"><span className="rounded border border-amber-300 bg-amber-50 px-1.5 py-0.5 font-mono text-[11px] text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200">{code(r)}</span></td>
                  <td className="font-semibold text-surface-900 dark:text-white">{r.full_name}{r.customer_name ? ` (${r.customer_name})` : ""}</td>
                  <td>{r.village ?? "—"}</td><td className="text-end">{r.animals}</td><td className="text-end">{Math.round(r.litres).toLocaleString("en-IN")}{r.centre_litres > 0 ? <div className="text-[10px] font-normal text-surface-500 dark:text-slate-400">{L("dy2_centre")} {Math.round(r.centre_litres).toLocaleString("en-IN")}</div> : null}</td>
                  <td className="text-end">{rs(r.expense)}</td><td className="text-end">{rs(r.income)}</td><td className="text-end"><Money v={r.profit} /></td>
                  <td className="text-end">{r.cost_per_litre === null ? "—" : `Rs ${Math.round(r.cost_per_litre)}`}{r.cost_basis ? <div className="text-[10px] font-normal text-surface-500 dark:text-slate-400">{L(r.cost_basis === "centre" ? "dy2_basis_centre" : "dy2_basis_home")}</div> : null}</td>
                  <td className="text-end"><Link href={`/admin/dairy/${r.farmer_id}${qs({})}`} className="rounded-lg border border-surface-200 px-2.5 py-1 text-xs font-semibold dark:border-surface-700">{L("ad_open")} →</Link></td>
                </tr>
              ))}
              <tr className="bg-surface-50 font-bold text-surface-900 dark:bg-surface-800/60 dark:text-white">
                <td className="py-2.5" colSpan={3}>{L("ad_grand")}</td><td className="text-end">{g.animals}</td><td className="text-end">{Math.round(g.litres).toLocaleString("en-IN")}</td>
                <td className="text-end">{rs(g.expense)}</td><td className="text-end">{rs(g.income)}</td><td className="text-end"><Money v={g.profit} /></td><td className="text-end">{g.cost_per_litre === null ? "—" : `Rs ${Math.round(g.cost_per_litre)}`}<div className="text-[10px] font-normal text-surface-500 dark:text-slate-400">{g.milk_farmers} {L("ad_cpl_basis")}{g.cost_basis ? ` · ${L(g.cost_basis === "centre" ? "dy2_basis_centre" : g.cost_basis === "home" ? "dy2_basis_home" : "dy2_basis_mixed")}` : ""}{g.avg_cost_per_litre === null ? "" : ` · ${L("ad_cpl_avg")} Rs ${Math.round(g.avg_cost_per_litre)}`}</div></td><td />
              </tr>
            </tbody>
          </ResponsiveTable>
        )}
      </Card>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card><CardHead title={L("ad_chart_farmer")} /><GroupBars height={220} groups={top.map((r) => ({ label: code(r).slice(-3), a: r.income, b: r.expense }))} names={[L("dy2_income"), L("dy2_expense")]} /></Card>
        <Card><CardHead title={L("ad_chart_cats")} /><CategoryRows rows={categoryShares(catSum)} lang={lang} showPct={false} /></Card>
      </div>
      <p className="text-center text-[11px] text-surface-500 dark:text-slate-400">🔒 {L("ad_only")}</p>
    </div>
  );
}
