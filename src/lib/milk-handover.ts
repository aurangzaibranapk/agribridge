/**
 * Milk Handover Certificate — hisaab, nishan, aur form ki qatarein.
 *
 * Litre yahan nahi bante. Adjusted volume tabhi number hai jab staff
 * ne likha ho, ya "Likhein" se andaza apni marzi se copy kiya ho.
 * Min spec se neeche = nishan, rok nahi.
 */

export interface HandoverSpecs {
  minFat: number;
  minLr: number;
  minSnf: number;
}

/** Kaghaz par chhapa hua minimum. Settings na milen to yahi. */
export const PAPER_SPECS: HandoverSpecs = { minFat: 4.1, minLr: 27, minSnf: 8.4 };

export interface LabFormula {
  snfConstant: number;
  referenceTs: number;
}

export interface HandoverLineInput {
  chillerNo: string;
  milkType: string;
  grossL: string;
  fat: string;
  lr: string;
  snf: string;
  adjustedL: string;
  temperatureC: string;
  organo: string;
}

export interface ParsedLine {
  chillerNo: string;
  milkType: string;
  grossL: number;
  fat: number | null;
  lr: number | null;
  snf: number | null;
  adjustedL: number | null;
  temperatureC: number | null;
  organo: string | null;
}

export type SpecField = "fat" | "lr" | "snf";

export interface SpecFlag {
  chillerNo: string;
  field: SpecField;
  value: number;
  min: number;
}

export function emptyLine(): HandoverLineInput {
  return {
    chillerNo: "",
    milkType: "",
    grossL: "",
    fat: "",
    lr: "",
    snf: "",
    adjustedL: "",
    temperatureC: "",
    organo: "",
  };
}

export function blankCertificateLines(count = 6): HandoverLineInput[] {
  return Array.from({ length: count }, () => emptyLine());
}

function roundTo(n: number, places: number): number {
  const m = 10 ** places;
  return Math.round(n * m) / m;
}

function parseNum(raw: string, label: string, chiller: string): number | null | string {
  const text = raw.trim();
  if (!text) return null;
  if (!/^-?\d+(\.\d+)?$/.test(text)) {
    return chiller ? `${chiller}: ${label} sahi adad nahi.` : `${label} sahi adad nahi.`;
  }
  const n = Number(text);
  if (!Number.isFinite(n)) return `${label} sahi adad nahi.`;
  return n;
}

function isBlank(line: HandoverLineInput): boolean {
  return [line.chillerNo, line.milkType, line.grossL, line.fat, line.lr, line.snf, line.adjustedL, line.temperatureC, line.organo].every(
    (v) => !v.trim()
  );
}

/** Form ki qatarein. Khali qatar chhoot jati hai. Galat adad error. */
export function parseHandoverLines(lines: HandoverLineInput[]): { lines: ParsedLine[] } | { error: string } {
  const out: ParsedLine[] = [];
  for (const line of lines) {
    if (isBlank(line)) continue;
    const chiller = line.chillerNo.trim();
    const milkType = line.milkType.trim();
    if (!chiller) return { error: "Chiller number likhein." };
    if (!milkType) return { error: `Chiller ${chiller} ka milk type likhein (Cow, Buffalo, Mixed).` };
    if (chiller.length > 40) return { error: `Chiller ${chiller} ka number 40 haroof se chhota rakhein.` };
    if (milkType.length > 40) return { error: `Chiller ${chiller} ka milk type 40 haroof se chhota rakhein.` };

    const gross = parseNum(line.grossL, "Gross Vol", chiller);
    if (typeof gross === "string") return { error: gross };
    if (gross == null) return { error: `Chiller ${chiller} ki miqdar (Gross Vol) likhein.` };
    if (gross < 0 || gross > 100000) return { error: `Chiller ${chiller} ki miqdar 0 se 100000 litre ke darmiyan ho.` };

    const fat = parseNum(line.fat, "FAT", chiller);
    if (typeof fat === "string") return { error: fat };
    const lr = parseNum(line.lr, "LR", chiller);
    if (typeof lr === "string") return { error: lr };
    const snf = parseNum(line.snf, "SNF", chiller);
    if (typeof snf === "string") return { error: snf };
    const adjusted = parseNum(line.adjustedL, "Adjusted volume", chiller);
    if (typeof adjusted === "string") return { error: adjusted };
    const temperature = parseNum(line.temperatureC, "Temperature", chiller);
    if (typeof temperature === "string") return { error: temperature };

    const organo = line.organo.trim();
    if (organo.length > 40) return { error: `Chiller ${chiller} ka organo 40 haroof se chhota rakhein.` };

    out.push({
      chillerNo: chiller,
      milkType,
      grossL: roundTo(gross, 3),
      fat: fat == null ? null : roundTo(fat, 2),
      lr: lr == null ? null : roundTo(lr, 2),
      snf: snf == null ? null : roundTo(snf, 2),
      adjustedL: adjusted == null ? null : roundTo(adjusted, 3),
      temperatureC: temperature == null ? null : roundTo(temperature, 2),
      organo: organo || null,
    });
  }
  if (out.length === 0 || out.every((l) => l.grossL <= 0)) {
    return { error: "Kam az kam ek chiller ki miqdar likhein. Khali certificate mehfooz nahi hota." };
  }
  if (out.length > 30) return { error: "Ek certificate par 30 se zyada chiller nahi." };
  return { lines: out };
}

export function lineToSql(line: ParsedLine) {
  return {
    chiller_no: line.chillerNo,
    milk_type: line.milkType,
    gross_volume_l: line.grossL,
    fat_percentage: line.fat,
    lr: line.lr,
    snf_percentage: line.snf,
    adjusted_volume_l: line.adjustedL,
    temperature_c: line.temperatureC,
    organo: line.organo,
  };
}

export function tsOf(fat: number | null, snf: number | null): number | null {
  if (fat == null || snf == null) return null;
  return roundTo(fat + snf, 2);
}

/** Neeche min spec. Barabar theek hai. Khali par koi nishan nahi. */
export function lineSpecFlags(line: Pick<ParsedLine, "chillerNo" | "fat" | "lr" | "snf">, specs: HandoverSpecs): SpecFlag[] {
  const flags: SpecFlag[] = [];
  if (line.fat != null && line.fat < specs.minFat) flags.push({ chillerNo: line.chillerNo, field: "fat", value: line.fat, min: specs.minFat });
  if (line.lr != null && line.lr < specs.minLr) flags.push({ chillerNo: line.chillerNo, field: "lr", value: line.lr, min: specs.minLr });
  if (line.snf != null && line.snf < specs.minSnf) flags.push({ chillerNo: line.chillerNo, field: "snf", value: line.snf, min: specs.minSnf });
  return flags;
}

export function specFlagText(flag: SpecFlag): string {
  const name = flag.field === "fat" ? "FAT" : flag.field === "lr" ? "LR" : "SNF";
  return `Chiller ${flag.chillerNo}: ${name} ${flag.value} — min ${flag.min}`;
}

export function grossTotal(lines: { grossL: number }[]): number {
  return roundTo(lines.reduce((s, l) => s + l.grossL, 0), 3);
}

/**
 * Adjusted ka total tabhi jab har miqdar wali qatar par adjusted likha ho.
 * Aadha jama jhoot hota hai — wahan null, sifar nahi.
 */
export function adjustedTotal(lines: { grossL: number; adjustedL: number | null }[]): number | null {
  const withMilk = lines.filter((l) => l.grossL > 0);
  if (withMilk.length === 0) return null;
  if (withMilk.some((l) => l.adjustedL == null)) return null;
  return roundTo(withMilk.reduce((s, l) => s + (l.adjustedL ?? 0), 0), 3);
}

/**
 * Lab ka andaza. Formula settings ke baghair nahi — 0.805 khud se nahi.
 * SNF khali ho aur LR+FAT hon to SNF ka andaza. Adjusted hamesha andaza,
 * tabhi jab FAT aur (SNF ya LR) hon.
 */
export function suggestLab(
  gross: number,
  fat: number | null,
  lr: number | null,
  snf: number | null,
  formula: LabFormula | null
): { snf: number | null; adjusted: number | null } {
  if (!formula || !(formula.referenceTs > 0) || !(gross > 0) || fat == null || !(fat > 0)) {
    return { snf: null, adjusted: null };
  }
  if (snf != null && snf > 0) {
    const ts = roundTo(fat + snf, 2);
    return { snf: null, adjusted: roundTo(gross * (ts / formula.referenceTs), 2) };
  }
  if (lr != null && lr > 0) {
    const snfGuess = roundTo(lr / 4 + fat * 0.2 + formula.snfConstant, 2);
    const ts = roundTo(fat + snfGuess, 2);
    return { snf: snfGuess, adjusted: roundTo(gross * (ts / formula.referenceTs), 2) };
  }
  return { snf: null, adjusted: null };
}

export function formatQty(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "—";
  return Number(n).toLocaleString("en-PK", { maximumFractionDigits: 3 });
}
