import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { checkFarmerVerification } from "@/lib/utils/verification-gate";
import { VerificationGateMessage } from "@/components/portal/verification-gate-message";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";
import { t, type TranslationKey } from "@/lib/i18n/translations";
import { loadKhata } from "@/lib/portal/khata-load";
import { filterStatement, parseRange, qs, rs, statementTotals } from "@/lib/portal/khata";
import { longDate } from "@/components/portal/khata/khata-parts";
import { StatementTable } from "@/components/portal/khata/statement-table";
import { PrintButton } from "@/components/portal/khata/print-button";

export const dynamic = "force-dynamic";

/** Print / PDF statement -- browser ka "Save as PDF". Sirf apna khata (565). */
export default async function KhataStatementPrintPage({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  const supabase = createClient();
  const lang = getLanguageFromCookies();
  const L = (k: TranslationKey) => t(k, lang);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: farmer } = await supabase.from("farmers").select("id, full_name, farmer_code").eq("user_id", user.id).single();
  if (!farmer) redirect("/login");
  const gate = await checkFarmerVerification(farmer.id);
  if (!gate.allowed) return <VerificationGateMessage reason={gate.reason!} />;

  const range = parseRange(searchParams ?? {});
  const { summary: s, rows: allRows } = await loadKhata(range.from, range.to);
  const asOf = s?.as_of || new Date().toISOString().slice(0, 10);
  const rows = filterStatement(allRows, range.filter);
  const totals = statementTotals(rows);
  const period = `${range.from ? longDate(range.from, lang) : L("pk_p_all")} — ${longDate(range.to ?? asOf, lang)}`;
  const auto = (Array.isArray(searchParams?.print) ? searchParams.print[0] : searchParams?.print) === "1";

  return (
    <div className="pf-fit mx-auto w-full max-w-[1760px] px-4 py-6 sm:px-6 print:max-w-none print:p-0 fit:gap-2.5 fit:py-3">
      <div className="mb-4 flex items-center justify-between print:hidden fit:mb-0">
        <Link href={`/portal/wallet${qs({ from: range.from, to: range.to, f: range.filter === "all" ? null : range.filter })}`} className="text-sm text-surface-500 hover:text-green-700 dark:text-slate-400">
          ← {L("pk_back")}
        </Link>
        <PrintButton auto={auto} label={L("pk_btn_print")} className="rounded-xl bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700" />
      </div>
      <div className="pf-panel pf-grow rounded-2xl border border-surface-200 bg-white p-6 shadow-sm dark:border-surface-800 dark:bg-surface-900 print:rounded-none print:border-0 print:shadow-none fit:p-4">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-surface-200 pb-4 dark:border-surface-800">
          <div>
            <p className="text-lg font-bold text-surface-900 dark:text-white">AgriBridge</p>
            <p className="text-sm text-surface-500 dark:text-slate-400">{L("pk_print_title")}</p>
          </div>
          <div className="text-end text-sm">
            <p className="font-semibold text-surface-900 dark:text-white">{farmer.full_name}</p>
            <p className="text-surface-500 dark:text-slate-400">{L("pk_print_member")}: {farmer.farmer_code}</p>
            <p className="text-surface-500 dark:text-slate-400">{L("pk_print_period")}: {period}</p>
          </div>
        </div>
        <div className="my-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4 fit:my-2.5">
          {[
            [L("pk_opening"), rs(totals.opening), ""],
            [L("pk_col_udhaar"), rs(totals.udhaar), "text-rose-600 dark:text-rose-300"],
            [L("pk_col_adaigi"), rs(totals.adaigi), "text-emerald-600 dark:text-emerald-300"],
            [L("pk_closing"), rs(totals.closing), ""],
          ].map(([k, v, c]) => (
            <div key={k} className="rounded-xl bg-surface-50 p-3 dark:bg-surface-800/60 print:border print:border-surface-200">
              <p className="text-xs text-surface-500 dark:text-slate-400">{k}</p>
              <p className={`font-bold text-surface-900 dark:text-white ${c}`}>{v}</p>
            </div>
          ))}
        </div>
        {rows.length === 0 ? (
          <p className="py-8 text-center text-sm text-surface-500">{L("pk_no_rows")}</p>
        ) : (
          <div className="pf-body"><StatementTable rows={rows} totals={totals} lang={lang} year={0} compact /></div>
        )}
        <p className="mt-6 border-t border-surface-200 pt-3 fit:mt-2 fit:pt-2 text-[11px] text-surface-500 dark:border-surface-800 dark:text-slate-400">
          {L("pk_print_footer")} · {L("pk_print_generated")}: {longDate(asOf, lang)}
        </p>
      </div>
    </div>
  );
}
