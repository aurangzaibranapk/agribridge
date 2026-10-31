/**
 * Phone app "Milk TS% Volume" ke digits.
 *
 * SNF = LR/4 + FAT×0.2 + constant. Phone paper constant 0.806.
 * Migration 053 ka column default 0.805 hai — kisan ki adaigi wahi
 * rehti hai. 0.805 ko yahan purana default maana jata hai aur phone
 * wala 0.806 lagta hai. Koi aur constant (maslan 0.72) Owner ka irada
 * hai, wahi chalta hai.
 *
 * Har adad Java DecimalFormat "0.000" + RoundingMode.CEILING hai.
 * Double.toString ke extra hisson se ceiling hoti hai. Exact 8.416
 * rehta hai. 4.3+8.416 JS/Java mein 12.716000000000001 hai, is liye
 * TS 12.717. Adjusted = litre × (wohi TS double) / reference TS, phir
 * wahi ceiling: 0.979.
 *
 * Temperature yahan nahi. LR correction alag recipe hai (handover).
 */

export const PHONE_SNF_CONSTANT = 0.806;
export const LEGACY_SNF_CONSTANT = 0.805;
export const PHONE_REFERENCE_TS = 13;

export function phoneSnfConstant(value: number | null | undefined): number {
  if (value == null || !Number.isFinite(value)) return PHONE_SNF_CONSTANT;
  if (Math.abs(value - LEGACY_SNF_CONSTANT) < 1e-9) return PHONE_SNF_CONSTANT;
  return value;
}

export function phoneReferenceTs(value: number | null | undefined): number {
  if (value == null || !Number.isFinite(value) || !(value > 0)) return PHONE_REFERENCE_TS;
  return value;
}

/**
 * Java DecimalFormat ceiling, 3 decimal.
 * Number ki string Double.toString jaisi hai. Exact thousandth rehta hai.
 * Us ke baad koi non-zero digit ho to agla thousandth.
 */
export function roundPhone3(n: number): number {
  if (!Number.isFinite(n)) return n;
  const neg = n < 0;
  const text = String(Math.abs(n));
  const plain = /e/i.test(text) ? expandScientific(text) : text;
  const [intRaw, frac = ""] = plain.split(".");
  if (!frac) return n;
  const head = frac.slice(0, 3).padEnd(3, "0");
  const tail = frac.slice(3);
  let milli = Number(intRaw) * 1000 + Number(head);
  if (/[1-9]/.test(tail)) milli += 1;
  const out = milli / 1000;
  return neg ? -out : out;
}

function expandScientific(text: string): string {
  const match = /^(\d+)(?:\.(\d+))?[eE]([+-]?\d+)$/.exec(text);
  if (!match) return Number(text).toFixed(12);
  const digits = `${match[1]}${match[2] ?? ""}`;
  const exp = Number(match[3]) - (match[2]?.length ?? 0);
  if (exp >= 0) return digits + "0".repeat(exp);
  const point = digits.length + exp;
  if (point > 0) return `${digits.slice(0, point)}.${digits.slice(point)}`;
  return `0.${"0".repeat(-point)}${digits}`;
}

export interface PhoneLab {
  snf: number;
  ts: number;
  adjusted: number;
  specificGravity: number;
  kilograms: number;
}

export function phoneLab(
  volume: number,
  fat: number,
  lr: number,
  referenceTs = PHONE_REFERENCE_TS,
  snfConstant = PHONE_SNF_CONSTANT
): PhoneLab | null {
  if (!(volume > 0) || !(fat > 0) || !(lr > 0) || !(referenceTs > 0) || !Number.isFinite(snfConstant)) {
    return null;
  }
  const snf = roundPhone3(lr / 4 + fat * 0.2 + snfConstant);
  const tsRaw = fat + snf;
  const ts = roundPhone3(tsRaw);
  const adjusted = roundPhone3((volume * tsRaw) / referenceTs);
  const gravityRaw = 1 + lr / 1000;
  return {
    snf,
    ts,
    adjusted,
    specificGravity: roundPhone3(gravityRaw),
    kilograms: roundPhone3(volume * gravityRaw),
  };
}

export function formatPhone3(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "—";
  return roundPhone3(n).toFixed(3);
}
