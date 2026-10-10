/** Grain dashboard drill-down: pure helpers (filter, group, CSV). Additive, no DB writes. */
export const KG_PER_MAUND = 40;

export const DRILL_VIEWS = ["purchases", "sales", "payments", "payable", "receivable", "expenses", "profit", "stock"] as const;
export type DrillView = (typeof DRILL_VIEWS)[number];
export const DRILL_TITLES: Record<DrillView, { ur: string; en: string }> = {
  purchases: { ur: "Kharidari ka statement", en: "Purchase statement" },
  sales: { ur: "Bikri ka statement", en: "Sale statement" },
  payments: { ur: "Adaigiyan", en: "Payments made" },
  payable: { ur: "Dena (party war)", en: "Payable by party" },
  receivable: { ur: "Lena (kharidar war)", en: "Receivable by buyer" },
  expenses: { ur: "Kharche", en: "Expenses" },
  profit: { ur: "Munafa (har saude ka)", en: "Profit per trade" },
  stock: { ur: "Godam ka maal", en: "Stock batches" },
};
export function parseDrillView(v: unknown): DrillView | null {
  return (DRILL_VIEWS as readonly string[]).includes(String(v)) ? (v as DrillView) : null;
}

export interface DrillFilter { from?: string | null; to?: string | null; q?: string | null; crop?: string | null }
export function drillHref(view: DrillView, f: DrillFilter = {}): string {
  const p = new URLSearchParams({ view });
  for (const k of ["from", "to", "q", "crop"] as const) if (f[k]) p.set(k, String(f[k]));
  return `/admin/grain-procurement/details?${p.toString()}`;
}

export interface PurchaseRow {
  id: string; date: string; billNo: string; party: string; partyType: "farmer" | "party"; partyId: string | null;
  crop: string; grossKg: number; cutKg: number; netKg: number; rate: number; amount: number; paid: number; balance: number;
}
export interface SaleRow {
  id: string; date: string; billNo: string; buyer: string; customerId: string | null; crop: string; kg: number;
  rate: number; amount: number; received: number; balance: number; cogs: number; profit: number;
}

const r2 = (n: number) => Math.round(n * 100) / 100;
export const toMaund = (kg: number) => r2(kg / KG_PER_MAUND);

/** Party-level paid is spread over its bills oldest-first (FIFO) so each bill gets paid/balance. */
export function allocatePayments<T extends { id: string; date: string; partyKey: string; amount: number }>(
  bills: T[], paidByParty: Record<string, number>,
): Record<string, number> {
  const left = { ...paidByParty };
  const out: Record<string, number> = {};
  for (const b of [...bills].sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id))) {
    const avail = Math.max(0, left[b.partyKey] ?? 0);
    const pay = Math.min(avail, b.amount);
    out[b.id] = r2(pay);
    left[b.partyKey] = avail - pay;
  }
  return out;
}

export function inRange(date: string | null | undefined, f: DrillFilter): boolean {
  const d = (date ?? "").slice(0, 10);
  if (f.from && d < f.from) return false;
  if (f.to && d > f.to) return false;
  return true;
}
export function matchesSearch(values: unknown[], q?: string | null): boolean {
  const s = (q ?? "").trim().toLowerCase();
  if (!s) return true;
  return values.some(v => String(v ?? "").toLowerCase().includes(s));
}
export function filterPurchases(rows: PurchaseRow[], f: DrillFilter): PurchaseRow[] {
  return rows.filter(r => inRange(r.date, f) && (!f.crop || r.crop === f.crop) && matchesSearch([r.billNo, r.party, r.crop], f.q));
}
export function filterSales(rows: SaleRow[], f: DrillFilter): SaleRow[] {
  return rows.filter(r => inRange(r.date, f) && (!f.crop || r.crop === f.crop) && matchesSearch([r.billNo, r.buyer, r.crop], f.q));
}

export interface PartyBalance { key: string; name: string; billed: number; settled: number; balance: number; count: number }
function group<T>(rows: T[], key: (r: T) => string, name: (r: T) => string, billed: (r: T) => number, settled: (r: T) => number): PartyBalance[] {
  const m = new Map<string, PartyBalance>();
  for (const r of rows) {
    const k = key(r);
    const g = m.get(k) ?? { key: k, name: name(r), billed: 0, settled: 0, balance: 0, count: 0 };
    g.billed = r2(g.billed + billed(r)); g.settled = r2(g.settled + settled(r)); g.balance = r2(g.billed - g.settled); g.count++;
    m.set(k, g);
  }
  return [...m.values()].sort((a, b) => b.balance - a.balance);
}
export const payableByParty = (rows: PurchaseRow[]) =>
  group(rows, r => `${r.partyType}:${r.partyId ?? r.party}`, r => r.party, r => r.amount, r => r.paid);
export const receivableByBuyer = (rows: SaleRow[]) =>
  group(rows, r => r.customerId ? `cu:${r.customerId}` : `b:${r.buyer}`, r => r.buyer, r => r.amount, r => r.received);

export function totals<T>(rows: T[], keys: (keyof T)[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const k of keys) out[String(k)] = r2(rows.reduce((s, r) => s + Number(r[k] ?? 0), 0));
  return out;
}

export function csvCell(v: unknown): string {
  const s = v == null ? "" : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
export function toCsv(headers: string[], rows: unknown[][]): string {
  return [headers, ...rows].map(r => r.map(csvCell).join(",")).join("\r\n");
}
