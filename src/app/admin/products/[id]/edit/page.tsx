import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/layout-primitives";
import { ProductForm } from "@/app/admin/products/new/product-form";
import { t } from "@/lib/i18n/translations";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";

export const dynamic = "force-dynamic";

export default async function EditProductPage({ params }: { params: { id: string } }) {
  const lang = getLanguageFromCookies("rm");
  const supabase = createClient();

  const [{ data: product }, { data: companies }, { data: brands }, { data: categories }] = await Promise.all([
    supabase.from("products").select("*").eq("id", params.id).single(),
    supabase.from("companies").select("id, name").order("name"),
    supabase.from("brands").select("id, name").order("name"),
    supabase.from("categories").select("id, name, category_kind, default_min_stock").order("name"),
  ]);

  if (!product) notFound();

  return (
    <div>
      <PageHeader title={t("pd_edit_product", lang)} description={product.name} />
      <ProductForm
        companies={companies ?? []}
        brands={brands ?? []}
        categories={categories ?? []}
        product={product}
      />
    </div>
  );
}