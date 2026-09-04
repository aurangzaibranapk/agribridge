"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { postJournal, type JournalLine } from "@/lib/ledger/post";
import { logAudit } from "@/lib/audit";

/**
 * Haath se likhi hui journal entry.
 *
 * Ye darwaza jaan boojh kar TANG rakha gaya hai. Nizam ka poora usool ye
 * hai ke har entry apne kaam se KHUD banti hai -- POS ki bikri se, maal
 * wusool hone se, doodh se, machinery se. Haath se entry daalne ki
 * zaroorat sirf un cheezon par parti hai jin ka koi safha hai hi nahi:
 * malik ka sarmaya, bank ka munafa, purane khaton ka opening balance.
 *
 * Is liye yahan teen rokein hain:
 *
 *   1. IJAZAT. Sirf Owner, Admin ya Finance. Jo banda apne haath se
 *      koi bhi khata debit-credit kar sakta ho, wo hisaab ki har rok se
 *      bahar ho jata hai.
 *
 *   2. WAJAH LAZMI. Bina wajah ki entry do mahine baad kisi ko samajh
 *      nahi aati -- aur na samajh aane wali entry par sawal bhi nahi
 *      poocha ja sakta.
 *
 *   3. PURANI TAREEKH PAR ALAG WAJAH. Guzri hui tareekh mein entry daalna
 *      jaiz hai (entry waqai us din ki ho sakti hai) magar yehi wo jagah
 *      hai jahan haath ki safai chhup sakti hai. Is liye rokte nahi,
 *      NAZAR MEIN rakhte hain -- audit trail par wo alag nishaan ke sath
 *      aati hai.
 *
 * Barabri (debit = credit) yahan nahi ginte -- wo postJournal ka kaam
 * hai, aur wahi ek jagah hai jahan wo ginti honi chahiye.
 */

export interface JvState {
  error?: string;
  success?: boolean;
  entryNumber?: string;
}

const ROLES = ["owner", "super_admin", "admin", "finance"];

export async function postManualJournal(_prev: JvState, formData: FormData): Promise<JvState> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Login karein." };

  const { data: me } = await supabase.from("profiles").select("role, is_active, branch_id").eq("id", user.id).maybeSingle();
  if (!me?.is_active || !ROLES.includes(me.role)) {
    return { error: "Haath se entry daalne ki ijazat sirf Owner, Admin ya Finance ke paas hai." };
  }

  const description = String(formData.get("description") ?? "").trim();
  const entryDate = String(formData.get("entry_date") ?? "").trim();
  const backdateReason = String(formData.get("backdate_reason") ?? "").trim();

  if (description.length < 5) {
    return { error: "Entry ki wajah likhein — kam az kam paanch harf. Ye wajah hamesha darj rahegi." };
  }
  if (!entryDate) return { error: "Tareekh chunein." };

  // Har qatar form se: acc_0, dr_0, cr_0 ...
  const lines: JournalLine[] = [];
  for (let i = 0; i < 12; i++) {
    const acc = String(formData.get(`acc_${i}`) ?? "").trim();
    if (!acc) continue;
    const dr = Number(formData.get(`dr_${i}`) ?? 0) || 0;
    const cr = Number(formData.get(`cr_${i}`) ?? 0) || 0;
    if (dr === 0 && cr === 0) continue;
    lines.push({
      account: acc,
      debit: dr > 0 ? dr : undefined,
      credit: cr > 0 ? cr : undefined,
      memo: String(formData.get(`memo_${i}`) ?? "").trim() || null,
    });
  }

  if (lines.length < 2) {
    return { error: "Kam az kam do qataren chahiyen — ek debit, ek credit." };
  }

  // Purani tareekh: rokte nahi, magar wajah maangte hain aur nishaan
  // lagate hain.
  const aaj = new Date().toISOString().slice(0, 10);
  const purani = entryDate < aaj;
  if (purani && backdateReason.length < 10) {
    return {
      error: "Ye entry guzri hui tareekh ki hai. Us ki wajah likhein — kam az kam das harf. Ye entry audit par nishaan ke sath aayegi.",
    };
  }

  const result = await postJournal({
    description,
    sourceModule: "manual",
    entryDate,
    branchId: me.branch_id ?? null,
    createdBy: user.id,
    lines,
    backdateReason: purani ? backdateReason : null,
  });

  if ("error" in result) return { error: result.error };

  await logAudit({
    actionType: "create",
    module: "finance",
    recordId: result.id,
    recordLabel: result.entryNumber,
    description: `Haath se journal entry: ${description} (Rs ${Math.round(result.total).toLocaleString()})`,
  });

  revalidatePath("/admin/finance/statements");
  revalidatePath("/admin/audit-trail");
  return { success: true, entryNumber: result.entryNumber };
}
