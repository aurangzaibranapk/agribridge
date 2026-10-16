"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

export interface ActionState {
  error?: string;
  success?: boolean;
  message?: string;
}

export async function saveChillar(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const name = String(formData.get("name") ?? "").trim();
  const location = String(formData.get("location") ?? "").trim() || null;
  const inCharge = String(formData.get("in_charge") ?? "").trim() || null;

  if (!name) return { error: "Name zaroori hai." };

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Login zaroori hai." };

  const service = createServiceClient();
  const { error } = await service.from("milk_chillars").insert({
    name,
    location,
    in_charge: inCharge,
  });

  if (error) return { error: error.message };

  revalidatePath("/admin/milk-collection/chillars");
  return { success: true, message: "Chillar save ho gaya." };
}

export async function listChillars() {
  const service = createServiceClient();
  const { data } = await service
    .from("milk_chillars")
    .select("*")
    .eq("is_active", true)
    .order("name");
  return data ?? [];
}
