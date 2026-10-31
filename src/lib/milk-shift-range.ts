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
