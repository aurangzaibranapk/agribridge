import { createServiceClient } from "@/lib/supabase/service";

/**
 * POS Collection Outstanding — malik ka mukammal spec (8 September,
 * raat). "POS Sale != Company Bank Receipt": cash sale hone se cash
 * company ko mila hua nahi maana jata, jab tak bank mein jama na ho
 * aur Finance us ki slip tasdeeq na kare.
 *
 * Outstanding HAMESHA live compute hota hai, kahin store nahi hota --
 * warna double-click/retry se dobara minus hone ka khatra rehta
 * (malik ka usool, item 17). Formula:
 *
 *   (POS cash sales − cash returns) − (sirf APPROVED deposits)
 *
 * Sirf CASH -- digital tareeqe (Easypaisa/JazzCash/Bank/Card) apne
 * raaste khud settle hote hain, is nizam ka hissa nahi.
 *
 * Per (staff, shop) -- ek staff kai shop ke counter chala sakta hai
 * (366), aur har shop ka apna alag outstanding hai. Deposit hamesha
 * EK shop ke against jama hoti hai.
 */

export interface StaffShopOutstanding {
  shopId: string;
  shopName: string;
  branchId: string;
  /** Lifetime cash collected via POS, minus cash returns, is shop mein. */
  totalCollected: number;
  /** Aaj ka hissa (isi lifetime figure ka). */
  todayCollected: number;
  /** Sirf Finance-manzoor shuda deposits. */
  approvedDeposits: number;
  /** Submit ho chuki, abhi tasdeeq baqi. Sirf malumati -- Outstanding kam nahi karti. */
  pendingDeposits: number;
  /** totalCollected − approvedDeposits. */
  outstanding: number;
}

function round2(v: number): number {
  return Math.round((v + Number.EPSILON) * 100) / 100;
}

/**
 * Ek staff ki (sab shops, jahan bhi kaam kiya) Outstanding fehrist.
 */
export async function staffOutstandingByShop(staffId: string): Promise<StaffShopOutstanding[]> {
  const service = createServiceClient();

  const { data: shifts } = await service.from("pos_shifts").select("id, counter_id").eq("staff_id", staffId);
  const shiftRows = shifts ?? [];
  if (shiftRows.length === 0) return [];

  const counterIds = [...new Set(shiftRows.map((s) => s.counter_id))];
  const { data: counters } = await service.from("pos_counters").select("id, shop_id, branch_id").in("id", counterIds);
  const shopByCounter = new Map((counters ?? []).map((c) => [c.id, { shopId: c.shop_id as string, branchId: c.branch_id as string }]));

  const shiftToShop = new Map(shiftRows.map((s) => [s.id, shopByCounter.get(s.counter_id)]));
  const shopIds = [...new Set([...shiftToShop.values()].filter(Boolean).map((v) => v!.shopId))];
  if (shopIds.length === 0) return [];

  const { data: shops } = await service.from("shops").select("id, name").in("id", shopIds);
  const shopNames = new Map((shops ?? []).map((s) => [s.id, s.name as string]));

  const shiftIds = shiftRows.map((s) => s.id);
  const { data: sales } = await service.from("pos_sales").select("id, shift_id, created_at").in("shift_id", shiftIds);
  const saleRows = sales ?? [];
  const saleIds = saleRows.map((s) => s.id);

  const [{ data: payments }, { data: returns }, { data: deposits }] = await Promise.all([
    saleIds.length > 0
      ? service.from("pos_sale_payment_details").select("sale_id, amount").eq("payment_method", "cash").in("sale_id", saleIds)
      : Promise.resolve({ data: [] }),
    saleIds.length > 0
      ? service.from("pos_returns").select("sale_id, total_amount").eq("refund_method", "cash").in("sale_id", saleIds)
      : Promise.resolve({ data: [] }),
    service.from("pos_collection_deposits").select("shop_id, amount, status").eq("staff_id", staffId),
  ]);

  const cashBySale = new Map<string, number>();
  for (const p of payments ?? []) cashBySale.set(p.sale_id, (cashBySale.get(p.sale_id) ?? 0) + Number(p.amount ?? 0));
  const returnBySale = new Map<string, number>();
  for (const r of returns ?? []) returnBySale.set(r.sale_id, (returnBySale.get(r.sale_id) ?? 0) + Number(r.total_amount ?? 0));

  const todayStr = new Date().toISOString().slice(0, 10);
  const byShop = new Map<string, { branchId: string; totalCollected: number; todayCollected: number }>();
  for (const sale of saleRows) {
    const shop = shiftToShop.get(sale.shift_id as string);
    if (!shop) continue;
    const net = (cashBySale.get(sale.id) ?? 0) - (returnBySale.get(sale.id) ?? 0);
    const cur = byShop.get(shop.shopId) ?? { branchId: shop.branchId, totalCollected: 0, todayCollected: 0 };
    cur.totalCollected += net;
    if (String(sale.created_at).slice(0, 10) === todayStr) cur.todayCollected += net;
    byShop.set(shop.shopId, cur);
  }

  const depositTotalsByShop = new Map<string, { approved: number; pending: number }>();
  for (const d of deposits ?? []) {
    const cur = depositTotalsByShop.get(d.shop_id) ?? { approved: 0, pending: 0 };
    if (d.status === "approved") cur.approved += Number(d.amount);
    else if (d.status === "pending") cur.pending += Number(d.amount);
    depositTotalsByShop.set(d.shop_id, cur);
  }

  const result: StaffShopOutstanding[] = [];
  for (const [shopId, agg] of byShop) {
    const dep = depositTotalsByShop.get(shopId) ?? { approved: 0, pending: 0 };
    result.push({
      shopId,
      shopName: shopNames.get(shopId) ?? "—",
      branchId: agg.branchId,
      totalCollected: round2(agg.totalCollected),
      todayCollected: round2(agg.todayCollected),
      approvedDeposits: round2(dep.approved),
      pendingDeposits: round2(dep.pending),
      outstanding: round2(agg.totalCollected - dep.approved),
    });
  }
  return result.sort((a, b) => a.shopName.localeCompare(b.shopName));
}

/** Ek staff ki EK shop ki Outstanding -- deposit submit karte waqt limit check ke liye. */
export async function staffShopOutstanding(staffId: string, shopId: string): Promise<StaffShopOutstanding | null> {
  const all = await staffOutstandingByShop(staffId);
  return all.find((r) => r.shopId === shopId) ?? null;
}
