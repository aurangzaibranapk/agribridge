"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export interface ActionState {
  error?: string;
  success?: boolean;
}

export async function saveLandPrepRate(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const id = (formData.get("id") as string) || null;
  const activityName = String(formData.get("activity_name") ?? "").trim();
  const rate = Number(formData.get("rate_per_acre") ?? 0);

  if (!activityName) return { error: "Activity name zaroori hai." };
  if (!rate || rate <= 0) return { error: "Rate sahi likhein." };

  const payload = { activity_name: activityName, rate_per_acre: rate };
  const { error } = id
    ? await supabase.from("land_prep_rates").update(payload).eq("id", id)
    : await supabase.from("land_prep_rates").insert(payload);

  if (error) return { error: error.message };
  revalidatePath("/admin/rate-master");
  return { success: true };
}

export async function deleteLandPrepRate(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const id = String(formData.get("id") ?? "");
  const { error } = await supabase.from("land_prep_rates").update({ is_active: false }).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/admin/rate-master");
  return { success: true };
}

export async function saveLaborRate(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const id = (formData.get("id") as string) || null;
  const laborType = String(formData.get("labor_type") ?? "").trim();
  const rate = Number(formData.get("rate") ?? 0);

  if (!laborType) return { error: "Labor type zaroori hai." };
  if (!rate || rate <= 0) return { error: "Rate sahi likhein." };

  const payload = { labor_type: laborType, rate };
  const { error } = id
    ? await supabase.from("labor_rates").update(payload).eq("id", id)
    : await supabase.from("labor_rates").insert(payload);

  if (error) return { error: error.message };
  revalidatePath("/admin/rate-master");
  return { success: true };
}

export async function deleteLaborRate(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const id = String(formData.get("id") ?? "");
  const { error } = await supabase.from("labor_rates").update({ is_active: false }).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/admin/rate-master");
  return { success: true };
}