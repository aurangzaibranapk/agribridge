"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type TenantSettingsState = { error?: string; success?: boolean };

function clean(value: FormDataEntryValue | null) {
  return String(value ?? "").trim();
}

export async function updateTenantSettings(
  _prev: TenantSettingsState,
  formData: FormData,
): Promise<TenantSettingsState> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("organization_id, role, is_active")
    .eq("id", user.id)
    .single();
  if (!profile?.is_active || profile.role !== "super_admin" || !profile.organization_id) {
    return { error: "Only the active organization owner can update these settings." };
  }

  const brandName = clean(formData.get("brand_name"));
  const logoUrl = clean(formData.get("logo_url")) || null;
  const primaryColor = clean(formData.get("primary_color")) || "#0f766e";
  const customDomain = clean(formData.get("custom_domain")).toLowerCase() || null;

  if (brandName.length < 2) return { error: "Brand name is required." };
  if (!/^#[0-9a-f]{6}$/i.test(primaryColor)) return { error: "Primary color must be a valid hex color." };
  if (logoUrl && !/^https:\/\//i.test(logoUrl)) return { error: "Logo URL must start with https://" };
  if (customDomain && !/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i.test(customDomain)) {
    return { error: "Custom domain format is invalid." };
  }

  const { error } = await supabase
    .from("organizations")
    .update({ brand_name: brandName, logo_url: logoUrl, primary_color: primaryColor, custom_domain: customDomain })
    .eq("id", profile.organization_id);
  if (error) {
    if (error.code === "23505") return { error: "This custom domain is already linked to another organization." };
    return { error: error.message };
  }

  revalidatePath("/admin/platform");
  revalidatePath("/admin/platform/tenant-settings");
  revalidatePath("/login");
  return { success: true };
}
