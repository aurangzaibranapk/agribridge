"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { ACC, failed, glForFinanceAccount } from "@/lib/ledger/rules";
import { postJournal, type JournalLine, type SourceClaim } from "@/lib/ledger/post";

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

  const { data: payments } = await service
    .from("pos_sale_payment_details")
    .select("payment_method, amount")
    .eq("sale_id", ret.sale_id);

  for (const p of payments ?? []) {
    const amount = Number(p.amount);
    if (amount <= 0 || p.payment_method === "khata") continue;

    const { data: map } = await service
      .from("payment_method_account_map")
      .select("finance_account_id")
      .eq("payment_method", p.payment_method)
      .maybeSingle();

    const gl = map?.finance_account_id ? await glForFinanceAccount(map.finance_account_id) : ACC.suspense;
    lines.push({ account: gl, credit: amount, memo: `Wapsi ${ret.return_number} — ${p.payment_method}` });

    if (map?.finance_account_id) {
      const { data: txn } = await service
        .from("finance_transactions")
        .select("id")
        .eq("account_id", map.finance_account_id)
        .eq("category", "pos_return")
        .eq("amount", amount)
        .gte("created_at", ret.created_at)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (txn?.id) claims.push({ table: "finance_transactions", rowId: txn.id });
    }
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
