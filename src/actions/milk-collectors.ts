"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

export interface ActionState {
  error?: string;
  success?: boolean;
  message?: string;
}

export async function saveCollector(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const name = String(formData.get("name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim() || null;
  const assignedChillar = String(formData.get("assigned_chillar") ?? "").trim() || null;
  const route = String(formData.get("route") ?? "").trim() || null;

  if (!name) return { error: "Name zaroori hai." };

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Login zaroori hai." };

  const service = createServiceClient();
  const { error } = await service.from("milk_collectors").insert({
    name,
    phone,
    assigned_chillar: assignedChillar,
    route,
    created_by: user.id,
  });

  if (error) return { error: error.message };

  revalidatePath("/admin/milk-collection/collectors");
  return { success: true, message: "Collector save ho gaya." };
}

export async function listCollectors() {
  const service = createServiceClient();
  const { data } = await service
    .from("milk_collectors")
    .select("*")
    .eq("is_active", true)
    .order("name");
  return data ?? [];
}
