import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/layout-primitives";
import { CatalogExportClient } from "./catalog-export-client";
import { t } from "@/lib/i18n/translations";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";
import { ProductSetupTabs } from "@/components/products/setup-tabs";

export const dynamic = "force-dynamic";

export default async function CatalogExportPage() {
  const lang = getLanguageFromCookies("rm");
  const supabase = createClient();

  const { data: rawProducts } = await supabase
    .from("products")
    .select("id, name, pack_size, purchase_price, selling_price, mrp_price, unit, barcode, manufacture_date, expiry_date, categories(name), companies(name)")
    .eq("is_deleted", false)
    .order("name");

  const { data: categories } = await supabase.from("categories").select("id, name").order("name");

  const products = (rawProducts ?? []).map((p: any) => ({
    id: p.id,
    name: p.name,
    category: Array.isArray(p.categories) ? p.categories[0]?.name : p.categories?.name,
    brand: Array.isArray(p.companies) ? p.companies[0]?.name : p.companies?.name,
    pack_size: p.pack_size,
    purchase_price: p.purchase_price ? Number(p.purchase_price) : null,
    selling_price: p.selling_price ? Number(p.selling_price) : null,
    mrp_price: p.mrp_price ? Number(p.mrp_price) : null,
    unit: p.unit,
    barcode: p.barcode,
    manufacture_date: p.manufacture_date,
    expiry_date: p.expiry_date,
  }));

  return (
    <div>
      <PageHeader title={t("pd_catalog_export", lang)} description="Category select karein, fields choose karein, Print/Download/WhatsApp/Email karein" />
      <ProductSetupTabs current="export" lang={lang} />
      <CatalogExportClient products={products} categories={categories ?? []} />
    </div>
  );
}