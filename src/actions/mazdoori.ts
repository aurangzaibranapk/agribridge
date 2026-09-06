"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { logAudit } from "@/lib/audit";
import { postJournal } from "@/lib/ledger/post";
import { ACC } from "@/lib/ledger/rules";

export interface ActionState {
  error?: string;
  success?: boolean;
  message?: string;
}

/**
 * Mazdoori — aur purana advance khud-ba-khud us mein se katta hai.
 *
 * =====================================================================
 * MALIK KA APNA MISAAL (6 September)
 * =====================================================================
 *
 *   *"Agar us ne pehle Rs 3,000 advance liye aur agle din Rs 2,000 ki
 *   mazdoori ki: Labour Earned 2,000, Advance Adjusted 2,000, Advance
 *   remaining 1,000. Kal phir Rs 1,500 ki mazdoori kare: remaining
 *   advance Rs 1,000 adjust, ab ART ko us ko Rs 500 dena hai. Yehi
 *   automatic settlement chahiye."*
 *
 * Aur us se bhi bunyadi baat:
 *
 *   *"Advance diya lekin kaam abhi nahi hua — us ko turant Labour
 *   Expense banana accounting-wise ghalat hoga. Wo pehle Labour/Worker
 *   Advance (Recoverable/Asset) rahega."*
 *
 * Is liye kharcha (6015) us DIN banta hai jis din KAAM hota hai, paisa
 * dene ke din nahi.
 *
 * =====================================================================
 * ADJUST SIRF MAZDOORI KE ADVANCE MEIN SE
 * =====================================================================
 *
 * Malik: *"System silently balance overwrite na kare... Silent set-off
 * bilkul nahi."*
 *
 * Is liye yahan sirf 1145 (mazdoor ka advance) chhua jata hai. Us bande
 * par khaad ka udhaar (1150) ya fasal ki peshgi (1140) ho to wo yahan se
 * NAHI katti -- us ke liye alag, manzoor shuda qadam chahiye. Do alag
 * sawal hain aur do alag manzooriyan.
 */

/**
 * `labour_work_entries` migration 349 ka hai; generated types abhi us se
 * pehle ke hain. Ye ek jagah ka cast types dobara banne par hat jayega
 * -- har call par `as any` bikherne se behtar hai.
 */
function mazdooriTable() {
  return (createServiceClient() as unknown as { from: (t: string) => any }).from("labour_work_entries");
}

const MANZOORI_WALE = ["manager", "admin_assistant", "finance"];
const SAB_KUCH = ["owner", "super_admin", "admin"];

async function main() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Login zaroori hai." };
  const { data: p } = await supabase
    .from("profiles")
    .select("role, is_active, branch_id, shop_id")
    .eq("id", user.id)
    .maybeSingle();
  if (!p?.is_active) return { error: "Ye account fa'aal nahi hai." };
  return {
    userId: user.id,
    role: String(p.role),
    branchId: (p.branch_id as string | null) ?? null,
    shopId: (p.shop_id as string | null) ?? null,
  };
}

async function nextMazdooriNumber(): Promise<string> {
  const saal = new Date().getFullYear() % 100;
  const { count } = await mazdooriTable()
    .select("id", { count: "exact", head: true })
    .like("entry_number", `MZD-${saal}-%`);
  return `MZD-${saal}-${String((count ?? 0) + 1).padStart(5, "0")}`;
}

/**
 * Is bande par mazdoori ka kya haal hai.
 *
 * Ledger se, kisi alag khane se nahi. Do jagah rakha hua adad ek din do
 * alag jawab dene lagta hai -- ye is project mein pehle ho chuka hai
 * (127).
 */
async function mazdooriKaHaal(
  partyType: string,
  partyId: string
): Promise<{ advanceBaqi: number; denaBaqi: number }> {
  const service = createServiceClient();
  const { data } = await service
    .from("journal_lines")
    .select("account_code, debit, credit")
    .eq("party_type", partyType)
    .eq("party_id", partyId)
    .in("account_code", [ACC.workerAdvance, ACC.workerPayable]);

  let advance = 0;
  let dena = 0;
  for (const l of (data ?? []) as { account_code: string; debit: number | null; credit: number | null }[]) {
    const d = Number(l.debit ?? 0);
    const c = Number(l.credit ?? 0);
    if (l.account_code === ACC.workerAdvance) advance += d - c;
    else dena += c - d;
  }
  return { advanceBaqi: Math.max(advance, 0), denaBaqi: Math.max(dena, 0) };
}

/** Safhe ke liye — banda chunte hi us ka haal saamne aa jaye. */
export async function bandeKaHaal(
  partyType: string,
  partyId: string
): Promise<{ advanceBaqi: number; denaBaqi: number } | null> {
  const who = await main();
  if ("error" in who) return null;
  return mazdooriKaHaal(partyType, partyId);
}

/** Staff kaam darj karta hai. */
export async function mazdooriDarj(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const who = await main();
  if ("error" in who) return { error: who.error };

  const partyType = String(formData.get("party_type") ?? "").trim();
  const partyId = String(formData.get("party_id") ?? "").trim();
  if (!partyType || !partyId) {
    return { error: "Banda chunein — mazdoori kisi ke khaate mein jati hai, is liye ID zaroori hai." };
  }

  const workDetail = String(formData.get("work_detail") ?? "").trim();
  if (!workDetail) return { error: "Kaam kya tha, ye likhein." };

  const workDate = String(formData.get("work_date") ?? "").trim();
  if (!workDate) return { error: "Kaam ki tareekh likhein." };

  const quantity = formData.get("quantity") ? Number(formData.get("quantity")) : null;
  const rate = formData.get("rate") ? Number(formData.get("rate")) : null;
  const unit = String(formData.get("unit") ?? "").trim() || null;

  // Raqam ginti × rate se banti hai jab dono maujood hon -- warna banda
  // ginti likh kar raqam kuch aur likh de, aur qatar khud apne aap se
  // ulti ho jaye.
  let amount = Number(formData.get("amount") ?? 0);
  if (quantity && rate) amount = Math.round(quantity * rate * 100) / 100;
  if (!Number.isFinite(amount) || amount <= 0) return { error: "Mazdoori ki raqam sahi likhein." };

  const { advanceBaqi } = await mazdooriKaHaal(partyType, partyId);
  const adjust = Math.min(advanceBaqi, amount);
  const payable = Math.round((amount - adjust) * 100) / 100;

  const entryNumber = await nextMazdooriNumber();

  const { data: row, error } = await mazdooriTable().insert({
      entry_number: entryNumber,
      party_type: partyType,
      party_id: partyId,
      work_date: workDate,
      work_detail: workDetail,
      quantity,
      unit,
      rate,
      amount,
      // Hisaab abhi likha ja raha hai taake staff ko saamne nazar aaye.
      // Manzoori ke waqt ye DOBARA lagta hai -- beech mein us bande par
      // aur qatarein aa sakti hain.
      advance_adjusted: adjust,
      payable_added: payable,
      received_by_name: String(formData.get("received_by_name") ?? "").trim() || null,
      received_by_note: String(formData.get("received_by_note") ?? "").trim() || null,
      branch_id: who.branchId,
      shop_id: who.shopId,
      created_by: who.userId,
      status: "pending",
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  await logAudit({
    actionType: "create",
    module: "mazdoori",
    recordId: row?.id,
    recordLabel: entryNumber,
    description: `Mazdoori Rs ${amount.toLocaleString()} — advance mein se ${adjust.toLocaleString()} adjust, ${payable.toLocaleString()} dena.`,
  });

  revalidatePath("/admin/mazdoori");
  return {
    success: true,
    message:
      adjust > 0
        ? `${entryNumber} darj. Rs ${amount.toLocaleString()} mein se Rs ${adjust.toLocaleString()} purane advance mein se adjust hua; Rs ${payable.toLocaleString()} dena banega. Manzoori ke baad kitab mein jayega.`
        : `${entryNumber} darj — Rs ${amount.toLocaleString()} dena banega. Manzoori ka intezar.`,
  };
}

/**
 * Manzoori — aur yahan hisaab DOBARA lagta hai.
 *
 * Darj hone aur manzoori ke beech us bande par aur qatarein aa sakti
 * hain (koi aur staff us ko advance de sakta hai). Purana hisaab chala
 * dene se advance do dafa adjust ho jata -- aur wo ghalti kabhi khud
 * nazar nahi aati.
 */
export async function mazdooriManzoor(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const who = await main();
  if ("error" in who) return { error: who.error };
  if (!MANZOORI_WALE.includes(who.role) && !SAB_KUCH.includes(who.role)) {
    return { error: "Manzoori sirf Manager, Admin Assistant, Finance ya Admin de sakta hai." };
  }

  const id = String(formData.get("id") ?? "");
  const raye = String(formData.get("comment") ?? "").trim();
  if (!id) return { error: "Qatar nahi mili." };
  // Malik ka usool: manzoori par comment lazmi hai.
  if (!raye) return { error: "Manzoori ke sath apni raye likhein — baad mein yehi batati hai ke aap ne kya dekh kar manzoor kia." };

  const { data: k } = (await mazdooriTable().select("*").eq("id", id).maybeSingle()) as { data: any };
  if (!k) return { error: "Ye qatar nahi mili." };
  if (k.status === "approved") return { error: "Ye pehle hi manzoor ho chuki hai." };
  if (k.status === "rejected") return { error: "Ye radd ho chuki hai." };

  const amount = Number(k.amount ?? 0);
  if (amount <= 0) return { error: "Raqam sifar hai — ye qatar post nahi ho sakti." };

  const { advanceBaqi } = await mazdooriKaHaal(String(k.party_type), String(k.party_id));
  const adjust = Math.min(advanceBaqi, amount);
  const payable = Math.round((amount - adjust) * 100) / 100;

  const tafseel = `${k.entry_number} — Mazdoori: ${k.work_detail}`;
  const lines: {
    account: string;
    debit?: number;
    credit?: number;
    partyType?: string | null;
    partyId?: string | null;
    memo: string;
  }[] = [
    // Kharcha poori raqam par -- kaam poora hua hai. Advance sirf ye
    // batata hai ke wo paisa pehle ja chuka tha.
    { account: ACC.labour, debit: amount, partyType: k.party_type, partyId: k.party_id, memo: tafseel },
  ];
  if (adjust > 0) {
    lines.push({
      account: ACC.workerAdvance,
      credit: adjust,
      partyType: k.party_type,
      partyId: k.party_id,
      memo: `${tafseel} — purana advance adjust`,
    });
  }
  if (payable > 0) {
    lines.push({
      account: ACC.workerPayable,
      credit: payable,
      partyType: k.party_type,
      partyId: k.party_id,
      memo: `${tafseel} — dena`,
    });
  }

  const posted = await postJournal({
    description: tafseel,
    sourceModule: "mazdoori",
    sourceId: id,
    branchId: k.branch_id ?? who.branchId,
    entryDate: k.work_date ?? undefined,
    createdBy: who.userId,
    claims: [{ table: "labour_work_entries", rowId: id }],
    lines,
  });

  if ("error" in posted) {
    return { error: `Kitab mein qatar nahi bani, is liye manzoori bhi nahi di gayi: ${posted.error}` };
  }

  const { error: halatError } = await mazdooriTable().update({
      status: "approved",
      approved_by: who.userId,
      approved_at: new Date().toISOString(),
      advance_adjusted: adjust,
      payable_added: payable,
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
    module: "mazdoori",
    recordId: id,
    recordLabel: k.entry_number,
    description: `Manzoor: Rs ${amount.toLocaleString()} (advance adjust ${adjust.toLocaleString()}, dena ${payable.toLocaleString()}). Raye: ${raye}`,
  });

  revalidatePath("/admin/mazdoori");
  revalidatePath("/admin/kharche");

  return {
    success: true,
    message:
      adjust > 0
        ? `Manzoor. Rs ${adjust.toLocaleString()} purane advance mein se adjust hua, Rs ${payable.toLocaleString()} dena baqi.`
        : `Manzoor. Rs ${payable.toLocaleString()} dena baqi.`,
  };
}

/** Wapas bhejna ya radd karna — dono par wajah lazmi. */
export async function mazdooriRadd(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const who = await main();
  if ("error" in who) return { error: who.error };
  if (!MANZOORI_WALE.includes(who.role) && !SAB_KUCH.includes(who.role)) {
    return { error: "Ye faisla sirf Manager, Admin Assistant, Finance ya Admin kar sakta hai." };
  }

  const id = String(formData.get("id") ?? "");
  const wajah = String(formData.get("rejection_reason") ?? "").trim();
  if (!id) return { error: "Qatar nahi mili." };
  if (!wajah) return { error: "Wajah likhein — us ke baghair darj karne wale ko pata nahi chalta ke kya theek karna hai." };

  const { data: k } = (await mazdooriTable()
    .select("entry_number, status")
    .eq("id", id)
    .maybeSingle()) as { data: any };
  if (!k) return { error: "Ye qatar nahi mili." };
  if (k.status === "approved") return { error: "Ye manzoor ho kar kitab mein ja chuki hai — ulti qatar banayein." };

  const { error } = await mazdooriTable()
    .update({ status: "rejected", rejection_reason: wajah })
    .eq("id", id);
  if (error) return { error: error.message };

  await logAudit({
    actionType: "reject",
    module: "mazdoori",
    recordId: id,
    recordLabel: k.entry_number,
    description: `Radd: ${wajah}`,
  });

  revalidatePath("/admin/mazdoori");
  return { success: true, message: "Radd kar diya." };
}
