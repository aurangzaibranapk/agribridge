import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/layout-primitives";
import { NewOrderForm } from "./new-order-form";
import { t } from "@/lib/i18n/translations";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";
import { categoriesForShop, type CatNode } from "@/lib/products/shop-kinds";

export const dynamic = "force-dynamic";

export default async function NewAgriOrderPage() {
  const lang = getLanguageFromCookies("rm");
  const supabase = createClient();

  const { data: branches } = await supabase.from("branches").select("id, name").eq("is_active", true).order("name");

  // Jis banday ki apni dukan hai, use SIRF apni dukan ka maal.
  //
  // Malik: "karyana ke ordering mein karyana hi aana chahiye -- phir
  // agri inputs ke kyun aa rahe hain?" Yahan koi rok thi hi nahi, is
  // liye karyana wali dukan ko urea aur poultry feed bhi nazar aate the
  // -- aur ek galat click se wo maal us dukan mein mangwa liya jata.
  //
  // Jis ka koi shop na ho (HQ, admin) us par rok NAHI: use poora maal
  // dikhna chahiye, kyunki wo har dukan ke liye order karta hai.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let meraShopKind: string | null = null;
  if (user) {
    const { data: me } = await supabase.from("profiles").select("shop_id").eq("id", user.id).maybeSingle();
    if (me?.shop_id) {
      const { data: shop } = await supabase.from("shops").select("business_type").eq("id", me.shop_id).maybeSingle();
      meraShopKind = (shop?.business_type as string | null) ?? null;
    }
  }

  const { data: sabCategories } = await supabase
    .from("categories")
    .select("id, name, parent_category_id");

  const khuliCategories = categoriesForShop(meraShopKind, (sabCategories ?? []) as CatNode[]);

  const { data: products } = await supabase
    .from("products")
    .select("id, name, pack_size, selling_price, purchase_price, image_url, category_id, categories(name), companies(name)")
    .eq("is_deleted", false)
    .eq("is_verified", true)
    .order("name");

  // Central Warehouse stock (Main Branch's warehouse) - shown on each
  // product card so shop staff can see availability before ordering,
  // Odoo-style.
  const { data: mainBranch } = await supabase.from("branches").select("id").eq("is_main_branch", true).single();
  let stockMap: Record<string, number> = {};
  if (mainBranch) {
    const { data: mainWarehouse } = await supabase.from("warehouses").select("id").eq("branch_id", mainBranch.id).limit(1).maybeSingle();
    if (mainWarehouse) {
      const { data: inventoryRows } = await supabase.from("inventory").select("product_id, quantity_on_hand").eq("warehouse_id", mainWarehouse.id);
      stockMap = Object.fromEntries((inventoryRows ?? []).map((r) => [r.product_id, Number(r.quantity_on_hand)]));
    }
  }

  const categories = (sabCategories ?? [])
    .filter((c) => (khuliCategories ? khuliCategories.has(c.id) : true))
    .sort((a, b) => a.name.localeCompare(b.name));

  const productsFormatted = (products ?? [])
    // Jis product ki category is dukan ki nahi, wo yahan aata hi nahi.
    .filter((p: any) => (khuliCategories ? p.category_id && khuliCategories.has(p.category_id) : true))
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

  return (
    <div>
      <PageHeader title={t("ao_new_order", lang)} description="Product select karein, order details bharein" />
      <NewOrderForm branches={branches ?? []} products={productsFormatted} categories={categories ?? []} />
    </div>
  );
}