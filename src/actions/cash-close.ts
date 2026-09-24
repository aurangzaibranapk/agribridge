"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { postJournal } from "@/lib/ledger/post";
import { ACC } from "@/lib/ledger/rules";
import {
  DENOMINATIONS,
  REASON_MIN,
  REASON_MAX,
  expectedCash,
  totalFromDenominations,
  type DenominationCount,
} from "@/lib/ledger/cash-close";

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
 *   2. Farq nikalte hi wo 6100 "Cash ka farq" mein darj hota hai.
 *      Aam tor par log farq ko kisi kharche mein "adjust" kar dete
 *      hain -- us se hisaab mil jata hai aur masla nazar aana band ho
 *      jata hai. Yahan wo raasta hai hi nahi: farq ka apna khata hai,
 *      aur mahine ke aakhir mein us khate ka jama shuda adad khud ek
 *      sawal hai.
 *
 *   3. Ginti pehle ledger mein jati hai, phir mahfooz hoti hai. Ulta
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

  const today = new Date().toISOString().slice(0, 10);
  if (closeDate > today) return { error: "Aane wale din ki ginti nahi ho sakti." };

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Login karein." };

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

  // Farq ledger mein. Sifar ho to koi entry nahi -- khali entry se koi
  // maloomat nahi milti, sirf fehrist bhar jati hai.
  let journalEntryId: string | null = null;
  if (difference !== 0) {
    const amount = Math.abs(difference);
    const short = difference < 0;

    const posted = await postJournal({
      description: `Cash ginti ${closeDate} — Rs ${amount.toLocaleString()} ${short ? "kam" : "zyada"} nikle`,
      sourceModule: "cash_close",
      branchId,
      entryDate: closeDate,
      createdBy: user.id,
      backdateReason:
        closeDate < today ? `Us raat ki ginti aaj darj hui — ${reason}` : null,
      lines: short
        ? // Cash kam nikla: golak ghata, farq kharche mein gaya.
          [
            { account: ACC.cashDifference, debit: amount, memo: reason },
            { account: ACC.cash, credit: amount, memo: `Ginti ${closeDate}` },
          ]
        : // Cash zyada nikla: golak barha, farq wapas kharche se kata.
          [
            { account: ACC.cash, debit: amount, memo: `Ginti ${closeDate}` },
            { account: ACC.cashDifference, credit: amount, memo: reason },
          ],
    });

    if ("error" in posted) return { error: `Farq ledger mein darj nahi ho saka: ${posted.error}` };
    journalEntryId = posted.id;
  }

  const { error } = await service.from("cash_closings").insert({
    branch_id: branchId,
    close_date: closeDate,
    expected_amount: expected,
    counted_amount: counted,
    difference,
    denominations: counts,
    difference_reason: difference === 0 ? null : reason,
    notes,
    counted_by: user.id,
    journal_entry_id: journalEntryId,
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
          }. Farq "Cash ka farq" khate mein chala gaya.`,
  };
}
