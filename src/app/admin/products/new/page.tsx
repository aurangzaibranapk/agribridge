import { createClient } from "@/lib/supabase/server";
import { PageHeader, Card } from "@/components/ui/layout-primitives";
import { getUiMode } from "@/lib/access/ui-mode";
import { ProductForm } from "@/app/admin/products/new/product-form";
import { t } from "@/lib/i18n/translations";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";
import { loadUnits, loadPackSizes } from "@/lib/units";

export const dynamic = "force-dynamic";

export default async function NewProductPage() {
  const lang = getLanguageFromCookies("rm");
  const supabase = createClient();
  const [{ data: companies }, { data: brands }, { data: categories }, { data: rawWarehouses }, units, packSizes] = await Promise.all([
    supabase.from("companies").select("id, name").order("name"),
    supabase.from("brands").select("id, name").order("name"),
    supabase.from("categories").select("id, name, category_kind, default_min_stock").order("name"),
    supabase.from("warehouses").select("id, name, shops(name)").order("name"),
    loadUnits(true),
    loadPackSizes(true),
  ]);
  const warehouses = (rawWarehouses ?? []).map((w: any) => ({
    id: w.id as string,
    name: w.name as string,
    shopName: (Array.isArray(w.shops) ? w.shops[0]?.name : w.shops?.name) ?? null,
  }));
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title={t("c_add_product", lang)} description="Company, brand, category, and specifications" />
      <Card>
        <ProductForm uiMode={await getUiMode()} companies={companies ?? []} brands={brands ?? []} categories={categories ?? []} warehouses={warehouses} units={units} packSizes={packSizes} />
      </Card>
    </div>
  );
}