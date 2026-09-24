"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export interface RateCardState {
  error?: string;
  success?: boolean;
  notice?: string;
}

/**
 * Naya default rate rakhna (177).
 *
 * Purani qatar mitai NAHI jati. Nayi qatar nayi tareekh se lagti hai
 * aur purani wahin rehti hai -- "us waqt rate kya tha" ka jawab kisi
 * din zaroor poochha jata hai, aur mita hui qatar wo jawab nahi de
 * sakti.
 *
 * Ye kisi bill ko nahi badalta. Jo bill ban chuke wo apne apne rate
 * par khare rehte hain -- warna card badalne se purana bill bhi badal
 * jata, aur wo bill kisan ko de bhi diya gaya hota.
 */
export async function saveRateCard(_prev: RateCardState, formData: FormData): Promise<RateCardState> {
  const supabase = createClient();

  const harvestType = String(formData.get("harvest_type") ?? "").trim();
  if (!["sabit", "kutra"].includes(harvestType)) {
    return { error: "Qism chunein: Sabit Parali ya Kutra." };
  }

  const rate = Number(formData.get("rate") ?? 0);
  if (!rate || rate <= 0) return { error: "Rate sahi likhein." };

  const cropKey = String(formData.get("crop_key") ?? "").trim() || null;
  // Machine ki qism hath se likhi jati hai -- "Harvester" aur
  // " harvester " ek hi cheez hain. Chhoti likhai mein rakhne se match
  // hamesha milta hai.
  const machineType = String(formData.get("machine_type") ?? "").trim().toLowerCase() || null;
  const effectiveFrom =
    String(formData.get("effective_from") ?? "").trim() || new Date().toISOString().slice(0, 10);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Usi din, usi fasal-machine-qism par dobara likhna ghalti ki durusti
  // hai -- nayi qatar nahi. "Khali fasal" ka filter postgrest par alag
  // banta hai, is liye milan yahan poori fehrist par hota hai; qatarein
  // thoRi si hi hoti hain.
  const { data: all } = await supabase
    .from("machinery_rate_cards")
    .select("id, crop_key, machine_type, harvest_type, effective_from");
  const existing = (all ?? []).find(
    (c) =>
      c.harvest_type === harvestType &&
      c.effective_from === effectiveFrom &&
      (c.crop_key ?? null) === cropKey &&
      (c.machine_type ?? null) === machineType
  );

  if (existing) {
    const { error } = await supabase
      .from("machinery_rate_cards")
      .update({ rate, is_active: true, notes: String(formData.get("notes") ?? "").trim() || null, updated_at: new Date().toISOString() })
      .eq("id", existing.id);
    if (error) return { error: error.message };
    revalidatePath("/admin/machinery-rental/rate-card");
    return { success: true, notice: "Usi tareekh ka rate badal diya gaya." };
  }

  const { error } = await supabase.from("machinery_rate_cards").insert({
    crop_key: cropKey,
    machine_type: machineType,
    harvest_type: harvestType,
    rate,
    effective_from: effectiveFrom,
    notes: String(formData.get("notes") ?? "").trim() || null,
    created_by: user?.id ?? null,
  });
  if (error) return { error: error.message };

  revalidatePath("/admin/machinery-rental/rate-card");
  revalidatePath("/admin/machinery-rental/booking/new");
  return { success: true, notice: "Naya default rate laag ho gaya." };
}

/**
 * Qatar ko band karna -- mitana nahi.
 *
 * Band qatar aage nahi lagti, magar record mein rehti hai. Purane bill
 * ki wajah samajhne ke liye yehi qatar chahiye hoti hai.
 */
export async function toggleRateCard(_prev: RateCardState, formData: FormData): Promise<RateCardState> {
  const supabase = createClient();
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Qatar nahi mili." };

  const { data: row } = await supabase
    .from("machinery_rate_cards")
    .select("id, is_active")
    .eq("id", id)
    .maybeSingle();
  if (!row) return { error: "Qatar nahi mili." };

  const { error } = await supabase
    .from("machinery_rate_cards")
    .update({ is_active: !row.is_active, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/admin/machinery-rental/rate-card");
  return { success: true, notice: row.is_active ? "Qatar band kar di gayi." : "Qatar dobara chalu." };
}
