/** Strict values: never join unrelated digits from malformed CSV cells. */
export function parseBillNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const text = String(value ?? "").trim().replace(/^(?:PKR|Rs\.?)\s*/i, "");
  if (!text || !/^(?:(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d+)?|\.\d+)$/.test(text)) return null;
  const number = Number(text.replace(/,/g, ""));
  return Number.isFinite(number) ? number : null;
}

export const roundBillMoney = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

/** Derived only from this row's quantity and trade rate; product mapping is irrelevant. */
export function purchaseLineTotal(quantity: unknown, tradeRate: unknown): number | null {
  const qty = parseBillNumber(quantity), rate = parseBillNumber(tradeRate);
  if (qty === null || rate === null || qty <= 0 || rate < 0) return null;
  const total = qty * rate;
  return Number.isFinite(total) ? roundBillMoney(total) : null;
}

export function purchaseBillTotals(
  lines: { quantity: unknown; unit_cost: unknown }[],
  discount: unknown = 0, tax: unknown = 0, paid: unknown = 0
) {
  const lineTotals = lines.map((row) => purchaseLineTotal(row.quantity, row.unit_cost));
  const money = (value: unknown) => String(value ?? "").trim() === "" ? 0 : parseBillNumber(value);
  const d = money(discount), t = money(tax), p = money(paid);
  const subtotal = lineTotals.reduce<number>((sum, value) => sum + Math.round((value ?? 0) * 100), 0) / 100;
  const errors: string[] = [];
  lineTotals.forEach((value, index) => { if (value === null) errors.push(`Line ${index + 1}: quantity/rate durust likhein.`); });
  if (d === null || d < 0 || d > subtotal) errors.push("Discount subtotal se zyada ya invalid hai.");
  if (t === null || t < 0) errors.push("Tax invalid hai.");
  const total = roundBillMoney(Math.max(0, subtotal - (d ?? 0) + (t ?? 0)));
  if (p === null || p < 0 || p > total) errors.push("Paid amount total se zyada ya invalid hai.");
  return { lineTotals, subtotal, total, paid: p ?? 0, due: roundBillMoney(Math.max(0, total - (p ?? 0))), errors };
}

export function normalizeBillProduct(value: string): string {
  return value.normalize("NFKC").trim().toLowerCase().replace(/[^a-z0-9\u0600-\u06ff]+/g, " ").trim().replace(/\s+/g, " ");
}

/** A duplicate name or wrong pack must be resolved by the user, never guessed. */
export function matchBillProduct<T extends { id: string; name: string; product_code?: string | null; pack_size?: string | null; unit?: string | null }>(
  products: T[], name: string, pack = "", productCode = ""
): T | null {
  const wantedCode = normalizeBillProduct(productCode);
  if (wantedCode) {
    const codeMatches = products.filter((p) => p.product_code && normalizeBillProduct(p.product_code) === wantedCode);
    if (codeMatches.length === 1) return codeMatches[0];
  }
  const wanted = normalizeBillProduct(name), wantedPack = normalizeBillProduct(pack);
  let matches = products.filter((p) => normalizeBillProduct(p.name) === wanted || (p.product_code && normalizeBillProduct(p.product_code) === wanted));
  if (wantedPack) matches = matches.filter((p) => normalizeBillProduct(p.pack_size ?? p.unit ?? "") === wantedPack);
  return matches.length === 1 ? matches[0] : null;
}

export function patchBillRow<T extends { row_id: string }>(rows: T[], rowId: string, patch: Partial<T>): T[] {
  return rows.map((row) => row.row_id === rowId ? { ...row, ...patch, row_id: row.row_id } : row);
}
