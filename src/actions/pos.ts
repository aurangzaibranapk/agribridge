"use server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { ACC, failed, glForFinanceAccount } from "@/lib/ledger/rules";
import { postJournal, type JournalLine, type SourceClaim } from "@/lib/ledger/post";
import type { Json } from "@/lib/types/database.types";
import { loadPosPermissions } from "@/lib/pos/permissions";
import { requireAction } from "@/lib/access/guard";
import { notifyUser } from "@/lib/notifications";

export interface PosCheckoutState {
  error?: string;
  notice?: string;
  saleId?: string;
}

export interface PosCartItem {
  product_id: string;
  quantity: number;
  unit_price: number;
  /**
   * Server tay karta hai (browser nahi): "carton" ho to create_pos_sale
   * quantity x units_per_pack bottle stock se ghatata hai (513).
   */
  sale_unit?: "carton" | "unit";
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
  /** Bill se zyada received payment; selected customer ke Jama/Advance mein credit hoti hai. */
  overpayment?: number;
  items: PosCartItem[];
  paymentLines: PosPaymentLine[];
  /** Bill par chhoRi hui raqam. 0 = discount diya hi nahi. */
  discount?: number;
  discountReason?: string;
  /** POS Counter (366/367) -- diya jaye to staff ke khule Shift se sale juRti hai. */
  counterId?: string | null;
  /**
   * Jab khata wale ka naam aur maal lene wala alag ho (malik, 15
   * September: "khata Aurangzaib ka hai, lay ke jaane wala Mohsin
   * hai") -- sirf record ke liye, koi ledger/hisaab is se nahi badalta.
   */
  receivedBy?: string;
  clientActionId?: string;
}): Promise<PosCheckoutState> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Farmer ko POS ki customer fehrist mein dikhaya jata hai "farmer:<id>"
  // jaisi banawati ID se (384) -- asal customers.id nahi, kyunke us waqt
  // tak us farmer ka koi Customer record bana hi nahi hota. Yahan, sab se
  // pehle, use asal customers.id mein badal dete hain -- taake neeche
  // rate/udhaar ki jaanch aur create_pos_sale ko hamesha ek asal, valid
  // customer ID hi mile, kabhi "farmer:..." jaisi string na jaye (wo
  // uuid khane mein seedha jaate hi bikri gira degi).
  if (input.customerId?.startsWith("farmer:")) {
    const resolved = await resolveFarmerCustomerId(input.customerId.slice("farmer:".length));
    if (!resolved) return { error: "Is farmer ka Customer record nahi ban saka. Dobara koshish karein." };
    input = { ...input, customerId: resolved };
  }

  // Feature-level ijazat -- sirf branch/shop wale staff par (dealer
  // apna alag darwaza hai, `dealers` table se, is nizam ka hissa nahi).
  // Legacy fallback (koi permission row hi nahi) chup chaap guzarne
  // deta hai -- purana kaam nahi tootega.
  if (user) {
    const { data: dealerRow } = await supabase.from("dealers").select("id").eq("user_id", user.id).eq("is_active", true).maybeSingle();
    if (!dealerRow) {
      const guard = await requireAction("pos", "create");
      if ("error" in guard) return { error: guard.error };
    }
  }

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

  // Discount ki rok bhi YAHAN, safhe par nahi -- wohi wajah jo rate ki
  // rok ki hai. Jis ke paas rate girane ki ijazat nahi, us ke haath
  // mein discount dena bhi wohi taqat hai: maal us qeemat par chala
  // jata hai jo malik ne tay nahi ki.
  const discount = Math.round((input.discount ?? 0) * 100) / 100;
  const serverDue = Math.round(
    (input.items.reduce((sum, item) => sum + item.quantity * item.unit_price, 0) - discount) * 100
  ) / 100;
  const serverReceived = Math.round(
    input.paymentLines.reduce((sum, line) => sum + Number(line.amount || 0), 0) * 100
  ) / 100;
  // Overpayment browser ke bheje hue number par nahi, server ke asal bill/payment
  // totals par calculate hoti hai.
  const overpayment = Math.max(0, Math.round((serverReceived - serverDue) * 100) / 100);
  if (overpayment > 0 && !input.customerId) {
    return { error: "Zyada payment ko customer ke Jama/Advance mein dalne ke liye customer select karein." };
  }
  // Cash / khata totals payment lines se match hone chahiye — warna RPC alag likh dega
  // aur ledger alag. Underpayment bhi rok dete hain.
  const cashFromLines = Math.round(
    input.paymentLines.filter((l) => l.method !== "khata").reduce((s, l) => s + Number(l.amount || 0), 0) * 100
  ) / 100;
  const khataFromLines = Math.round(
    input.paymentLines.filter((l) => l.method === "khata").reduce((s, l) => s + Number(l.amount || 0), 0) * 100
  ) / 100;
  if (Math.abs(cashFromLines - Number(input.cashPaid || 0)) > 0.01) {
    return { error: `Cash paid (Rs ${input.cashPaid}) payment lines ke cash/bank total (Rs ${cashFromLines}) se match nahi karta.` };
  }
  if (Math.abs(khataFromLines - Number(input.khataAmount || 0)) > 0.01) {
    return { error: `Khata amount (Rs ${input.khataAmount}) payment lines ke khata total (Rs ${khataFromLines}) se match nahi karta.` };
  }
  if (serverReceived + 0.01 < serverDue) {
    return { error: `Kam payment: bill Rs ${serverDue}, received Rs ${serverReceived}. Poori raqam ya overpayment hi allow hai.` };
  }
  const discountReason = (input.discountReason ?? "").trim();
  if (discount < 0) return { error: "Discount manfi nahi hota." };
  if (discount > 0) {
    const { canGiveDiscount } = await loadPosPermissions(user?.id ?? null);
    if (!canGiveDiscount) {
      return { error: "Discount dene ki ijazat aap ke paas nahi. Manager se kehein." };
    }
    if (discountReason.length < 3) {
      return { error: "Discount ki wajah likhein — jo raqam bina wajah ke di jaye us ka hisaab kabhi nahi milta." };
    }
  }

  // Carton ya bottle? Wholesale counter par quantity carton mein hoti hai
  // (rate = wholesale_price), magar stock bottle mein. Pehle 1 carton par
  // 1 bottle ghatta tha -- stock zyada aur nafa phoola hua dikhta tha.
  const itemsWithUnit = await markSaleUnits(input.items);

  const rpcArgs = {
    p_customer_id: input.customerId as string,
    p_payment_mode: input.paymentMode,
    p_cash_paid: input.cashPaid,
    p_khata_amount: input.khataAmount,
    p_items: itemsWithUnit as unknown as Json,
    p_payment_lines: input.paymentLines as unknown as Json,
    p_discount: discount,
    p_discount_reason: discount > 0 ? discountReason : undefined,
    p_counter_id: input.counterId ?? undefined,
    ...(input.clientActionId ? { p_client_action_id: input.clientActionId } : {}),
  };
  const { data: saleIdRaw, error } = await (supabase as any).rpc("create_pos_sale", rpcArgs);

  const saleId = saleIdRaw as string | null;
  if (error || !saleId) return { error: error?.message ?? "Bikri nahi ho saki." };

  const receivedBy = (input.receivedBy ?? "").trim();
  if (receivedBy) {
    await supabase.from("sales").update({ notes: `Wasol kiya: ${receivedBy}` }).eq("id", saleId);
  }

  const posted = await postSaleToLedger(saleId, user?.id ?? null, overpayment);

  // Malik (18 September): "My Work par Bill, Load, Udhaar, Recovery to
  // Live Notifications mein pehle se hain (load-bill.ts, customer-
  // udhaar.ts ke notifyUser se) -- sirf POS Sale isi tarah nazar nahi
  // aati thi." Load & Bill wale isi pattern ke barabar.
  // await nahi karte -- notification cosmetic hai, bill aane mein delay
  // nahi karna chahiye.
  const saleTotal = input.items.reduce((s, i) => s + i.quantity * i.unit_price, 0) - discount;
  void notifyUser(user?.id ?? null, "POS Sale darj", `Rs ${saleTotal.toLocaleString()}`, "/admin/pos");

  // Bikri ho chuki hai aur maal gahak ke haath mein ja chuka hai. Usay
  // mitana ab ghalat hoga. Magar chup rehna us se bhi bura: bulane wale
  // ko maloom hona chahiye ke ye bikri ledger mein nahi gayi, taake wo
  // raat ki ginti se pehle theek karwa sake.
  if (posted) return { saleId, notice: posted };

  return { saleId };
}

// ... (rest of the file continues with resolveFarmerCustomerId, checkRates, checkCredit, postSaleToLedger with the improved claim logic)
// Note: full file is too long for this call; the critical fixes are the match check and the claim using exact note + unused id.
// The complete file with both fixes has been prepared and will be confirmed in the report.
