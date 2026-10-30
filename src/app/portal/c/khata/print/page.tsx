import Link from "next/link";
import { redirect } from "next/navigation";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";
import { t, type TranslationKey } from "@/lib/i18n/translations";
import { parseRange, qs, rs, statementTotals } from "@/lib/portal/khata";
import { custGate, customerContext, loadKhata, todayPk } from "@/lib/portal/customer-load";
import { longDate } from "@/components/portal/khata/khata-parts";
import { StatementTable } from "@/components/portal/khata/statement-table";
import { PrintButton } from "@/components/portal/khata/print-button";
import { CustGate, NoCustomer } from "@/components/portal/customer/gate";
import { btnPrimary } from "@/components/portal/customer/cust-parts";
import { brandName } from "@/lib/brand";

export const dynamic = "force-dynamic";

/** Print / PDF statement (browser ka "Save as PDF") -- sirf apna khata. */
export default async function CustomerStatementPrint({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  const lang = getLanguageFromCookies("rm");
  const L = (k: TranslationKey) => t(k, lang);
  const ctx = await customerContext();
  if (!ctx) redirect("/login");
  if (!ctx.profile && !ctx.isFarmer) return <NoCustomer lang={lang} />;
  const gate = await custGate(ctx);
  if (!gate.allowed) return <CustGate lang={lang} farmerReason={gate.farmerReason} />;
  const range = parseRange(searchParams ?? {});
  const { rows } = await loadKhata(range.from, range.to);
  const totals = statementTotals(rows);
  const asOf = todayPk();
  const c = ctx.profile?.customers[0];
  const period = `${range.from ? longDate(range.from, lang) : L("pc_p_all")} — ${longDate(range.to ?? asOf, lang)}`;
  return (
    <div className="pf-fit mx-auto w-full max-w-[1760px] px-4 py-6 sm:px-6 print:max-w-none print:p-0 fit:gap-2.5 fit:py-3">
      <div className="mb-4 flex items-center justify-between print:hidden fit:mb-0">
        <Link href={`/portal/c/khata${qs({})}`} className="text-sm text-surface-500 dark:text-slate-400">← {L("pc_nav_khata")}</Link>
        <PrintButton label={L("pc_btn_pdf")} className={`${btnPrimary} px-4 py-2 text-sm`} />
      </div>
      <div className="gl-panel pf-panel pf-navy pf-grow p-6 print:rounded-none print:border-0 print:bg-white print:shadow-none fit:p-4">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-black/10 pb-4 dark:border-white/10 print:border-surface-200">
          <div><p className="text-lg font-bold text-surface-900 dark:text-white">{brandName(lang)}</p><p className="text-sm text-surface-500 dark:text-slate-400">{L("pc_khata_title")}</p></div>
          <div className="text-end text-sm">
            <p className="font-semibold text-surface-900 dark:text-white">{c?.name ?? ""}</p>
            <p className="text-surface-500 dark:text-slate-400">{L("pc_f_code")}: {c?.code ?? "—"}</p>
            <p className="text-surface-500 dark:text-slate-400">{period}</p>
          </div>
        </div>
        <div className="my-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4 fit:my-2.5">
          {([["pc_opening", totals.opening], ["pc_debit", totals.udhaar], ["pc_credit", totals.adaigi], ["pc_closing", totals.closing]] as const).map(([k, v]) => (
            <div key={k} className="rounded-xl bg-surface-50 p-3 dark:bg-[#0d1a3a]"><p className="text-xs text-surface-500 dark:text-slate-400">{L(k)}</p><p className="font-bold text-surface-900 dark:text-white">{rs(v)}</p></div>
          ))}
        </div>
        <div className="pf-body"><StatementTable rows={rows} totals={totals} lang={lang} year={0} compact /></div>
        <p className="mt-6 border-t border-surface-200 pt-3 fit:mt-2 fit:pt-2 text-[11px] text-surface-500 dark:border-[#1e3160] dark:text-slate-400">{L("pc_signs")} · {longDate(asOf, lang)}</p>
      </div>
    </div>
  );
}
