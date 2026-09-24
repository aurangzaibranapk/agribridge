import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/layout-primitives";
import { PermissionsClient } from "./permissions-client";
import { t } from "@/lib/i18n/translations";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";

export const dynamic = "force-dynamic";

export default async function AdminPermissionsPage() {
  const lang = getLanguageFromCookies("rm");
  const supabase = createClient();
  const { data: staff } = await supabase
    .from("profiles")
    .select("id, full_name, role, allowed_pages")
    .eq("is_active", true)
    .in("role", ["manager", "sales_staff", "finance", "warehouse", "hr", "admin_assistant", "procurement", "milk_collection", "machinery"])
    .order("role")
    .order("full_name");
  return (
    <div>
      <PageHeader title={t("at_staff_permissions", lang)} description="Har staff member ke liye khud tay karein wo kya kya dekh sake" />
      <PermissionsClient staff={(staff ?? []).map((s) => ({ ...s, allowed_pages: s.allowed_pages as string[] | null }))} />
    </div>
  );
}