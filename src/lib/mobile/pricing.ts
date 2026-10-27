import { FAT_MAX, FAT_MIN, LR_MAX, LR_MIN, requireMilkSettings, routeVariance, type MilkSettings } from "../dairy/rules";
import { calculateMilkValue } from "../utils/milk-formula";

/**
 * Mockup ke SNF/rate/alert adad sample hain. Yahan koi sample nahi.
 * Rate, SNF constant, reference TS aur hadd settings se aati hain.
 * Hadd ki column khali ho to portal ki maujooda hadd (FAT 1–12, LR 15–40)
 * — naya andaza nahi.
 */

export interface MilkThresholds {
  fatMin: number;
  fatMax: number;
  lrMin: number;
  lrMax: number;
  /** null = settings mein kami ki hadd nahi, alert nahi lagate. */
  shortagePct: number | null;
  snfLow: number | null;
  snfHigh: number | null;
}

function numOr(value: unknown, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function numOrNull(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function resolveThresholds(row: {
  fat_min?: number | null;
  fat_max?: number | null;
  lr_min?: number | null;
  lr_max?: number | null;
  shortage_alert_threshold?: number | null;
  snf_alert_low?: number | null;
  snf_alert_high?: number | null;
} | null | undefined): MilkThresholds {
  return {
    fatMin: numOr(row?.fat_min, FAT_MIN),
    fatMax: numOr(row?.fat_max, FAT_MAX),
    lrMin: numOr(row?.lr_min, LR_MIN),
    lrMax: numOr(row?.lr_max, LR_MAX),
    shortagePct: numOrNull(row?.shortage_alert_threshold),
    snfLow: numOrNull(row?.snf_alert_low),
    snfHigh: numOrNull(row?.snf_alert_high),
  };
}

export function priceFromSettings(
  volume: number,
  fat: number,
  lr: number,
  settings: MilkSettings
) {
  return calculateMilkValue(volume, fat, lr, settings.standardRate, settings.snfConstant, settings.referenceTs);
}

export function settingsOrError(row: Parameters<typeof requireMilkSettings>[0]) {
  return requireMilkSettings(row);
}

export interface MilkNotice {
  id: string;
  at: string;
  collector: string | null;
  liters: number;
  fat: number | null;
  lr: number | null;
  snf: number | null;
  rate: number | null;
  amount: number | null;
  shift: string | null;
}

export function toMilkNotice(
  row: {
    id: string;
    at?: string | null;
    collected_at?: string | null;
    entry_date?: string | null;
    shift?: string | null;
    liters?: number | null;
    quantity_liters?: number | null;
    fat?: number | null;
    fat_percentage?: number | null;
    lr?: number | null;
    rate?: number | null;
    rate_per_liter?: number | null;
    amount?: number | null;
    total_amount?: number | null;
    collector?: string | null;
  },
  settings: MilkSettings | null
): MilkNotice {
  const liters = Number(row.liters ?? row.quantity_liters ?? 0);
  const fat = row.fat ?? row.fat_percentage ?? null;
  const lr = row.lr ?? null;
  const rate = row.rate ?? row.rate_per_liter ?? null;
  const amount = row.amount ?? row.total_amount ?? null;
  let snf: number | null = null;
  if (settings && fat != null && lr != null && liters > 0) {
    snf = priceFromSettings(liters, Number(fat), Number(lr), settings).snf;
  }
  return {
    id: row.id,
    at: String(row.at ?? row.collected_at ?? row.entry_date ?? ""),
    collector: row.collector ?? null,
    liters,
    fat: fat == null ? null : Number(fat),
    lr: lr == null ? null : Number(lr),
    snf,
    rate: rate == null ? null : Number(rate),
    amount: amount == null ? null : Number(amount),
    shift: row.shift ?? null,
  };
}

export function milkAlerts(notice: MilkNotice, thresholds: MilkThresholds): string[] {
  const out: string[] = [];
  if (notice.fat != null && (notice.fat < thresholds.fatMin || notice.fat > thresholds.fatMax)) {
    out.push(`FAT ${thresholds.fatMin} se ${thresholds.fatMax} ke bahar hai.`);
  }
  if (notice.lr != null && (notice.lr < thresholds.lrMin || notice.lr > thresholds.lrMax)) {
    out.push(`LR ${thresholds.lrMin} se ${thresholds.lrMax} ke bahar hai.`);
  }
  if (thresholds.snfLow != null && notice.snf != null && notice.snf < thresholds.snfLow) {
    out.push("SNF neeche wali hadd se kam hai.");
  }
  if (thresholds.snfHigh != null && notice.snf != null && notice.snf > thresholds.snfHigh) {
    out.push("SNF upar wali hadd se zyada hai.");
  }
  return out;
}

export function dropVariance(fieldLiters: number, chillerLiters: number | null, shortagePct: number | null) {
  if (shortagePct == null) {
    return { error: "Kami ki hadd settings mein nahi. Andaza nahi lagate." as const };
  }
  return routeVariance(fieldLiters, chillerLiters, shortagePct);
}
