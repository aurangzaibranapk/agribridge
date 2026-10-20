/**
 * POS card par dukan ke sath godam.
 *
 * Dukan ka adad shop ke apne warehouse se aata hai. Godam sirf un
 * godamon ka hai jo `shop_godams` mein is dukan se juda hon. Branch
 * ka saara central godam, doosri dukan ka shelf, aur juda na hua
 * godam is kul mein nahi aata.
 *
 * Link na ho, ya sawal fail ho, to total null rehta hai. Safha "—"
 * likhe. Sifar sirf tab jab link maujood ho aur dekh liya ho ke maal
 * nahi tha.
 */

export const SHOP_LOW_AT = 5;

export type GodamWarehouse = {
  id: string;
  name: string | null;
  shop_id: string | null;
  is_quarantine: boolean | null;
  is_active?: boolean | null;
};

export type GodamLine = { name: string; qty: number };

export type GodamStock = {
  /** null = pata nahi. 0 = dekh liya, khali. */
  total: number | null;
  /** null = pata nahi. Khali fehrist = koi godam mein maal nahi. */
  lines: GodamLine[] | null;
};

/** Admin ki fehrist: shelf, quarantine, aur band godam nahi. */
export function linkableGodams(warehouses: GodamWarehouse[]): GodamWarehouse[] {
  return warehouses.filter(
    (w) => w.shop_id == null && w.is_quarantine !== true && w.is_active !== false
  );
}

export type PickLinks =
  | { ok: true; ids: string[] }
  | { ok: false; error: string };

/**
 * Client ki fehrist par bharosa nahi. Jo id database mein nahi, shelf
 * ho, quarantine ho, ya band ho, wo link nahi banti. Khali fehrist
 * theek hai: saare link hat jate hain, POS par —.
 */
export function pickLinkedGodams(all: GodamWarehouse[], chosenIds: string[]): PickLinks {
  const byId = new Map(all.map((w) => [w.id, w]));
  const ids: string[] = [];
  const seen = new Set<string>();
  for (const id of chosenIds) {
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const w = byId.get(id);
    if (!w) return { ok: false, error: "Godam nahi mila." };
    if (w.shop_id != null) return { ok: false, error: "Dukan ka shelf godam ke tor par nahi judta." };
    if (w.is_quarantine === true) return { ok: false, error: "Quarantine godam dukan se nahi judta." };
    if (w.is_active === false) return { ok: false, error: "Band godam nahi judta." };
    ids.push(id);
  }
  return { ok: true, ids };
}

/** RPC ek dafa 500 se zyada product nahi leta. POS 400 ke tukron mein poochta hai. */
export function chunkIds(ids: string[], size = 400): string[][] {
  const step = size > 0 ? size : 400;
  const out: string[][] = [];
  for (let i = 0; i < ids.length; i += step) out.push(ids.slice(i, i + step));
  return out;
}

/**
 * null = POS "—" dikhaye. Map tabhi jab dukan ho, link mil gaye hon,
 * kam az kam ek godam juda ho, aur stock ka sawal theek ho.
 * Juda na hui warehouse ki qatar yahan gir jati hai.
 */
export function linkedGodamStock(input: {
  shopId: string | null;
  linksOk: boolean;
  linkedWarehouseIds: string[];
  stockOk: boolean;
  productIds: string[];
  rows:
    | {
        product_id: string;
        warehouse_id: string;
        warehouse_name?: string | null;
        quantity_on_hand: number | string | null;
      }[]
    | null;
}): Map<string, GodamStock> | null {
  if (!input.shopId || !input.linksOk || !input.stockOk || input.linkedWarehouseIds.length === 0) {
    return null;
  }
  const nameOf = new Map<string, string>();
  for (const id of input.linkedWarehouseIds) nameOf.set(id, "Godam");
  for (const row of input.rows ?? []) {
    if (!nameOf.has(row.warehouse_id)) continue;
    const name = (row.warehouse_name ?? "").trim();
    if (name) nameOf.set(row.warehouse_id, name);
  }
  const warehouses = [...nameOf.entries()].map(([id, name]) => ({ id, name }));
  return aggregateGodamByProduct(input.productIds, warehouses, input.rows, true);
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
