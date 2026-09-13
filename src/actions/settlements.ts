"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { logAudit } from "@/lib/audit";
import { postJournal } from "@/lib/ledger/post";

export interface ActionState {
  error?: string;
  success?: boolean;
  message?: string;
}

/**
 * Ek bande ka "lena" aur "dena" — manzoori se kaatna.
 *
 * =====================================================================
 * MALIK KI SHART (6 September)
 * =====================================================================
 *
 *   *"Agar Muhammad Aslam ne aap se fertilizer bhi udhaar liya hua hai:
 *   Farmer se Rs 10,000 lena. Aur us ki mazdoori bani: Farmer ko Rs
 *   3,000 dena. System silently balance overwrite na kare... Phir
 *   authorized settlement. Is adjustment ka proper journal + audit trail
 *   hoga. Silent set-off bilkul nahi."*
 *
 * Is liye ye ek QATAR hai, ek hisaab nahi: koi maangta hai, koi manzoor
 * karta hai, wajah likhi jati hai, aur us ka apna journal banta hai.
 *
 * =====================================================================
 * YE "WASOOLI" NAHI HAI
 * =====================================================================
 *
 * Cash kahin nahi hilta. Sirf do khate kam hote hain -- ek asset, ek
 * liability. Is liye yahan Cash Book ki koi qatar NAHI banti, aur ye
 * khamoshi jaan boojh kar hai: Cash Book sirf cash aur bank ki kitab
 * hai, aur is qadam mein na cash aaya na gaya.
 */

const MANZOORI_WALE = ["finance"];
const SAB_KUCH = ["owner", "super_admin", "admin"];
const MAANG_SAKTE = ["manager", "finance", "admin_assistant"];

async function main() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Login zaroori hai." };
  const { data: p } = await supabase
    .from("profiles")
    .select("role, is_active, branch_id")
    .eq("id", user.id)
    .maybeSingle();
  if (!p?.is_active) return { error: "Ye account fa'aal nahi hai." };
  return { userId: user.id, role: String(p.role), branchId: (p.branch_id as string | null) ?? null };
}

function loose() {
  return createServiceClient() as unknown as { from: (t: string) => any };
}

/**
 * Ek khate par is bande ka baqi.
 *
 * Asset par ye "lena" hai (debit − credit), liability par "dena"
 * (credit − debit). Ye farq yahan lagta hai, safhe par nahi -- warna har
 * safha apna hisaab lagata hai aur ek din do alag jawab aate hain.
 */
async function khatePaBaqi(partyType: string, partyId: string, khata: string): Promise<number> {
  const service = createServiceClient();
  const [{ data: acct }, { data: lines }] = await Promise.all([
    service.from("gl_accounts").select("account_type").eq("code", khata).maybeSingle(),
    service
      .from("journal_lines")
      .select("debit, credit")
      .eq("party_type", partyType)
      .eq("party_id", partyId)
      .eq("account_code", khata),
  ]);

  const liability = String(acct?.account_type ?? "") === "liability";
  let baqi = 0;
  for (const l of (lines ?? []) as { debit: number | null; credit: number | null }[]) {
    const d = Number(l.debit ?? 0);
    const c = Number(l.credit ?? 0);
    baqi += liability ? c - d : d - c;
  }
  return Math.max(Math.round(baqi * 100) / 100, 0);
}

async function nextNumber(): Promise<string> {
  const saal = new Date().getFullYear() % 100;
  const { count } = await loose()
    .from("party_settlements")
    .select("id", { count: "exact", head: true })
    .like("settlement_number", `ADJ-${saal}-%`);
  return `ADJ-${saal}-${String((count ?? 0) + 1).padStart(5, "0")}`;
}

/** Safhe ke liye — dono taraf kitna baqi hai. */
export async function donoTarafKaBaqi(
  partyType: string,
  partyId: string,
  lenaKhata: string,
  denaKhata: string
): Promise<{ lena: number; dena: number } | null> {
  const who = await main();
  if ("error" in who) return null;
  const [lena, dena] = await Promise.all([
    khatePaBaqi(partyType, partyId, lenaKhata),
    khatePaBaqi(partyType, partyId, denaKhata),
  ]);
  return { lena, dena };
}

/** Adjustment ki darkhwast. */
export async function settlementMaangein(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const who = await main();
  if ("error" in who) return { error: who.error };
  if (!MAANG_SAKTE.includes(who.role) && !SAB_KUCH.includes(who.role)) {
    return { error: "Ye darkhwast Manager, Finance ya Admin de sakta hai." };
  }

  const partyType = String(formData.get("party_type") ?? "").trim();
  const partyId = String(formData.get("party_id") ?? "").trim();
  const lenaKhata = String(formData.get("lena_khata") ?? "").trim();
  const denaKhata = String(formData.get("dena_khata") ?? "").trim();
  const amount = Number(formData.get("amount") ?? 0);
  const wajah = String(formData.get("wajah") ?? "").trim();

  if (!partyType || !partyId) return { error: "Banda chunein." };
  if (!lenaKhata || !denaKhata) return { error: "Dono khate chunein." };
  if (lenaKhata === denaKhata) return { error: "Ek hi khata dono taraf nahi ho sakta — us se kuch adjust nahi hota." };
  if (!Number.isFinite(amount) || amount <= 0) return { error: "Raqam sahi likhein." };
  if (!wajah) {
    return { error: "Wajah likhein — chhe mahine baad yehi batati hai ke ye raqam kahan gayi." };
  }

  const [lena, dena] = await Promise.all([
    khatePaBaqi(partyType, partyId, lenaKhata),
    khatePaBaqi(partyType, partyId, denaKhata),
  ]);
  const hadd = Math.min(lena, dena);
  if (hadd <= 0) {
    return {
      error: `Adjust karne ke liye dono taraf raqam honi chahiye. Abhi lena Rs ${lena.toLocaleString()} aur dena Rs ${dena.toLocaleString()} hai.`,
    };
  }
  if (amount > hadd) {
    return {
      error: `Rs ${amount.toLocaleString()} zyada hai. Dono mein se chhoti raqam Rs ${hadd.toLocaleString()} hai — us se zyada adjust karne se ek khata ULTA ho jayega.`,
    };
  }

  const number = await nextNumber();
  const { data: row, error } = await loose()
    .from("party_settlements")
    .insert({
      settlement_number: number,
      party_type: partyType,
      party_id: partyId,
      lena_khata: lenaKhata,
      dena_khata: denaKhata,
      amount,
      wajah,
      branch_id: who.branchId,
      created_by: who.userId,
      status: "pending",
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  await logAudit({
    actionType: "create",
    module: "settlements",
    recordId: row?.id,
    recordLabel: number,
    description: `Adjustment maanga: Rs ${amount.toLocaleString()} — ${lenaKhata} ke against ${denaKhata}. Wajah: ${wajah}`,
  });

  revalidatePath("/admin/settlements");
  return { success: true, message: `${number} darj — Finance ki manzoori ka intezar.` };
}

/**
 * Manzoori — aur hadd DOBARA dekhi jati hai.
 *
 * Darkhwast aur manzoori ke beech us bande par aur qatarein aa sakti
 * hain. Purani hadd par bharosa karne se khata ULTA ho sakta hai (jaise
 * beech mein wasooli ho gayi ho), aur wo ghalti kabhi khud nazar nahi
 * aati.
 */
export async function settlementManzoor(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const who = await main();
  if ("error" in who) return { error: who.error };
  if (!MANZOORI_WALE.includes(who.role) && !SAB_KUCH.includes(who.role)) {
    return { error: "Adjustment ki manzoori sirf Finance ya Admin de sakta hai." };
  }

  const id = String(formData.get("id") ?? "");
  const raye = String(formData.get("comment") ?? "").trim();
  if (!id) return { error: "Qatar nahi mili." };
  if (!raye) return { error: "Manzoori ke sath apni raye likhein." };

  const { data: s } = (await loose().from("party_settlements").select("*").eq("id", id).maybeSingle()) as {
    data: any;
  };
  if (!s) return { error: "Ye adjustment nahi mila." };
  if (s.status === "approved") return { error: "Ye pehle hi manzoor ho chuka hai." };
  if (s.status === "rejected") return { error: "Ye radd ho chuka hai." };

  const amount = Number(s.amount ?? 0);
  const [lena, dena] = await Promise.all([
    khatePaBaqi(String(s.party_type), String(s.party_id), String(s.lena_khata)),
    khatePaBaqi(String(s.party_type), String(s.party_id), String(s.dena_khata)),
  ]);
  const hadd = Math.min(lena, dena);
  if (amount > hadd) {
    return {
      error: `Ab ye raqam adjust nahi ho sakti: is waqt lena Rs ${lena.toLocaleString()} aur dena Rs ${dena.toLocaleString()} hai, is liye hadd Rs ${hadd.toLocaleString()} hai. Beech mein koi aur qatar aa gayi hai — nayi darkhwast banayein.`,
    };
  }

  const tafseel = `${s.settlement_number} — Khaton ka adjustment: ${s.wajah}`;

  // Dena (liability) DEBIT, Lena (asset) CREDIT -- dono kam.
  const posted = await postJournal({
    description: tafseel,
    sourceModule: "settlement",
    sourceId: id,
    branchId: s.branch_id ?? who.branchId,
    createdBy: who.userId,
    claims: [{ table: "party_settlements", rowId: id }],
    lines: [
      {
        account: String(s.dena_khata),
        debit: amount,
        partyType: String(s.party_type),
        partyId: String(s.party_id),
        memo: `${tafseel} — dena kam`,
      },
      {
        account: String(s.lena_khata),
        credit: amount,
        partyType: String(s.party_type),
        partyId: String(s.party_id),
        memo: `${tafseel} — lena kam`,
      },
    ],
  });

  if ("error" in posted) {
    return { error: `Kitab mein qatar nahi bani, is liye manzoori bhi nahi di gayi: ${posted.error}` };
  }

  const { error: halatError } = await loose()
    .from("party_settlements")
    .update({
      status: "approved",
      approved_by: who.userId,
      approved_at: new Date().toISOString(),
      journal_entry_id: (posted as { id?: string }).id ?? null,
    })
    .eq("id", id);

  if (halatError) {
    return {
      error: `Kitab mein qatar ban gayi magar halat "manzoor" nahi ho saki: ${halatError.message}. Kisi ko batayein — dobara manzoori se dohri qatar ban jayegi.`,
    };
  }

  await logAudit({
    actionType: "approve",
    module: "settlements",
    recordId: id,
    recordLabel: s.settlement_number,
    description: `Manzoor: Rs ${amount.toLocaleString()} — ${s.lena_khata} ke against ${s.dena_khata}. Raye: ${raye}`,
  });

  revalidatePath("/admin/settlements");
  return { success: true, message: `Manzoor. Dono khate Rs ${amount.toLocaleString()} kam ho gaye.` };
}

/** Radd karna — wajah ke saath. */
export async function settlementRadd(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const who = await main();
  if ("error" in who) return { error: who.error };
  if (!MANZOORI_WALE.includes(who.role) && !SAB_KUCH.includes(who.role)) {
    return { error: "Ye faisla sirf Finance ya Admin kar sakta hai." };
  }

  const id = String(formData.get("id") ?? "");
  const wajah = String(formData.get("rejection_reason") ?? "").trim();
  if (!id) return { error: "Qatar nahi mili." };
  if (!wajah) return { error: "Wajah likhein." };

  const { data: s } = (await loose()
    .from("party_settlements")
    .select("settlement_number, status")
    .eq("id", id)
    .maybeSingle()) as { data: any };
  if (!s) return { error: "Ye adjustment nahi mila." };
  if (s.status === "approved") return { error: "Ye manzoor ho kar kitab mein ja chuka hai — ulti qatar banayein." };

  const { error } = await loose()
    .from("party_settlements")
    .update({ status: "rejected", rejection_reason: wajah })
    .eq("id", id);
  if (error) return { error: error.message };

  await logAudit({
    actionType: "reject",
    module: "settlements",
    recordId: id,
    recordLabel: s.settlement_number,
    description: `Radd: ${wajah}`,
  });

  revalidatePath("/admin/settlements");
  return { success: true, message: "Radd kar diya." };
}
