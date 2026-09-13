"use server";

import { revalidatePath } from "next/cache";
import { apnaKhanaBadlein } from "@/lib/profile-write";
import { createClient } from "@/lib/supabase/server";

/** Academy, Training Mode aur Simple/Advanced (Guided ERP D, E). */
export interface TrainingState {
  error?: string;
  success?: boolean;
}

export async function markModule(_prev: TrainingState, formData: FormData): Promise<TrainingState> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Login karein." };
  const key = String(formData.get("module_key") ?? "");
  const status = String(formData.get("status") ?? "done");
  if (!key || !["in_progress", "done"].includes(status)) return { error: "Module saaf nahi." };
  const { error } = await supabase.from("staff_training_progress").upsert(
    { profile_id: user.id, module_key: key, status, completed_at: status === "done" ? new Date().toISOString() : null, updated_at: new Date().toISOString() },
    { onConflict: "profile_id,module_key" }
  );
  if (error) return { error: error.message };
  revalidatePath("/admin/academy");
  revalidatePath("/admin/academy/team");
  revalidatePath("/admin/my-work");
  return { success: true };
}

export async function setTrainingMode(_prev: TrainingState, formData: FormData): Promise<TrainingState> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Login karein." };
  const on = String(formData.get("on") ?? "") === "1";
  // Apne hi profile ka khana -- aur wo bhi bandhi hui fehrist se.
  // `profiles` par badalne ka koi RLS qanoon nahi hai, is liye user wale
  // client se ye update chup chaap 0 qatarein badalta tha.
  const res = await apnaKhanaBadlein(user.id, { training_mode: on });
  if (res.error) return { error: res.error };
  revalidatePath("/admin/my-work");
  revalidatePath("/admin/academy");
  return { success: true };
}

export async function setUiMode(mode: "simple" | "advanced"): Promise<TrainingState> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Login karein." };
  const res = await apnaKhanaBadlein(user.id, { ui_mode: mode });
  if (res.error) return { error: res.error };
  revalidatePath("/admin", "layout");
  return { success: true };
}
