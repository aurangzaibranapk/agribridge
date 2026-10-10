/**
 * P&L dashboard ki pure logic (migration 526 ke SQL ka TypeScript aaina).
 * Grouping yahan aur SQL mein ek jaisi rakhein; tests: npm run test:pnl
 */
export type PnlKind = "revenue" | "cogs" | "expense" | "stock_adjustment";
export type PnlLine = { account_code: string; amount: number; source_module?: string | null };

export const DEPARTMENTS = ["Karyana POS", "Agri", "Grain", "Milk/Dairy", "Rent/Other"] as const;

export function pnlDepartment(module: string | null | undefined): string {
  if (!module) return "Rent/Other";
  if (module.startsWith("grain")) return "Grain";
  if (module.startsWith("milk") || module.startsWith("dairy")) return "Milk/Dairy";
  if (module.startsWith("agri") || module === "farmer_credit" || module === "branch_credit") return "Agri";
  if (module.startsWith("pos") || module.startsWith("stock_") || ["reconciliation", "load_bill", "customer_udhaar"].includes(module)) return "Karyana POS";
  return "Rent/Other";
}

export function pnlExpenseGroup(code: string): string | null {
  if (code === "6000" || code === "6015") return "Staff";
  if (["6010", "6020", "6050"].includes(code)) return "Vehicle & Fuel";
  if (code === "6030" || code === "6040") return "Rent & Utilities";
  if (code >= "6100" && code <= "6130") return "Losses & Differences";
  if (code >= "6200" && code <= "6220") return "Assets";
  if (code.startsWith("6")) return "Other";
  return null;
}

export function pnlKind(code: string): PnlKind | null {
  if (code.startsWith("4")) return "revenue";
  if (code.startsWith("5")) return "cogs";
  if (code === "6110") return "stock_adjustment";
  if (code.startsWith("6")) return "expense";
  return null;
}

/** Ledger line (debit/credit) ko P&L amount mein badalna. */
export function lineAmount(code: string, debit: number, credit: number): number {
  return code.startsWith("4") ? credit - debit : debit - credit;
}

const r2 = (n: number) => Math.round(n * 100) / 100;

export type PnlSummary = {
  revenue: number; cogs: number; gross_profit: number; operating_expenses: number;
  stock_adjustments: number; total_expenses: number; net_profit: number;
};

export function summarize(lines: PnlLine[]): PnlSummary {
  let revenue = 0, cogs = 0, opx = 0, adj = 0;
  for (const l of lines) {
    const k = pnlKind(l.account_code);
    if (k === "revenue") revenue += l.amount;
    else if (k === "cogs") cogs += l.amount;
    else if (k === "expense") opx += l.amount;
    else if (k === "stock_adjustment") adj += l.amount;
  }
  return {
    revenue: r2(revenue), cogs: r2(cogs), gross_profit: r2(revenue - cogs), operating_expenses: r2(opx),
    stock_adjustments: r2(adj), total_expenses: r2(opx + adj), net_profit: r2(revenue - cogs - opx - adj),
  };
}

export function pctChange(current: number, previous: number): number | null {
  if (!previous) return null;
  return Math.round(((current - previous) / Math.abs(previous)) * 1000) / 10;
}

export function marginPct(revenue: number, profit: number): number | null {
  return revenue ? Math.round((profit / revenue) * 1000) / 10 : null;
}

export function costAbovePrice(line: { subtotal: number; line_cogs: number | null }): boolean {
  return Number(line.line_cogs ?? 0) > Number(line.subtotal);
}

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export type RangeKey = "this_month" | "last_month" | "this_year" | "custom";

export function resolveRange(key: string | undefined, now: Date, from?: string, to?: string): { key: RangeKey; from: string; to: string; grain: "day" | "month" } {
  const y = now.getFullYear(), m = now.getMonth();
  if (key === "last_month") return { key, from: iso(new Date(y, m - 1, 1)), to: iso(new Date(y, m, 0)), grain: "day" };
  if (key === "this_year") return { key, from: iso(new Date(y, 0, 1)), to: iso(now), grain: "month" };
  if (key === "custom" && from && to && /^\d{4}-\d{2}-\d{2}$/.test(from) && /^\d{4}-\d{2}-\d{2}$/.test(to) && from <= to) {
    const days = (Date.parse(to) - Date.parse(from)) / 86400000;
    return { key, from, to, grain: days > 62 ? "month" : "day" };
  }
  return { key: "this_month", from: iso(new Date(y, m, 1)), to: iso(now), grain: "day" };
}

/** Previous period: usi lambai ka, `from` se pehle (SQL fn_pnl_summary jaisa). */
export function previousRange(from: string, to: string): { from: string; to: string } {
  const f = Date.parse(from + "T00:00:00Z"), t = Date.parse(to + "T00:00:00Z");
  const len = Math.round((t - f) / 86400000) + 1;
  const d = (ms: number) => new Date(ms).toISOString().slice(0, 10);
  return { from: d(f - len * 86400000), to: d(f - 86400000) };
}

export function toCsv(rows: (string | number | null)[][]): string {
  return rows.map((r) => r.map((c) => {
    const s = c == null ? "" : String(c);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }).join(",")).join("\n");
}

/** Missing migration ka error pehchaanna (function/view na mile). */
export function isMissingMigrationError(err: { code?: string; message?: string } | null | undefined): boolean {
  if (!err) return false;
  return err.code === "PGRST202" || err.code === "42883" || err.code === "42P01" || err.code === "PGRST205" ||
    /could not find the function|does not exist|schema cache/i.test(err.message ?? "");
}
