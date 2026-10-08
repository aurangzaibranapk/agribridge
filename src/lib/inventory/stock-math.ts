export type BatchSlice = { remaining: number; unitCost: number };

/** Value on-hand at remaining batch cost. Only uncovered quantity uses the product master price. */
export function stockHoldingValue(quantityOnHand: number, batches: BatchSlice[], fallbackUnitCost = 0) {
  let need = Math.max(0, Number(quantityOnHand) || 0);
  let value = 0;
  let covered = 0;
  for (const batch of batches) {
    if (need <= 0) break;
    const take = Math.min(need, Math.max(0, Number(batch.remaining) || 0));
    value += take * (Number(batch.unitCost) || 0);
    covered += take;
    need -= take;
  }
  const unbatched = need;
  if (unbatched > 0) value += unbatched * (Number(fallbackUnitCost) || 0);
  return { value, covered, unbatched };
}

export function stockOutPlan(quantity: number, quantityOnHand: number, batches: BatchSlice[]) {
  const qty = Number(quantity) || 0;
  const onHand = Number(quantityOnHand) || 0;
  const batchQty = batches.reduce((sum, batch) => sum + Math.max(0, Number(batch.remaining) || 0), 0);
  if (qty <= 0) return { ok: false as const, error: "Miqdar sifar se zyada honi chahiye.", cost: 0, batchQty, onHand };
  if (onHand < qty) return { ok: false as const, error: `Stock kam hai: ${onHand} maujood, ${qty} nikalna hai.`, cost: 0, batchQty, onHand };
  if (batchQty < qty) return { ok: false as const, error: `Batch cost adhoori hai: ${batchQty} batch mein, ${qty} nikalna hai. Pehle batch theek karein.`, cost: 0, batchQty, onHand };
  let remaining = qty;
  let cost = 0;
  for (const batch of batches) {
    if (remaining <= 0) break;
    const take = Math.min(remaining, Math.max(0, Number(batch.remaining) || 0));
    cost += take * (Number(batch.unitCost) || 0);
    remaining -= take;
  }
  return { ok: true as const, error: null, cost, batchQty, onHand };
}
