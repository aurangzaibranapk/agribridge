"use server";

import { revalidatePath } from "next/cache";
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
  const { error } = await supabase.from("profiles").update({ training_mode: on }).eq("id", user.id);
  if (error) return { error: error.message };
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
  const { error } = await supabase.from("profiles").update({ ui_mode: mode }).eq("id", user.id);
  if (error) return { error: error.message };
  revalidatePath("/admin", "layout");
  return { success: true };
}
