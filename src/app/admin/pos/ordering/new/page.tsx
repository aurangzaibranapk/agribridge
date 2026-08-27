import { createClient } from "@/lib/supabase/server";
import { getCurrentSeller } from "@/lib/current-seller";
import { PageHeader } from "@/components/ui/layout-primitives";
import { SimpleOrderForm } from "./simple-order-form";
export const dynamic = "force-dynamic";
// Only these root categories (and everything under them) are shown in
// Karyana Ordering, so Fertilizer/Pesticide/Seeds/Wanda/Agricultural/
// Veterinary from other business lines never mix in here.
const KARYANA_ROOT_NAMES = ["Grocery", "Cold/Soft Drink", "Dairy Products"];
function collectDescendantIds(rootIds: string[], allCategories: { id: string; parent_category_id: string | null }[]): Set<string> {
  const result = new Set<string>(rootIds);
  let changed = true;
  while (changed) {
    changed = false;
    for (const cat of allCategories) {
      if (cat.parent_category_id && result.has(cat.parent_category_id) && !result.has(cat.id)) {
        result.add(cat.id);
        changed = true;
      }
    }
  }
  return result;
}
export default async function NewBranchOrderPage() {
  const seller = await getCurrentSeller();
  if (!seller || seller.kind !== "branch") {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <p className="text-surface-600">Ye account kisi branch se linked nahi hai. Admin se rabta karein.</p>
      </div>
    );
  }
  const supabase = createClient();
  const { data: allCategories } = await supabase.from("categories").select("id, name, parent_category_id").order("name");
  const rootIds = (allCategories ?? []).filter((c) => !c.parent_category_id && KARYANA_ROOT_NAMES.includes(c.name)).map((c) => c.id);
  const karyanaCategoryIds = collectDescendantIds(rootIds, allCategories ?? []);
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
  const karyanaCategories = (allCategories ?? [])
    .filter((c) => karyanaCategoryIds.has(c.id) && !rootIds.includes(c.id))
    .map((c) => ({ id: c.id, name: c.name }));
  return (
    <div>
      <PageHeader title="Karyana Order" description={seller.name} />
      <SimpleOrderForm products={productsFormatted} categories={karyanaCategories} />
    </div>
  );
}