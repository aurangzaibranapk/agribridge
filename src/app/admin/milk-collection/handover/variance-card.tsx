import { t, type Lang } from "@/lib/i18n/translations";
import { formatQty, gapKind, type MilkVariance } from "@/lib/milk-handover";

function gapText(lang: Lang, gap: number | null): string {
  const kind = gapKind(gap);
  if (kind === "pending") return t("mh_receipt_pending", lang);
  if (kind === "even") return t("mh_even", lang);
  const amount = `${formatQty(Math.abs(gap ?? 0))} L`;
  return kind === "loss" ? `${t("mh_loss", lang)} ${amount}` : `${t("mh_gain", lang)} ${amount}`;
}

/** Staff screen. Print par nahi — kaghaz wala slip alag hai. */
export function HandoverVarianceCard({
  lang,
  title,
  variance,
  pendingCount = 0,
  grossLabel,
  receivedLabel,
  gapLabel,
}: {
  lang: Lang;
  title: string;
  variance: MilkVariance;
  pendingCount?: number;
  grossLabel?: string;
  receivedLabel?: string;
  gapLabel?: string;
}) {
  const grossGap = pendingCount > 0 ? `${pendingCount} raseed baqi — is din ka farq nahi` : gapText(lang, variance.grossGapL);
  return (
    <div className="mb-3 rounded-lg border border-surface-200 bg-white px-3 py-2 text-sm print:hidden">
      <p className="font-semibold text-surface-900">{title}</p>
      <p className="mt-1 text-surface-700">
        {grossLabel ?? t("mh_aaya", lang)}: {formatQty(variance.grossL)} L
        {" · "}
        {t("mh_adjusted_short", lang)}: {variance.adjustedL == null ? t("mh_adjusted_incomplete", lang) : `${formatQty(variance.adjustedL)} L`}
        {" · "}
        {receivedLabel ?? t("mh_gaya", lang)}: {variance.receivedL == null ? t("mh_receipt_pending", lang) : `${formatQty(variance.receivedL)} L`}
      </p>
      <p className="mt-1 text-surface-900">
        {gapLabel ?? t("mh_gap_gross", lang)}: {grossGap}
        {variance.adjustedGapL != null && pendingCount === 0 && (
          <> · {t("mh_gap_adjusted", lang)}: {gapText(lang, variance.adjustedGapL)}</>
        )}
      </p>
    </div>
  );
}
