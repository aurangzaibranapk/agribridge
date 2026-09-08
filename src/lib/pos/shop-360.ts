import { createServiceClient } from "@/lib/supabase/service";
import { billQismKaLabel } from "@/lib/kharche";
import { ACC } from "@/lib/ledger/rules";
import { shopPaymentMethodBreakdown, type ShopPaymentMethodRow } from "@/lib/pos/shop-payment-methods";

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

  const { data: mapRows } = await service.from("payment_method_account_map").select("payment_method, finance_account_id");
  const accountToMethod = new Map<string, string>();
  for (const m of (mapRows ?? []) as { payment_method: string; finance_account_id: string | null }[]) {
    if (m.finance_account_id) accountToMethod.set(m.finance_account_id, m.payment_method);
  }
  const METHOD_LABEL: Record<string, string> = {
    cash: "Cash", bank_transfer: "Bank Transfer", card: "Card", jazzcash: "JazzCash",
    easypaisa: "Easypaisa", qr: "QR", khata: "Khata (udhaar)",
  };

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
 * "Paisa Kahan Hai?" -- Stock + Cash/Bank/Digital (lifetime, is shop
 * ki) + Receivable (branch tak) + Payable (abhi nahi).
 */
export async function shopWhereIsMyMoney(shopId: string): Promise<ShopWhereIsMyMoney> {
  const service = createServiceClient();

  const { data: shop } = await service.from("shops").select("branch_id, created_at").eq("id", shopId).maybeSingle();
  const branchId = (shop?.branch_id as string | null) ?? null;
  // Shop kab bani -- lifetime hisaab isi din se shuru hota hai, us se
  // pehle ka data hai hi nahi.
  const fromDate = shop?.created_at ? String(shop.created_at).slice(0, 10) : "2020-01-01";
  const today = new Date().toISOString().slice(0, 10);

  const [warehouseRes, byMethod, receivable] = await Promise.all([
    service.from("warehouses").select("id").eq("shop_id", shopId).limit(1).maybeSingle(),
    shopPaymentMethodBreakdown(shopId, fromDate, today),
    branchId ? branchReceivableFromLedger(branchId) : Promise.resolve(null),
  ]);

  let stockValueApprox: number | null = null;
  const warehouseId = warehouseRes.data?.id as string | undefined;
  if (warehouseId) {
    const { data: invRows } = await service
      .from("inventory")
      .select("quantity_on_hand, products(purchase_price)")
      .eq("warehouse_id", warehouseId);
    stockValueApprox = round2(
      (invRows ?? []).reduce((sum, r: any) => {
        const product = Array.isArray(r.products) ? r.products[0] : r.products;
        return sum + Number(r.quantity_on_hand ?? 0) * Number(product?.purchase_price ?? 0);
      }, 0)
    );
  }

  return {
    stockValueApprox,
    stockValueNote: "Abhi maal ki maujooda price se (MRP/selling nahi, purchase price) -- asal FIFO cost Phase 2 mein.",
    byPaymentMethod: byMethod,
    cashDigitalTotal: round2(byMethod.reduce((s, r) => s + r.net, 0)),
    receivableBranchLevel: receivable,
    receivableNote:
      "Ledger (account 1100) se, is shop ki poori BRANCH tak -- shop tak nahi, kyunke Load & Bill ka udhaar/wasooli sirf branch tak darj hota hai, shop tag nahi karta.",
    payable: null,
    payableNote: "Abhi shop-wise track nahi hoti -- purchases shop se reliably linked nahi hain. Branch/company level Finance ke safhe par dekhein.",
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
