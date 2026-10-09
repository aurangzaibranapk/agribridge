export function orderNetUnit(line: { order_qty?: number; unit_price?: number; line_total?: number | null }) {
  const qty = Number(line.order_qty) || 0;
  const lineTotal = Number(line.line_total);
  if (qty > 0 && Number.isFinite(lineTotal) && lineTotal > 0) return lineTotal / qty;
  return Number(line.unit_price) || 0;
}

export function returnPriceCheck(
  requestedPrice: number,
  requestedQty: number,
  orderLine: { order_qty?: number; unit_price?: number; line_total?: number | null } | null,
  alreadyReturnedQty = 0
) {
  const qty = Number(requestedQty) || 0;
  const price = Number(requestedPrice) || 0;
  if (qty <= 0) return { ok: false as const, error: "Return quantity sahi likhein.", unitPrice: 0 };
  if (!orderLine) return { ok: false as const, error: "Return order line se match nahi hui. Qeemat form se nahi li ja sakti.", unitPrice: 0 };
  const allowed = Math.max(0, (Number(orderLine.order_qty) || 0) - (Number(alreadyReturnedQty) || 0));
  if (qty > allowed) return { ok: false as const, error: `Return quantity ${qty} order ki bachi hui ${allowed} se zyada hai.`, unitPrice: 0 };
  const unitPrice = orderNetUnit(orderLine);
  if (Math.abs(price - unitPrice) > 0.01) {
    return { ok: false as const, error: `Return qeemat order se match nahi: bheji ${price}, order ${unitPrice}.`, unitPrice };
  }
  return { ok: true as const, error: null, unitPrice };
}
