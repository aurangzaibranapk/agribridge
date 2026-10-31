import { t, type Lang } from "@/lib/i18n/translations";
import { formatLab, formatQty, gapKind, internalAmountTotal, type DayDestinationSummary, type DestinationBucket, type HandoverDestination } from "@/lib/milk-handover";

function outText(lang: Lang, bucket: DestinationBucket): string {
  if (bucket.slipCount === 0) return t("mh_no_slip", lang);
  const gross = `${formatQty(bucket.grossL)} L`;
  const receipt = bucket.receiptPending > 0 || bucket.receivedL == null
    ? t("mh_receipt_pending", lang)
    : `${t("mh_receipt_short", lang)} ${formatQty(bucket.receivedL)} L`;
  const adjusted = bucket.adjustedL == null ? t("mh_adjusted_incomplete", lang) : `${t("mh_adjusted_short", lang)} ${formatQty(bucket.adjustedL)} L`;
  return `${gross} · ${receipt} · ${adjusted}`;
}

function varianceText(lang: Lang, summary: DayDestinationSummary): string {
  if (summary.intakeIncomplete || summary.inL == null) {
    return summary.intakeIncomplete ? t("mh_intake_partial", lang) : t("mh_intake_none", lang);
  }
  const kind = gapKind(summary.varianceL);
  if (kind === "even") return t("mh_even", lang);
  if (kind === "pending") return t("mh_intake_none", lang);
  const amount = `${formatQty(Math.abs(summary.varianceL ?? 0))} L`;
  return kind === "loss" ? `${t("mh_loss", lang)} ${amount}` : `${t("mh_gain", lang)} ${amount}`;
}

/** Roz ka khulasa. Teen out hamesha alag. Raseed farq mein shamil nahi. */
export function HandoverDaySummary({ lang, date, summary }: { lang: Lang; date: string; summary: DayDestinationSummary }) {
  const intake = summary.inL == null
    ? (summary.intakeIncomplete ? t("mh_intake_partial", lang) : t("mh_intake_none", lang))
    : `${formatQty(summary.inL)} L`;
  return (
    <div data-testid="handover-day-summary" className="mb-4 rounded-lg border border-surface-200 bg-white px-3 py-3 text-sm">
      <p className="font-semibold text-surface-900">{t("mh_day_title", lang)} · {date}</p>
      <p className="mt-2" data-testid="out-in">{t("mh_in_chiller", lang)}: {intake}</p>
      <p className="mt-1" data-testid="out-company">{t("mh_out_company", lang)}: {outText(lang, summary.company)}</p>
      <p className="mt-1" data-testid="out-vendor">{t("mh_out_vendor", lang)}: {outText(lang, summary.vendor)}</p>
      <p className="mt-1" data-testid="out-party">{t("mh_out_party", lang)}: {outText(lang, summary.party)}</p>
      <p className="mt-2 font-semibold" data-testid="out-variance">{t("mh_variance", lang)}: {varianceText(lang, summary)}</p>
      <p className="mt-2 text-xs text-surface-500">{t("mh_summary_note", lang)}</p>
    </div>
  );
}

export interface HisaabRow {
  id: string;
  mccName: string;
  destination: HandoverDestination;
  shift: string;
  adjustedL: number | null;
  rate: number | null;
  amount: number | null;
}

/** Admin/Owner. Rate na ho to "rate nahi", sifar nahi. Jama tab jab har slip par rate ho. */
export function HandoverInternalHisaab({ lang, rows }: { lang: Lang; rows: HisaabRow[] }) {
  const total = internalAmountTotal(rows.map((row) => row.amount));
  return (
    <div data-testid="handover-internal-hisaab" className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 text-sm">
      <p className="font-semibold text-amber-950">{t("mh_hisaab", lang)}</p>
      <p className="mt-1 text-xs text-amber-900">{t("mh_hisaab_note", lang)} {t("mh_rate_private", lang)}</p>
      {rows.length === 0 ? (
        <p className="mt-2 text-amber-900">{t("mh_none", lang)}</p>
      ) : (
        <table className="mt-2 w-full text-left text-xs">
          <thead>
            <tr className="text-amber-900">
              <th className="py-1 pr-2">MCC</th>
              <th className="py-1 pr-2">{t("mh_shift", lang)}</th>
              <th className="py-1 pr-2">{t("mh_adjusted_short", lang)}</th>
              <th className="py-1 pr-2">{t("mh_rate", lang)}</th>
              <th className="py-1">{t("mh_amount", lang)}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-t border-amber-100">
                <td className="py-1 pr-2">{row.mccName} · {row.destination}</td>
                <td className="py-1 pr-2">{row.shift === "evening" ? t("mh_evening", lang) : t("mh_morning", lang)}</td>
                <td className="py-1 pr-2">{row.adjustedL == null ? "—" : formatLab(row.adjustedL)}</td>
                <td className="py-1 pr-2">{row.rate == null ? t("mh_rate_missing", lang) : `Rs ${row.rate.toFixed(2)}`}</td>
                <td className="py-1">{row.amount == null ? t("mh_rate_missing", lang) : `Rs ${row.amount.toFixed(2)}`}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <p className="mt-2 font-semibold text-amber-950">
        {t("mh_hisaab_total", lang)}: {total == null ? t("mh_hisaab_incomplete", lang) : `Rs ${total.toFixed(2)}`}
      </p>
    </div>
  );
}
