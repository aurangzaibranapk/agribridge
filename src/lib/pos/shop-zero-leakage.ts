import { createServiceClient } from "@/lib/supabase/service";
import { shopTodayFlow, shopCashControl, shopCollectionOutstanding, shopInvestmentPosition } from "@/lib/pos/shop-360";

const round2 = (v: number) => Math.round((v + Number.EPSILON) * 100) / 100;

export interface SellingStockPosition {
  value: number | null;
  quantity: number;
  missingPriceItems: number;
  note: string;
}

/**
 * Main Shop Match uses SELLING RATE, not FIFO cost.
 * FIFO remains available in Shop 360 for COGS/profit reporting.
 */
export async function shopSellingStockPosition(shopId: string): Promise<SellingStockPosition> {
  const service = createServiceClient();
  const { data: wh } = await service.from("warehouses").select("id").eq("shop_id", shopId).limit(1).maybeSingle();
  if (!wh?.id) return { value: null, quantity: 0, missingPriceItems: 0, note: "Shop warehouse nahi mila." };

  const { data: rows } = await service
    .from("inventory")
    .select("quantity_on_hand, products(selling_price)")
    .eq("warehouse_id", wh.id);

  let value = 0;
  let quantity = 0;
  let missingPriceItems = 0;
  for (const row of rows ?? []) {
    const qty = Number(row.quantity_on_hand ?? 0);
    const joined = row.products as unknown as { selling_price?: number | null } | { selling_price?: number | null }[] | null;
    const product = Array.isArray(joined) ? joined[0] : joined;
    const price = product?.selling_price;
    quantity += qty;
    if (qty > 0 && (price == null || Number(price) <= 0)) missingPriceItems += 1;
    else value += qty * Number(price ?? 0);
  }

  return {
    value: missingPriceItems > 0 ? null : round2(value),
    quantity: round2(quantity),
    missingPriceItems,
    note: missingPriceItems > 0
      ? `${missingPriceItems} stocked item ka selling rate missing hai; Full Match ko Rs 0 kehna safe nahi.`
      : "Current stock quantity × product selling_price.",
  };
}

export async function shopZeroLeakageSnapshot(shopId: string, fromDate: string, toDate: string) {
  const [stock, flow, cash, deposits, investment] = await Promise.all([
    shopSellingStockPosition(shopId),
    shopTodayFlow(shopId, toDate),
    shopCashControl(shopId, fromDate, toDate),
    shopCollectionOutstanding(shopId),
    shopInvestmentPosition(shopId),
  ]);

  // Shop-level customer receivable is deliberately NOT invented here.
  // Existing Load & Bill receivable is branch-level, so Full Shop Match
  // remains incomplete until every receivable source is shop-attributable.
  const blockers: string[] = [];
  if (stock.value == null) blockers.push(stock.note);
  blockers.push("Customer Khata/Receivable abhi har source se shop-level attributable nahi hai.");
  if (cash.openShiftsCount > 0) blockers.push(`${cash.openShiftsCount} POS shift abhi khuli hai; physical cash final nahi.`);

  return {
    stock,
    flow,
    cash,
    deposits,
    investment,
    status: blockers.length ? "incomplete" as const : (Math.abs(cash.fullDifference) < 1 ? "matched" as const : "difference" as const),
    blockers,
  };
}
