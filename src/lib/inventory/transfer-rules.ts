/** Transfer ke liye source par kaafi maal hai? (trigger bhi yehi jaanch karta hai) */
export function transferHasEnoughStock(onHand: number, qty: number): boolean {
  if (!Number.isFinite(onHand) || !Number.isFinite(qty) || qty <= 0) return false;
  return onHand + 1e-9 >= qty;
}
