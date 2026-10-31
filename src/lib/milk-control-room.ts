/**
 * Doodh control room ka hisaab. Sirf dekhne ke liye: ye file database
 * nahi likhti, faisla nahi karti. Page ke liye din bhar ke entries aur
 * dispatches ko shift aur manzil ke hisaab se ginta hai.
 *
 * Aaya / gaya / farq ka hisaab yahan dobara nahi hota; wo
 * loadHandoverDay (milk-handover-page.ts) se aata hai.
 */

export type ControlShift = "morning" | "evening";

export interface ControlEntryRow {
  shift: string | null;
  quantity_liters: number | string | null;
  status: string | null;
}

export interface ControlDispatchRow {
  id: string;
  shift: string | null;
  destination: string | null;
  dispatched_liters: number | string | null;
  received_liters: number | string | null;
  shortage_percentage: number | string | null;
}

export interface ShiftCounts {
  entries: number;
  liters: number;
  pendingFat: number;
  priced: number;
  verified: number;
  rejected: number;
}

export interface ControlSummary {
  byShift: Record<ControlShift, ShiftCounts>;
  total: ShiftCounts;
}

export interface DispatchAlert {
  id: string;
  shift: string | null;
  destination: string | null;
  dispatchedLiters: number;
  shortagePercentage: number | null;
  kind: "raseed_baqi" | "kami";
}

const SHIFTS: ControlShift[] = ["morning", "evening"];

function emptyCounts(): ShiftCounts {
  return { entries: 0, liters: 0, pendingFat: 0, priced: 0, verified: 0, rejected: 0 };
}

function num(value: number | string | null | undefined): number {
  const n = typeof value === "string" ? Number(value) : value;
  return typeof n === "number" && Number.isFinite(n) ? n : 0;
}

function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}

/**
 * Din ke entries ko shift wise ginta hai. Rejected entries bhi ginti mein
 * aati hain, taake manager dekh sake ke kitna doodh radd hua.
 * Shift jo morning ya evening na ho, wo total mein to jaata hai magar kisi
 * shift mein nahi, taake galat shift ka doodh chupke se kisi ek mein na gir jaye.
 */
export function summarizeEntries(rows: ControlEntryRow[]): ControlSummary {
  const byShift: Record<ControlShift, ShiftCounts> = {
    morning: emptyCounts(),
    evening: emptyCounts(),
  };
  const total = emptyCounts();

  for (const row of rows) {
    const liters = num(row.quantity_liters);
    const bucket = SHIFTS.includes(row.shift as ControlShift) ? byShift[row.shift as ControlShift] : null;

    const apply = (c: ShiftCounts) => {
      c.entries += 1;
      c.liters += liters;
      if (row.status === "pending_fat") c.pendingFat += 1;
      else if (row.status === "priced") c.priced += 1;
      else if (row.status === "verified") c.verified += 1;
      else if (row.status === "rejected") c.rejected += 1;
    };

    apply(total);
    if (bucket) apply(bucket);
  }

  for (const c of [total, byShift.morning, byShift.evening]) {
    c.liters = round3(c.liters);
  }

  return { byShift, total };
}

/**
 * Dispatch ki do baatein dikhani hain:
 *  - raseed_baqi: manzil ne abhi tak maal ki raseed nahi likhi
 *  - kami: raseed likhi gayi, aur kuch litre kam aaye (shortage > 0)
 * Koi threshold yahan nahi lagaya: kitni kami "bari" hai, ye malik ka faisla hai.
 */
export function dispatchAlerts(rows: ControlDispatchRow[]): DispatchAlert[] {
  const alerts: DispatchAlert[] = [];
  for (const row of rows) {
    const dispatched = num(row.dispatched_liters);
    if (row.received_liters == null) {
      alerts.push({
        id: row.id,
        shift: row.shift,
        destination: row.destination,
        dispatchedLiters: round3(dispatched),
        shortagePercentage: null,
        kind: "raseed_baqi",
      });
      continue;
    }
    const shortage = num(row.shortage_percentage);
    if (shortage > 0) {
      alerts.push({
        id: row.id,
        shift: row.shift,
        destination: row.destination,
        dispatchedLiters: round3(dispatched),
        shortagePercentage: round3(shortage),
        kind: "kami",
      });
    }
  }
  return alerts;
}

// ---------------------------------------------------------------------------
// Din ki poori tasveer: chiller totals, farmer ka hisaab, company ka hisaab.
// Farmer ki entries (milk_entries) aur chiller ke totals (milk_chiller_totals)
// alag sources hain. Farq wahin dikhta hai jahan dono ka jama mel nahi khata.
// ---------------------------------------------------------------------------

export interface ChillerTotalInput {
  chiller_no: string | null;
  shift: string | null;
  gross_liters: number | string | null;
  fat_percentage: number | string | null;
  lr: number | string | null;
  snf_percentage: number | string | null;
  ts_percentage: number | string | null;
  adjusted_liters: number | string | null;
}

export interface FarmerEntryInput extends ControlEntryRow {
  total_amount: number | string | null;
}

export interface ChillerLine {
  chillerNo: string;
  shift: ControlShift | null;
  grossL: number;
  fat: number | null;
  lr: number | null;
  snf: number | null;
  ts: number | null;
  adjustedL: number | null;
}

export interface DayReport {
  chillers: ChillerLine[];
  chillerTotal: { grossL: number; adjustedL: number; snfAvg: number | null; fatAvg: number | null; count: number };
  farmer: {
    entries: number;
    litersAll: number;
    litersPayable: number;
    payableRs: number;
    pendingFat: number;
    priced: number;
    verified: number;
    rejected: number;
    avgRatePerL: number | null;
  };
  /** Chiller gross − farmer ki entries ke litre (sirf jab dono mojood hon). */
  farmerVsChillerL: number | null;
}

function weightedAvg(rows: { value: number | null; weight: number }[]): number | null {
  const usable = rows.filter((r) => r.value != null && r.weight > 0);
  const w = usable.reduce((s, r) => s + r.weight, 0);
  if (w === 0) return null;
  return round3(usable.reduce((s, r) => s + (r.value as number) * r.weight, 0) / w);
}

/** Subah pehle, shaam baad mein; shift na ho to sab se aakhir mein. */
function shiftOrder(shift: ControlShift | null): number {
  if (shift === "morning") return 0;
  if (shift === "evening") return 1;
  return 2;
}

function nOrNull(value: number | string | null | undefined): number | null {
  if (value == null || value === "") return null;
  const n = typeof value === "string" ? Number(value) : value;
  return Number.isFinite(n) ? n : null;
}

/**
 * Chiller ki har line ko shift ke hisaab se tarteeb deta hai aur
 * kul gross, adjusted aur SNF/FAT ka wazan-wala ausat nikalta hai.
 * Koi chiller ka total na ho to wo qatar NULL ki tarah rahti hai, sifar nahi.
 */
export function buildChillerLines(rows: ChillerTotalInput[]): ChillerLine[] {
  return rows
    .map((r) => ({
      chillerNo: r.chiller_no ?? "—",
      shift: SHIFTS.includes(r.shift as ControlShift) ? (r.shift as ControlShift) : null,
      grossL: round3(num(r.gross_liters)),
      fat: nOrNull(r.fat_percentage),
      lr: nOrNull(r.lr),
      snf: nOrNull(r.snf_percentage),
      ts: nOrNull(r.ts_percentage),
      adjustedL: nOrNull(r.adjusted_liters) == null ? null : round3(num(r.adjusted_liters)),
    }))
    .sort((a, b) => shiftOrder(a.shift) - shiftOrder(b.shift) || a.chillerNo.localeCompare(b.chillerNo));
}

export function buildDayReport(input: {
  chillers: ChillerTotalInput[];
  entries: FarmerEntryInput[];
}): DayReport {
  const chillers = buildChillerLines(input.chillers);
  const grossSum = round3(chillers.reduce((s, c) => s + c.grossL, 0));
  const adjustedSum = round3(chillers.reduce((s, c) => s + (c.adjustedL ?? 0), 0));

  let payableRs = 0;
  let litersPayable = 0;
  let litersAll = 0;
  let pendingFat = 0;
  let priced = 0;
  let verified = 0;
  let rejected = 0;
  for (const e of input.entries) {
    const l = num(e.quantity_liters);
    litersAll += l;
    if (e.status === "pending_fat") pendingFat += 1;
    else if (e.status === "priced") priced += 1;
    else if (e.status === "verified") verified += 1;
    else if (e.status === "rejected") rejected += 1;
    if (e.status === "priced" || e.status === "verified") {
      payableRs += num(e.total_amount);
      litersPayable += l;
    }
  }
  payableRs = Math.round(payableRs * 100) / 100;
  litersAll = round3(litersAll);
  litersPayable = round3(litersPayable);

  return {
    chillers,
    chillerTotal: {
      grossL: grossSum,
      adjustedL: adjustedSum,
      snfAvg: weightedAvg(chillers.map((c) => ({ value: c.snf, weight: c.grossL }))),
      fatAvg: weightedAvg(chillers.map((c) => ({ value: c.fat, weight: c.grossL }))),
      count: chillers.length,
    },
    farmer: {
      entries: input.entries.length,
      litersAll,
      litersPayable,
      payableRs,
      pendingFat,
      priced,
      verified,
      rejected,
      avgRatePerL: litersPayable > 0 ? Math.round((payableRs / litersPayable) * 100) / 100 : null,
    },
    farmerVsChillerL: chillers.length === 0 ? null : round3(grossSum - litersAll),
  };
}
