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
