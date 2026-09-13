import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/layout-primitives";
import { CatalogExportClient } from "./catalog-export-client";
import { t } from "@/lib/i18n/translations";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";
import { ProductSetupTabs } from "@/components/products/setup-tabs";
import { categoriesForShop } from "@/lib/products/shop-kinds";

export const dynamic = "force-dynamic";

/** Har dukan-qism ke jaR (shop-kinds.ts): "Karyana" ka matlab sirf ye 3
 * root categories nahi -- unki har aulaad bhi (Grocery ke neeche 15+
 * upar-categories). Yehi hisaab POS/ordering filter mein bhi lagta hai
 * -- yahan dobara likhne ki zaroorat nahi. */
const SHOP_GROUPS: { key: string; label: string }[] = [
  { key: "karyana", label: "Karyana" },
  { key: "agri_inputs", label: "Agri Inputs" },
  { key: "dairy", label: "Dairy" },
];

export default async function CatalogExportPage() {
  const lang = getLanguageFromCookies("rm");
  const supabase = createClient();

  const [{ data: rawProducts }, { data: allCategories }, { data: inventoryRows }] = await Promise.all([
    supabase
      .from("products")
      .select("id, name, category_id, pack_size, purchase_price, selling_price, mrp_price, unit, barcode, manufacture_date, expiry_date, categories(name), companies(name)")
      .eq("is_deleted", false)
      .order("name"),
    supabase.from("categories").select("id, name, parent_category_id"),
    supabase.from("inventory").select("product_id, quantity_on_hand"),
  ]);

  const categories = (allCategories ?? []).map((c) => ({ id: c.id, name: c.name }));
  const catNodes = (allCategories ?? []).map((c) => ({ id: c.id, name: c.name, parent_category_id: c.parent_category_id as string | null }));

  // Karyana/Agri Inputs/Dairy = category ID ka set (jaR + saari aulaad).
  const groupCategoryIds = new Map(SHOP_GROUPS.map((g) => [g.key, categoriesForShop(g.key, catNodes)]));

  const stockByProduct = new Map<string, number>();
  for (const row of inventoryRows ?? []) {
    const pid = row.product_id as string;
    stockByProduct.set(pid, (stockByProduct.get(pid) ?? 0) + Number(row.quantity_on_hand ?? 0));
  }

  const products = (rawProducts ?? []).map((p: any) => {
    const categoryId = p.category_id as string | null;
    const shopGroups = SHOP_GROUPS.filter((g) => categoryId && groupCategoryIds.get(g.key)?.has(categoryId)).map((g) => g.key);
    return {
      id: p.id,
      name: p.name,
      category: Array.isArray(p.categories) ? p.categories[0]?.name : p.categories?.name,
      shopGroups,
      brand: Array.isArray(p.companies) ? p.companies[0]?.name : p.companies?.name,
      pack_size: p.pack_size,
      purchase_price: p.purchase_price ? Number(p.purchase_price) : null,
      selling_price: p.selling_price ? Number(p.selling_price) : null,
      mrp_price: p.mrp_price ? Number(p.mrp_price) : null,
      unit: p.unit,
      barcode: p.barcode,
      manufacture_date: p.manufacture_date,
      expiry_date: p.expiry_date,
      stock_qty: stockByProduct.get(p.id) ?? 0,
    };
  });

  return (
    <div>
      <PageHeader title={t("pd_catalog_export", lang)} description="Category select karein, fields choose karein, Print/Download/WhatsApp/Email karein" />
      <ProductSetupTabs current="export" lang={lang} />
      <CatalogExportClient products={products} categories={categories} shopGroups={SHOP_GROUPS} />
    </div>
  );
}