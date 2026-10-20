/**
 * POS card par dukan ke sath godam.
 *
 * Dukan ka adad shop ke apne warehouse se aata hai. Godam sirf usi
 * branch ke central godam hain: shop_id khali, quarantine nahi, aur
 * dukan ka apna warehouse is kul mein dobara nahi aata. Doosri dukan
 * ka shelf "godam" nahi hai.
 *
 * Sawal fail ho to total null rehta hai. Safha "—" likhe. Sifar sirf
 * tab jab dekh liya aur maal nahi tha.
 */

export const SHOP_LOW_AT = 5;

export type GodamWarehouse = {
  id: string;
  name: string | null;
  shop_id: string | null;
  is_quarantine: boolean | null;
};

export type GodamLine = { name: string; qty: number };

export type GodamStock = {
  /** null = pata nahi. 0 = dekh liya, khali. */
  total: number | null;
  /** null = pata nahi. Khali fehrist = koi godam mein maal nahi. */
  lines: GodamLine[] | null;
};

export function centralGodams(
  warehouses: GodamWarehouse[],
  shopWarehouseId: string | null
): GodamWarehouse[] {
  return warehouses.filter(
    (w) => w.id !== shopWarehouseId && w.shop_id == null && w.is_quarantine !== true
  );
}

export function aggregateGodamByProduct(
  productIds: string[],
  warehouses: { id: string; name: string | null }[],
  rows: { product_id: string; warehouse_id: string; quantity_on_hand: number | string | null }[] | null,
  queryOk: boolean
): Map<string, GodamStock> {
  const out = new Map<string, GodamStock>();
  if (!queryOk) {
    for (const id of productIds) out.set(id, { total: null, lines: null });
    return out;
  }
  const nameOf = new Map(warehouses.map((w) => [w.id, (w.name ?? "").trim() || "Godam"]));
  const byProduct = new Map<string, Map<string, number>>();
  for (const row of rows ?? []) {
    if (!nameOf.has(row.warehouse_id)) continue;
    const qty = Number(row.quantity_on_hand ?? 0);
    if (!Number.isFinite(qty) || qty <= 0) continue;
    const perWh = byProduct.get(row.product_id) ?? new Map<string, number>();
    perWh.set(row.warehouse_id, (perWh.get(row.warehouse_id) ?? 0) + qty);
    byProduct.set(row.product_id, perWh);
  }
  for (const id of productIds) {
    const perWh = byProduct.get(id);
    const lines: GodamLine[] = [];
    if (perWh) {
      for (const [warehouseId, qty] of perWh) {
        lines.push({ name: nameOf.get(warehouseId) || "Godam", qty });
      }
      lines.sort((a, b) => b.qty - a.qty || a.name.localeCompare(b.name));
    }
    out.set(id, { total: lines.reduce((sum, line) => sum + line.qty, 0), lines });
  }
  return out;
}

/** "out" = dukan khatam, "low" = kam, null = ishara nahi. */
export function godamHint(
  shopQty: number,
  godamTotal: number | null,
  minStock: number | null | undefined
): "out" | "low" | null {
  if (godamTotal == null || !(godamTotal > 0)) return null;
  const shop = Number(shopQty);
  if (!Number.isFinite(shop) || shop <= 0) return "out";
  const min = Number(minStock ?? 0);
  if (shop <= SHOP_LOW_AT || (Number.isFinite(min) && min > 0 && shop <= min)) return "low";
  return null;
}

export function formatGodamQty(qty: number | null | undefined): string {
  if (qty == null || !Number.isFinite(Number(qty))) return "—";
  const n = Math.round(Number(qty) * 1000) / 1000;
  return String(n);
}

export function shopQtyToneClass(qty: number): string {
  if (qty <= SHOP_LOW_AT) return "bg-red-500";
  if (qty <= 20) return "bg-amber-500";
  return "bg-emerald-500";
}
