import { headers } from "next/headers";
import { createServiceClient } from "@/lib/supabase/service";

/** Resolve the tenant for a public signup request without trusting client input. */
export async function resolveRequestOrganizationId() {
  try {
    const host = headers().get("host")?.split(":")[0]?.toLowerCase().replace(/^www\./, "");
    const service = createServiceClient();
    if (host && host !== "alranatraders.pk" && host !== "localhost" && host !== "127.0.0.1") {
      const { data: customTenant } = await service
        .from("organizations")
        .select("id")
        .eq("custom_domain", host)
        .eq("is_active", true)
        .maybeSingle();
      if (customTenant?.id) return customTenant.id;
    }

    const { data: defaultTenant } = await service
      .from("organizations")
      .select("id")
      .eq("slug", "al-rana-traders")
      .eq("is_active", true)
      .maybeSingle();
    return defaultTenant?.id ?? null;
  } catch {
    return null;
  }
}
