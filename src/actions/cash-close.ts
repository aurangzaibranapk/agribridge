"use server";
import { revalidatePath } from "next/cache";
import { aajKaKhana } from "@/lib/utils/format";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { postJournal } from "@/lib/ledger/post";
import {
  DENOMINATIONS,
  REASON_MIN,
  REASON_MAX,
  expectedCash,
  totalFromDenominations,
  type DenominationCount,
} from "@/lib/ledger/cash-close";
import { cashCloseApproveGate, cashCloseRecordGate, cashDifferenceLines } from "@/lib/finance/money-guards";

export interface ActionState {
  error?: string;
  success?: boolean;
  message?: string;
}

/**
 * Raat ki ginti darj karna.
 *
 * Tarteeb jaan boojh kar aisi hai:
 *
 *   1. "Hona kitna chahiye" SERVER par gina jata hai, form se nahi
 *      liya jata. Form se lein to ginne wala wohi adad bhej sakta hai
 *      jo us ne gina -- farq hamesha sifar aayega aur ginti ka koi
 *      matlab nahi rahega.
 *
 *   2. Farq yahin kitab mein nahi jata. Ginne wala sirf ginti likhta
 *      hai. Doosra Owner / Super Admin / Admin baad mein farq ko
 *      6100 "Cash ka farq" mein likhta hai. Sifar farq par koi
 *      journal nahi.
 *
 *   3. Ginti pehle mahfooz hoti hai. Ledger baad mein, doosre bande se. Ulta
 *      karein to aisi ginti bach sakti hai jis ka hisaab kahin nahi --
 *      yani wo farq jo darj to hua magar kisi khate mein gaya nahi.
 */
export async function recordCashClose(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const service = createServiceClient();

  const branchId = String(formData.get("branch_id") ?? "");
  const closeDate = String(formData.get("close_date") ?? "").trim();
  const reason = String(formData.get("difference_reason") ?? "").trim();
  const notes = (formData.get("notes") as string)?.trim() || null;

  if (!branchId) return { error: "Branch select karein." };
  if (!closeDate) return { error: "Tareekh select karein." };

  const today = aajKaKhana();
  if (closeDate > today) return { error: "Aane wale din ki ginti nahi ho sakti." };

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Login karein." };
  const { data: me } = await supabase.from("profiles").select("role, is_active, branch_id").eq("id", user.id).maybeSingle();
  if (!me?.is_active) return { error: "Ye account fa'aal nahi hai." };
  const recordGate = cashCloseRecordGate(String(me.role), me.branch_id, branchId);
  if (!recordGate.ok) return { error: recordGate.error };

  // Note ki ginti. Har qism alag likhi jati hai taake dobara ginna aasan
  // ho -- kul adad mein farq nikle to poori ginti dobara karne ke bajaye
  // sirf wo dher dobara gina jata hai.
  const counts: DenominationCount = {};
  for (const note of DENOMINATIONS) {
    const raw = formData.get(`d_${note}`);
    const n = Number(raw ?? 0);
    if (!Number.isFinite(n) || n < 0) return { error: `Rs ${note} ki ginti sahi likhein.` };
    counts[String(note)] = Math.floor(n);
  }

  const counted = totalFromDenominations(counts);
  if (counted <= 0) return { error: "Ginti likhein — kam az kam ek note ya sikka." };

  // Ye adad server par ginta hai, form se nahi aata.
  const expected = await expectedCash(branchId, closeDate);
  const difference = Math.round((counted - expected) * 100) / 100;

  if (difference !== 0) {
    if (reason.length < REASON_MIN) {
      const kam = difference < 0 ? "kam" : "zyada";
      return {
        error: `Rs ${Math.abs(difference).toLocaleString()} ${kam} nikle hain. Kya samajh aaya, wo likhna zaroori hai — kam az kam ${REASON_MIN} harf.`,
      };
    }
    if (reason.length > REASON_MAX) return { error: `Wajah ${REASON_MAX} harf se chhoti rakhein.` };
  }

  // Us din ki asal ginti pehle se hai? Phir ye durustgi hai.
  //
  // Ginti badalne ki ijazat dena ghalat hota: farq nikalne par log
  // purana adad theek kar dete hain aur ginti ka koi matlab nahi rehta.
  // Magar dobara ginne ka raasta bilkul band kar dena bhi ghalat hai --
  // ginti mein ghalti hoti hai, aur us ka koi ilaj na ho to log ginti se
  // katrane lagte hain.
  //
  // Beech ka raasta: purani ginti apni jagah rehti hai, nayi us ke sath
  // nazar aati hai, aur wajah likhna parti hai.
  const { data: original } = await service
    .from("cash_closings")
    .select("id, counted_amount")
    .eq("branch_id", branchId)
    .eq("close_date", closeDate)
    .is("corrects_id", null)
    .maybeSingle();

  const correctionReason = String(formData.get("correction_reason") ?? "").trim();
  if (original && correctionReason.length < REASON_MIN) {
    return {
      error: `Is din ki ginti pehle ho chuki hai (Rs ${Number(original.counted_amount).toLocaleString()}). Dobara ginna hai to wajah likhein — purani ginti mitegi nahi, dono nazar aayengi.`,
    };
  }

  // Farq abhi kitab mein NAHI jata. Doosra Owner/Admin manzoor kare
  // (approveCashCloseDifference) tab GL entry banti hai.
  const approvalStatus = difference === 0 ? "approved" : "recorded";

  const { error } = await (service.from("cash_closings") as any).insert({
    branch_id: branchId,
    close_date: closeDate,
    expected_amount: expected,
    counted_amount: counted,
    difference,
    denominations: counts,
    difference_reason: difference === 0 ? null : reason,
    notes,
    counted_by: user.id,
    journal_entry_id: null,
    approval_status: approvalStatus,
    corrects_id: original?.id ?? null,
    correction_reason: original ? correctionReason : null,
  });

  if (error) return { error: error.message };

  revalidatePath("/admin/cash-close");
  revalidatePath("/admin/money-trail");

  const kind = original ? "Dobara ginti darj" : "Ginti darj";
  return {
    success: true,
    message:
      difference === 0
        ? `${kind} — Rs ${counted.toLocaleString()}, farq koi nahi.`
        : `${kind} — Rs ${Math.abs(difference).toLocaleString()} ${
            difference < 0 ? "kam" : "zyada"
          }. Farq abhi kitab mein nahi — doosra Owner/Admin manzoor karega.`,
  };
}

/** Farq ki GL entry — ginne wale se alag banda. */
export async function approveCashCloseDifference(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const service = createServiceClient();
  const id = String(formData.get("id") ?? "").trim();
  if (!id) return { error: "Ginti ki qatar nahi mili." };

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Login karein." };
  const { data: me } = await supabase.from("profiles").select("role, is_active").eq("id", user.id).maybeSingle();
  if (!me?.is_active) return { error: "Ye account fa'aal nahi hai." };

  const { data: row, error: readError } = await (service.from("cash_closings") as any)
    .select("id, branch_id, close_date, difference, difference_reason, counted_by, approval_status, journal_entry_id")
    .eq("id", id)
    .maybeSingle();
  if (readError) return { error: readError.message };
  if (!row) return { error: "Ginti nahi mili." };

  const gate = cashCloseApproveGate(
    {
      counted_by: row.counted_by,
      difference: Number(row.difference),
      approval_status: row.approval_status,
      journal_entry_id: row.journal_entry_id,
    },
    user.id,
    String(me.role)
  );
  if (!gate.ok) return { error: gate.error };

  const { data: claimed, error: claimError } = await (service.from("cash_closings") as any)
    .update({ approval_status: "approving" })
    .eq("id", id)
    .eq("approval_status", "recorded")
    .is("journal_entry_id", null)
    .select("id")
    .maybeSingle();
  if (claimError) return { error: claimError.message };
  if (!claimed) return { error: "Ye ginti pehle hi kisi ne le li hai." };

  const difference = Number(row.difference);
  const closeDate = String(row.close_date);
  const reason = String(row.difference_reason ?? "");
  const today = aajKaKhana();
  const posted = await postJournal({
    description: `Cash ginti ${closeDate} — Rs ${Math.abs(difference).toLocaleString()} ${difference < 0 ? "kam" : "zyada"} nikle`,
    sourceModule: "cash_close",
    sourceId: id,
    branchId: row.branch_id,
    entryDate: closeDate,
    createdBy: user.id,
    backdateReason: closeDate < today ? `Us raat ki ginti ki manzoori aaj — ${reason}` : null,
    lines: cashDifferenceLines({ difference, closeDate, reason }),
  });
  if ("error" in posted) {
    await (service.from("cash_closings") as any).update({ approval_status: "recorded" }).eq("id", id).eq("approval_status", "approving");
    return { error: `Farq ledger mein darj nahi ho saka: ${posted.error}` };
  }

  const { data: saved, error: saveError } = await (service.from("cash_closings") as any)
    .update({
      approval_status: "approved",
      approved_by: user.id,
      approved_at: new Date().toISOString(),
      journal_entry_id: posted.id,
    })
    .eq("id", id)
    .eq("approval_status", "approving")
    .select("id")
    .maybeSingle();
  if (saveError || !saved) {
    return { error: `Kitab mein entry ban gayi magar ginti par nahi likhi ja saki: ${saveError?.message ?? "claim nahi mili"}.` };
  }

  revalidatePath("/admin/cash-close");
  revalidatePath("/admin/money-trail");
  return { success: true, message: `Farq kitab mein darj ho gaya (${posted.entryNumber}).` };
}
