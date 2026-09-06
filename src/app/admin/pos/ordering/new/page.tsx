import { createClient } from "@/lib/supabase/server";
import { getCurrentSeller } from "@/lib/current-seller";
import { PageHeader } from "@/components/ui/layout-primitives";
import { BackLink } from "@/components/pos/back-link";
import { SimpleOrderForm } from "./simple-order-form";
import { t } from "@/lib/i18n/translations";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";
import { categoriesForShop, type CatNode } from "@/lib/products/shop-kinds";
export const dynamic = "force-dynamic";
// Kaunsi categories yahan dikhti hain, ye ab `shop-kinds` tay karta hai --
// pehle ye fehrist sirf isi safhe ke andar likhi thi, aur isi wajah se
// `agri-orders/new` par koi rok lagi hi nahi rah gayi thi. Ye safha
// hamesha Karyana ka hai, is liye qism yahan pakki hai.
export default async function NewBranchOrderPage() {
  const lang = getLanguageFromCookies("rm");
  const seller = await getCurrentSeller();
  if (!seller || seller.kind !== "branch") {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <p className="text-surface-600">{t("at_no_branch_link", lang)}</p>
      </div>
    );
  }
  const supabase = createClient();
  const { data: allCategories } = await supabase.from("categories").select("id, name, parent_category_id").order("name");
  const karyanaCategoryIds = categoriesForShop("karyana", (allCategories ?? []) as CatNode[]) ?? new Set<string>();
  const { data: products } = await supabase
    .from("products")
    .select("id, name, pack_size, selling_price, purchase_price, image_url, category_id, categories(name), companies(name)")
    .eq("is_deleted", false)
    .eq("is_verified", true)
    .order("name");
  // Central Warehouse stock (Main Branch's warehouse) shown per product,
  // same pattern as the HQ order form.
  const { data: mainBranch } = await supabase.from("branches").select("id").eq("is_main_branch", true).single();
  let stockMap: Record<string, number> = {};
  if (mainBranch) {
    // Karyana Ordering specifically pulls from the Main Branch's
    // Karyana-shop warehouse - not just "any" warehouse under the
    // branch, since Phase 3 split each branch into multiple shops
    // (Karyana/Agri Inputs/Dairy) each with their own warehouse now.
    const { data: karyanaShop } = await supabase
      .from("shops")
      .select("id")
      .eq("branch_id", mainBranch.id)
      .eq("business_type", "karyana")
      .maybeSingle();
    const { data: mainWarehouse } = karyanaShop
      ? await supabase.from("warehouses").select("id").eq("shop_id", karyanaShop.id).maybeSingle()
      : await supabase.from("warehouses").select("id").eq("branch_id", mainBranch.id).eq("code", "MAIN").maybeSingle();
    if (mainWarehouse) {
      const { data: inventoryRows } = await supabase.from("inventory").select("product_id, quantity_on_hand").eq("warehouse_id", mainWarehouse.id);
      stockMap = Object.fromEntries((inventoryRows ?? []).map((r) => [r.product_id, Number(r.quantity_on_hand)]));
    }
  }
  const productsFormatted = (products ?? [])
    .filter((p: any) => p.category_id && karyanaCategoryIds.has(p.category_id))
    .map((p: any) => ({
      id: p.id,
      name: p.name,
      pack_size: p.pack_size,
      selling_price: Number(p.selling_price),
      purchase_price: p.purchase_price ? Number(p.purchase_price) : 0,
      image_url: p.image_url,
      category_id: p.category_id,
      category: Array.isArray(p.categories) ? p.categories[0]?.name : p.categories?.name,
      brand: Array.isArray(p.companies) ? p.companies[0]?.name : p.companies?.name,
      warehouse_stock: stockMap[p.id] ?? 0,
    }));
  // Jar wali qismein (Grocery waghera) khane mein nahi aatin -- wo itni
  // barhi hain ke un par daba kar kuch chhanta hi nahi.
  const karyanaCategories = (allCategories ?? [])
    .filter((c) => karyanaCategoryIds.has(c.id) && c.parent_category_id !== null)
    .map((c) => ({ id: c.id, name: c.name }));
  // Doosri shops ki list, taake branch-to-branch order ho sake.
  const { data: branches } = await supabase.from("branches").select("id, name").eq("is_active", true).order("name");

  return (
    <div>
      <PageHeader
        title={t("at_karyana_order", lang)}
        description={seller.name}
        actions={<BackLink href="/admin/pos/ordering" label="Ordering par wapas" />}
      />
      <SimpleOrderForm
        products={productsFormatted}
        categories={karyanaCategories}
        branches={branches ?? []}
        ownBranchId={seller.id}
      />
    </div>
  );
}