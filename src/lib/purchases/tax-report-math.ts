/** invoice_total is already subtotal - discount + tax. Do not subtract discount again. */
export function taxReportPayable(invoiceTotal: unknown, goodsSubtotal: unknown, discount: unknown, tax: unknown): number {
  const num = (value: unknown) => {
    const n = Number(value ?? 0);
    return Number.isFinite(n) ? n : 0;
  };
  const invoice = num(invoiceTotal);
  if (invoice !== 0) return Math.round(invoice * 100) / 100;
  return Math.round((num(goodsSubtotal) - num(discount) + num(tax)) * 100) / 100;
}

export function taxReportTotals(rows: { invoice_total?: unknown; total_amount?: unknown; discount_amount?: unknown; tax_amount?: unknown }[]) {
  const discount = rows.reduce((sum, row) => sum + (Number(row.discount_amount) || 0), 0);
  const tax = rows.reduce((sum, row) => sum + (Number(row.tax_amount) || 0), 0);
  const payable = rows.reduce((sum, row) => sum + taxReportPayable(row.invoice_total, row.total_amount, row.discount_amount, row.tax_amount), 0);
  return {
    discount: Math.round(discount * 100) / 100,
    tax: Math.round(tax * 100) / 100,
    payable: Math.round(payable * 100) / 100,
  };
}
