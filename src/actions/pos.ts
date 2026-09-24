"use server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { ACC, failed, glForFinanceAccount } from "@/lib/ledger/rules";
import { postJournal, type JournalLine, type SourceClaim } from "@/lib/ledger/post";
import type { Json } from "@/lib/types/database.types";

export interface PosCheckoutState {
  error?: string;
  notice?: string;
  saleId?: string;
}

export interface PosCartItem {
  product_id: string;
  quantity: number;
  unit_price: number;
}

export interface PosPaymentLine {
  method: string;
  amount: number;
  reference?: string;
  receipt_url?: string;
}

/**
 * POS ka checkout.
 *
 * Pehle browser seedha create_pos_sale ko bulata tha. Wo function bikri
 * likh deta tha, stock ghata deta tha, khata barha deta tha, aur cash
 * book mein qatar daal deta tha -- magar LEDGER mein kuch nahi jata tha.
 *
 * Us ka nateeja raat ki ginti par nazar aata tha: expectedCash ledger se
 * poochta hai (khata 1000), aur ledger ko POS ki bikri ka pata hi nahi
 * hota. Yani golak mein har roz "zyada" paisa nikalta -- poore din ki
 * bikri jitna -- aur manager ko har raat ek aisa farq milta jis ki koi
 * wajah nahi hoti. Zero-Rupee ki nazar ise pakaR to rahi thi (har bikri
 * "ledger mein nahi gayi" ki fehrist mein khaRi thi) magar theek karne
 * ka koi raasta nahi tha.
 *
 * Ab checkout yahan se guzarta hai: pehle wohi purana function (bikri,
 * stock, khata, cash book), phir ledger.
 *
 * Ledger ka posting SQL ke andar NAHI daala gaya. Wahan daalne ka matlab
 * hota ke hisaab ke usool do zabanon mein likhe jayen -- ek TypeScript
 * mein aur ek plpgsql mein -- aur phir wo ek din alag ho jate.
 */
export async function posCheckout(input: {
  customerId: string | null;
  paymentMode: string;
  cashPaid: number;
  khataAmount: number;
  items: PosCartItem[];
  paymentLines: PosPaymentLine[];
}): Promise<PosCheckoutState> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: saleIdRaw, error } = await supabase.rpc("create_pos_sale", {
    p_customer_id: input.customerId as string,
    p_payment_mode: input.paymentMode,
    p_cash_paid: input.cashPaid,
    p_khata_amount: input.khataAmount,
    p_items: input.items as unknown as Json,
    p_payment_lines: input.paymentLines as unknown as Json,
  });

  const saleId = saleIdRaw as string | null;
  if (error || !saleId) return { error: error?.message ?? "Bikri nahi ho saki." };

  const posted = await postSaleToLedger(saleId, user?.id ?? null);

  // Bikri ho chuki hai aur maal gahak ke haath mein ja chuka hai. Usay
  // mitana ab ghalat hoga. Magar chup rehna us se bhi bura: bulane wale
  // ko maloom hona chahiye ke ye bikri ledger mein nahi gayi, taake wo
  // raat ki ginti se pehle theek karwa sake.
  if (posted) return { saleId, notice: posted };

  return { saleId };
}

/**
 * Ek bikri ka hisaab.
 *
 *   Dr  cash / bank      jitna naqad (ya bank) aaya
 *   Dr  gahak ka udhaar  jitna khate par gaya
 *       Cr  dukan ki bikri            poori raqam
 *   Dr  maal ki lagat
 *       Cr  godam ka maal             lagat jitni
 *
 * Do alag baatein ek entry mein: paisa/udhaar aur lagat. Ye jaan boojh
 * kar ek hi entry hai -- waqia bhi ek hi hai. Do entriyan banane se ek
 * ke nakaam hone par doosri akeli reh jati hai.
 */
async function postSaleToLedger(saleId: string, userId: string | null): Promise<string | null> {
  const service = createServiceClient();

  const { data: sale } = await service
    .from("pos_sales")
    .select("id, total_amount, khata_amount, total_cogs, branch_id, created_at")
    .eq("id", saleId)
    .maybeSingle();
  if (!sale) return "Bikri ka record nahi mila, ledger mein nahi ja saki.";

  const { data: payments } = await service
    .from("pos_sale_payment_details")
    .select("payment_method, amount")
    .eq("sale_id", saleId);

  const lines: JournalLine[] = [];
  const claims: SourceClaim[] = [];

  // Har adaigi ke tareeqe ka apna khata. Ye Finance ke apne naqshe se
  // aata hai (payment_method_account_map), wohi jo cash book bharte waqt
  // istemal hota hai -- warna cash book kuch aur kehti aur ledger kuch
  // aur.
  for (const p of payments ?? []) {
    const amount = Number(p.amount);
    if (amount <= 0 || p.payment_method === "khata") continue;

    const { data: map } = await service
      .from("payment_method_account_map")
      .select("finance_account_id")
      .eq("payment_method", p.payment_method)
      .maybeSingle();

    const gl = map?.finance_account_id ? await glForFinanceAccount(map.finance_account_id) : ACC.suspense;
    lines.push({ account: gl, debit: amount, memo: `POS — ${p.payment_method}` });

    // Cash book ki jis qatar ne ye paisa likha tha, us par is entry ka
    // daawa. Bina daawe ke wo qatar hamesha "ledger mein nahi gayi" ki
    // fehrist mein khaRi rehti.
    if (map?.finance_account_id) {
      const { data: txn } = await service
        .from("finance_transactions")
        .select("id")
        .eq("account_id", map.finance_account_id)
        .eq("category", "pos_sale")
        .eq("amount", amount)
        .gte("created_at", sale.created_at)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (txn?.id) claims.push({ table: "finance_transactions", rowId: txn.id });
    }
  }

  const khata = Number(sale.khata_amount ?? 0);
  if (khata > 0) lines.push({ account: ACC.customerDue, debit: khata, memo: "POS — khata" });

  lines.push({ account: ACC.salesShop, credit: Number(sale.total_amount) });

  const cogs = Number(sale.total_cogs ?? 0);
  if (cogs > 0) {
    lines.push({ account: ACC.cogs, debit: cogs, memo: "POS — maal ki lagat" });
    lines.push({ account: ACC.stockGoods, credit: cogs });
  }

  const result = await postJournal({
    description: `POS bikri`,
    sourceModule: "pos",
    sourceId: saleId,
    branchId: sale.branch_id,
    lines,
    createdBy: userId,
    claims,
  });

  if (failed(result)) return `Bikri ho gayi magar ledger mein nahi gayi: ${result.error}`;
  return null;
}
