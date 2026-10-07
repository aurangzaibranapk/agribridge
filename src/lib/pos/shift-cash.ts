import { createServiceClient } from "@/lib/supabase/service";
import { ACC } from "@/lib/ledger/rules";

export interface ShiftCashSummary {
  saleCount: number;
  /** pos_sales.total_amount ka jama -- poori bikri, tareeqa chahe koi ho. */
  totalSales: number;
  /** Sirf CASH tareeqe se aaya paisa (pos_sale_payment_details, method='cash'). */
  cashSalesTotal: number;
  /** Udhaar (Khata) par gaya hissa. */
  khataTotal: number;
  /** Har qisam ki wapsi, gross aur net sale ko saaf dikhane ke liye. */
  returnsTotal: number;
  /** Bank/card/Easypaisa/JazzCash/QR -- na cash na khata. */
  digitalTotal: number;
  cashReturnsTotal: number;
  /** Is shift mein Load & Bill ki Bill wali qatarein (kind='bill'), sab methods jama. */
  billTotal: number;
  /** Is shift mein Load & Bill ki Load wali qatarein (kind='load'), sab methods jama. */
  loadTotal: number;
  /** Load+Bill mein se sirf CASH se hua hissa -- golak mein isi se farq paRta hai. */
  loadBillCashTotal: number;
  /** Is shift mein CASH mein diya gaya Udhaar (golak se nikla). */
  udhaarGivenCashTotal: number;
  /** Is shift mein CASH mein wasool hui Recovery (golak mein aaya). */
  recoveryCashTotal: number;
  /** opening_cash + cashSalesTotal + loadBillCashTotal + recoveryCashTotal − cashReturnsTotal − udhaarGivenCashTotal. */
  expectedCash: number;
  bankTransferTotal: number;
  serviceChargeTotal: number;
  recoveryTotal: number;
  udhaarGivenTotal: number;
  accountMovements: { accountId: string; name: string; received: number; paid: number; net: number }[];
}

/**
 * Khaali jama -- opening_cash rakhne ke ilawa sab sifar. Ye khud kisi
 * ka jhoota "sab theek hai" nahi -- caller ko pata hai ke is shift mein
 * abhi tak koi sale/return record nahi mila.
 */

interface LoadBillRow {
  kind: string;
  payment_method: string | null;
  principal: number | string | null;
  service_charge?: number | string | null;
}

/** journal_lines ki qatar, account_code = ACC.cash (1000) wali, customer_udhaar se. */
interface UdhaarCashLegRow {
  debit: number | string | null;
  credit: number | string | null;
}

/**
 * Asal hisaab -- ek shift ki (pehle se fetch ki hui) sales/payments/
 * returns ki qatarein le kar jama karta hai. `computeShiftCash` (ek
 * shift, khud fetch karta hai) aur report page (kai shift, ek sath bulk
 * fetch kar ke ye function har shift ke liye alag se bulati hai) DONO
 * yehi istemal karte hain -- taake formula ek hi jagah rahe.
 *
 * `pos_sales.cash_paid` ka naam gumraah karta hai -- ismein cash + bank +
 * digital, TEENON shamil hain (sirf khata alag hai; dekhein pos-client.tsx
 * ka `cashCollected = deyRaqam - khataTotal`). Golak mein asal mein kitna
 * paisa hona chahiye, is ka jawab sirf `pos_sale_payment_details` se milta
 * hai, jahan har tareeqa (cash/bank/jazzcash/...) apni ALAG qatar mein hai.
 *
 * `loadBillRows`/`udhaarCashRows` marzi se hain -- report page (jahan
 * kai shift ek sath bulk fetch hoti hain) filhaal khali fehrist bhejta
 * hai; `computeShiftCash` (Shift Band Karein ka asal hisaab) dono bhejta
 * hai (18 September, malik: "Bill, Load, Udhaar, Recovery bhi golak ke
 * hisaab mein aane chahiye").
 */
export function aggregateShiftCash(
  openingCash: number,
  sales: { total_amount: number | string | null; khata_amount: number | string | null }[],
  payments: { payment_method: string | null; amount: number | string | null }[],
  returns: { total_amount: number | string | null; refund_method?: string | null; cash_refund?: number | string | null }[],
  loadBillRows: LoadBillRow[] = [],
  udhaarCashRows: UdhaarCashLegRow[] = [],
  deskCashRows?: UdhaarCashLegRow[]
): ShiftCashSummary {
  const totalSales = sales.reduce((s, r) => s + Number(r.total_amount ?? 0), 0);
  const khataTotal = sales.reduce((s, r) => s + Number(r.khata_amount ?? 0), 0);

  // Bug (18 September, malik: "Total Sale se Cash+Digital+Khata match
  // nahi ho rahe"): `pos_sale_payment_details` mein Khata ki apni
  // qatarein bhi hoti hain (khud POS bhejta hai) -- "agar cash nahi to
  // Digital" wali shart unhen dobara Digital mein gin leti thi, jab ke
  // Khata pehle hi neeche `sales.khata_amount` se alag gin chuka hota
  // hai. Ab Khata ki qatarein yahan chhoR di jati hain (double-count
  // se bachne ke liye) -- sirf cash aur digital (bank/card/jazzcash/
  // easypaisa/qr/waseela) hi is loop mein aate hain.
  let cashSalesTotal = 0;
  let digitalTotal = 0;
  for (const p of payments) {
    const amt = Number(p.amount ?? 0);
    if (p.payment_method === "cash") cashSalesTotal += amt;
    else if (p.payment_method === "khata") continue;
    else digitalTotal += amt;
  }

  const returnsTotal = returns.reduce((s, r) => s + Number(r.total_amount ?? 0), 0);
  // Golak se nikla paisa:
  //   refund_method = null/"cash" → poori raqam cash (purani qatarein ya seedhi cash wapsi)
  //   refund_method = "original" → cash_refund field mein sirf cash hissa (467: SQL fix)
  //   refund_method = "khata" → golak nahi, 0
  const cashReturnsTotal = returns.reduce((s, r) => {
    if (r.refund_method == null || r.refund_method === "cash") return s + Number(r.total_amount ?? 0);
    if (r.refund_method === "original") return s + Number(r.cash_refund ?? 0);
    return s;
  }, 0);

  let billTotal = 0;
  let loadTotal = 0;
  let loadBillCashTotal = 0;
  for (const l of loadBillRows) {
    const amt = Number(l.principal ?? 0);
    if (l.kind === "bill") billTotal += amt;
    else if (l.kind === "load") loadTotal += amt;
    if (l.payment_method === "cash") loadBillCashTotal += amt + Number(l.service_charge ?? 0);
  }

  // customer-udhaar.ts ka posting: Udhaar DENA cash (asset) account ko
  // CREDIT karta hai (paisa bahar gaya, asset account mein credit =
  // ghatna), Recovery cash ko DEBIT karta hai (paisa andar aaya, asset
  // mein debit = barhna) -- is liye cash-leg par credit = diya gaya,
  // debit = wasool hua. Testing DB ki asal qatarein se cross-check kiya
  // (Aurangzaib Rs 2,000 diya = credit row, Rs 300 wapas aaya = debit row).
  let udhaarGivenCashTotal = 0;
  let recoveryCashTotal = 0;
  for (const u of udhaarCashRows) {
    udhaarGivenCashTotal += Number(u.credit ?? 0);
    recoveryCashTotal += Number(u.debit ?? 0);
  }

  // Use posted cash legs for desk services: includes charges, bank transfers,
  // settlements and reversals, rather than guessing from principal amounts.
  if (deskCashRows) loadBillCashTotal = deskCashRows.reduce((sum, row) => sum + Number(row.debit ?? 0) - Number(row.credit ?? 0), 0);

  return {
    bankTransferTotal: 0, serviceChargeTotal: loadBillRows.reduce((sum, row) => sum + Number(row.service_charge ?? 0), 0),
    recoveryTotal: recoveryCashTotal, udhaarGivenTotal: udhaarGivenCashTotal, accountMovements: [],
    saleCount: sales.length,
    totalSales,
    cashSalesTotal,
    khataTotal,
    returnsTotal,
    digitalTotal,
    cashReturnsTotal,
    billTotal,
    loadTotal,
    loadBillCashTotal,
    udhaarGivenCashTotal,
    recoveryCashTotal,
    expectedCash:
      Number(openingCash) + cashSalesTotal - cashReturnsTotal + loadBillCashTotal + recoveryCashTotal - udhaarGivenCashTotal,
  };
}

/**
 * EK shift ka cash hisaab, khud fetch kar ke. Close Shift (action) aur
 * "abhi tak kitni sale hui" wala live preview (UI), DONO isi se chalte
 * hain -- taake dikhaya gaya adad aur asal band karte waqt ginta gaya
 * adad kabhi alag na ho.
 *
 * Load & Bill, Udhaar aur Recovery ka apna `shift_id` nahi hota (sirf
 * POS sales ka hota hai) -- is liye ye isi staff ki, isi shift ke khulne
 * (`opened_at`) se ab tak ki qatarein shop ke hisaab se le kar shamil
 * karta hai (Load & Bill ka `shop_id`, Udhaar/Recovery ka `branch_id` se
 * -- ledger mein shop_id nahi hota, dekhein my-work.tsx ka isi tarah ka
 * note).
 */
export async function computeShiftCash(shiftId: string, openingCash: number): Promise<ShiftCashSummary> {
  const service = createServiceClient();

  const { data: shift, error: shiftError } = await service
    .from("pos_shifts")
    .select("staff_id, opened_at, closed_at, pos_counters(shop_id, branch_id)")
    .eq("id", shiftId)
    .maybeSingle();
  if (shiftError || !shift) throw new Error("Shift cash could not be verified: shift unavailable.");
  const counter = shift?.pos_counters as { shop_id: string | null; branch_id: string | null } | { shop_id: string | null; branch_id: string | null }[] | null;
  const counterRow = Array.isArray(counter) ? counter[0] : counter;
  const shopId = counterRow?.shop_id ?? null;
  const branchId = counterRow?.branch_id ?? null;
  const staffId = (shift?.staff_id as string | null) ?? null;
  const fromTs = (shift?.opened_at as string | undefined) ?? null;
  const toTs = (shift?.closed_at as string | undefined) ?? new Date().toISOString();

  // Return `sale_id` se nahi, `shift_id` se poochha jata hai (380) --
  // aaj ki shift mein KAL ki bikri ka cash refund bhi golak se nikalta
  // hai. `sale_id IN (isi shift ki sales)` wala purana tareeqa aisi
  // wapsiyan bilkul chhoR deta tha, aur shift "kam" nazar aati bina
  // wajah bataye.
  async function fetchAll(factory: () => any, orderColumn = "id"): Promise<{ data: any[]; error: null }> {
    const data: any[] = [];
    for (let offset = 0; ; offset += 1000) {
      const page = await factory().order(orderColumn).range(offset, offset + 999);
      if (page.error) throw new Error("Shift cash could not be verified: " + page.error.message);
      data.push(...(page.data ?? []));
      if ((page.data?.length ?? 0) < 1000) return { data, error: null };
    }
  }
  const results = await Promise.all([
    fetchAll(() => service.from("pos_sales").select("id, total_amount, khata_amount").eq("shift_id", shiftId)),
    fetchAll(() => service.from("pos_returns").select("total_amount, refund_method, cash_refund").eq("shift_id", shiftId)),
    shopId && staffId && fromTs
      ? fetchAll(() => service
          .from("load_transactions")
          .select("kind, payment_method, principal, service_charge")
          .eq("shop_id", shopId)
          .eq("created_by", staffId)
          .in("kind", ["load", "bill"])
          .neq("status", "wapas")
          .gte("created_at", fromTs)
          .lte("created_at", toTs))
      : Promise.resolve({ data: [] as LoadBillRow[] }),
    branchId && staffId && fromTs
      ? fetchAll(() => service
          .from("journal_lines")
          .select("debit, credit, journal_entries!inner(description, source_module, branch_id, created_by, created_at, pos_shift_id)")
          .eq("account_code", ACC.cash)
          .eq("journal_entries.source_module", "customer_udhaar")
          .eq("journal_entries.branch_id", branchId)
          .or(`pos_shift_id.is.null,pos_shift_id.eq.${shiftId}`, { foreignTable: "journal_entries" })
          .eq("journal_entries.created_by", staffId)
          .gte("journal_entries.created_at", fromTs)
          .lte("journal_entries.created_at", toTs))
      : Promise.resolve({ data: [] as UdhaarCashLegRow[] }),
    branchId && staffId && fromTs
      ? fetchAll(() => service.from("journal_lines")
          .select("debit, credit, journal_entries!inner(description, source_module, branch_id, created_by, created_at, pos_shift_id)")
          .eq("account_code", ACC.cash)
          .in("journal_entries.source_module", ["load_bill", "bank_transfer", "load_bill_settle", "load_float", "load_reversal"])
          .eq("journal_entries.branch_id", branchId)
          .or(`pos_shift_id.is.null,pos_shift_id.eq.${shiftId}`, { foreignTable: "journal_entries" })
          .eq("journal_entries.created_by", staffId)
          .gte("journal_entries.created_at", fromTs)
          .lte("journal_entries.created_at", toTs))
      : Promise.resolve({ data: [] as UdhaarCashLegRow[], error: null }),
  ]);
  const [salesResult, returnsResult, loadsResult, udhaarResult, deskResult] = results;
  const shiftSales = salesResult.data as { id: string; total_amount: number; khata_amount: number }[] | null;
  const returns = returnsResult.data as { total_amount: number; refund_method: string | null; cash_refund: number }[] | null;
  const loadBillRows = loadsResult.data as LoadBillRow[] | null;
  const udhaarCashRows = udhaarResult.data as UdhaarCashLegRow[] | null;
  const deskCashRows = deskResult.data as UdhaarCashLegRow[] | null;
  const rows = shiftSales ?? [];
  const returnRows = returns ?? [];
  const loadBill = loadBillRows ?? [];
  const udhaarCash = udhaarCashRows ?? [];
  const saleIds = rows.map((r) => r.id);
  const { data: payments } =
    saleIds.length > 0
      ? await fetchAll(() => service.from("pos_sale_payment_details").select("payment_method, amount").in("sale_id", saleIds))
      : { data: [] as { payment_method: string | null; amount: number | string | null }[] };

  const summary = aggregateShiftCash(openingCash, rows, payments ?? [], returnRows, loadBill, udhaarCash, deskCashRows ?? []);
  if (!staffId || !branchId || !fromTs) throw new Error("Shift staff/branch/time missing; cash verification required.");
  const [bank, partyLegs, claims] = await Promise.all([
    fetchAll(() => (service as any).from("bank_transfer_transactions")
      .select("principal, service_charge").eq("created_by", staffId).eq("shop_id", shopId)
      .neq("status", "wapas").gte("created_at", fromTs).lte("created_at", toTs)),
    fetchAll(() => service.from("journal_lines")
      .select("debit, credit, journal_entries!inner(description, source_module, branch_id, created_by, created_at, pos_shift_id)")
      .in("account_code", ["1100", "1150"]).eq("journal_entries.source_module", "customer_udhaar")
      .or(`pos_shift_id.is.null,pos_shift_id.eq.${shiftId}`, { foreignTable: "journal_entries" })
          .eq("journal_entries.created_by", staffId).eq("journal_entries.branch_id", branchId)
      .gte("journal_entries.created_at", fromTs).lte("journal_entries.created_at", toTs)),
    fetchAll(() => service.from("journal_entry_sources")
      .select("source_row_id, journal_entries!inner(description, source_module, branch_id, created_by, created_at, pos_shift_id)")
      .eq("source_table", "finance_transactions")
      .in("journal_entries.source_module", ["pos", "pos_return", "load_bill", "bank_transfer", "customer_udhaar", "load_bill_settle", "load_float"])
      .or(`pos_shift_id.is.null,pos_shift_id.eq.${shiftId}`, { foreignTable: "journal_entries" })
          .eq("journal_entries.created_by", staffId).eq("journal_entries.branch_id", branchId)
      .gte("journal_entries.created_at", fromTs).lte("journal_entries.created_at", toTs), "source_row_id"),
  ]);
  summary.bankTransferTotal = bank.data.reduce((sum, r) => sum + Number(r.principal ?? 0), 0);
  summary.serviceChargeTotal += bank.data.reduce((sum, r) => sum + Number(r.service_charge ?? 0), 0);
  summary.udhaarGivenCashTotal = 0; summary.recoveryCashTotal = 0;
  for (const r of udhaarResult.data ?? []) {
    const entry = Array.isArray(r.journal_entries) ? r.journal_entries[0] : r.journal_entries;
    const description = String(entry?.description ?? "").replace(/^Reversal:\s*/i, "");
    if (/^Udhaar (ki wapsi|wapas aaya)/i.test(description)) summary.recoveryCashTotal += Number(r.debit) - Number(r.credit);
    else summary.udhaarGivenCashTotal += Number(r.credit) - Number(r.debit);
  }
  summary.udhaarGivenTotal = 0; summary.recoveryTotal = 0;
  for (const r of partyLegs.data) {
    const entry = Array.isArray(r.journal_entries) ? r.journal_entries[0] : r.journal_entries;
    const description = String(entry?.description ?? "").replace(/^Reversal:\s*/i, "");
    if (/^Udhaar (ki wapsi|wapas aaya)/i.test(description)) summary.recoveryTotal += Number(r.credit) - Number(r.debit);
    else summary.udhaarGivenTotal += Number(r.debit) - Number(r.credit);
  }
  const accounts = new Map<string, ShiftCashSummary["accountMovements"][number]>();
  const cashbookIds = [...new Set(claims.data.map((r) => r.source_row_id as string))];
  for (let offset = 0; offset < cashbookIds.length; offset += 500) {
    const { data, error } = await service.from("finance_transactions")
      .select("account_id, transaction_type, amount, finance_accounts(name)")
      .in("id", cashbookIds.slice(offset, offset + 500));
    if (error) throw new Error("Shift account receipts could not be verified: " + error.message);
    for (const r of data ?? []) {
      const account = Array.isArray(r.finance_accounts) ? r.finance_accounts[0] : r.finance_accounts;
      const movement = accounts.get(r.account_id) ?? { accountId: r.account_id, name: account?.name ?? "Account", received: 0, paid: 0, net: 0 };
      if (r.transaction_type === "income") movement.received += Number(r.amount);
      else if (r.transaction_type === "expense") movement.paid += Number(r.amount);
      movement.net = movement.received - movement.paid;
      accounts.set(r.account_id, movement);
    }
  }
  summary.accountMovements = [...accounts.values()].sort((a, b) => a.name.localeCompare(b.name));
  return summary;
}
