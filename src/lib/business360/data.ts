import { createServiceClient } from "@/lib/supabase/service";
import { loadCustomerAging } from "@/lib/recovery/load-aging";
import type { PnlLineIn, BatchIn, CatItemIn, Maybe } from "./core";

/** Sirf parhna. Har source alag -- ek fail ho to sirf wahi "not available". */
const BIG = 50000;
const VOID = ["voided", "cancelled", "void"];
const num = (v: unknown) => { const n = Number(v ?? 0); return Number.isFinite(n) ? n : 0; };
async function rows<T = any>(p: PromiseLike<{ data: T[] | null; error: any }>): Promise<{ data: T[] | null; error: string | null }> {
  try { const r = await p; return r.error ? { data: null, error: r.error.message ?? String(r.error) } : { data: r.data ?? [], error: null }; }
  catch (e) { return { data: null, error: (e as Error).message }; }
}
const sum = (d: any[] | null, f: (r: any) => number): Maybe => (d == null ? null : Math.round(d.reduce((a, r) => a + f(r), 0) * 100) / 100);

export type PartyBalance = { type: string; receivable: Maybe; payable: Maybe; href: string; source: string };

export async function loadBusiness360(p: { from: string; to: string; today: string; branch: string | null }) {
  const db = createServiceClient() as any;
  const br = (q: any, col = "branch_id") => (p.branch ? q.eq(col, p.branch) : q);
  const tsFrom = `${p.from}T00:00:00+05:00`, tsTo = `${p.to}T23:59:59.999+05:00`;
  const tsToday = `${p.today}T00:00:00+05:00`, tsTodayEnd = `${p.today}T23:59:59.999+05:00`;
  const dead90 = new Date(Date.now() - 90 * 86_400_000).toISOString();

  const [pnlLines, todaySales, todayPurch, todayExp, accounts, suppliers, batches, sold90, catItems, grain, branches,
    dealersComm, dealersPaid, buyerOrders, buyerPays, invIn, invOut, staffLedger, lowInv] = await Promise.all([
    rows<PnlLineIn>(br(db.from("v_pnl_lines").select("account_code,account_name,kind,department,source_module,branch_id,entry_date,amount").gte("entry_date", p.from).lte("entry_date", p.to)).limit(BIG)),
    rows(br(db.from("pos_sales").select("total_amount,status").gte("created_at", tsToday).lte("created_at", tsTodayEnd)).limit(BIG)),
    rows(br(db.from("purchases").select("total_amount").eq("purchase_date", p.today)).limit(BIG)),
    rows(br(db.from("v_pnl_lines").select("amount,kind").eq("entry_date", p.today).in("kind", ["expense", "stock_adjustment"])).limit(BIG)),
    rows(db.from("finance_accounts").select("id,name,account_type,current_balance").eq("is_active", true).order("name")),
    rows(db.from("suppliers").select("current_payable").limit(BIG)),
    rows<BatchIn>(db.from("stock_batches").select("product_id,remaining_quantity,unit_cost,expiry_date").gt("remaining_quantity", 0).limit(BIG)),
    rows(db.from("pos_sale_items").select("product_id,pos_sales!inner(created_at)").gte("pos_sales.created_at", dead90).limit(BIG)),
    rows(br(db.from("pos_sale_items").select("subtotal,line_cogs,products(categories(name)),pos_sales!inner(created_at,status,branch_id)").gte("pos_sales.created_at", tsFrom).lte("pos_sales.created_at", tsTo), "pos_sales.branch_id").limit(BIG)),
    rows(db.from("grain_farmer_balances").select("farmer_id,balance_due").gt("balance_due", 0).limit(BIG)),
    rows(db.from("branches").select("id,name").order("name")),
    rows(db.from("bridge_orders").select("commission_amount").gt("commission_amount", 0).limit(BIG)),
    rows(db.from("dealer_payments").select("amount").limit(BIG)),
    rows(db.from("produce_orders").select("subtotal").limit(BIG)),
    rows(db.from("buyer_payments").select("amount,direction").limit(BIG)),
    rows(db.from("investor_investments").select("amount").limit(BIG)),
    rows(db.from("investor_returns").select("amount").limit(BIG)),
    rows(db.from("staff_credit_ledger").select("ledger_type,amount").limit(BIG)),
    rows(db.from("inventory").select("product_id,quantity_on_hand,products(name,min_stock_threshold)").limit(BIG)),
  ]);
  const aging = await loadCustomerAging().catch((e) => ({ rows: [], error: (e as Error).message }));
  const agingRows = aging.error ? null : aging.rows;

  const errors: Record<string, string> = {};
  const note = (k: string, r: { error: string | null }) => { if (r.error) errors[k] = r.error; };
  note("pnl", pnlLines); note("accounts", accounts); note("stock", batches); note("category", catItems); note("grain", grain);

  const sold = sold90.data ? new Set<string>(sold90.data.map((r: any) => r.product_id)) : null;
  const items: CatItemIn[] | null = catItems.data
    ? catItems.data.filter((r: any) => !VOID.includes(String(r.pos_sales?.status ?? "completed"))).map((r: any) => ({ category: r.products?.categories?.name ?? null, subtotal: num(r.subtotal), line_cogs: r.line_cogs == null ? null : num(r.line_cogs) }))
    : null;
  const low = lowInv.data
    ? lowInv.data.filter((r: any) => r.products?.min_stock_threshold != null && num(r.quantity_on_hand) <= num(r.products.min_stock_threshold)).map((r: any) => ({ id: r.product_id, name: r.products?.name ?? "—", qty: num(r.quantity_on_hand), min: num(r.products.min_stock_threshold) }))
    : null;

  const diff = (a: Maybe, b: Maybe): Maybe => (a == null || b == null ? null : Math.round((a - b) * 100) / 100);
  const buyerOwed = diff(sum(buyerOrders.data, (r) => num(r.subtotal)), diff(sum(buyerPays.data && buyerPays.data.filter((r: any) => r.direction === "they_paid"), (r) => num(r.amount)), sum(buyerPays.data && buyerPays.data.filter((r: any) => r.direction === "we_paid"), (r) => num(r.amount))));
  const staffOwed = diff(sum(staffLedger.data && staffLedger.data.filter((r: any) => r.ledger_type === "credit"), (r) => num(r.amount)), sum(staffLedger.data && staffLedger.data.filter((r: any) => r.ledger_type === "debit"), (r) => num(r.amount)));
  const pos = (v: Maybe) => (v == null ? null : Math.max(0, v));
  const neg = (v: Maybe) => (v == null ? null : Math.max(0, -v));
  const parties: PartyBalance[] = [
    { type: "customer", receivable: sum(agingRows, (r) => Math.max(0, num(r.balance))), payable: null, href: "/admin/receivable-aging", source: "customer khata aging" },
    { type: "farmer", receivable: null, payable: sum(grain.data, (r) => num(r.balance_due)), href: "/admin/grain-procurement/payments", source: "grain_farmer_balances" },
    { type: "dealer", receivable: null, payable: pos(diff(sum(dealersComm.data, (r) => num(r.commission_amount)), sum(dealersPaid.data, (r) => num(r.amount)))), href: "/admin/dealers", source: "commission - dealer_payments" },
    { type: "supplier", receivable: null, payable: sum(suppliers.data, (r) => Math.max(0, num(r.current_payable))), href: "/admin/suppliers/all-statement", source: "suppliers.current_payable" },
    { type: "buyer", receivable: pos(buyerOwed), payable: neg(buyerOwed), href: "/admin/buyers", source: "produce_orders - buyer_payments" },
    { type: "investor", receivable: null, payable: pos(diff(sum(invIn.data, (r) => num(r.amount)), sum(invOut.data, (r) => num(r.amount)))), href: "/admin/investors", source: "investments - returns" },
    { type: "staff", receivable: neg(staffOwed), payable: pos(staffOwed), href: "/admin/staff-khata", source: "staff_credit_ledger" },
  ];

  return {
    pnlLines: pnlLines.data,
    today: {
      sales: sum(todaySales.data && todaySales.data.filter((r: any) => !VOID.includes(String(r.status ?? "completed"))), (r) => num(r.total_amount)),
      purchases: sum(todayPurch.data, (r) => num(r.total_amount)),
      expenses: sum(todayExp.data, (r) => num(r.amount)),
    },
    accounts: accounts.data as { id: string; name: string; account_type: string; current_balance: number }[] | null,
    parties,
    overdueCredit: sum(agingRows, (r) => num(r.bucket_30_plus)),
    batches: batches.data, sold, items, low,
    grainPending: grain.data ? { count: grain.data.length, amount: sum(grain.data, (r) => num(r.balance_due)) } : null,
    branches: (branches.data ?? []) as { id: string; name: string }[],
    errors,
  };
}
