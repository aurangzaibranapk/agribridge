import { t, type Lang } from "@/lib/i18n/translations";
import { formatQty, gapKind, type DayDestinationSummary, type DestinationBucket } from "@/lib/milk-handover";

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
