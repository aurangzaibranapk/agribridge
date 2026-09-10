import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/layout-primitives";
import { WarehousesListClient } from "./warehouses-list-client";
import { t } from "@/lib/i18n/translations";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";

export const dynamic = "force-dynamic";

export default async function AdminWarehousesPage() {
  const lang = getLanguageFromCookies("rm");
  const supabase = createClient();

  const [{ data: rawWarehouses }, { data: branches }, { data: shops }] = await Promise.all([
    supabase
      .from("warehouses")
      .select("id, name, code, address, is_active, branch_id, shop_id, branches(name), shops(name)")
      .order("name"),
    supabase.from("branches").select("id, name").eq("is_active", true).order("name"),
    supabase.from("shops").select("id, name, branch_id").order("name"),
  ]);

  const warehouses = (rawWarehouses ?? []).map((w: any) => ({
    id: w.id,
    name: w.name,
    code: w.code,
    address: w.address,
    is_active: w.is_active,
    branch_id: w.branch_id,
    shop_id: w.shop_id,
    branch_name: Array.isArray(w.branches) ? w.branches[0]?.name : w.branches?.name,
    shop_name: Array.isArray(w.shops) ? w.shops[0]?.name : w.shops?.name,
  }));

  return (
    <div>
      <PageHeader title={t("at_warehouses", lang)} description="Physical storage locations for your stock" />
      <WarehousesListClient warehouses={warehouses} branches={branches ?? []} shops={(shops ?? []) as any} />
    </div>
  );
}
