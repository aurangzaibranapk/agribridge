import { createServiceClient } from "@/lib/supabase/service";

/**
 * Kaam ka haath badalna -- ek hi jagah se.
 *
 * Malik ka usool (4 September): jis safhe ka kaam poora ho, wahan
 * green line aaye aur likha aaye ke ab ye kaam kis safhe par kis ka
 * hai; aur jis jis ko wo kaam jaye us ki sidebar, dashboard aur ghanti
 * -- teenon jagah nazar aaye.
 *
 * Yahan sirf handoff darj hota hai. Khabar (notification) database ka
 * trigger khud banata hai (290) -- is liye har raasta khabar bhejta
 * hai, chahe wo safha ho, sheet ka import ho, ya AI ki tajweez. Agar
 * khabar bhejna har raaste ka apna kaam hota to koi ek raasta usay
 * bhool jata, aur wo soorat mahinon nazar na aati: safha bilkul theek
 * chalta rehta, bas khabar na jati.
 *
 * DO USOOL:
 *
 * 1. Handoff banne mein NAKAAMI se asal kaam nahi rukta. Purchase
 *    manzoor ho chuki hai -- us ke baad khabar na ja sakne par manzoori
 *    wapas nahi li jati. Khabar ahem hai, magar wo asal kaam se upar
 *    nahi. Is liye yahan se koi cheez phenki nahi jati; nakaami sirf
 *    likh di jati hai.
 *
 * 2. Service client se likha jata hai. Handoff us bande ke liye banta
 *    hai jo abhi login nahi -- warehouse wala, manager. Us ke apne RLS
 *    se likhne par wo qatar ban hi nahi sakti jo doosre ke liye ho.
 */

export type HandoffInput = {
  /** Kis safhe se aaya (feature key). */
  from: string | null;
  /** Ab kis safhe par kaam hai (feature key). */
  to: string;
  /** Us safhe ka raasta. */
  route: string;
  /** Kis ka kaam -- role. */
  roles?: string[];
  /** Kis ka kaam -- naam (agar us record par kisi ka naam laga ho). */
  profileId?: string | null;
  /** Kis cheez ka kaam. */
  recordTable?: string | null;
  recordId?: string | null;
  /** Wo naam jo banda pehchanta hai: "PO-1788537423737". */
  recordLabel?: string | null;
  /** Kis shaakh ka kaam. */
  branchId?: string | null;
  /** Ek line: kya hua. */
  title: string;
  /** Ek line: ab kya karna hai. */
  message: string;
  /** Jis ne ye kaam poora kiya -- us ko apni hi khabar nahi jati. */
  byProfileId?: string | null;
};

export async function createHandoff(input: HandoffInput): Promise<{ ok: boolean; reason?: string }> {
  if (!input.to || !input.route) return { ok: false, reason: "agla safha nahi bataya gaya" };
  if ((input.roles?.length ?? 0) === 0 && !input.profileId) {
    // Bina kisi ke naam ya role ke khabar wo qatar hai jo kisi ko nazar
    // nahi aati. Aisi qatar banane se na banana behtar hai.
    return { ok: false, reason: "khabar kis ke liye hai, ye nahi bataya gaya" };
  }

  try {
    const service = createServiceClient();
    const { error } = await service.from("work_handoffs").insert({
      from_feature: input.from,
      to_feature: input.to,
      to_route: input.route,
      to_roles: input.roles ?? [],
      to_profile_id: input.profileId ?? null,
      record_table: input.recordTable ?? null,
      record_id: input.recordId ?? null,
      record_label: input.recordLabel ?? null,
      branch_id: input.branchId ?? null,
      title: input.title,
      message: input.message,
      created_by: input.byProfileId ?? null,
    });

    if (error) {
      // Wohi kaam dobara mukammal hua -- khabar pehle se khuli hai. Ye
      // ghalti nahi, rok hai (290 ka unique index). Bar bar aane wali
      // khabar ko log parhna chhoR dete hain, aur us ke baad asal
      // khabar bhi us ke sath dab jati hai.
      if (error.code === "23505") return { ok: true };
      console.error("handoff nahi bana:", error.message);
      return { ok: false, reason: error.message };
    }
    return { ok: true };
  } catch (err) {
    console.error("handoff nahi bana:", err);
    return { ok: false, reason: "maloom nahi" };
  }
}

/**
 * Jo kaam ho gaya, us ki qatar band.
 *
 * Khuli qatar band na karne se sidebar ki ginti barhti rehti hai aur
 * banda us par bharosa karna chhoR deta hai -- "wahan to hamesha 5
 * likha rehta hai".
 */
export async function closeHandoff(
  toFeature: string,
  recordTable: string,
  recordId: string,
  byProfileId?: string | null
): Promise<void> {
  try {
    const service = createServiceClient();
    await service
      .from("work_handoffs")
      .update({ status: "done", done_at: new Date().toISOString(), done_by: byProfileId ?? null })
      .eq("to_feature", toFeature)
      .eq("record_table", recordTable)
      .eq("record_id", recordId)
      .eq("status", "open");
  } catch (err) {
    console.error("handoff band nahi hua:", err);
  }
}
