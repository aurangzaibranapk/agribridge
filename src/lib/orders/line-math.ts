/** Discount and tax on an agri order line are line amounts, not per-unit amounts. */
export function orderLineAmounts(quantity: number, unitPrice: number, discount = 0, tax = 0) {
  const qty = Number(quantity) || 0;
  const price = Number(unitPrice) || 0;
  const disc = Number(discount) || 0;
  const lineTax = Number(tax) || 0;
  const lineTotal = qty * price - disc + lineTax;
  const netPrice = qty > 0 ? lineTotal / qty : price;
  return { lineTotal, netPrice };
}
