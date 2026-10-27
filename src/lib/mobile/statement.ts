import { filterStatement, statementTotals, type StatementRow } from "../portal/khata";

/** Hafta Pakistan mein Somvaar se Itwaar. */
export function karachiWeek(now = new Date()): { start: string; end: string } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Karachi",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  }).formatToParts(now);
  const bag: Record<string, string> = {};
  for (const part of parts) if (part.type !== "literal") bag[part.type] = part.value;
  const weekday = bag.weekday;
  const index: Record<string, number> = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 };
  const back = index[weekday] ?? 0;
  const today = new Date(Date.UTC(Number(bag.year), Number(bag.month) - 1, Number(bag.day)));
  const startDate = new Date(today);
  startDate.setUTCDate(today.getUTCDate() - back);
  const endDate = new Date(startDate);
  endDate.setUTCDate(startDate.getUTCDate() + 6);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return { start: iso(startDate), end: iso(endDate) };
}

export function inWeek(date: string | null, week: { start: string; end: string }): boolean {
  if (!date) return false;
  const day = date.slice(0, 10);
  return day >= week.start && day <= week.end;
}

export interface WeeklyStatement {
  start: string;
  end: string;
  rows: StatementRow[];
  totals: ReturnType<typeof statementTotals>;
  milkLiters: number;
  milkAmount: number;
}

export function weeklyStatement(
  rows: StatementRow[],
  milk: { entry_date?: string | null; at?: string | null; liters: number; amount: number | null }[],
  week: { start: string; end: string }
): WeeklyStatement {
  const doodh = filterStatement(rows, "doodh").filter((row) => row.is_opening || inWeek(row.entry_date, week));
  const body = doodh.filter((row) => !row.is_opening && inWeek(row.entry_date, week));
  const weekMilk = milk.filter((row) => inWeek(row.entry_date ?? row.at ?? null, week));
  return {
    start: week.start,
    end: week.end,
    rows: body,
    totals: statementTotals(doodh),
    milkLiters: Math.round(weekMilk.reduce((sum, row) => sum + row.liters, 0) * 100) / 100,
    milkAmount: Math.round(weekMilk.reduce((sum, row) => sum + (row.amount ?? 0), 0) * 100) / 100,
  };
}
