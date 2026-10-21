/** Stock ka nishan (mockup manzoor, 21 Oct): hara / peela / laal. */
export type StockStatus = "ok" | "low" | "out";

export function stockStatus(qty: number | null | undefined, minStock: number | null | undefined): StockStatus {
  const q = Number(qty ?? 0);
  if (!(q > 0)) return "out";
  const m = Number(minStock ?? 0);
  if (m > 0 && q <= m) return "low";
  return "ok";
}

export const STOCK_LABEL: Record<StockStatus, string> = {
  ok: "Stock mein",
  low: "Kam reh gaya",
  out: "Khatam",
};

export function formatStockQty(qty: number | null | undefined, unit?: string | null): string {
  const q = Number(qty ?? 0);
  const n = Number.isInteger(q) ? q.toLocaleString() : q.toLocaleString(undefined, { maximumFractionDigits: 2 });
  return unit ? `${n} ${unit}` : n;
}
