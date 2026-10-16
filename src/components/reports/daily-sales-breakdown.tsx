import Link from "next/link";
import { t, type Lang } from "@/lib/i18n/translations";
import { salesIn, paymentsFor, type SalesScope } from "@/lib/reports/sales-fetch";
import { buildDailyRows, dayKeys, recentDayRanges, sumDailyRows, type DailyRow } from "@/lib/reports/sales-period";

const rs = (n: number) => `Rs. ${Math.round(n).toLocaleString()}`;
const dmy = (d: string) => d.split("-").reverse().join("-");

/**
 * Aaj (abhi tak) / Kal / Parson tiles + rozana table.
 * Sales report (poora) aur Command Center (compact) dono yahi istemal karte hain.
 * Data request karne wale ke apne client se -- RLS aur dukan/branch scope wahi.
 */
export async function DailySalesBreakdown({ supabase, scope, tableRange, lang, compact = false, reportHref }: {
  supabase: any;
  scope: SalesScope;
  /** Table ke din (e.g. filter ki period). Aaj is mein shamil nahi hota. */
  tableRange: { start: Date; end: Date };
  lang: Lang;
  compact?: boolean;
  reportHref?: string;
}) {
  const now = new Date();
  const recent = recentDayRanges(now);
  const parsonStart = recent[2].start;
  const from = new Date(Math.min(parsonStart.getTime(), tableRange.start.getTime()));
  const to = new Date(Math.max(now.getTime(), tableRange.end.getTime()));
  const sales = await salesIn(supabase, scope, from, to);
  const payments = await paymentsFor(supabase, sales.map((s) => s.id));

  const tiles = buildDailyRows(recent.map((r) => r.key), sales, payments);
  const byKey = new Map(tiles.map((r) => [r.day, r]));
  const table = buildDailyRows(dayKeys(tableRange), sales, payments);
  const tot = sumDailyRows(table);

  return (
    <div className={compact ? "space-y-3" : "mt-5 space-y-3 border-t border-surface-100 pt-4 dark:border-surface-800"}>
      <div className="grid gap-2 sm:grid-cols-3">
        {recent.map((r) => {
          const d = byKey.get(r.key)!;
          return (
            <div key={r.kind} className="rounded-xl bg-surface-50 p-3 dark:bg-surface-800">
              <p className="text-xs text-surface-500">{t(`sps_${r.kind}` as any, lang)} · {dmy(r.key)}</p>
              <p className="mt-1 text-lg font-bold text-surface-900 dark:text-surface-100">{rs(d.total)}</p>
              <p className="text-[11px] text-surface-500">{d.bills} {t("sps_bills", lang)}</p>
              <p className="mt-1 text-[11px] text-surface-600 dark:text-surface-300">
                {t("sps_cash", lang)} {rs(d.cash)} · {t("sps_bank", lang)} {rs(d.bank)} · {t("sps_udhaar", lang)} {rs(d.udhaar)}
              </p>
            </div>
          );
        })}
      </div>
      <div>
        <p className="mb-1 text-xs font-semibold text-surface-500">{compact ? t("sps_daily_7d", lang) : t("sps_daily_table", lang)}</p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm tabular-nums">
            <thead><tr className="text-left text-xs text-surface-500">
              <th className="py-1">{t("sps_date", lang)}</th><th className="text-right">{t("sps_bills", lang)}</th><th className="text-right">{t("sps_total", lang)}</th>
              <th className="text-right">{t("sps_cash", lang)}</th><th className="text-right">{t("sps_bank", lang)}</th><th className="text-right">{t("sps_udhaar", lang)}</th>
            </tr></thead>
            <tbody>
              {table.map((r) => <Row key={r.day} r={r} label={dmy(r.day)} />)}
              <Row r={tot} label={t("sps_grand_total", lang)} bold />
            </tbody>
          </table>
        </div>
        {reportHref && <Link href={reportHref} className="mt-2 inline-block text-xs font-semibold text-brand-700 hover:underline">{t("sps_full_report", lang)} →</Link>}
      </div>
    </div>
  );
}

function Row({ r, label, bold = false }: { r: DailyRow; label: string; bold?: boolean }) {
  return (
    <tr className={`border-t border-surface-100 dark:border-surface-800 ${bold ? "font-semibold" : ""}`}>
      <td className="py-1">{label}</td><td className="text-right">{r.bills}</td><td className="text-right">{rs(r.total)}</td>
      <td className="text-right">{rs(r.cash)}</td><td className="text-right">{rs(r.bank)}</td><td className="text-right">{rs(r.udhaar)}</td>
    </tr>
  );
}
