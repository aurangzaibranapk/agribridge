/**
 * Ek POS bill mein asal NAQAD (cash) kitna aaya -- reports ke liye.
 *
 * `pos_sales.cash_paid` purani qataron mein cash + Waseela Card + bank +
 * wallet sab jama rakhta tha (19 October tak; dekhein checkout-guards
 * `cashOnly`). Is liye "Naqad aaya" `pos_sale_payment_details` ki sirf
 * `cash` qataron se ginna chahiye. Jis bill ki koi payment-detail qatar hi
 * nahi (bohat purane bill), us ke liye `cash_paid` hi wahid sahara hai.
 */
export interface SalePaymentRow {
  sale_id: string;
  payment_method: string | null;
  amount: number | string | null;
}

export interface SaleCashIndex {
  cash: Map<string, number>;
  hasLines: Set<string>;
}

export function buildSaleCashIndex(rows: SalePaymentRow[]): SaleCashIndex {
  const cash = new Map<string, number>();
  const hasLines = new Set<string>();
  for (const r of rows) {
    if (!r.sale_id) continue;
    hasLines.add(r.sale_id);
    if (r.payment_method === "cash") cash.set(r.sale_id, (cash.get(r.sale_id) ?? 0) + Number(r.amount ?? 0));
  }
  return { cash, hasLines };
}

export function saleCash(sale: { id: string; cash_paid?: number | string | null }, idx: SaleCashIndex): number {
  if (idx.hasLines.has(sale.id)) return Math.round((idx.cash.get(sale.id) ?? 0) * 100) / 100;
  return Number(sale.cash_paid ?? 0);
}
