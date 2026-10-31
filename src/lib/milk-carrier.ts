/**
 * Carrier (Wasela, vendor, hum khud) ka hisaab. Pure functions: database
 * nahi chhoota. Har dispatch ki lines ko jod kar carrier wise khata banta hai.
 */

export interface CarrierLineInput {
  gross_volume_l: number | string | null;
  adjusted_volume_l: number | string | null;
  fat_percentage: number | string | null;
  snf_percentage: number | string | null;
  lr: number | string | null;
  ts_percentage: number | string | null;
}

export interface CarrierDispatchTotals {
  grossL: number;
  adjustedL: number;
  fat: number | null;
  snf: number | null;
  lr: number | null;
  ts: number | null;
  /** adjusted × rate. Rate ya adjusted na ho to null, sifar nahi. */
  amount: number | null;
}

const round3 = (n: number) => Math.round(n * 1000) / 1000;
const round2 = (n: number) => Math.round(n * 100) / 100;

function num(v: number | string | null | undefined): number | null {
  if (v == null || v === "") return null;
  const n = typeof v === "string" ? Number(v) : v;
  return Number.isFinite(n) ? n : null;
}

/** Gross ke wazan se ausat. Koi value na ho to null. */
function weighted(rows: { value: number | null; weight: number }[]): number | null {
  const usable = rows.filter((r) => r.value != null && r.weight > 0);
  const w = usable.reduce((s, r) => s + r.weight, 0);
  if (w === 0) return null;
  return round3(usable.reduce((s, r) => s + (r.value as number) * r.weight, 0) / w);
}

/** Ek dispatch ke lines se uska jama, ausat aur amount. */
export function dispatchTotals(lines: CarrierLineInput[], rate: number | string | null | undefined): CarrierDispatchTotals {
  const grossL = round3(lines.reduce((s, l) => s + (num(l.gross_volume_l) ?? 0), 0));
  const adjustedL = round3(lines.reduce((s, l) => s + (num(l.adjusted_volume_l) ?? 0), 0));
  const r = num(rate);
  const weightOf = (l: CarrierLineInput) => num(l.gross_volume_l) ?? 0;
  return {
    grossL,
    adjustedL,
    fat: weighted(lines.map((l) => ({ value: num(l.fat_percentage), weight: weightOf(l) }))),
    snf: weighted(lines.map((l) => ({ value: num(l.snf_percentage), weight: weightOf(l) }))),
    lr: weighted(lines.map((l) => ({ value: num(l.lr), weight: weightOf(l) }))),
    ts: weighted(lines.map((l) => ({ value: num(l.ts_percentage), weight: weightOf(l) }))),
    amount: r == null || lines.length === 0 ? null : round2(adjustedL * r),
  };
}

/** Carrier ki kul: litre, ausat aur total amount. Amount sirf jin dispatch par rate ho un ka jama hai. */
export function carrierTotals(items: { totals: CarrierDispatchTotals; lines: number }[]) {
  const withLines = items.filter((i) => i.lines > 0);
  const grossL = round3(withLines.reduce((s, i) => s + i.totals.grossL, 0));
  const adjustedL = round3(withLines.reduce((s, i) => s + i.totals.adjustedL, 0));
  const rated = withLines.filter((i) => i.totals.amount != null);
  const amount = rated.length === 0 ? null : round2(rated.reduce((s, i) => s + (i.totals.amount as number), 0));
  const pick = (k: "fat" | "snf" | "lr" | "ts") =>
    weighted(withLines.map((i) => ({ value: i.totals[k], weight: i.totals.grossL })));
  return {
    grossL,
    adjustedL,
    fat: pick("fat"),
    snf: pick("snf"),
    lr: pick("lr"),
    ts: pick("ts"),
    amount,
    unratedCount: withLines.length - rated.length,
  };
}
