// Global print CSS (globals.css) admin tables ka aakhri "Actions" column chhupata hai --
// yahan aakhri column baqaya hai, is liye print:!table-cell.
import { rs, tafseelText, type StatementRow, type StatementTotals } from "@/lib/portal/khata";
import { t, type Lang, type TranslationKey } from "@/lib/i18n/translations";
import { shortDate } from "./khata-parts";

/** Chalte baqaye wala statement -- page aur print dono yahi istemal karte hain. */
export function StatementTable({ rows, totals, lang, year, compact = false }: {
  rows: StatementRow[]; totals: StatementTotals; lang: Lang; year: number; compact?: boolean;
}) {
  const L = (k: TranslationKey) => t(k, lang);
  const catKey = (c: string) => `pk_cat_${c}` as TranslationKey;
  const pad = compact ? "py-1.5" : "py-2.5";
  return (
    <div className="overflow-x-auto print:overflow-visible">
      <table className="w-full min-w-[640px] text-[13px] print:min-w-0 print:text-[11px]">
        <thead>
          <tr className="border-b border-surface-200 text-[11px] uppercase tracking-wide text-surface-500 dark:border-surface-800 dark:text-slate-400">
            <th className="py-2 pe-3 text-start font-semibold">{L("pk_col_date")}</th>
            <th className="py-2 pe-3 text-start font-semibold">{L("pk_col_detail")}</th>
            <th className="py-2 pe-3 text-start font-semibold">{L("pk_col_ref")}</th>
            <th className="py-2 pe-3 text-end font-semibold">{L("pk_col_udhaar")}</th>
            <th className="py-2 pe-3 text-end font-semibold">{L("pk_col_adaigi")}</th>
            <th className="py-2 text-end font-semibold print:!table-cell">{L("pk_col_balance")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) =>
            r.is_opening ? (
              <tr key={`o${i}`} className="border-b border-surface-100 bg-surface-50/70 dark:border-surface-800 dark:bg-surface-800/40">
                <td className={`${pad} pe-3 text-surface-600 dark:text-slate-300`}>{shortDate(r.entry_date, lang, year)}</td>
                <td className={`${pad} pe-3 font-semibold text-surface-800 dark:text-slate-100`} colSpan={4}>{L("pk_opening")}</td>
                <td className={`${pad} text-end font-bold text-surface-900 dark:text-white print:!table-cell`}>{rs(r.baqaya)}</td>
              </tr>
            ) : (
              <tr key={i} className="border-b border-surface-100 last:border-0 dark:border-surface-800">
                <td className={`${pad} whitespace-nowrap pe-3 text-surface-600 dark:text-slate-300`}>{shortDate(r.entry_date, lang, year)}</td>
                <td className={`${pad} pe-3`}>
                  <span className="font-semibold text-surface-900 dark:text-white">{tafseelText(r.tafseel, (k) => L(k as TranslationKey), lang)}</span>
                  {L(catKey(r.category)) !== tafseelText(r.tafseel, (k) => L(k as TranslationKey), lang) && (
                    <span className="ms-2 text-[11px] text-surface-400 dark:text-slate-500 print:hidden">{L(catKey(r.category))}</span>
                  )}
                </td>
                <td className={`${pad} whitespace-nowrap pe-3 text-surface-500 dark:text-slate-400 print:text-[10px]`}>{r.ref ?? "—"}</td>
                <td className={`${pad} whitespace-nowrap pe-3 text-end text-rose-600 dark:text-rose-300`}>{r.udhaar > 0 ? rs(r.udhaar) : ""}</td>
                <td className={`${pad} whitespace-nowrap pe-3 text-end text-emerald-600 dark:text-emerald-300`}>{r.adaigi > 0 ? rs(r.adaigi) : ""}</td>
                <td className={`${pad} whitespace-nowrap text-end font-bold text-surface-900 dark:text-white print:!table-cell`}>{rs(r.baqaya)}</td>
              </tr>
            )
          )}
        </tbody>
        {rows.length > 0 && (
          <tfoot>
            <tr className="border-t-2 border-surface-200 text-[13px] font-bold dark:border-surface-700">
              <td className="py-2.5 pe-3 text-surface-700 dark:text-slate-200" colSpan={3}>{L("pk_total")}</td>
              <td className="py-2.5 pe-3 text-end text-rose-600 dark:text-rose-300">{rs(totals.udhaar)}</td>
              <td className="py-2.5 pe-3 text-end text-emerald-600 dark:text-emerald-300">{rs(totals.adaigi)}</td>
              <td className="py-2.5 text-end text-surface-900 dark:text-white print:!table-cell">{rs(totals.closing)}</td>
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}
