"use server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { ACC, failed, glForFinanceAccount } from "@/lib/ledger/rules";
import { postJournal, type JournalLine, type SourceClaim } from "@/lib/ledger/post";
import type { Json } from "@/lib/types/database.types";
import { loadPosPermissions } from "@/lib/pos/permissions";

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

  // Rate ki rok -- safhe par nahi, YAHAN.
  //
  // Rate browser se aata hai. Safhe par khana band kar dena us bande ko
  // nahi rokta jo seedha ye request bhej de -- aur counter par paise ka
  // faisla isi ek adad par hota hai. Is liye jis ke paas rate badalne ki
  // ijazat nahi, us ka bheja hua rate manzoor nahi hota: server khud
  // apna rate nikalta hai aur farq par bikri rok deta hai.
  const rateGhalat = await checkRates(input, user?.id ?? null);
  if (rateGhalat) return { error: rateGhalat };

  // Bina naam ka udhaar kabhi nahi.
  //
  // Malik ka usool (4 September): "Cash mein customer optional, Udhar
  // mein customer mandatory." Jo raqam kisi ke zimme nahi likhi gayi, wo
  // kisi se maangi bhi nahi ja sakti -- aur mahine baad wo sirf golak ke
  // farq ki soorat mein nazar aati hai, jahan us ka koi ilaj nahi hota.
  const udhaarGhalat = await checkCredit(input);
  if (udhaarGhalat) return { error: udhaarGhalat };

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
 * Bheja hua rate wohi hai jo hona chahiye?
 *
 * Jis ke paas rate badalne ki ijazat hai, us par koi rok nahi -- wo
 * faisla us ka hai aur bikri par likha bhi jata hai.
 *
 * Baqi sab ke liye rate server khud nikalta hai: thok wali dukan ho AUR
 * us cheez ka thok ka rate darj ho to thok, warna retail. Yehi hisaab
 * safhe par bhi chalta hai, is liye theek chalne wale counter par ye rok
 * kabhi saamne nahi aayegi -- ye sirf us raaste par khaRi hai jo safhe
 * se nahi guzarta.
 *
 * Ek paisa tak ka farq nahi pakaRa jata (0.01), warna gol karne se hi
 * bikri ruk jati.
 */
async function checkRates(
  input: { customerId: string | null; items: PosCartItem[] },
  userId: string | null
): Promise<string | null> {
  const { canEditRate } = await loadPosPermissions(userId);
  if (canEditRate) return null;
  if (input.items.length === 0) return null;

  const service = createServiceClient();

  let thok = false;
  if (input.customerId) {
    const { data: cust } = await service
      .from("customers")
      .select("customer_type")
      .eq("id", input.customerId)
      .maybeSingle();
    thok = cust?.customer_type === "wholesale_shop";
  }

  const ids = Array.from(new Set(input.items.map((i) => i.product_id)));
  const { data: products, error } = await service
    .from("products")
    .select("id, name, selling_price, wholesale_price")
    .in("id", ids);

  // Jawab hi na mile to bikri rok di jati hai. "Poochha nahi ja saka" ko
  // "sab theek hai" samajh lena wo ghalti hai jo sirf us din nazar aati
  // hai jab koi jaan boojh kar faida uthhata hai.
  if (error) return "Rate ki tasdeeq nahi ho saki, is liye bikri rok di gayi. Dobara koshish karein.";

  const byId = new Map((products ?? []).map((p) => [p.id, p]));

  for (const item of input.items) {
    const p = byId.get(item.product_id);
    if (!p) return "Is cheez ka rate nahi mila, bikri rok di gayi.";

    const chahiye = thok && p.wholesale_price != null ? Number(p.wholesale_price) : Number(p.selling_price);
    if (Math.abs(Number(item.unit_price) - chahiye) > 0.01) {
      return `"${p.name}" ka rate Rs ${chahiye.toLocaleString()} hai. Rate badalne ki ijazat aap ke paas nahi -- Admin se kehein.`;
    }
  }

  return null;
}

/**
 * Udhaar ka gahak maujood hai, aur hadd ke andar hai?
 *
 * DO alag jaanchein:
 *
 * 1. Khate par raqam ja rahi ho to gahak ka naam LAZMI. Safhe par bhi
 *    rok hai, magar safha ek darwaza hai -- ye rok us raaste par bhi
 *    khaRi hai jo safhe se nahi guzarta.
 *
 * 2. Udhaar ki hadd. Hadd DARJ HO (sifar se zyada) tabhi lagti hai.
 *    Khali ya sifar hadd ka matlab "hadd tay hi nahi hui" liya jata hai,
 *    "is ko udhaar bilkul nahi" nahi -- kyunke wo faisla kisi ne kiya hi
 *    nahi hota, aur us maan par har purana gahak aaj se ruk jata.
 */
async function checkCredit(input: {
  customerId: string | null;
  khataAmount: number;
}): Promise<string | null> {
  const khata = Number(input.khataAmount ?? 0);
  if (khata <= 0) return null;

  if (!input.customerId) {
    return "Udhaar sale ke liye darj shuda gahak chunein. Bina naam ke udhaar darj nahi hota.";
  }

  const service = createServiceClient();
  const { data: cust, error } = await service
    .from("customers")
    .select("name, current_balance, credit_limit")
    .eq("id", input.customerId)
    .maybeSingle();

  // Jawab na mile to bikri rok di jati hai. "Poochha nahi ja saka" ko
  // "sab theek hai" samajh lena wohi ghalti hai jo baad mein wasooli ke
  // waqt pakRi jati hai.
  if (error) return "Gahak ka khata nahi dekha ja saka, is liye udhaar rok diya gaya. Dobara koshish karein.";
  if (!cust) return "Gahak ka record nahi mila -- udhaar darj nahi ho sakta.";

  const hadd = cust.credit_limit == null ? 0 : Number(cust.credit_limit);
  if (hadd > 0) {
    const abTak = cust.current_balance == null ? 0 : Number(cust.current_balance);
    if (abTak + khata > hadd) {
      return `"${cust.name}" ki udhaar ki hadd Rs ${hadd.toLocaleString()} hai aur us par pehle hi Rs ${Math.round(
        abTak
      ).toLocaleString()} baqi hai. Ye bikri us hadd se aage nikal rahi hai -- Admin se manzoori lein.`;
    }
  }

  return null;
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
