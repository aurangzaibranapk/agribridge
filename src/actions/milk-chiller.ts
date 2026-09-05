"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { applyFat, VERIFY_COMMENT_MAX, VERIFY_COMMENT_MIN } from "@/lib/milk-collection";
import { logAudit } from "@/lib/audit";
import { requireAction } from "@/lib/access/guard";

export interface ActionState {
  error?: string;
  success?: boolean;
  message?: string;
}

const CHILLER_ROLES = ["owner", "super_admin", "admin", "manager", "milk_collection"];
const VERIFY_ROLES = ["owner", "super_admin", "admin", "manager"];

async function caller(allowed: string[]) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Login zaroori hai." };

  const { data: profile } = await supabase.from("profiles").select("role, is_active").eq("id", user.id).maybeSingle();
  if (!profile?.is_active) return { error: "Ye account fa'aal nahi hai." };
  if (!allowed.includes(profile.role)) return { error: "Aapko is kaam ki ijazat nahi hai." };

  return { userId: user.id, role: profile.role };
}

/**
 * Chiller par FAT lagana -- ek entry par.
 *
 * Yahi wo lamha hai jab paisa kisan ke khate mein jata hai. Rate ka
 * hisaab yahan nahi likha; wo engine mein hai, wahi jo website, WhatsApp
 * aur offline istemal karte hain.
 */
export async function applyFatAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const who = await caller(CHILLER_ROLES);
  if ("error" in who) return { error: who.error };

  // FAT lagne se paisa banta hai -- is liye ye 'verify' ki ijazat mangta
  // hai, sirf safha khulne se kaam nahi chalta.
  const gate = await requireAction("milk-collection.chiller", "verify");
  if ("error" in gate) return { error: gate.error };

  const entryId = String(formData.get("entry_id") ?? "");
  const fat = Number(formData.get("fat_percentage") ?? 0);

  if (!entryId) return { error: "Entry nahi mili." };
  if (!(fat > 0) || fat > 15) return { error: "FAT sahi likhein (0 se 15 ke darmiyan)." };

  const result = await applyFat(entryId, fat, who.userId);
  if ("error" in result) return { error: result.error };

  await logAudit({
    actionType: "update",
    module: "milk_entries",
    recordId: entryId,
    recordLabel: result.collectionNumber,
    description: `FAT ${fat}% laga — TS ${result.ts}, Rs ${result.amount.toLocaleString()}`,
  });

  revalidatePath("/admin/milk-collection/chiller");
  revalidatePath("/admin/milk-collection");
  return { success: true, message: `${result.collectionNumber} — Rs ${result.amount.toLocaleString()}` };
}

/**
 * Poore route par ek hi FAT.
 *
 * Chiller par aksar poore tank ka ek namoona liya jata hai, har kisan ka
 * alag nahi. Us soorat mein wohi FAT sab par lagta hai.
 *
 * Ek entry nakaam ho to baqi rukti nahi -- 30 mein se ek ka LR na hone
 * ki wajah se baqi 29 kisanon ka paisa rok dena ghalat hoga. Nakaam
 * hone walon ki ginti sath bata di jati hai.
 */
export async function applyFatToBatch(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const who = await caller(CHILLER_ROLES);
  if ("error" in who) return { error: who.error };

  const gate = await requireAction("milk-collection.chiller", "verify");
  if ("error" in gate) return { error: gate.error };

  const fat = Number(formData.get("fat_percentage") ?? 0);
  const date = String(formData.get("entry_date") ?? "");
  const shift = String(formData.get("shift") ?? "");
  const route = String(formData.get("route_name") ?? "");

  if (!(fat > 0) || fat > 15) return { error: "FAT sahi likhein (0 se 15 ke darmiyan)." };
  if (!date || !shift) return { error: "Tareekh aur shift zaroori hai." };

  const service = createServiceClient();
  let query = service
    .from("milk_entries")
    .select("id")
    .eq("entry_date", date)
    .eq("shift", shift)
    .eq("collection_source", "mca_field")
    .eq("status", "pending_fat");
  query = route ? query.eq("route_name", route) : query.is("route_name", null);

  const { data: entries } = await query;
  if (!entries || entries.length === 0) return { error: "Is route mein FAT ke intezar wali koi entry nahi." };

  let done = 0;
  const failures: string[] = [];
  for (const entry of entries) {
    const result = await applyFat(entry.id, fat, who.userId);
    if ("error" in result) failures.push(result.error);
    else done += 1;
  }

  await logAudit({
    actionType: "update",
    module: "milk_entries",
    recordLabel: `${route || "Bagair route"} ${date} ${shift}`,
    description: `Poore route par FAT ${fat}% laga — ${done} entries`,
  });

  revalidatePath("/admin/milk-collection/chiller");
  revalidatePath("/admin/milk-collection");

  if (failures.length) {
    return {
      success: true,
      message: `${done} entries par FAT lag gaya. ${failures.length} reh gayin: ${failures[0]}`,
    };
  }
  return { success: true, message: `${done} entries par FAT lag gaya.` };
}

/**
 * Chiller par kitna doodh pahuncha.
 *
 * Maidan ka doodh entries se khud gina jata hai -- MCA se dobara
 * poochhna do jagah number rakhne jaisa hota, aur do numbers hamesha ek
 * din alag ho jate hain.
 */
export async function recordChillerReceipt(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const who = await caller(CHILLER_ROLES);
  if ("error" in who) return { error: who.error };

  const date = String(formData.get("entry_date") ?? "");
  const shift = String(formData.get("shift") ?? "");
  const route = String(formData.get("route_name") ?? "");
  const received = Number(formData.get("chiller_received_volume") ?? 0);
  const notes = (formData.get("notes") as string) || null;

  if (!date || !shift) return { error: "Tareekh aur shift zaroori hai." };
  if (!(received > 0)) return { error: "Chiller par pahuncha hua doodh likhein." };

  const gate = await requireAction("milk-collection.chiller", "edit");
  if ("error" in gate) return { error: gate.error };

  const service = createServiceClient();

  // SIRF wo doodh jo MCA le kar aaya. Jo kisan khud chiller par de gaya,
  // wo kisi MCA ki gaari mein kabhi tha hi nahi -- use is hisaab mein
  // milane se us MCA ka nuqsan ghalat nikalta aur us ki karkardagi
  // kharab nazar aati.
  let entriesQuery = service
    .from("milk_entries")
    .select("quantity_liters, branch_id")
    .eq("entry_date", date)
    .eq("shift", shift)
    .eq("collection_source", "mca_field")
    .neq("status", "rejected");
  entriesQuery = route ? entriesQuery.eq("route_name", route) : entriesQuery.is("route_name", null);

  const { data: entries } = await entriesQuery;
  if (!entries || entries.length === 0) return { error: "Is route ka MCA wala koi doodh nahi mila." };

  const fieldVolume = entries.reduce((sum, e) => sum + Number(e.quantity_liters), 0);
  const branchId = entries.find((e) => e.branch_id)?.branch_id ?? null;

  const { data: settings } = await service
    .from("milk_rate_settings")
    .select("shortage_alert_threshold")
    .limit(1)
    .maybeSingle();
  const threshold = Number(settings?.shortage_alert_threshold ?? 0.5);

  const shortageLiters = Math.round((fieldVolume - received) * 100) / 100;
  const shortagePercentage = fieldVolume > 0 ? (shortageLiters / fieldVolume) * 100 : 0;
  const isRedAlert = shortagePercentage > threshold;

  const routeLabel = route || "Bagair route";

  // Ek hi route ka ek hi shift do dafa darj na ho jaye -- pehle dekh
  // lete hain, phir badalte hain.
  const { data: existing } = await service
    .from("milk_route_collections")
    .select("id")
    .eq("collection_date", date)
    .eq("shift", shift)
    .eq("route_name", routeLabel)
    .maybeSingle();

  const row = {
    route_name: routeLabel,
    branch_id: branchId,
    collection_date: date,
    shift,
    field_collected_volume: fieldVolume,
    chiller_received_volume: received,
    shortage_liters: shortageLiters,
    shortage_percentage: Math.round(shortagePercentage * 1000) / 1000,
    is_red_alert: isRedAlert,
    notes,
    created_by: who.userId,
  };

  const { error } = existing
    ? await service.from("milk_route_collections").update(row).eq("id", existing.id)
    : await service.from("milk_route_collections").insert(row);

  if (error) return { error: error.message };

  revalidatePath("/admin/milk-collection/chiller");
  revalidatePath("/admin/milk-collection/routes");

  const gap = `${shortageLiters > 0 ? "Kami" : "Ziyadti"} ${Math.abs(shortageLiters)} L (${Math.abs(
    Math.round(shortagePercentage * 100) / 100
  )}%)`;
  return { success: true, message: isRedAlert ? `⚠️ ${gap} — hadd se zyada.` : gap };
}

/**
 * Manager ki tasdeeq.
 *
 * Comment lazmi hai, aur ye rok database mein bhi lagi hui hai
 * (chk_milk_verify_comment) -- sirf yahan nahi. Paise ke faisle par ek
 * hi rok kaafi nahi hoti.
 */
export async function verifyMilkEntries(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const who = await caller(VERIFY_ROLES);
  if ("error" in who) return { error: who.error };

  const ids = formData.getAll("entry_ids").map(String).filter(Boolean);
  const comment = String(formData.get("verified_comment") ?? "").trim();
  const decision = String(formData.get("decision") ?? "verified");

  if (ids.length === 0) return { error: "Koi entry nahi chuni gayi." };
  if (!["verified", "rejected"].includes(decision)) return { error: "Faisla sahi nahi hai." };

  const gate = await requireAction("milk-collection.verify", decision === "verified" ? "verify" : "reject");
  if ("error" in gate) return { error: gate.error };
  if (comment.length < VERIFY_COMMENT_MIN) {
    return { error: `Comment kam az kam ${VERIFY_COMMENT_MIN} haroof ka hona chahiye — bina wajah likhe faisla nahi ho sakta.` };
  }
  if (comment.length > VERIFY_COMMENT_MAX) {
    return { error: `Comment zyada se zyada ${VERIFY_COMMENT_MAX} haroof ka ho sakta hai.` };
  }

  const service = createServiceClient();
  const { error } = await service
    .from("milk_entries")
    .update({
      status: decision,
      verified_by_profile_id: who.userId,
      verified_comment: comment,
      verified_at: new Date().toISOString(),
    })
    .in("id", ids)
    // Sirf wo entries jin par rate lag chuka ho. Do manager ek sath
    // faisla kar dein to doosra khali haath lautta hai, badalta kuch
    // nahi.
    .eq("status", "priced");

  if (error) return { error: error.message };

  await logAudit({
    actionType: decision === "verified" ? "approve" : "reject",
    module: "milk_entries",
    recordLabel: `${ids.length} entries`,
    description: `${decision === "verified" ? "Tasdeeq" : "Rad"}: ${comment}`,
  });

  revalidatePath("/admin/milk-collection/verify");
  revalidatePath("/admin/milk-collection");
  return { success: true, message: `${ids.length} entries par faisla ho gaya.` };
}
