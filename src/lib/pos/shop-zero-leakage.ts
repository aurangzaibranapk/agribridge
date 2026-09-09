import { createServiceClient } from "@/lib/supabase/service";
import { shopCashControl, shopCollectionOutstanding, shopInvestmentPosition } from "@/lib/pos/shop-360";
import { shopPaymentMethodBreakdown, type ShopPaymentMethodRow } from "@/lib/pos/shop-payment-methods";

const round2 = (v: number) => Math.round((v + Number.EPSILON) * 100) / 100;
const GAYE_KINDS = ["kharcha", "supplier_ko_diya", "staff_ko_advance", "kisan_ko_advance", "mazdoor_ko_advance", "mazdoori_ki_adaigi"];

export interface SellingStockPosition {
  value: number | null;
  quantity: number;
  missingPriceItems: number;
  note: string;
}

export interface ShopPeriodFlow {
  sales: { total: number; byMethod: ShopPaymentMethodRow[] };
  expenses: { total: number };
}

/** Main Shop Match uses SELLING RATE, not FIFO cost. */
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

/** Selected date range ka real sale + approved expense flow. */
export async function shopPeriodFlow(shopId: string, fromDate: string, toDate: string): Promise<ShopPeriodFlow> {
  const service = createServiceClient();
  const [byMethod, expenseResult] = await Promise.all([
    shopPaymentMethodBreakdown(shopId, fromDate, toDate),
    service
      .from("company_expense_requests")
      .select("kind, amount")
      .eq("shop_id", shopId)
      .eq("status", "approved")
      .in("kind", GAYE_KINDS)
      .gte("expense_date", fromDate)
      .lte("expense_date", toDate),
  ]);

  return {
    sales: {
      total: round2(byMethod.reduce((sum, row) => sum + Number(row.sales ?? 0), 0)),
      byMethod,
    },
    expenses: {
      total: round2((expenseResult.data ?? []).reduce((sum, row) => sum + Number(row.amount ?? 0), 0)),
    },
  };
}

export async function shopZeroLeakageSnapshot(shopId: string, fromDate: string, toDate: string) {
  const [stock, flow, cash, deposits, investment] = await Promise.all([
    shopSellingStockPosition(shopId),
    shopPeriodFlow(shopId, fromDate, toDate),
    shopCashControl(shopId, fromDate, toDate),
    shopCollectionOutstanding(shopId),
    shopInvestmentPosition(shopId),
  ]);

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

export interface BranchZeroLeakageRow {
  shopId: string;
  shopName: string;
  sales: number;
  sellingStock: number | null;
  outstanding: number;
  pendingDeposit: number;
  verifiedDeposit: number;
  cashDifference: number;
  status: "matched" | "difference" | "incomplete";
}

export async function branchZeroLeakageSummary(branchId: string, fromDate: string, toDate: string) {
  const service = createServiceClient();
  const { data: shops } = await service.from("shops").select("id,name").eq("branch_id", branchId).eq("is_active", true).order("name");
  const rows: BranchZeroLeakageRow[] = [];

  for (const shop of shops ?? []) {
    const snap = await shopZeroLeakageSnapshot(shop.id, fromDate, toDate);
    rows.push({
      shopId: shop.id,
      shopName: shop.name,
      sales: snap.flow.sales.total,
      sellingStock: snap.stock.value,
      outstanding: snap.deposits.outstanding,
      pendingDeposit: snap.deposits.pendingDeposits,
      verifiedDeposit: snap.deposits.approvedDeposits,
      cashDifference: snap.cash.fullDifference,
      status: snap.status,
    });
  }

  const anyIncomplete = rows.some((r) => r.status === "incomplete");
  const anyDifference = rows.some((r) => r.status === "difference" || Math.abs(r.cashDifference) >= 1);

  return {
    shops: rows,
    totalSales: round2(rows.reduce((s, r) => s + r.sales, 0)),
    totalSellingStock: rows.some((r) => r.sellingStock == null) ? null : round2(rows.reduce((s, r) => s + Number(r.sellingStock ?? 0), 0)),
    totalOutstanding: round2(rows.reduce((s, r) => s + r.outstanding, 0)),
    totalPendingDeposit: round2(rows.reduce((s, r) => s + r.pendingDeposit, 0)),
    totalVerifiedDeposit: round2(rows.reduce((s, r) => s + r.verifiedDeposit, 0)),
    totalCashDifference: round2(rows.reduce((s, r) => s + r.cashDifference, 0)),
    status: anyIncomplete ? "incomplete" as const : anyDifference ? "difference" as const : "matched" as const,
  };
}

export interface OrganizationZeroLeakageRow {
  branchId: string;
  branchName: string;
  shopCount: number;
  sales: number;
  sellingStock: number | null;
  outstanding: number;
  pendingDeposit: number;
  verifiedDeposit: number;
  cashDifference: number;
  status: "matched" | "difference" | "incomplete";
}

/**
 * Organization view intentionally aggregates branch summaries only.
 * It does not invent a second accounting formula and therefore keeps
 * the drill-down chain Company -> Branch -> Shop as the single truth.
 */
export async function organizationZeroLeakageSummary(fromDate: string, toDate: string) {
  const service = createServiceClient();
  const { data: branches } = await service.from("branches").select("id,name").order("name");
  const rows: OrganizationZeroLeakageRow[] = [];

  for (const branch of branches ?? []) {
    const summary = await branchZeroLeakageSummary(branch.id, fromDate, toDate);
    rows.push({
      branchId: branch.id,
      branchName: branch.name,
      shopCount: summary.shops.length,
      sales: summary.totalSales,
      sellingStock: summary.totalSellingStock,
      outstanding: summary.totalOutstanding,
      pendingDeposit: summary.totalPendingDeposit,
      verifiedDeposit: summary.totalVerifiedDeposit,
      cashDifference: summary.totalCashDifference,
      status: summary.status,
    });
  }

  const anyIncomplete = rows.some((r) => r.status === "incomplete");
  const anyDifference = rows.some((r) => r.status === "difference" || Math.abs(r.cashDifference) >= 1);

  return {
    branches: rows,
    totalShops: rows.reduce((s, r) => s + r.shopCount, 0),
    totalSales: round2(rows.reduce((s, r) => s + r.sales, 0)),
    totalSellingStock: rows.some((r) => r.sellingStock == null) ? null : round2(rows.reduce((s, r) => s + Number(r.sellingStock ?? 0), 0)),
    totalOutstanding: round2(rows.reduce((s, r) => s + r.outstanding, 0)),
    totalPendingDeposit: round2(rows.reduce((s, r) => s + r.pendingDeposit, 0)),
    totalVerifiedDeposit: round2(rows.reduce((s, r) => s + r.verifiedDeposit, 0)),
    totalCashDifference: round2(rows.reduce((s, r) => s + r.cashDifference, 0)),
    status: anyIncomplete ? "incomplete" as const : anyDifference ? "difference" as const : "matched" as const,
  };
}
