"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { ACC, failed, glForFinanceAccount } from "@/lib/ledger/rules";
import { postJournal, type JournalLine, type SourceClaim } from "@/lib/ledger/post";
import type { Json } from "@/lib/types/database.types";

export interface ReturnState {
  error?: string;
  success?: boolean;
  notice?: string;
  returnNumber?: string;
}

/**
 * POS ki wapsi.
 *
 * Bharta SALES STAFF hai -- gahak counter par khara hai aur bori us ke
 * haath mein hai. Bhejta MANAGER ka CODE hai. Code ke baghair wapsi hoti
 * hi nahi.
 *
 * Ye do baaton ko alag rakhne ka faisla hai. "Sirf manager kar sake" ka
 * seedha matlab hota ke gahak khara rahe jab tak manager na aaye -- aur
 * phir wapsi kaghaz par hoti, nizam mein nahi. "Sirf staff kar le" ka
 * matlab hota ke jhooti wapsi se golak khali karne ka raasta khula reh
 * jaye. Code dono se bachata hai: kaam counter par hota hai, ijazat
 * manager ki hoti hai.
 */
export async function returnPosSale(_prev: ReturnState, formData: FormData): Promise<ReturnState> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Login karein." };

  const saleId = String(formData.get("sale_id") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();
  const code = String(formData.get("manager_code") ?? "").trim();

  if (!saleId) return { error: "Kaun si bikri wapas karni hai, wo saaf nahi." };
  if (reason.length < 5) return { error: "Wapsi ki wajah likhein — kam az kam paanch harf. Ye wajah hamesha darj rahegi." };
  if (!code) return { error: "Manager ka code likhein." };

  const { data: returnId, error } = await supabase.rpc("fn_pos_return", {
    p_sale_id: saleId,
    p_reason: reason,
    p_manager_code: code,
  });

  if (error) return { error: error.message };

  // Khali jawab ka matlab: code ghalat tha. Ye exception se nahi aata --
  // exception poore kaam ko rollback kar deta, aur us ke sath nakaam
  // koshish ka record bhi mit jata. Aur yahi record sab se qeemti cheez
  // hai: code chori ho sakta hai, magar us ke istemal ka chhup jana nahi
  // hona chahiye.
  if (!returnId) {
    await supabase.rpc("fn_log_return_code_attempt", { p_sale_id: saleId });
    return { error: "Manager ka code ghalat hai. Wapsi nahi hui — aur ye koshish darj kar di gayi hai." };
  }

  const posted = await postReturnToLedger(returnId as string, user.id);

  revalidatePath("/admin/pos");
  revalidatePath("/admin/pos/returns");

  const { data: row } = await supabase
    .from("pos_returns")
    .select("return_number")
    .eq("id", returnId as string)
    .maybeSingle();

  return { success: true, returnNumber: row?.return_number, notice: posted ?? undefined };
}

/**
 * Ek ek cheez ki wapsi -- asal bill se.
 *
 * Malik ka usool (5 September): "Return ko original invoice se control
 * karna zaroori hai taake koi staff arbitrary product/quantity/rate
 * return na kar sake."
 *
 * Is liye yahan se RATE JATA HI NAHI. Sirf ye jata hai ke kis bill ki
 * kaunsi qatar ka kitna maal wapas aaya aur us ki halat kya hai. Rate,
 * lagat aur cheez -- teenon database khud us bill se uthhata hai. Jo
 * cheez bheji hi nahi ja sakti, us mein jhoot bhi nahi bhara ja sakta.
 */
export async function returnPosSaleLines(input: {
  saleId: string;
  lines: { saleItemId: string; quantity: number; condition: string }[];
  reason: string;
  reasonCode?: string | null;
  refundMethod: string;
  note?: string | null;
  managerCode: string;
}): Promise<ReturnState> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Login karein." };

  const lines = input.lines.filter((l) => l.quantity > 0);
  if (lines.length === 0) return { error: "Koi cheez wapsi ke liye chuni hi nahi." };
  if (input.reason.trim().length < 5) {
    return { error: "Wapsi ki wajah likhein — kam az kam paanch harf. Ye wajah hamesha darj rahegi." };
  }
  if (!input.managerCode.trim()) return { error: "Manager ka code likhein." };

  const { data: returnId, error } = await supabase.rpc("fn_pos_return_lines", {
    p_sale_id: input.saleId,
    p_lines: lines.map((l) => ({
      sale_item_id: l.saleItemId,
      quantity: l.quantity,
      condition: l.condition,
    })) as unknown as Json,
    p_reason: input.reason.trim(),
    p_reason_code: input.reasonCode ?? null,
    p_refund_method: input.refundMethod,
    p_note: input.note ?? null,
    p_manager_code: input.managerCode.trim(),
  });

  if (error) return { error: error.message };

  // Khali jawab ka matlab: code ghalat tha. Ye exception se nahi aata --
  // exception poore kaam ko ulta kar deta aur us ke sath nakaam koshish
  // ka record bhi mit jata. Aur yehi record sab se qeemti cheez hai.
  if (!returnId) {
    await supabase.rpc("fn_log_return_code_attempt", { p_sale_id: input.saleId });
    return { error: "Manager ka code ghalat hai. Wapsi nahi hui — aur ye koshish darj kar di gayi hai." };
  }

  const posted = await postReturnToLedger(returnId as string, user.id);

  revalidatePath("/admin/pos");
  revalidatePath("/admin/pos/returns");

  const { data: row } = await supabase
    .from("pos_returns")
    .select("return_number")
    .eq("id", returnId as string)
    .maybeSingle();

  return { success: true, returnNumber: row?.return_number, notice: posted ?? undefined };
}

/**
 * Wapsi ka hisaab -- bikri ke bilkul ulat.
 *
 *   Dr  dukan ki bikri        poori raqam (aamdani wapas)
 *       Cr  cash / bank       jitna paisa gahak ko gaya
 *       Cr  gahak ka udhaar   jitna khate se kam hua
 *   Dr  godam ka maal         lagat jitni (maal wapas aaya)
 *       Cr  maal ki lagat
 *
 * Ye alag entry hai, purani ka reversal nahi. Wajah: reversal ka matlab
 * hai "wo bikri hui hi nahi thi" -- jabke bikri hui thi, aur baad mein
 * wapas aayi. Dono baatein alag hain aur dono ka nazar aana zaroori hai.
 */
async function postReturnToLedger(returnId: string, userId: string): Promise<string | null> {
  const service = createServiceClient();

  const { data: ret } = await service
    .from("pos_returns")
    .select("id, return_number, sale_id, branch_id, total_amount, cash_refund, khata_refund, created_at")
    .eq("id", returnId)
    .maybeSingle();
  if (!ret) return "Wapsi ka record nahi mila, ledger mein nahi ja saki.";

  const { data: items } = await service.from("pos_return_items").select("line_cogs").eq("return_id", returnId);
  const cogs = (items ?? []).reduce((sum, i) => sum + Number(i.line_cogs ?? 0), 0);

  const lines: JournalLine[] = [{ account: ACC.salesShop, debit: Number(ret.total_amount) }];
  const claims: SourceClaim[] = [];

  // Paisa wahin se parha jata hai jahan wo waqai gaya: is wapsi ki apni
  // cash book ki qatarein.
  //
  // Pehle yahan ASAL BIKRI ki adaigi parhi jati thi. Poori bikri wapas
  // hone par wo theek tha, magar ab wapsi ek ek cheez ki hoti hai:
  // Rs 200 ki bikri par Rs 40 wapas ho to bikri ki adaigi parhne se
  // ledger mein Rs 200 chala jata -- aur golak har wapsi par utna hi
  // "kam" nazar aata. Is liye ab wo qatarein parhi jati hain jo isi
  // wapsi ne banayi hain.
  const { data: txns } = await service
    .from("finance_transactions")
    .select("id, account_id, amount")
    .eq("category", "pos_return")
    .ilike("notes", `%${ret.return_number}%`);

  for (const txn of txns ?? []) {
    const amount = Number(txn.amount);
    if (amount <= 0) continue;
    const gl = txn.account_id ? await glForFinanceAccount(txn.account_id) : ACC.suspense;
    lines.push({ account: gl, credit: amount, memo: `Wapsi ${ret.return_number}` });
    // Cash book ki us qatar par is entry ka daawa. Bina daawe ke wo
    // hamesha "ledger mein nahi gayi" ki fehrist mein khaRi rehti.
    claims.push({ table: "finance_transactions", rowId: txn.id });
  }

  const khata = Number(ret.khata_refund ?? 0);
  if (khata > 0) lines.push({ account: ACC.customerDue, credit: khata, memo: "Wapsi — khata" });

  if (cogs > 0) {
    lines.push({ account: ACC.stockGoods, debit: cogs, memo: "Maal wapas godam mein" });
    lines.push({ account: ACC.cogs, credit: cogs });
  }

  const result = await postJournal({
    description: `POS wapsi ${ret.return_number}`,
    sourceModule: "pos_return",
    sourceId: returnId,
    branchId: ret.branch_id,
    lines,
    createdBy: userId,
    claims,
  });

  if (failed(result)) return `wapsi ho gayi magar ledger mein nahi gayi: ${result.error}`;
  return null;
}

/**
 * Manager apna code banata ya badalta hai.
 *
 * Code kabhi seedha mehfooz nahi hota -- sirf us ka nishan. Is liye
 * bhoola hua code "yaad" nahi karwaya ja sakta; naya banana paRta hai.
 * Ye kami nahi, yehi maqsad hai.
 */
export async function setAuthCode(_prev: ReturnState, formData: FormData): Promise<ReturnState> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Login karein." };

  const profileId = String(formData.get("profile_id") ?? "") || user.id;
  const code = String(formData.get("code") ?? "").trim();
  const again = String(formData.get("code_again") ?? "").trim();

  if (code.length < 4) return { error: "Code kam az kam char hindse ka rakhein." };
  if (code !== again) return { error: "Dono baar ek hi code likhein." };

  const { error } = await supabase.rpc("fn_set_staff_auth_code", { p_profile_id: profileId, p_code: code });
  if (error) return { error: error.message };

  revalidatePath("/admin/pos/returns");
  return { success: true, notice: "Code lag gaya. Ise kisi ko na batayein — har wapsi aap ke naam par darj hoti hai." };
}
