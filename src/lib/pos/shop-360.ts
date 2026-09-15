import { createServiceClient } from "@/lib/supabase/service";
import { billQismKaLabel } from "@/lib/kharche";
import { ACC } from "@/lib/ledger/rules";
import { shopPaymentMethodBreakdown, type ShopPaymentMethodRow } from "@/lib/pos/shop-payment-methods";
import { computeShiftCash } from "@/lib/pos/shift-cash";

/**
 * Shop 360 — Business Position (malik ka poora spec, 8 September, raat).
 *
 * Phase 1: "Paisa Kahan Hai?" + Aaj ki Sale + Recovery + Expense.
 *
 * Malik ki do sharton par yahan amal hai:
 *
 *   1. Customer ke udhaar ka SIRF EK sach — ledger (`journal_lines`
 *      account 1100). `customers.current_balance` aur
 *      `khata_accounts.current_balance` ko sirf cache maana gaya hai,
 *      yahan un se kuch nahi ginta.
 *   2. Supplier payable abhi SHOP tak nahi -- purchases shop se reliably
 *      linked nahi hain (malik ka apna faisla), is liye yahan `null`
 *      (NULL, sifar nahi) rehta hai, safha khud "—" dikhata hai.
 *
 * Ek aur asal hadd, is Phase mein saamne aayi (chhupai nahi ja rahi):
 * customer ka udhaar/wasooli DO raaston se darj hoti hai --
 * `customer-udhaar.ts` (Load & Bill, sirf BRANCH tak, shop tag nahi
 * karta) aur `kharche.ts` ka "customer_se_wasooli" qism (Paisa & Khata,
 * shop tak). Is liye:
 *   - Receivable (Paisa Kahan Hai) BRANCH tak hai, shop tak nahi.
 *   - Aaj ki Recovery sirf Paisa & Khata se darj shuda wasooli ginti
 *     hai -- Load & Bill se ki gayi wasooli is number mein NAHI aati
 *     (us mein shop tag hi nahi hota). Safhe par ye saaf likha jata hai.
 */

const GAYE_KINDS = ["kharcha", "supplier_ko_diya", "staff_ko_advance", "kisan_ko_advance", "mazdoor_ko_advance", "mazdoori_ki_adaigi"];
const RECOVERY_KINDS = ["customer_se_wasooli", "staff_se_wapas", "kisan_se_wapas"];

function round2(v: number): number {
  return Math.round((v + Number.EPSILON) * 100) / 100;
}

const METHOD_LABEL: Record<string, string> = {
  cash: "Cash", bank_transfer: "Bank Transfer", card: "Card", jazzcash: "JazzCash",
  easypaisa: "Easypaisa", qr: "QR", khata: "Khata (udhaar)",
};

/** `paid_from_account_id` → payment_method, sab jagah wohi ek naqsha. */
async function accountToMethodMap(): Promise<Map<string, string>> {
  const service = createServiceClient();
  const { data: mapRows } = await service.from("payment_method_account_map").select("payment_method, finance_account_id");
  const map = new Map<string, string>();
  for (const m of (mapRows ?? []) as { payment_method: string; finance_account_id: string | null }[]) {
    if (m.finance_account_id) map.set(m.finance_account_id, m.payment_method);
  }
  return map;
}

export interface ShopFlowRow {
  total: number;
  byMethod: ShopPaymentMethodRow[];
}

export interface ShopExpenseRow {
  category: string;
  categoryLabel: string;
  amount: number;
}

export interface ShopTodayFlow {
  sales: ShopFlowRow;
  recovery: ShopFlowRow;
  expenses: { total: number; byCategory: ShopExpenseRow[] };
}

/** Aaj (ya kisi bhi ek din) ki Sale (payment-method) + Recovery + Expense. */
export async function shopTodayFlow(shopId: string, date: string): Promise<ShopTodayFlow> {
  const service = createServiceClient();

  const salesByMethod = await shopPaymentMethodBreakdown(shopId, date, date);
  const salesTotal = round2(salesByMethod.reduce((s, r) => s + r.sales, 0));

  const { data: expenseRows } = await service
    .from("company_expense_requests")
    .select("kind, category, amount, paid_from_account_id")
    .eq("shop_id", shopId)
    .eq("status", "approved")
    .eq("expense_date", date);

  const rows = (expenseRows ?? []) as { kind: string; category: string | null; amount: number; paid_from_account_id: string | null }[];
  const accountToMethod = await accountToMethodMap();

  // Recovery -- alag kinds, sirf Paisa & Khata se.
  const recoveryRows = rows.filter((r) => RECOVERY_KINDS.includes(r.kind));
  const recoveryByMethod = new Map<string, number>();
  for (const r of recoveryRows) {
    const method = r.paid_from_account_id ? accountToMethod.get(r.paid_from_account_id) ?? "other" : "other";
    recoveryByMethod.set(method, (recoveryByMethod.get(method) ?? 0) + Number(r.amount ?? 0));
  }
  const recoveryTotal = round2([...recoveryByMethod.values()].reduce((s, v) => s + v, 0));
  const recoveryRowsOut: ShopPaymentMethodRow[] = [...recoveryByMethod.entries()].map(([method, amount]) => ({
    method, label: METHOD_LABEL[method] ?? method, sales: round2(amount), expenseNet: 0, net: round2(amount),
  }));

  // Expense -- GAYE kinds, category ke hisaab se.
  const expenseRowsOnly = rows.filter((r) => GAYE_KINDS.includes(r.kind));
  const byCategory = new Map<string, number>();
  for (const r of expenseRowsOnly) {
    const cat = r.category ?? "other";
    byCategory.set(cat, (byCategory.get(cat) ?? 0) + Number(r.amount ?? 0));
  }
  const expenseTotal = round2([...byCategory.values()].reduce((s, v) => s + v, 0));
  const expenseByCategory: ShopExpenseRow[] = [...byCategory.entries()]
    .map(([category, amount]) => ({ category, categoryLabel: billQismKaLabel(category), amount: round2(amount) }))
    .sort((a, b) => b.amount - a.amount);

  return {
    sales: { total: salesTotal, byMethod: salesByMethod },
    recovery: { total: recoveryTotal, byMethod: recoveryRowsOut },
    expenses: { total: expenseTotal, byCategory: expenseByCategory },
  };
}

export interface ShopWhereIsMyMoney {
  stockValueApprox: number | null;
  stockValueNote: string;
  byPaymentMethod: ShopPaymentMethodRow[];
  cashDigitalTotal: number;
  /** Branch tak -- shop tak nahi (malik ko wajah bata di gayi hai). */
  receivableBranchLevel: number | null;
  receivableNote: string;
  /** Abhi maujood nahi -- shop tak purchase linkage reliable nahi. */
  payable: null;
  payableNote: string;
}

/**
 * "Paisa Kahan Hai?" -- Stock (FIFO cost, Phase 2E) + Cash/Bank/Digital
 * (lifetime, is shop ki) + Receivable (branch tak) + Payable (abhi nahi).
 */
export async function shopWhereIsMyMoney(shopId: string): Promise<ShopWhereIsMyMoney> {
  const service = createServiceClient();

  const { data: shop } = await service.from("shops").select("branch_id, created_at").eq("id", shopId).maybeSingle();
  const branchId = (shop?.branch_id as string | null) ?? null;
  // Shop kab bani -- lifetime hisaab isi din se shuru hota hai, us se
  // pehle ka data hai hi nahi.
  const fromDate = shop?.created_at ? String(shop.created_at).slice(0, 10) : "2020-01-01";
  const today = new Date().toISOString().slice(0, 10);

  const [stock, byMethod, receivable] = await Promise.all([
    shopStockPosition(shopId, today, today),
    shopPaymentMethodBreakdown(shopId, fromDate, today),
    branchId ? branchReceivableFromLedger(branchId) : Promise.resolve(null),
  ]);

  return {
    stockValueApprox: stock.stockValueFifo,
    stockValueNote: "FIFO cost se (stock_batches.unit_cost) -- MRP/selling price se nahi.",
    byPaymentMethod: byMethod,
    cashDigitalTotal: round2(byMethod.reduce((s, r) => s + r.net, 0)),
    receivableBranchLevel: receivable,
    receivableNote:
      "Ledger (account 1100) se, is shop ki poori BRANCH tak -- shop tak nahi, kyunke Load & Bill ka udhaar/wasooli sirf branch tak darj hota hai, shop tag nahi karta.",
    payable: null,
    payableNote: "Abhi shop-wise track nahi hoti -- purchases shop se reliably linked nahi hain. Branch/company level Finance ke safhe par dekhein.",
  };
}

export interface ShopStockPosition {
  /** stock_batches.unit_cost se (FIFO) -- NULL agar is shop ka warehouse hi nahi mila. */
  stockValueFifo: number | null;
  stockQuantity: number;
  receivedInPeriod: number;
  soldInPeriod: number;
  lowStockCount: number;
  outOfStockCount: number;
  note: string;
}

/**
 * Phase 2E — Stock Position, asal cost (FIFO) se.
 *
 * Pehle (Phase 1) `products.purchase_price` (maujooda, ek hi rate) se
 * andaza lagaya jata tha -- ghalat tha agar ek product ke do batch alag
 * rate par khareede gaye hon. Ab `stock_batches.unit_cost *
 * remaining_quantity` -- wohi cost jo POS ki COGS bhi istemal karti
 * hai (FIFO), is liye Shop 360 ka Stock Value aur P&L ka COGS ek hi
 * hisaab se aate hain, do alag nahi.
 */
export async function shopStockPosition(shopId: string, fromDate: string, toDate: string): Promise<ShopStockPosition> {
  const service = createServiceClient();

  const { data: wh } = await service.from("warehouses").select("id").eq("shop_id", shopId).limit(1).maybeSingle();
  const warehouseId = wh?.id as string | undefined;
  if (!warehouseId) {
    return {
      stockValueFifo: null,
      stockQuantity: 0,
      receivedInPeriod: 0,
      soldInPeriod: 0,
      lowStockCount: 0,
      outOfStockCount: 0,
      note: "Is shop ka warehouse nahi mila -- stock ka hisaab nahi laga sakte.",
    };
  }

  const [{ data: batches }, { data: invRows }] = await Promise.all([
    service.from("stock_batches").select("remaining_quantity, unit_cost").eq("warehouse_id", warehouseId),
    service.from("inventory").select("id, quantity_on_hand, products(min_stock_threshold)").eq("warehouse_id", warehouseId),
  ]);

  const stockValueFifo = round2(
    (batches ?? []).reduce((s, b) => s + Number(b.remaining_quantity ?? 0) * Number(b.unit_cost ?? 0), 0)
  );

  const rows = (invRows ?? []) as { id: string; quantity_on_hand: number; products: { min_stock_threshold: number | null } | { min_stock_threshold: number | null }[] | null }[];
  const stockQuantity = round2(rows.reduce((s, r) => s + Number(r.quantity_on_hand ?? 0), 0));

  let lowStockCount = 0;
  let outOfStockCount = 0;
  for (const r of rows) {
    const qty = Number(r.quantity_on_hand ?? 0);
    const product = Array.isArray(r.products) ? r.products[0] : r.products;
    const threshold = product?.min_stock_threshold != null ? Number(product.min_stock_threshold) : null;
    if (qty <= 0) outOfStockCount += 1;
    else if (threshold != null && qty <= threshold) lowStockCount += 1;
  }

  const inventoryIds = rows.map((r) => r.id);
  let receivedInPeriod = 0;
  let soldInPeriod = 0;
  if (inventoryIds.length > 0) {
    const { data: movements } = await service
      .from("stock_movements")
      .select("movement_type, quantity")
      .in("inventory_id", inventoryIds)
      .gte("created_at", `${fromDate}T00:00:00`)
      .lte("created_at", `${toDate}T23:59:59.999`);
    for (const m of (movements ?? []) as { movement_type: string; quantity: number }[]) {
      const qty = Number(m.quantity ?? 0);
      if (m.movement_type === "purchase_in") receivedInPeriod += qty;
      else if (m.movement_type === "sale_out") soldInPeriod += qty;
    }
  }

  return {
    stockValueFifo,
    stockQuantity,
    receivedInPeriod: round2(receivedInPeriod),
    soldInPeriod: round2(soldInPeriod),
    lowStockCount,
    outOfStockCount,
    note: "Stock Value FIFO cost se (stock_batches) -- wohi hisaab jo POS ki COGS bhi istemal karti hai.",
  };
}

/** Ek branch ka poora customer receivable, ledger (1100) se -- asal sach. */
async function branchReceivableFromLedger(branchId: string): Promise<number> {
  const service = createServiceClient();

  const { data: entries } = await service.from("journal_entries").select("id").eq("branch_id", branchId);
  const entryIds = (entries ?? []).map((e) => e.id as string);
  if (entryIds.length === 0) return 0;

  const { data: lines } = await service
    .from("journal_lines")
    .select("debit, credit")
    .eq("account_code", ACC.customerDue)
    .in("entry_id", entryIds);

  const total = (lines ?? []).reduce((s, l) => s + (Number(l.debit ?? 0) - Number(l.credit ?? 0)), 0);
  return round2(total);
}

export interface ShopInvestmentPosition {
  /** Lifetime, sab dafa mila kar -- "opening" vs "additional" alag nahi rakha, wo faisla khud data mein nahi hai. */
  totalInvestment: number;
  totalWithdrawals: number;
  /** totalInvestment − totalWithdrawals. */
  netOwnerEquity: number;
  entryCount: number;
  note: string;
}

/**
 * Phase 2C — Investment/Withdrawal. `company_expense_requests` ke naye
 * kind (`malik_ka_sarmaya`/`malik_ne_nikala`, migration 375) se, sirf
 * MANZOOR-shuda -- Paisa & Khata ka wohi purana usool.
 *
 * "Retained Profit" aur "Current Equity" abhi is mein NAHI (in ke liye
 * shop ki lifetime P&L chahiye, jo Phase 2E ke baad hi bharosemand
 * hogi) -- yahan sirf Investment/Withdrawal ka asal, ledger-based hisaab.
 */
export async function shopInvestmentPosition(shopId: string): Promise<ShopInvestmentPosition> {
  const service = createServiceClient();

  const { data: rows } = await service
    .from("company_expense_requests")
    .select("kind, amount")
    .eq("shop_id", shopId)
    .eq("status", "approved")
    .in("kind", ["malik_ka_sarmaya", "malik_ne_nikala"]);

  const entries = (rows ?? []) as { kind: string; amount: number }[];
  const totalInvestment = round2(entries.filter((r) => r.kind === "malik_ka_sarmaya").reduce((s, r) => s + Number(r.amount ?? 0), 0));
  const totalWithdrawals = round2(entries.filter((r) => r.kind === "malik_ne_nikala").reduce((s, r) => s + Number(r.amount ?? 0), 0));

  return {
    totalInvestment,
    totalWithdrawals,
    netOwnerEquity: round2(totalInvestment - totalWithdrawals),
    entryCount: entries.length,
    note: "Sirf Paisa & Khata ke zariye darj shuda, Finance/Owner se manzoor-shuda entries. \"Opening\" aur \"Additional\" mein farq nahi kiya — wo faisla khud data mein maujood nahi. Retained Profit/Current Equity abhi shamil nahi (Stock/FIFO ke baad, Phase 2E).",
  };
}

/**
 * Phase 2 — Shop-wise Outstanding (jo migration 373 mein staff-wise
 * bana tha, wohi formula, sirf shop ki poori jama).
 *
 * Malik ka usool jaisa hai waisa: duplicate nahi, "sirf jama karne ka
 * tareeqa alag" -- data wahi (pos_sale_payment_details, pos_returns,
 * pos_collection_deposits), staff ke bajaye shop tak jama.
 */
export interface ShopCollectionOutstanding {
  /** Lifetime cash sale minus cash returns, is shop mein (sab staff mila kar). */
  totalCashCollected: number;
  approvedDeposits: number;
  pendingDeposits: number;
  /** totalCashCollected − approvedDeposits. */
  outstanding: number;
}

export async function shopCollectionOutstanding(shopId: string): Promise<ShopCollectionOutstanding> {
  const service = createServiceClient();

  const { data: sales } = await service.from("pos_sales").select("id").eq("shop_id", shopId);
  const saleIds = (sales ?? []).map((s) => s.id as string);

  const [{ data: payments }, { data: returns }, { data: deposits }] = await Promise.all([
    saleIds.length > 0
      ? service.from("pos_sale_payment_details").select("amount").eq("payment_method", "cash").in("sale_id", saleIds)
      : Promise.resolve({ data: [] as { amount: number }[] }),
    saleIds.length > 0
      ? service.from("pos_returns").select("total_amount").eq("refund_method", "cash").in("sale_id", saleIds)
      : Promise.resolve({ data: [] as { total_amount: number }[] }),
    service.from("pos_collection_deposits").select("amount, status").eq("shop_id", shopId),
  ]);

  const cash = (payments ?? []).reduce((s, p) => s + Number(p.amount ?? 0), 0);
  const returned = (returns ?? []).reduce((s, r) => s + Number(r.total_amount ?? 0), 0);
  const totalCashCollected = round2(cash - returned);

  const depositRows = (deposits ?? []) as { amount: number; status: string }[];
  const approvedDeposits = round2(depositRows.filter((d) => d.status === "approved").reduce((s, d) => s + Number(d.amount ?? 0), 0));
  const pendingDeposits = round2(depositRows.filter((d) => d.status === "pending").reduce((s, d) => s + Number(d.amount ?? 0), 0));

  return {
    totalCashCollected,
    approvedDeposits,
    pendingDeposits,
    outstanding: round2(totalCashCollected - approvedDeposits),
  };
}

export interface ShopCashControl {
  openShiftsCount: number;
  closedShiftsCount: number;
  /** Band shifts ka jama -- POS Shift close par jo asal mein darj hua. */
  openingCashClosed: number;
  expectedCashClosed: number;
  countedCashClosed: number;
  differenceClosed: number;
  /** Khule shifts ka "abhi tak ka andaza" -- physical count abhi nahi hua. */
  openShiftsLiveExpected: number;
  /** Sirf CASH tareeqe se -- context ke liye. */
  cashSalesToday: number;
  cashRecoveryToday: number;
  cashExpensesToday: number;
  /** Phase 2C se -- sirf CASH method wale investment/withdrawal. */
  cashInvestmentToday: number;
  cashWithdrawalToday: number;
  /**
   * Phase 2D — asal, poora hisaab: `differenceClosed` (POS Shift Close
   * ka apna hisaab) mein se Recovery/Investment ghata kar aur Withdrawal
   * jorh kar. Wajah: Recovery/Investment/Withdrawal ka paisa bhi USI
   * golak mein jata/aata hai jo shift close par ginti hoti hai, magar
   * Shift Close ka apna formula (`shift-cash.ts`) inhein jaanta hi nahi
   * -- is liye jo "farq" wo dikhata hai, us mein ye teen cheezein bhi
   * shamil hoti hain, ghalti nahi hoti. Yahan unhein ALAG kar ke asal,
   * baqi bacha hua (WAQAI unexplained) farq nikalte hain.
   */
  fullDifference: number;
  note: string;
}

/**
 * Cash Control -- is shop ke POS counters ki (from..to) shifts jama kar
 * ke. `pos_shifts.expected_cash`/`counted_cash`/`difference` WOHI adad
 * hain jo staff ne Shift Close par asal mein darj kiye -- yahan dobara
 * nahi ginte, sirf jama karte hain (taake shop-level number aur staff
 * ka apna shift-level number kabhi alag na ho).
 *
 * Khula shift ka `expected_cash` abhi database mein nahi likha (sirf
 * Close par likha jata hai) -- is liye khule shifts ke liye `computeShiftCash`
 * se LIVE andaza nikala jata hai (wohi function jo POS ka apna "abhi tak
 * ki sale" preview istemal karta hai), aur "abhi tak ka andaza" ke tor
 * par ALAG dikhaya jata hai -- band shifts ke asal difference ke sath
 * kabhi mix nahi kiya jata, kyunke khule shift ka physical count hi
 * nahi hua.
 *
 * Din, hafta, mahina ya custom range -- `from`/`to` barabar ho to ek
 * din, warna poora arsa. Har shift ka `difference` apne aap mein
 * mukammal/durust hisaab hai (us shift ke apne opening/counted se), is
 * liye kai din ki shifts ka `difference` jama karna bhi durust hai --
 * "opening cash" jama karna sirf malumati hai, hisaab mein istemal
 * nahi hota.
 */
export async function shopCashControl(shopId: string, fromDate: string, toDate: string): Promise<ShopCashControl> {
  const service = createServiceClient();

  const { data: counters } = await service.from("pos_counters").select("id").eq("shop_id", shopId);
  const counterIds = (counters ?? []).map((c) => c.id as string);

  let shifts: { id: string; status: string; opening_cash: number; expected_cash: number | null; counted_cash: number | null; difference: number | null }[] = [];
  if (counterIds.length > 0) {
    const rangeStart = `${fromDate}T00:00:00`;
    const rangeEnd = `${toDate}T23:59:59.999`;
    const { data } = await service
      .from("pos_shifts")
      .select("id, status, opening_cash, expected_cash, counted_cash, difference")
      .in("counter_id", counterIds)
      .gte("opened_at", rangeStart)
      .lte("opened_at", rangeEnd);
    shifts = data ?? [];
  }

  const closed = shifts.filter((s) => s.status === "closed");
  const open = shifts.filter((s) => s.status !== "closed");

  const openingCashClosed = round2(closed.reduce((s, r) => s + Number(r.opening_cash ?? 0), 0));
  const expectedCashClosed = round2(closed.reduce((s, r) => s + Number(r.expected_cash ?? 0), 0));
  const countedCashClosed = round2(closed.reduce((s, r) => s + Number(r.counted_cash ?? 0), 0));
  const differenceClosed = round2(closed.reduce((s, r) => s + Number(r.difference ?? 0), 0));

  let openShiftsLiveExpected = 0;
  for (const s of open) {
    const live = await computeShiftCash(s.id, Number(s.opening_cash ?? 0));
    openShiftsLiveExpected += live.expectedCash;
  }
  openShiftsLiveExpected = round2(openShiftsLiveExpected);

  const [salesByMethod, mapRows] = await Promise.all([
    shopPaymentMethodBreakdown(shopId, fromDate, toDate),
    (async () => {
      const accountToMethod = await accountToMethodMap();
      const { data: expenseRows } = await service
        .from("company_expense_requests")
        .select("kind, amount, paid_from_account_id")
        .eq("shop_id", shopId)
        .eq("status", "approved")
        .gte("expense_date", fromDate)
        .lte("expense_date", toDate);
      return { accountToMethod, rows: (expenseRows ?? []) as { kind: string; amount: number; paid_from_account_id: string | null }[] };
    })(),
  ]);

  const cashSalesToday = round2(salesByMethod.find((r) => r.method === "cash")?.sales ?? 0);

  let cashRecoveryToday = 0;
  let cashExpensesToday = 0;
  let cashInvestmentToday = 0;
  let cashWithdrawalToday = 0;
  for (const r of mapRows.rows) {
    const method = r.paid_from_account_id ? mapRows.accountToMethod.get(r.paid_from_account_id) : null;
    if (method !== "cash") continue;
    const amt = Number(r.amount ?? 0);
    if (RECOVERY_KINDS.includes(r.kind)) cashRecoveryToday += amt;
    else if (GAYE_KINDS.includes(r.kind)) cashExpensesToday += amt;
    else if (r.kind === "malik_ka_sarmaya") cashInvestmentToday += amt;
    else if (r.kind === "malik_ne_nikala") cashWithdrawalToday += amt;
  }

  // Asal farq: shift close ka apna farq, minus Recovery/Investment (jo
  // golak mein aaya magar shift ke formula ko maloom nahi tha), plus
  // Withdrawal (jo golak se nikla magar shift ke formula ko maloom nahi
  // tha). Jo bacha, wohi WAQAI puchhne wala farq hai.
  const fullDifference = round2(differenceClosed - cashRecoveryToday - cashInvestmentToday + cashWithdrawalToday);

  return {
    openShiftsCount: open.length,
    closedShiftsCount: closed.length,
    openingCashClosed,
    expectedCashClosed,
    countedCashClosed,
    differenceClosed,
    openShiftsLiveExpected: round2(openShiftsLiveExpected),
    cashSalesToday,
    cashRecoveryToday: round2(cashRecoveryToday),
    cashExpensesToday: round2(cashExpensesToday),
    cashInvestmentToday: round2(cashInvestmentToday),
    cashWithdrawalToday: round2(cashWithdrawalToday),
    fullDifference,
    note:
      open.length > 0
        ? `${open.length} shift abhi khuli hai -- us ka physical count abhi nahi hua, is liye difference mein shamil nahi.`
        : "Sab shifts band hain.",
  };
}

export interface BranchShop360Row {
  shopId: string;
  shopName: string;
  stockValue: number | null;
  cashDigitalTotal: number;
  cashDifference: number;
  openShifts: number;
  outstanding: number;
  netOwnerEquity: number;
}

export interface BranchConsolidated360 {
  shops: BranchShop360Row[];
  totalStockValue: number;
  totalCashDigital: number;
  totalCashDifference: number;
  totalOpenShifts: number;
  totalOutstanding: number;
  totalNetOwnerEquity: number;
  /** Ek hi adad, poori branch ke liye -- shop ke hisaab se dobara nahi ginta (double count na ho). */
  receivableBranchLevel: number | null;
  note: string;
}

/**
 * Phase 5 — Branch Consolidation. Har shop ka apna, independently
 * durust hisaab (upar wale functions) hi jama kiya jata hai -- koi
 * naya "branch-level" formula nahi likha, is liye shop-to-shop internal
 * stock transfer consolidated total ko phoola nahi sakta (wo sirf
 * jagah badalta hai, kul stock waisa hi rehta hai). Receivable ek hi
 * dafa liya jata hai (kisi ek shop se) -- wo khud branch-level hai,
 * har shop ke liye dobara jorna usay N guna kar deta.
 */
export async function branchConsolidated360(branchId: string, date: string): Promise<BranchConsolidated360> {
  const service = createServiceClient();
  const { data: shops } = await service.from("shops").select("id, name").eq("branch_id", branchId).eq("is_active", true).order("name");
  const shopList = shops ?? [];

  if (shopList.length === 0) {
    return {
      shops: [],
      totalStockValue: 0,
      totalCashDigital: 0,
      totalCashDifference: 0,
      totalOpenShifts: 0,
      totalOutstanding: 0,
      totalNetOwnerEquity: 0,
      receivableBranchLevel: null,
      note: "Is branch mein koi active shop nahi mili.",
    };
  }

  const rows: BranchShop360Row[] = [];
  let receivableBranchLevel: number | null = null;

  for (const s of shopList) {
    const [money, cashControl, outstanding, investment] = await Promise.all([
      shopWhereIsMyMoney(s.id),
      shopCashControl(s.id, date, date),
      shopCollectionOutstanding(s.id),
      shopInvestmentPosition(s.id),
    ]);
    if (receivableBranchLevel == null) receivableBranchLevel = money.receivableBranchLevel;

    rows.push({
      shopId: s.id,
      shopName: s.name,
      stockValue: money.stockValueApprox,
      cashDigitalTotal: money.cashDigitalTotal,
      cashDifference: cashControl.fullDifference,
      openShifts: cashControl.openShiftsCount,
      outstanding: outstanding.outstanding,
      netOwnerEquity: investment.netOwnerEquity,
    });
  }

  return {
    shops: rows,
    totalStockValue: round2(rows.reduce((s, r) => s + (r.stockValue ?? 0), 0)),
    totalCashDigital: round2(rows.reduce((s, r) => s + r.cashDigitalTotal, 0)),
    totalCashDifference: round2(rows.reduce((s, r) => s + r.cashDifference, 0)),
    totalOpenShifts: rows.reduce((s, r) => s + r.openShifts, 0),
    totalOutstanding: round2(rows.reduce((s, r) => s + r.outstanding, 0)),
    totalNetOwnerEquity: round2(rows.reduce((s, r) => s + r.netOwnerEquity, 0)),
    receivableBranchLevel,
    note: "Receivable poori branch ka ek hi adad hai -- har shop ke liye dobara nahi jorha gaya (double-count na ho).",
  };
}
