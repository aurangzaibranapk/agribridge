"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export interface ActionState {
  error?: string;
  success?: boolean;
}

export async function updateAiInstructions(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const instructions = String(formData.get("instructions") ?? "");

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Login zaroori hai." };

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  const HQ_ROLES = ["super_admin", "admin", "owner"];
  if (!HQ_ROLES.includes(profile?.role ?? "")) return { error: "Sirf Admin/Owner instructions change kar sakte hain." };

  const { data: existing } = await supabase.from("ai_report_instructions").select("id").limit(1).maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("ai_report_instructions")
      .update({ instructions, updated_by: user.id, updated_at: new Date().toISOString() })
      .eq("id", existing.id);
    if (error) return { error: error.message };
  } else {
    const { error } = await supabase.from("ai_report_instructions").insert({ instructions, updated_by: user.id });
    if (error) return { error: error.message };
  }

  revalidatePath("/admin/ai-instructions");
  return { success: true };
}