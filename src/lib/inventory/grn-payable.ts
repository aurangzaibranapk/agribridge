/**
 * GRN payable: sirf jo maal sahi haalat mein mila (received_qty, jis mein
 * short aur toota pehle hi shamil NAHI) us ki qeemat, minus discount, plus
 * kharche/tax -- EK dafa. Short/damage ko received value se dobara ghatana
 * dohri katoti thi.
 */
export function grnPayable(
  items: Array<{ received_qty: number; unit_price: number }>,
  discount: number,
  additionalCharges: number
): number {
  const received = items.reduce((sum, i) => sum + Math.max(0, Number(i.received_qty) || 0) * (Number(i.unit_price) || 0), 0);
  const raw = received - (Number(discount) || 0) + (Number(additionalCharges) || 0);
  return Math.round(raw * 100) / 100;
}
