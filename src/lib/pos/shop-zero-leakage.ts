import { createServiceClient } from "@/lib/supabase/service";
import { shopCashControl, shopCollectionOutstanding, shopInvestmentPosition } from "@/lib/pos/shop-360";
import { shopPaymentMethodBreakdown, type ShopPaymentMethodRow } from "@/lib/pos/shop-payment-methods";

const round2 = (v: number) => Math.round((v + Number.EPSILON) * 100) / 100;
const GAYE_KINDS = ["kharcha", "supplier_ko_diya", "staff_ko_advance", "kisan_ko_advance", "mazdoor_ko_advance", "mazdoori_ki_adaigi"];
const STOCK_IN_TYPES = new Set(["purchase_in", "transfer_in", "adjustment_increase", "return_in"]);
const STOCK_OUT_TYPES = new Set(["sale_out", "transfer_out", "adjustment_decrease", "damaged_out", "expired_out"]);

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

export interface StockSaleMatch {
  openingValue: number | null;
  stockInValue: number | null;
  stockSaleOutValue: number | null;
  otherStockOutValue: number | null;
  expectedClosingValue: number | null;
  actualClosingValue: number | null;
  stockDifference: number | null;
  posSalesValue: number;
  posVsStockSaleDifference: number | null;
  note: string;
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

/**
 * Selling-rate stock equation for the selected period.
 * Opening + stock in - sale out - other stock out = expected closing.
 * Actual closing comes from inventory. If the append-only stock ledger is
 * complete, expected and actual should match. POS sale is shown separately
 * so discount/rate variance or a missing sale_out movement cannot hide.
 */
export async function shopStockSaleMatch(
  shopId: string,
  fromDate: string,
  toDate: string,
  posSalesValue: number
): Promise<StockSaleMatch> {
  const service = createServiceClient();
  const { data: wh } = await service.from("warehouses").select("id").eq("shop_id", shopId).limit(1).maybeSingle();
  if (!wh?.id) {
    return {
      openingValue: null, stockInValue: null, stockSaleOutValue: null, otherStockOutValue: null,
      expectedClosingValue: null, actualClosingValue: null, stockDifference: null,
      posSalesValue, posVsStockSaleDifference: null, note: "Shop warehouse nahi mila.",
    };
  }

  const { data: invRows } = await service
    .from("inventory")
    .select("id, quantity_on_hand, products(selling_price)")
    .eq("warehouse_id", wh.id);

  const inventory = (invRows ?? []).map((r) => {
    const joined = r.products as unknown as { selling_price?: number | null } | { selling_price?: number | null }[] | null;
    const product = Array.isArray(joined) ? joined[0] : joined;
    return {
      id: r.id as string,
      currentQty: Number(r.quantity_on_hand ?? 0),
      price: product?.selling_price == null ? null : Number(product.selling_price),
    };
  });

  if (inventory.some((r) => r.currentQty > 0 && (!r.price || r.price <= 0))) {
    return {
      openingValue: null, stockInValue: null, stockSaleOutValue: null, otherStockOutValue: null,
      expectedClosingValue: null, actualClosingValue: null, stockDifference: null,
      posSalesValue, posVsStockSaleDifference: null,
      note: "Kuch stocked items ka selling rate missing hai; stock-sale match safe nahi.",
    };
  }

  const ids = inventory.map((r) => r.id);
  const byInventory = new Map<string, { movement_type: string; quantity: number; balance_after: number; created_at: string }[]>();
  if (ids.length > 0) {
    const { data: movements } = await service
      .from("stock_movements")
      .select("inventory_id, movement_type, quantity, balance_after, created_at")
      .in("inventory_id", ids)
      .gte("created_at", `${fromDate}T00:00:00`)
      .lte("created_at", `${toDate}T23:59:59.999`)
      .order("created_at", { ascending: true });

    for (const m of (movements ?? []) as { inventory_id: string; movement_type: string; quantity: number; balance_after: number; created_at: string }[]) {
      const arr = byInventory.get(m.inventory_id) ?? [];
      arr.push({ movement_type: m.movement_type, quantity: Number(m.quantity ?? 0), balance_after: Number(m.balance_after ?? 0), created_at: m.created_at });
      byInventory.set(m.inventory_id, arr);
    }
  }

  let openingValue = 0;
  let stockInValue = 0;
  let saleOutValue = 0;
  let otherOutValue = 0;
  let expectedClosingValue = 0;
  let actualClosingValue = 0;

  for (const inv of inventory) {
    const price = Number(inv.price ?? 0);
    const ms = byInventory.get(inv.id) ?? [];
    let openingQty = inv.currentQty;
    if (ms.length > 0) {
      const first = ms[0];
      if (STOCK_IN_TYPES.has(first.movement_type)) openingQty = first.balance_after - first.quantity;
      else if (STOCK_OUT_TYPES.has(first.movement_type)) openingQty = first.balance_after + first.quantity;
      else openingQty = first.balance_after;
    }

    let expectedQty = openingQty;
    for (const m of ms) {
      if (STOCK_IN_TYPES.has(m.movement_type)) {
        expectedQty += m.quantity;
        stockInValue += m.quantity * price;
      } else if (STOCK_OUT_TYPES.has(m.movement_type)) {
        expectedQty -= m.quantity;
        if (m.movement_type === "sale_out") saleOutValue += m.quantity * price;
        else otherOutValue += m.quantity * price;
      }
    }

    openingValue += openingQty * price;
    expectedClosingValue += expectedQty * price;
    actualClosingValue += inv.currentQty * price;
  }

  const stockDifference = actualClosingValue - expectedClosingValue;
  const posVsStockSaleDifference = posSalesValue - saleOutValue;
  return {
    openingValue: round2(openingValue),
    stockInValue: round2(stockInValue),
    stockSaleOutValue: round2(saleOutValue),
    otherStockOutValue: round2(otherOutValue),
    expectedClosingValue: round2(expectedClosingValue),
    actualClosingValue: round2(actualClosingValue),
    stockDifference: round2(stockDifference),
    posSalesValue: round2(posSalesValue),
    posVsStockSaleDifference: round2(posVsStockSaleDifference),
    note: "Selling-rate stock ledger match. POS sale alag compare hoti hai taa-ke discount/rate variance chhup na jaye.",
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
  const stockSaleMatch = await shopStockSaleMatch(shopId, fromDate, toDate, flow.sales.total);

  const blockers: string[] = [];
  if (stock.value == null) blockers.push(stock.note);
  if (stockSaleMatch.stockDifference == null) blockers.push(stockSaleMatch.note);
  else if (Math.abs(stockSaleMatch.stockDifference) >= 1) blockers.push(`Stock ledger difference Rs ${Math.abs(stockSaleMatch.stockDifference).toLocaleString()}.`);
  if (stockSaleMatch.posVsStockSaleDifference != null && Math.abs(stockSaleMatch.posVsStockSaleDifference) >= 1) {
    blockers.push(`POS sale aur selling-rate sale_out mein Rs ${Math.abs(stockSaleMatch.posVsStockSaleDifference).toLocaleString()} farq hai; discount/rate/movement verify karein.`);
  }
  blockers.push("Customer Khata/Receivable abhi har source se shop-level attributable nahi hai.");
  if (cash.openShiftsCount > 0) blockers.push(`${cash.openShiftsCount} POS shift abhi khuli hai; physical cash final nahi.`);

  return {
    stock,
    stockSaleMatch,
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

  // Test 9 (Zero-Leakage spec) — poori consolidation `shop_id` se chalti
  // hai (har shop wala query `.eq("shop_id", shopId)`), is liye do shops
  // ke darmiyan koi raqam DOUBLE nahi ginti -- har row sirf ek hi shop ki
  // query se match karti hai. Magar `pos_sales.shop_id` aur
  // `company_expense_requests.shop_id` DB mein nullable hain -- agar
  // koi bikri/kharcha branch se jura ho magar kisi shop se nahi (shop_id
  // khali), to wo kisi bhi shop ki query mein kabhi aata hi nahi, aur ye
  // rollup use bhi kabhi nahi dekhta. Ye "double count" nahi, "invisible"
  // hai -- aur "sifar" se bhi zyada khatarnak, kyunke koi blocker bhi
  // nahi lagta. Yahan isay pakar kar disclose kiya jata hai.
  const [{ data: orphanSales }, { data: orphanExpenses }] = await Promise.all([
    service
      .from("pos_sales")
      .select("id, total_amount")
      .eq("branch_id", branchId)
      .is("shop_id", null)
      .in("status", ["completed", "partially_returned"])
      .gte("created_at", `${fromDate}T00:00:00`)
      .lte("created_at", `${toDate}T23:59:59.999`),
    service
      .from("company_expense_requests")
      .select("id, amount")
      .eq("branch_id", branchId)
      .is("shop_id", null)
      .eq("status", "approved")
      .gte("expense_date", fromDate)
      .lte("expense_date", toDate),
  ]);

  const blockers: string[] = [];
  const orphanSalesTotal = round2((orphanSales ?? []).reduce((s, r) => s + Number(r.total_amount ?? 0), 0));
  const orphanExpensesTotal = round2((orphanExpenses ?? []).reduce((s, r) => s + Number(r.amount ?? 0), 0));
  if ((orphanSales?.length ?? 0) > 0) {
    blockers.push(`${orphanSales!.length} bikri (Rs ${orphanSalesTotal.toLocaleString()}) is branch se juri hai magar kisi shop se nahi (shop_id khali) -- upar ki totals mein shamil NAHI hain.`);
  }
  if ((orphanExpenses?.length ?? 0) > 0) {
    blockers.push(`${orphanExpenses!.length} manzoor-shuda kharcha/sarmaya entry (Rs ${orphanExpensesTotal.toLocaleString()}) is branch se juri hai magar kisi shop se nahi (shop_id khali) -- upar ki totals mein shamil NAHI hain.`);
  }

  return {
    shops: rows,
    totalSales: round2(rows.reduce((s, r) => s + r.sales, 0)),
    totalSellingStock: rows.some((r) => r.sellingStock == null) ? null : round2(rows.reduce((s, r) => s + Number(r.sellingStock ?? 0), 0)),
    totalOutstanding: round2(rows.reduce((s, r) => s + r.outstanding, 0)),
    totalPendingDeposit: round2(rows.reduce((s, r) => s + r.pendingDeposit, 0)),
    totalVerifiedDeposit: round2(rows.reduce((s, r) => s + r.verifiedDeposit, 0)),
    totalCashDifference: round2(rows.reduce((s, r) => s + r.cashDifference, 0)),
    blockers,
    status: anyIncomplete || blockers.length > 0 ? "incomplete" as const : anyDifference ? "difference" as const : "matched" as const,
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

/** Organization aggregate reuses the branch truth; no second formula. */
export async function organizationZeroLeakageSummary(fromDate: string, toDate: string) {
  const service = createServiceClient();
  const { data: branches } = await service.from("branches").select("id,name").order("name");
  const rows: OrganizationZeroLeakageRow[] = [];

  const blockers: string[] = [];
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
    for (const b of summary.blockers) blockers.push(`${branch.name}: ${b}`);
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
    blockers,
    status: anyIncomplete ? "incomplete" as const : anyDifference ? "difference" as const : "matched" as const,
  };
}
