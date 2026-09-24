import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/layout-primitives";
import { ProductPermissionsClient } from "./product-permissions-client";
import { t } from "@/lib/i18n/translations";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";
export const dynamic = "force-dynamic";
export default async function ProductPermissionsPage() {
  const lang = getLanguageFromCookies("rm");
  const supabase = createClient();
  const { data: staff } = await supabase
    .from("profiles")
    .select("id, full_name, role")
    .eq("is_active", true)
    .in("role", ["manager", "sales_staff"])
    .order("full_name");
  const { data: permissions } = await supabase.from("staff_product_permissions").select("*");
  const permMap = new Map((permissions ?? []).map((p) => [p.profile_id, p]));
  const staffWithPerms = (staff ?? []).map((s) => {
    const perm = permMap.get(s.id);
    return {
      id: s.id,
      full_name: s.full_name,
      role: s.role,
      can_add: perm?.can_add ?? false,
      can_edit: perm?.can_edit ?? false,
      can_view: perm?.can_view ?? true,
      can_delete: perm?.can_delete ?? false,
      can_approve_products: perm?.can_approve_products ?? false,
    };
  });
  return (
    <div>
      <PageHeader title={t("at_product_catalog_perms", lang)} description="Har staff ke liye Add/Edit/View/Delete/Approve access alag set karein" />
      <ProductPermissionsClient staff={staffWithPerms} />
    </div>
  );
}