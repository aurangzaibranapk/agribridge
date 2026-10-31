/**
 * Milk Handover Certificate — hisaab, nishan, aur form ki qatarein.
 *
 * Gross litre staff likhta hai. Lactometer LR raw rehta hai.
 * Company form ki recipe 20°C hai. Vendor form ki recipe 22°C hai.
 * Party form par staff 20 ya 22 chunte hain — lock nahi.
 * Party ka default 20°C hai: teesri party ko achha doodh bhi ja sakta hai,
 * is liye vendor wali sakht chart khud nahi lagti. Slip par wahi recipe
 * likhi hoti hai jo us delivery par chuni gayi.
 * Vendor 22°C wahi 3°C bands hain, ek point kam (sakht).
 * 32°C par company +4 (LR 28), vendor +3 (LR 27).
 * 20 ya neeche (vendor par 23 ya neeche jab company sirf +1 ho): points 0,
 * minus nahi. 40°C se upar company +7 par rukta hai.
 * Settings na hon, ya purana default 0.805 ho, to handover SNF constant
 * 0.806 aur reference TS 13 — phone "Milk TS% Volume" ke teen hisse.
 * Kisan ki adaigi alag rehti hai (calculateMilkValue, 2 hisse).
 * Min spec se neeche = nishan, rok nahi. LR ka nishan 20°C wale adad par.
 */

import { calculatePhoneMilkLab, roundLab3 } from "@/lib/utils/milk-formula";

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

/**
 * Phone paper: snf constant 0.806, reference TS 13.
 * Migration 053 ka column default 0.805 tha. 729 naya default 0.806 karti hai
 * magar maujooda Live qatar (0.805) UPDATE nahi karti — kisan ki adaigi
 * fn_apply_milk_fat usi qatar par rehti hai. Handover 0.805 ko purana
 * paper default maanta hai aur phone wala 0.806 lagata hai. Koi aur
 * constant (maslan 0.72) Owner ka irada hai, wahi chalta hai.
 */
export const LEGACY_SNF_CONSTANT = 0.805;
export const PHONE_SNF_CONSTANT = 0.806;
export const PAPER_FORMULA: LabFormula = { snfConstant: PHONE_SNF_CONSTANT, referenceTs: 13 };

export function isLegacyPaperSnf(stored: number): boolean {
  return Number.isFinite(stored) && Math.abs(stored - LEGACY_SNF_CONSTANT) < 1e-9;
}

/** Handover ka constant. 0.805 purana default hai, phone override nahi. */
export function handoverSnfConstant(stored: number): number {
  if (isLegacyPaperSnf(stored)) return PHONE_SNF_CONSTANT;
  return stored;
}

export function resolveLabFormula(formula: LabFormula | null | undefined): LabFormula {
  if (
    formula &&
    Number.isFinite(formula.snfConstant) &&
    Number.isFinite(formula.referenceTs) &&
    formula.referenceTs > 0
  ) {
    return formula;
  }
  return PAPER_FORMULA;
}

/** Rate settings se sirf SNF constant aur reference TS. Rate khali ho to bhi. */
export function formulaFromRateRow(row: {
  snf_constant?: number | string | null;
  reference_ts?: number | string | null;
} | null | undefined): LabFormula {
  if (
    row &&
    row.snf_constant != null &&
    String(row.snf_constant).trim() !== "" &&
    row.reference_ts != null &&
    String(row.reference_ts).trim() !== ""
  ) {
    return resolveLabFormula({
      snfConstant: handoverSnfConstant(Number(row.snf_constant)),
      referenceTs: Number(row.reference_ts),
    });
  }
  return PAPER_FORMULA;
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
      snf: snf == null ? null : roundTo(snf, 3),
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
  return roundLab3(fat + snf);
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
  const name = flag.field === "fat" ? "FAT" : flag.field === "lr" ? "LR (corrected)" : "SNF";
  return `Chiller ${flag.chillerNo}: ${name} ${flag.value} — min ${flag.min}`;
}

/** 20 = company agreement. 22 = vendor, ek point sakht. Form ki default 20. */
export type LrBaseline = 20 | 22;

export const DEFAULT_LR_BASELINE: LrBaseline = 20;

export function parseLrBaseline(value: unknown): LrBaseline {
  return Number(value) === 22 ? 22 : 20;
}

export function lrRecipeLabel(baseline: LrBaseline): string {
  return baseline === 22 ? "vendor 22°C" : "company agreement 20°C";
}

/** Teen alag handover. Ek mixed form nahi. */
export type HandoverDestination = "company" | "vendor" | "party";

/**
 * Party default 20°C (company agreement).
 * Teesri party ko becha ya diya hua achha doodh bhi hota hai — spoil sirf
 * optional wajah hai. Vendor ki 22°C chart us par khud nahi chadhni chahiye.
 * Staff usi slip par 22 chun sakte hain. Slip `lr_baseline` sambhalti hai.
 * Company hamesha 20. Vendor hamesha 22.
 */
export const PARTY_LR_DEFAULT: LrBaseline = 20;

export function parseDestination(value: unknown): HandoverDestination | null {
  const raw = String(value ?? "").trim().toLowerCase();
  if (raw === "company" || raw === "vendor" || raw === "party") return raw;
  return null;
}

export function baselineForDestination(destination: HandoverDestination, chosen?: LrBaseline | null): LrBaseline {
  if (destination === "vendor") return 22;
  if (destination === "company") return 20;
  return chosen === 22 ? 22 : PARTY_LR_DEFAULT;
}

/** Raseed lag chuki ho to jo recipe mehfooz hai wahi dikhao. Warna form ki recipe. */
export function initialBaseline(destination: HandoverDestination, saved: LrBaseline | null | undefined, locked: boolean): LrBaseline {
  if (locked) return saved === 22 ? 22 : baselineForDestination(destination, saved);
  return baselineForDestination(destination, destination === "party" ? saved : null);
}

export type HandoverReason = "sale" | "given" | "spoil" | "other";

export function parseHandoverReason(value: unknown): HandoverReason | null | "invalid" {
  const raw = String(value ?? "").trim().toLowerCase();
  if (!raw) return null;
  if (raw === "sale" || raw === "given" || raw === "spoil" || raw === "other") return raw;
  return "invalid";
}

export function handoverReasonLabel(reason: HandoverReason): string {
  if (reason === "sale") return "Bechna (sale)";
  if (reason === "given") return "De diya (given)";
  if (reason === "spoil") return "Kharab (spoil)";
  return "Aur wajah (other)";
}

export function destinationShareLine(destination: HandoverDestination, partyName?: string | null): string {
  if (destination === "vendor") return "Manzil: Vendor";
  if (destination === "party") {
    const name = partyName?.trim();
    return name ? `Manzil: Party — ${name}` : "Manzil: Party";
  }
  return "Manzil: Company";
}

export function handoverSlipTitle(destination: HandoverDestination, partyName?: string | null): string {
  if (destination === "vendor") return "Milk Handover — Vendor";
  if (destination === "party") {
    const name = partyName?.trim();
    return name ? `Milk Handover — Party: ${name}` : "Milk Handover — Party";
  }
  return "Milk Handover — Company";
}

/**
 * Company 20°C bands, 3°C wide, upper edge included:
 * (20, 23] +1 … (29, 32] +4 … (38, 40] +7. Us se garam +7.
 * 20 ya neeche: 0. Thanda doodh par minus nahi.
 */
function companyLrPoints(tempC: number): number {
  if (!Number.isFinite(tempC) || !(tempC > 20)) return 0;
  if (tempC <= 23) return 1;
  if (tempC <= 26) return 2;
  if (tempC <= 29) return 3;
  if (tempC <= 32) return 4;
  if (tempC <= 35) return 5;
  if (tempC <= 38) return 6;
  return 7;
}

/**
 * Vendor 22°C: wahi bands, counting ek point baad se — company se 1 kam,
 * sifar se neeche nahi. 32°C par +3 (company +4).
 */
export function lrCorrectionPoints(tempC: number, baseline: LrBaseline = DEFAULT_LR_BASELINE): number {
  const company = companyLrPoints(tempC);
  if (baseline === 22) return Math.max(0, company - 1);
  return company;
}

export interface LrCorrection {
  raw: number;
  points: number;
  corrected: number;
  tempMissing: boolean;
  /** Chart 40°C par khatam. Us se garam doodh +7 par rehta hai. */
  capped: boolean;
}

export function lrCorrection(raw: number | null, tempC: number | null, baseline: LrBaseline = DEFAULT_LR_BASELINE): LrCorrection | null {
  if (raw == null || !Number.isFinite(raw) || !(raw > 0)) return null;
  const tempMissing = tempC == null || !Number.isFinite(tempC);
  const points = tempMissing ? 0 : lrCorrectionPoints(tempC, baseline);
  return {
    raw,
    points,
    corrected: roundTo(raw + points, 2),
    tempMissing,
    capped: !tempMissing && (tempC as number) > 40,
  };
}

/** Staff ke LR khane ke neeche. Temperature khali ho to null — alag jumla. */
export function lrCorrectionLabel(raw: number | null, tempC: number | null, baseline: LrBaseline = DEFAULT_LR_BASELINE): string | null {
  const view = lrCorrection(raw, tempC, baseline);
  if (!view || view.tempMissing) return null;
  const name = lrRecipeLabel(baseline);
  if (view.points === 0) return `${name} +0`;
  const text = `${name}: ${formatQty(view.raw)}+${view.points}=${formatQty(view.corrected)}`;
  return view.capped ? `${text} (40°C tak)` : text;
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
 * Aaya (MCC gross) aur gaya (company raseed).
 * Farq = aaya − gaya. Positive nuqsan, negative faida.
 * Raseed na ho to farq null — sifar nahi. Wahi shortage_liters ka qanoon.
 * Adjusted tabhi jab har miqdar wali qatar par adjusted ho.
 */
export interface MilkVariance {
  grossL: number;
  adjustedL: number | null;
  receivedL: number | null;
  grossGapL: number | null;
  adjustedGapL: number | null;
}

export function milkVariance(grossL: number, adjustedL: number | null, receivedL: number | null): MilkVariance {
  return {
    grossL: roundTo(grossL, 3),
    adjustedL: adjustedL == null ? null : roundTo(adjustedL, 3),
    receivedL: receivedL == null ? null : roundTo(receivedL, 3),
    grossGapL: receivedL == null ? null : roundTo(grossL - receivedL, 3),
    adjustedGapL: receivedL == null || adjustedL == null ? null : roundTo(adjustedL - receivedL, 3),
  };
}

export type GapKind = "pending" | "even" | "loss" | "gain";

export function gapKind(gap: number | null): GapKind {
  if (gap == null) return "pending";
  const g = roundTo(gap, 3);
  if (g === 0) return "even";
  return g > 0 ? "loss" : "gain";
}

/** Din ka jama. Koi raseed khali ho to din ka gaya aur farq null. */
export function dayMilkVariance(rows: { grossL: number; adjustedL: number | null; receivedL: number | null }[]): MilkVariance & {
  receiptPending: number;
  shifts: number;
} {
  const grossL = roundTo(rows.reduce((sum, row) => sum + row.grossL, 0), 3);
  const receiptPending = rows.filter((row) => row.receivedL == null).length;
  const adjustedL = rows.some((row) => row.adjustedL == null)
    ? null
    : roundTo(rows.reduce((sum, row) => sum + (row.adjustedL ?? 0), 0), 3);
  const receivedL = receiptPending > 0 ? null : roundTo(rows.reduce((sum, row) => sum + (row.receivedL ?? 0), 0), 3);
  return { ...milkVariance(grossL, adjustedL, receivedL), receiptPending, shifts: rows.length };
}

export interface RouteIntake {
  routeName: string;
  receivedL: number | null;
}

export interface IntakeEntry {
  source: string;
  routeName: string | null;
  liters: number;
}

export interface ChillerIntake {
  /** null = chiller intake darj nahi, ya adhuri hai. Sifar nahi. */
  inL: number | null;
  incomplete: boolean;
  status: "none" | "partial" | "ok";
}

/**
 * MCC chiller ka aana: route ki chiller raseed + khud laya hua doodh.
 * Maidan ka litre chiller ka litre nahi. Koi route ki raseed khali ho
 * to jama null — adhura jama sifar ki tarah nahi.
 */
export function chillerIntake(routes: RouteIntake[], entries: IntakeEntry[]): ChillerIntake {
  const self = roundTo(
    entries.filter((entry) => entry.source === "self_delivery").reduce((sum, entry) => sum + entry.liters, 0),
    3
  );
  const fieldRoutes = new Set(
    entries
      .filter((entry) => entry.source !== "self_delivery" && entry.routeName && entry.routeName.trim())
      .map((entry) => entry.routeName as string)
  );
  const byRoute = new Map<string, RouteIntake[]>();
  for (const route of routes) {
    const rows = byRoute.get(route.routeName) ?? [];
    rows.push(route);
    byRoute.set(route.routeName, rows);
  }
  if (routes.length === 0 && fieldRoutes.size === 0 && self === 0) {
    return { inL: null, incomplete: false, status: "none" };
  }
  if (routes.some((route) => route.receivedL == null)) {
    return { inL: null, incomplete: true, status: "partial" };
  }
  for (const name of fieldRoutes) {
    const rows = byRoute.get(name) ?? [];
    if (rows.length === 0) return { inL: null, incomplete: true, status: "partial" };
  }
  const received = routes.reduce((sum, route) => sum + (route.receivedL ?? 0), 0);
  return { inL: roundTo(received + self, 3), incomplete: false, status: "ok" };
}

/**
 * Din ka aaya: chiller ke shift totals ka jama.
 * Koi total darj na ho to null — sifar nahi. Kisan ki alag qatarein yahan nahi.
 * Koi litre kharab (manfi ya adad nahi) ho to jama null, adhura sifar nahi.
 */
export function chillerDayIntake(rows: { grossL: number }[]): ChillerIntake {
  if (rows.length === 0) return { inL: null, incomplete: false, status: "none" };
  if (rows.some((row) => !Number.isFinite(row.grossL) || row.grossL < 0)) {
    return { inL: null, incomplete: true, status: "partial" };
  }
  return {
    inL: roundTo(rows.reduce((sum, row) => sum + row.grossL, 0), 3),
    incomplete: false,
    status: "ok",
  };
}

export interface SlipBucketInput {
  destination: HandoverDestination;
  grossL: number;
  adjustedL: number | null;
  receivedL: number | null;
}

export interface DestinationBucket {
  slipCount: number;
  /** null jab koi slip nahi — fehrist par "koi slip nahi". Farq mein ye 0 litre out hai. */
  grossL: number | null;
  adjustedL: number | null;
  receivedL: number | null;
  receiptPending: number;
}

export interface DayDestinationSummary {
  inL: number | null;
  intakeIncomplete: boolean;
  company: DestinationBucket;
  vendor: DestinationBucket;
  party: DestinationBucket;
  /**
   * Chiller in − (company + vendor + party gross).
   * Jis manzil par slip nahi, us ka out 0. Intake darj na ho to farq null, sifar nahi.
   * Raseed is farq mein shamil nahi — har manzil ki raseed alag rehti hai.
   */
  varianceL: number | null;
}

function destinationBucket(rows: SlipBucketInput[]): DestinationBucket {
  if (rows.length === 0) {
    return { slipCount: 0, grossL: null, adjustedL: null, receivedL: null, receiptPending: 0 };
  }
  const grossL = roundTo(rows.reduce((sum, row) => sum + row.grossL, 0), 3);
  const adjustedL = rows.some((row) => row.adjustedL == null)
    ? null
    : roundTo(rows.reduce((sum, row) => sum + (row.adjustedL ?? 0), 0), 3);
  const receiptPending = rows.filter((row) => row.receivedL == null).length;
  const receivedL = receiptPending > 0 ? null : roundTo(rows.reduce((sum, row) => sum + (row.receivedL ?? 0), 0), 3);
  return { slipCount: rows.length, grossL, adjustedL, receivedL, receiptPending };
}

export function dayDestinationSummary(input: { intake: ChillerIntake; slips: SlipBucketInput[] }): DayDestinationSummary {
  const company = destinationBucket(input.slips.filter((slip) => slip.destination === "company"));
  const vendor = destinationBucket(input.slips.filter((slip) => slip.destination === "vendor"));
  const party = destinationBucket(input.slips.filter((slip) => slip.destination === "party"));
  const out = (company.grossL ?? 0) + (vendor.grossL ?? 0) + (party.grossL ?? 0);
  const varianceL = input.intake.status !== "ok" || input.intake.inL == null ? null : roundTo(input.intake.inL - out, 3);
  return {
    inL: input.intake.inL,
    intakeIncomplete: input.intake.incomplete,
    company,
    vendor,
    party,
    varianceL,
  };
}

export function varianceForCertificate(
  lines: { grossL: number; adjustedL: number | null }[],
  priorGross: number | null,
  receivedL: number | null
): MilkVariance {
  const withMilk = lines.filter((line) => line.grossL > 0);
  const grossL = withMilk.length ? grossTotal(withMilk) : priorGross ?? 0;
  const adjustedL = withMilk.length ? adjustedTotal(withMilk) : null;
  return milkVariance(grossL, adjustedL, receivedL);
}

/**
 * Lab ka andaza. Formula yahan khud nahi banta — certificate
 * resolveLabFormula se 0.806 / 13 bhejta hai jab settings khali hon
 * ya purana 0.805 ho. LR yahan corrected hona chahiye (caller ye kare).
 * Temperature khali ho to raw LR. SNF pehle se ho to sirf adjusted.
 * Teen hisse phone jaisa (ceiling), SNF ko 2 hisse par round karke
 * TS se pehle nahi kaatta.
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
    const tsRaw = fat + snf;
    return { snf: null, adjusted: roundLab3(gross * (tsRaw / formula.referenceTs)) };
  }
  if (lr != null && lr > 0) {
    const phone = calculatePhoneMilkLab(gross, fat, lr, formula.snfConstant, formula.referenceTs);
    return { snf: phone.snf, adjusted: phone.adjustedVolume };
  }
  return { snf: null, adjusted: null };
}

/** Sp. gravity = 1 + LR/1000. Milk kg = gross × wahi ratio. Teen hisse. */
export function milkDensity(lr: number, grossL: number | null): { specificGravity: number; milkKg: number | null } {
  const ratio = 1 + lr / 1000;
  return {
    specificGravity: roundLab3(ratio),
    milkKg: grossL == null ? null : roundLab3(grossL * ratio),
  };
}

export function formatQty(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "—";
  return Number(n).toLocaleString("en-PK", { maximumFractionDigits: 3 });
}

/** SNF, TS, adjusted, SG, kg — hamesha teen hisse, jaise phone. */
export function formatLab(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(Number(n))) return "—";
  return Number(n).toFixed(3);
}

export function labText(n: number): string {
  return roundLab3(n).toFixed(3);
}

function looseNum(raw: string): number | null {
  const text = raw.trim();
  if (!text || !/^-?\d+(\.\d+)?$/.test(text)) return null;
  const n = Number(text);
  return Number.isFinite(n) ? n : null;
}

/**
 * Gross, FAT, raw LR (aur temperature) badlein to SNF aur adjusted
 * corrected LR se bhar jate hain. SNF khud badlein to adjusted usi se.
 * Temperature aur organo nahi chhoote. Adjusted khud likha ho to
 * tab tak rehta hai jab tak ye inputs na badlein.
 */
export function applyAutoLab(
  line: HandoverLineInput,
  formula: LabFormula | null,
  touched: "inputs" | "snf",
  baseline: LrBaseline = DEFAULT_LR_BASELINE
): HandoverLineInput {
  if (touched === "snf" && !line.snf.trim()) return applyAutoLab(line, formula, "inputs", baseline);
  const resolved = resolveLabFormula(formula);
  const gross = looseNum(line.grossL);
  const fat = looseNum(line.fat);
  const rawLr = looseNum(line.lr);
  const temp = looseNum(line.temperatureC);
  const lr = lrCorrection(rawLr, temp, baseline)?.corrected ?? null;

  if (touched === "snf") {
    const snfTyped = looseNum(line.snf);
    if (gross != null && gross > 0 && fat != null && fat > 0 && snfTyped != null && snfTyped > 0) {
      const hint = suggestLab(gross, fat, lr, snfTyped, resolved);
      if (hint.adjusted != null) return { ...line, adjustedL: labText(hint.adjusted) };
    }
    return line;
  }

  if (gross != null && gross > 0 && fat != null && fat > 0 && lr != null && lr > 0) {
    const hint = suggestLab(gross, fat, lr, null, resolved);
    if (hint.snf != null && hint.adjusted != null) {
      return { ...line, snf: labText(hint.snf), adjustedL: labText(hint.adjusted) };
    }
  }
  return line;
}

/** Khali SNF ya adjusted, jab gross+fat+LR hon, form khulte hi bhar dein. Dono bhari hon to na chheiren. */
export function seedAutoLab(
  line: HandoverLineInput,
  formula: LabFormula | null,
  baseline: LrBaseline = DEFAULT_LR_BASELINE
): HandoverLineInput {
  if (line.snf.trim() && line.adjustedL.trim()) return line;
  if (!line.snf.trim()) return applyAutoLab(line, formula, "inputs", baseline);
  return applyAutoLab(line, formula, "snf", baseline);
}

export interface CertificateShareLine {
  chillerNo: string;
  milkType: string;
  grossL: number | null;
  fat: number | null;
  lr: number | null;
  temperatureC: number | null;
  snf: number | null;
  ts: number | null;
  adjustedL: number | null;
  organo: string | null;
}

export interface CertificateShareInput {
  mccName: string;
  date: string;
  time: string;
  shiftLabel: string;
  vehicle: string | null;
  driver: string | null;
  lines: CertificateShareLine[];
  grossTotal: number | null;
  adjustedTotal: number | null;
  accepted: boolean | null;
  rejectionReason: string | null;
  lrBaseline: LrBaseline;
  destination?: HandoverDestination;
  partyName?: string | null;
  handoverReason?: HandoverReason | null;
}

function lrShareBit(raw: number | null, temp: number | null, baseline: LrBaseline): string {
  const view = lrCorrection(raw, temp, baseline);
  const name = lrRecipeLabel(baseline);
  if (!view) return "LR —";
  if (view.tempMissing) return `LR ${formatQty(view.raw)} raw (temp khali, ${name})`;
  if (view.points === 0) return `LR ${formatQty(view.raw)} (${name} +0)`;
  const cap = view.capped ? ", 40°C tak" : "";
  return `LR ${formatQty(view.raw)} raw → ${formatQty(view.corrected)} (${name} +${view.points}${cap})`;
}

function densityShareBit(
  gross: number | null,
  rawLr: number | null,
  temp: number | null,
  baseline: LrBaseline
): string {
  const view = lrCorrection(rawLr, temp, baseline);
  if (!view) return "Sp. Gravity — · Milk kg —";
  const density = milkDensity(view.corrected, gross);
  return `Sp. Gravity ${formatLab(density.specificGravity)} · Milk kg ${formatLab(density.milkKg)}`;
}

/** Slip ka text. Public naam Kisan Pakistan. Jo recipe chuni ho wahi. Rate aur amount is slip par nahi. */
export function certificateShareText(input: CertificateShareInput): string {
  const accepted = input.accepted == null ? "Abhi nahi" : input.accepted ? "YES" : "NO";
  const lines = input.lines.map((line) =>
    [
      `Chiller ${line.chillerNo.trim() || "—"}`,
      line.milkType.trim() || "—",
      `Gross ${formatQty(line.grossL)} L`,
      `FAT ${formatQty(line.fat)}`,
      lrShareBit(line.lr, line.temperatureC, input.lrBaseline),
      `Temp ${formatQty(line.temperatureC)}`,
      `SNF ${formatLab(line.snf)}`,
      `TS ${formatLab(line.ts)}`,
      densityShareBit(line.grossL, line.lr, line.temperatureC, input.lrBaseline),
      `Adjusted ${formatLab(line.adjustedL)} L`,
      `Organo ${line.organo?.trim() || "—"}`,
    ].join(" · ")
  );
  const parts = [
    "Kisan Pakistan",
    "Milk Handover Certificate",
  ];
  if (input.destination) {
    parts.push(destinationShareLine(input.destination, input.partyName));
    if (input.destination === "party" && input.handoverReason) {
      parts.push(`Wajah: ${handoverReasonLabel(input.handoverReason)}`);
    }
  }
  parts.push(
    `MCC: ${input.mccName.trim() || "—"}`,
    `Date: ${input.date} · ${input.shiftLabel}`,
  );
  if (input.time.trim()) parts.push(`Time: ${input.time.trim()}`);
  if (input.vehicle?.trim() || input.driver?.trim()) {
    parts.push(`Vehicle: ${input.vehicle?.trim() || "—"} · Driver: ${input.driver?.trim() || "—"}`);
  }
  parts.push("");
  parts.push(...(lines.length ? lines : ["Koi chiller nahi."]));
  parts.push("");
  parts.push(`Gross total: ${formatQty(input.grossTotal)} L`);
  parts.push(`Adjusted total: ${input.adjustedTotal == null ? "—" : `${formatQty(input.adjustedTotal)} L`}`);
  parts.push(`Accepted: ${accepted}`);
  if (input.accepted === false && input.rejectionReason?.trim()) {
    parts.push(`Rejected: ${input.rejectionReason.trim()}`);
  }
  parts.push(`LR recipe: ${lrRecipeLabel(input.lrBaseline)}`);
  return parts.join("\n");
}

export function certificateEmailSubject(input: { mccName: string; date: string; title?: string }): string {
  const mcc = input.mccName.trim() || "MCC";
  const title = input.title?.trim() || "Milk Handover Certificate";
  return `Kisan Pakistan — ${title} — ${mcc} ${input.date}`;
}

export function certificateShareMessage(text: string, printUrl: string): string {
  return `${text}\n\nPrint: ${printUrl}`;
}

/** Admin, Owner, Super Admin. Manager aur milk staff rate nahi dekhte. */
export const HANDOVER_RATE_ROLES = ["owner", "super_admin", "admin"] as const;

export function canSeeHandoverRate(role: string | null | undefined): boolean {
  return (HANDOVER_RATE_ROLES as readonly string[]).includes(role ?? "");
}

/** Amount = adjusted litre × rate. Adjusted ya rate khali ho to null, sifar nahi. */
export function handoverAmount(adjustedL: number | null, ratePerAdjustedL: number | null): number | null {
  if (adjustedL == null || ratePerAdjustedL == null) return null;
  if (!Number.isFinite(adjustedL) || !Number.isFinite(ratePerAdjustedL) || ratePerAdjustedL < 0) return null;
  return Math.round(adjustedL * ratePerAdjustedL * 100) / 100;
}

/**
 * Din ka amount tabhi jab har certificate par rate ho.
 * Jis par rate nahi, us ko sifar parhna jhoot hai — total null.
 */
export function internalAmountTotal(amounts: (number | null)[]): number | null {
  if (amounts.length === 0) return null;
  let sum = 0;
  for (const amount of amounts) {
    if (amount == null) return null;
    sum += amount;
  }
  return Math.round(sum * 100) / 100;
}

export interface ChillerIdentity {
  chillerNo: string;
  milkType: string;
}

function chillerKey(value: string): string {
  return value.trim().toLowerCase();
}

/** Shift ke naam aur pichli certificate ki identity. Duplicates nahi. Lab khali. */
export function chillerStockRows(previous: ChillerIdentity[], shiftNames: string[]): HandoverLineInput[] {
  const rows: HandoverLineInput[] = [];
  const seen = new Set<string>();
  const push = (chillerNo: string, milkType: string) => {
    const key = chillerKey(chillerNo);
    if (!key || seen.has(key)) return;
    seen.add(key);
    rows.push({ ...emptyLine(), chillerNo: chillerNo.trim(), milkType: milkType.trim() });
  };
  for (const row of previous) push(row.chillerNo, row.milkType);
  for (const name of shiftNames) push(name, "");
  return rows;
}

function lineHasWork(line: HandoverLineInput): boolean {
  return [line.milkType, line.grossL, line.fat, line.lr, line.snf, line.adjustedL, line.temperatureC, line.organo].some(
    (value) => value.trim()
  );
}

/**
 * Nayi certificate par stock ke chiller jor dein.
 * Jo chiller pehle se ho us ki lab qatarein na mitao.
 * Khali form par stock puri jagah le.
 */
export function absorbChillerStock(current: HandoverLineInput[], stock: HandoverLineInput[]): HandoverLineInput[] {
  const named = current.filter((line) => line.chillerNo.trim());
  const untouched = current.every((line) => !line.chillerNo.trim() && !lineHasWork(line));
  if (untouched) return stock.length > 0 ? stock : current;
  const have = new Set(named.map((line) => chillerKey(line.chillerNo)));
  const extra = stock.filter((line) => !have.has(chillerKey(line.chillerNo)));
  if (extra.length === 0) return current;
  const blanks = current.filter((line) => !line.chillerNo.trim() && !lineHasWork(line));
  const kept = current.filter((line) => line.chillerNo.trim() || lineHasWork(line));
  return [...kept, ...extra, ...blanks];
}

/** POS closing slip jaisa: staff ke WhatsApp mein slip ka text. */
export function whatsAppShareHref(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

export function emailShareHref(subject: string, body: string): string {
  return `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

function viewNum(raw: string): number | null {
  const text = raw.trim();
  if (!text) return null;
  const n = Number(text);
  return Number.isFinite(n) ? n : null;
}

/** Saved certificate se slip. Khali pad qatarein bahar. */
export function certificateShareFromInputs(input: {
  mccName: string;
  date: string;
  time: string;
  shiftLabel: string;
  vehicle: string;
  driver: string;
  lines: HandoverLineInput[];
  accepted: "" | "yes" | "no";
  rejectionReason: string;
  grossFallback?: number | null;
  lrBaseline?: LrBaseline;
  destination?: HandoverDestination;
  partyName?: string | null;
  handoverReason?: HandoverReason | null;
}): { text: string; subject: string } {
  const lrBaseline = input.lrBaseline ?? DEFAULT_LR_BASELINE;
  const lines = input.lines
    .map((line) => ({
      chillerNo: line.chillerNo,
      milkType: line.milkType,
      grossL: viewNum(line.grossL),
      fat: viewNum(line.fat),
      lr: viewNum(line.lr),
      temperatureC: viewNum(line.temperatureC),
      snf: viewNum(line.snf),
      adjustedL: viewNum(line.adjustedL),
      organo: line.organo,
    }))
    .filter((line) => line.grossL != null || line.chillerNo.trim() || line.lr != null)
    .map((line) => ({ ...line, ts: tsOf(line.fat, line.snf) }));
  const withGross = lines.filter((line) => line.grossL != null);
  const gross = withGross.length
    ? grossTotal(withGross.map((line) => ({ grossL: line.grossL as number })))
    : input.grossFallback ?? null;
  const adjusted = lines.length
    ? adjustedTotal(lines.map((line) => ({ grossL: line.grossL ?? 0, adjustedL: line.adjustedL })))
    : null;
  return {
    text: certificateShareText({
      mccName: input.mccName,
      date: input.date,
      time: input.time,
      shiftLabel: input.shiftLabel,
      vehicle: input.vehicle || null,
      driver: input.driver || null,
      lines,
      grossTotal: gross,
      adjustedTotal: adjusted,
      accepted: input.accepted === "" ? null : input.accepted === "yes",
      rejectionReason: input.rejectionReason || null,
      lrBaseline,
      destination: input.destination,
      partyName: input.partyName,
      handoverReason: input.handoverReason ?? null,
    }),
    subject: certificateEmailSubject({
      mccName: input.mccName,
      date: input.date,
      title: input.destination ? handoverSlipTitle(input.destination, input.partyName) : undefined,
    }),
  };
}
