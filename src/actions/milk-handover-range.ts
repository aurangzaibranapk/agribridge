"use server";

import { createClient } from "@/lib/supabase/server";
import { aggregateRange, slotsBetween, type RangeShift, type ChillerRangeRow } from "@/lib/milk-shift-range";

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const SHIFTS: RangeShift[] = ["morning", "evening"];

/**
 * Slip ke daure ke liye har master chiller ka gross, FAT, LR. Shuru aur akhir
 * (tareekh + shift) ke beech ki saari shifts ka jama. Khali data = shifts 0.
 */
export async function lookupRangeStock(
  branchId: string,
  fromDate: string,
  fromShift: string,
  toDate: string,
  toShift: string
): Promise<{ rows: ChillerRangeRow[]; error: string | null }> {
  if (!/^[0-9a-f-]{36}$/i.test(branchId)) return { rows: [], error: "Branch sahi nahi." };
  if (!DATE.test(fromDate) || !DATE.test(toDate)) return { rows: [], error: "Tareekh sahi nahi." };
  if (!SHIFTS.includes(fromShift as RangeShift) || !SHIFTS.includes(toShift as RangeShift)) {
    return { rows: [], error: "Shift sahi nahi." };
  }
  const slots = slotsBetween(
    { date: fromDate, shift: fromShift as RangeShift },
    { date: toDate, shift: toShift as RangeShift }
  );
  if (slots.length === 0) return { rows: [], error: "Akhir shuru se pehle nahi ho sakti." };

  const db = createClient() as any;
  const { data: masters, error: masterErr } = await db
    .from("milk_chiller_master")
    .select("name")
    .eq("branch_id", branchId)
    .eq("is_active", true)
    .order("sort_no");
  if (masterErr) return { rows: [], error: "Chiller ki list nahi mili (737)." };
  const names = ((masters ?? []) as { name: string }[]).map((m) => m.name);

  const { data: totals, error } = await db
    .from("milk_chiller_totals")
    .select("entry_date, shift, chiller_no, gross_liters, fat_percentage, lr")
    .eq("branch_id", branchId)
    .gte("entry_date", fromDate)
    .lte("entry_date", toDate)
    .limit(5000);
  if (error) return { rows: [], error: "Chiller totals nahi mile." };

  const rows = ((totals ?? []) as any[]).map((t) => ({
    entryDate: t.entry_date as string,
    shift: t.shift as RangeShift,
    chillerNo: t.chiller_no as string,
    grossL: Number(t.gross_liters),
    fat: t.fat_percentage == null ? null : Number(t.fat_percentage),
    lr: t.lr == null ? null : Number(t.lr),
  }));
  return { rows: aggregateRange(rows, slots, names), error: null };
}
