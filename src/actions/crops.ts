"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export interface CropState {
  error?: string;
  success?: boolean;
  /** Jo fasal abhi bani -- form usay foran chun leta hai. */
  key?: string;
  label?: string;
}

/**
 * Nayi fasal fehrist mein daalna (spec E).
 *
 * Pehle fasl ki fehrist teen form mein alag alag likhi hui thi. Nayi
 * fasal aane par ek jagah badalti thi aur do jagah purani reh jati thi
 * -- aur usi se ek hi cheez ke do naam paida hote the ("Kanak" aur
 * "Gandum"), jo report mein do alag qatarein ban jate hain.
 *
 * Ab ek hi jagah hai. Yahan sirf naam daala jata hai; koi hisaab is se
 * nahi badalta.
 */
export async function addCrop(_prev: CropState, formData: FormData): Promise<CropState> {
  const supabase = createClient();

  const label = String(formData.get("label") ?? "").trim();
  if (!label) return { error: "Fasal ka naam likhein." };
  if (label.length > 40) return { error: "Naam bohot lamba hai." };

  // Key naam se banti hai -- aur wohi key duplicate rokti hai. "Gandum"
  // aur "gandum " ek hi cheez hain.
  const key = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (!key) return { error: "Naam mein angrezi harf ya adad hona chahiye." };

  const { data: existing } = await supabase.from("crops").select("key, label, is_active").eq("key", key).maybeSingle();
  if (existing) {
    // Pehle se hai to naya nahi banta -- band ho to sirf dobara khol dete hain.
    if (!existing.is_active) {
      await supabase.from("crops").update({ is_active: true }).eq("key", key);
    }
    return { success: true, key: existing.key, label: existing.label, error: undefined };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from("crops").insert({
    key,
    label,
    sort_order: 100,
    created_by: user?.id ?? null,
  });
  if (error) return { error: error.message };

  revalidatePath("/admin/machinery-rental/booking/new");
  return { success: true, key, label };
}
