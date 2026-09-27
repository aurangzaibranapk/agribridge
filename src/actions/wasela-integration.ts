"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

export interface ActionState {
  error?: string;
  success?: boolean;
}

const ADMIN_ROLES = ["super_admin", "admin", "owner"];

type SettingRow = { value: string };

export async function getWaselaIntegrationStatus(): Promise<boolean> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const service = createServiceClient() as any;
  const { data } = await service
    .from("system_settings")
    .select("value")
    .eq("key", "wasela_pakistan_enabled")
    .maybeSingle();
  return (data as SettingRow | null)?.value === "true";
}

export async function toggleWaselaIntegration(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Login zaroori hai." };

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (!profile?.role || !ADMIN_ROLES.includes(profile.role)) {
    return { error: "Sirf Admin ye setting badal sakta hai." };
  }

  const enabled = formData.get("enabled") === "true";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const service = createServiceClient() as any;

  const { error } = await service
    .from("system_settings")
    .upsert({ key: "wasela_pakistan_enabled", value: enabled ? "true" : "false", updated_by: user.id, updated_at: new Date().toISOString() });

  if (error) return { error: error.message };

  revalidatePath("/admin/finance/payment-mapping");
  revalidatePath("/admin/finance");
  return { success: true };
}
