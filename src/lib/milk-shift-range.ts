/**
 * Slip ki shift range. Ek slip mein kai (tareekh, shift) ho sakte hain.
 * Pure: database nahi chhoota. Tareekh YYYY-MM-DD, shift morning ya evening.
 */

export type RangeShift = "morning" | "evening";

export interface ShiftSlot {
  date: string;
  shift: RangeShift;
}

export type ShiftPreset = "evening_to_morning" | "morning_to_evening" | "morning" | "evening";

export const SHIFT_PRESETS: { key: ShiftPreset; label: string }[] = [
  { key: "evening_to_morning", label: "Shaam → agli subah (kal ki shaam se aaj ki subah)" },
  { key: "morning_to_evening", label: "Subah → shaam (aaj)" },
  { key: "morning", label: "Subah (aaj)" },
  { key: "evening", label: "Shaam (aaj)" },
];

function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Do shift slots ke beech ki saari shifts, shuru se akhir tak (dono shamil). */
export function slotsBetween(from: ShiftSlot, to: ShiftSlot): ShiftSlot[] {
  const order = (s: ShiftSlot) => s.date + (s.shift === "morning" ? "0" : "1");
  if (order(from) > order(to)) return [];
  const out: ShiftSlot[] = [];
  let date = from.date;
  let shift: RangeShift = from.shift;
  for (let guard = 0; guard < 400; guard++) {
    out.push({ date, shift });
    if (date === to.date && shift === to.shift) break;
    if (shift === "morning") {
      shift = "evening";
    } else {
      shift = "morning";
      date = addDays(date, 1);
    }
  }
  return out;
}

/** Preset se shuru aur akhir, aaj ki tareekh (today) ke hisaab se. */
export function presetRange(preset: ShiftPreset, today: string): { from: ShiftSlot; to: ShiftSlot } {
  switch (preset) {
    case "evening_to_morning":
      return { from: { date: addDays(today, -1), shift: "evening" }, to: { date: today, shift: "morning" } };
    case "morning_to_evening":
      return { from: { date: today, shift: "morning" }, to: { date: today, shift: "evening" } };
    case "morning":
      return { from: { date: today, shift: "morning" }, to: { date: today, shift: "morning" } };
    case "evening":
      return { from: { date: today, shift: "evening" }, to: { date: today, shift: "evening" } };
  }
}

export interface RangeTotalInput {
  entryDate: string;
  shift: RangeShift;
  chillerNo: string;
  grossL: number;
  fat: number | null;
  lr: number | null;
}

export interface ChillerRangeRow {
  chillerNo: string;
  grossL: number;
  fat: number | null;
  lr: number | null;
  shifts: number;
}

/**
 * Range ki shifts ka jama: har chiller ka gross jama, aur FAT, LR gross ke wazan se.
 * Jis chiller ka koi total range mein nahi, uski qatar shifts 0 aur gross 0 hogi.
 */
export function aggregateRange(rows: RangeTotalInput[], slots: ShiftSlot[], chillerNames: string[]): ChillerRangeRow[] {
  const inRange = new Set(slots.map((s) => `${s.date}|${s.shift}`));
  return chillerNames.map((name) => {
    const hits = rows.filter((r) => r.chillerNo === name && inRange.has(`${r.entryDate}|${r.shift}`));
    const grossL = Math.round(hits.reduce((s, r) => s + r.grossL, 0) * 1000) / 1000;
    const weigh = (pick: (r: RangeTotalInput) => number | null) => {
      const usable = hits.filter((r) => pick(r) != null && r.grossL > 0);
      const w = usable.reduce((s, r) => s + r.grossL, 0);
      if (w === 0) return null;
      return Math.round((usable.reduce((s, r) => s + (pick(r) as number) * r.grossL, 0) / w) * 100) / 100;
    };
    return { chillerNo: name, grossL, fat: weigh((r) => r.fat), lr: weigh((r) => r.lr), shifts: hits.length };
  });
}
