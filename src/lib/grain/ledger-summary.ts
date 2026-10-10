/**
 * Grain business summary from the general ledger (pure, no DB).
 *
 * An entry is a "grain entry" when its source_module starts with "grain"
 * or it touches a grain-only account (1220 stock, 4010 sales, 5020 purchases).
 *  - Sales (4010)          = credit - debit
 *  - COGS (5020)           = debit - credit (wheat moved to 1220 nets out = stock, not cost)
 *  - Expenses (6xxx)       = debit - credit on grain entries (mazdoori, bardana, chungi, kiraya, nuqsan)
 *  - Receivable (1100)     = debit - credit on grain entries that touch 4010 or are grain_sale* modules
 *  - Payable (2010/2040)   = credit - debit on grain entries
 *  - Wasela amanat (2062)  = credit - debit on ANY entry (wheat advance held in trust), added to payable
 *  - Stock value (1220)    = debit - credit, cumulative up to the "to" date
 * Sales/COGS/Expenses are period figures; receivable, payable, stock are balances as of "to".
 */
export type GrainLedgerLine = {
  entry_id: string;
  entry_date: string; // YYYY-MM-DD
  source_module: string | null;
  account_code: string;
  debit: number | string | null;
  credit: number | string | null;
};

export type GrainSummary = {
  receivable: number;
  payable: number; // farmerPayable + waselaAmanat
  farmerPayable: number;
  waselaAmanat: number;
  sales: number;
  cogs: number;
  grossProfit: number;
  expenses: number;
  netProfit: number;
  stockValue: number;
};

export const GRAIN_ONLY_ACCOUNTS = ["1220", "4010", "5020"] as const;
export const WASELA_AMANAT_ACCOUNT = "2062";
const PAYABLE_ACCOUNTS = new Set(["2010", "2040"]);

const r2 = (n: number) => Math.round(n * 100) / 100;
const num = (v: number | string | null) => Number(v ?? 0) || 0;

export function isGrainModule(m: string | null | undefined): boolean {
  return !!m && m.toLowerCase().startsWith("grain");
}

export function summarizeGrainLedger(lines: GrainLedgerLine[], range: { from?: string | null; to?: string | null } = {}): GrainSummary {
  const from = range.from || null;
  const to = range.to || null;
  const byEntry = new Map<string, GrainLedgerLine[]>();
  for (const l of lines) {
    const arr = byEntry.get(l.entry_id) ?? [];
    arr.push(l);
    byEntry.set(l.entry_id, arr);
  }
  const s = { receivable: 0, payable: 0, wasela: 0, sales: 0, cogs: 0, expenses: 0, stockValue: 0 };
  for (const entryLines of Array.from(byEntry.values())) {
    const first = entryLines[0];
    const date = first.entry_date;
    if (to && date > to) continue;
    for (const l of entryLines) if (l.account_code === WASELA_AMANAT_ACCOUNT) s.wasela += num(l.credit) - num(l.debit);
    const touchesGrain = entryLines.some(l => (GRAIN_ONLY_ACCOUNTS as readonly string[]).includes(l.account_code));
    const grainModule = isGrainModule(first.source_module);
    if (!touchesGrain && !grainModule) continue;
    const saleEntry = entryLines.some(l => l.account_code === "4010") || (first.source_module ?? "").toLowerCase().startsWith("grain_sale");
    const inPeriod = !from || date >= from;
    for (const l of entryLines) {
      const dr = num(l.debit), cr = num(l.credit), code = l.account_code;
      if (code === "1220") s.stockValue += dr - cr;
      else if (code === "1100" && saleEntry) s.receivable += dr - cr;
      else if (PAYABLE_ACCOUNTS.has(code)) s.payable += cr - dr;
      if (!inPeriod) continue;
      if (code === "4010") s.sales += cr - dr;
      else if (code === "5020") s.cogs += dr - cr;
      else if (code.startsWith("6")) s.expenses += dr - cr;
    }
  }
  const grossProfit = s.sales - s.cogs;
  return {
    receivable: r2(s.receivable), payable: r2(s.payable + s.wasela), farmerPayable: r2(s.payable), waselaAmanat: r2(s.wasela), sales: r2(s.sales), cogs: r2(s.cogs),
    grossProfit: r2(grossProfit), expenses: r2(s.expenses), netProfit: r2(grossProfit - s.expenses), stockValue: r2(s.stockValue),
  };
}
