export interface ShiftRow {
  shift: string | null;
  liters: number;
  amount: number | null;
}

export interface ShiftTotals {
  morningLiters: number;
  morningAmount: number;
  eveningLiters: number;
  eveningAmount: number;
}

function isMorning(shift: string | null): boolean {
  const s = String(shift ?? "").toLowerCase();
  return s === "morning" || s === "am" || s === "subah";
}

export function shiftTotals(rows: ShiftRow[]): ShiftTotals {
  const totals: ShiftTotals = { morningLiters: 0, morningAmount: 0, eveningLiters: 0, eveningAmount: 0 };
  for (const row of rows) {
    const morning = isMorning(row.shift);
    if (morning) {
      totals.morningLiters += row.liters;
      totals.morningAmount += row.amount ?? 0;
    } else {
      totals.eveningLiters += row.liters;
      totals.eveningAmount += row.amount ?? 0;
    }
  }
  const round = (n: number) => Math.round(n * 100) / 100;
  return {
    morningLiters: round(totals.morningLiters),
    morningAmount: round(totals.morningAmount),
    eveningLiters: round(totals.eveningLiters),
    eveningAmount: round(totals.eveningAmount),
  };
}
