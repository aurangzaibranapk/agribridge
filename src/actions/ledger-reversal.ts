"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { reverseJournal } from "@/lib/ledger/post";
import { logAudit } from "@/lib/audit";
import { REVERSAL_REASON_MIN } from "@/lib/ledger/audit-trail";

export interface ActionState {
  error?: string;
  success?: boolean;
  message?: string;
}

/** Hisaab ka zimmedar kaun -- reversal ek maali kaam hai. */
const CAN_REVERSE = ["owner", "super_admin", "admin", "finance"];

/**
 * Ghalti theek karne ka wahid raasta.
 *
 * 106 se ye baat baar baar kahi ja rahi hai ke ghalti mitane se nahi,
 * reversal se theek hoti hai -- magar us ko bulane ka koi raasta nahi
 * tha. Aisa nizam logon ko database tak jane par majboor karta hai,
 * yani theek us jagah jahan koi rok nahi.
 *
 * Reversal purani entry ko chhoota nahi. Wo us ke ulat ek nayi entry
 * banata hai. Dono nazar aati rehti hain, aur yehi maqsad hai: mita
 * dene se ghalti ke sath us ka saboot bhi chala jata hai, aur phir ye
 * sawal kabhi jawab nahi paata ke wo raqam thi kahan.
 */
export async function reverseEntry(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const service = createServiceClient();

  const entryId = String(formData.get("entry_id") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();

  if (!entryId) return { error: "Kaunsi entry ulti karni hai, wo saaf nahi." };
  if (reason.length < REVERSAL_REASON_MIN) {
    return {
      error: `Reversal ki wajah likhna zaroori hai — kam az kam ${REVERSAL_REASON_MIN} harf. Ye wajah hamesha ke liye darj rahegi.`,
    };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Login karein." };

  const { data: me } = await service
    .from("profiles")
    .select("role, is_active")
    .eq("id", user.id)
    .maybeSingle();

  if (!me?.is_active || !CAN_REVERSE.includes(me.role)) {
    return {
      error:
        "Entry ulti karne ka haq sirf Malik, Admin aur Finance ke paas hai — reversal ek maali kaam hai, aur us ka jawab dene wala hi wo kar sakta hai.",
    };
  }

  const { data: entry } = await service
    .from("journal_entries")
    .select("entry_number, description, source_module")
    .eq("id", entryId)
    .maybeSingle();

  const result = await reverseJournal(entryId, reason, user.id);
  if ("error" in result) return { error: result.error };

  await logAudit({
    actionType: "update",
    module: "ledger_reversal",
    recordId: entryId,
    recordLabel: entry?.entry_number,
    description: `Entry ${entry?.entry_number ?? entryId} ulti gayi (${result.entryNumber}): ${reason}`,
  });

  revalidatePath("/admin/audit-trail");
  revalidatePath("/admin/money-trail");

  // Ye baat saaf batana zaroori hai. Reversal LEDGER theek karta hai --
  // wo us kaam ko wapas nahi karta jo hua tha. Ginti wahi rahegi jo hui
  // thi, stock wahi rahega jo set hua tha. Ye na batayein to log
  // samjhenge ke sab kuch wapas ho gaya, aur asal kaam adhoora reh
  // jayega.
  return {
    success: true,
    message: `Reversal ban gaya (${result.entryNumber}) — Rs ${result.total.toLocaleString()}. Yaad rahe: ye sirf LEDGER theek karta hai. Jo kaam hua tha (ginti, stock, adaigi) wo apni jagah waisa hi hai — us ko alag se dekhna parega.`,
  };
}
