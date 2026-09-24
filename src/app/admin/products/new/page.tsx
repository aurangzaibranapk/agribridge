import { createClient } from "@/lib/supabase/server";
import { PageHeader, Card } from "@/components/ui/layout-primitives";
import { ProductForm } from "@/app/admin/products/new/product-form";
import { t } from "@/lib/i18n/translations";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";

export const dynamic = "force-dynamic";

export default async function NewProductPage() {
  const lang = getLanguageFromCookies("rm");
  const supabase = createClient();
  const [{ data: companies }, { data: brands }, { data: categories }] = await Promise.all([
    supabase.from("companies").select("id, name").order("name"),
    supabase.from("brands").select("id, name").order("name"),
    supabase.from("categories").select("id, name").order("name"),
  ]);
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title={t("c_add_product", lang)} description="Company, brand, category, and specifications" />
      <Card>
        <ProductForm companies={companies ?? []} brands={brands ?? []} categories={categories ?? []} />
      </Card>
    </div>
  );
}