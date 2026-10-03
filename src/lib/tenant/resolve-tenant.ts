import { headers } from "next/headers";
import { createServiceClient } from "@/lib/supabase/service";

export type TenantBrand = {
  name: string;
  brandName: string;
  logoUrl: string | null;
  primaryColor: string;
};

/** Resolve an active customer tenant from the incoming custom domain. */
export async function resolveTenantFromRequest(): Promise<TenantBrand | null> {
  try {
    const rawHost = headers().get("host")?.split(":")[0]?.toLowerCase().replace(/^www\./, "");
    if (!rawHost || rawHost === "alranatraders.pk" || rawHost === "localhost") return null;
    const service = createServiceClient();
    const { data } = await service
      .from("organizations")
      .select("name, brand_name, logo_url, primary_color")
      .eq("custom_domain", rawHost)
      .eq("is_active", true)
      .maybeSingle();
    if (!data) return null;
    return {
      name: data.name,
      brandName: data.brand_name || data.name,
      logoUrl: data.logo_url,
      primaryColor: data.primary_color || "#174B2B",
    };
  } catch {
    // A missing service key or local host must never break the login page.
    return null;
  }
}

