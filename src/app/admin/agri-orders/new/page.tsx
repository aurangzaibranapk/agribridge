import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/layout-primitives";
import { NewOrderForm } from "./new-order-form";
import { t } from "@/lib/i18n/translations";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";
import { categoriesForShop, type CatNode } from "@/lib/products/shop-kinds";
import { UNRESTRICTED_ROLES } from "@/lib/access/permissions";

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

  // Dukan ki qism, aur ye bhi ke wo MALOOM hai ya nahi.
  //
  // Malik (6 September): *"karyana ki shop ko yahan karyana hi nazar
  // aaye, baqi nahi — agri input ki shop ko agri se related aur wanda
  // aaye lekin karyana nahi aana chahiye."*
  //
  // Chhanti ka nizam pehle se maujood tha. Jo cheez nahi thi wo ye:
  // agar bande ka SHOP hi set na ho to filter chup chaap haath utha
  // leta tha aur saara maal nazar aa jata tha. Ab wo baat safhe par
  // likhi jati hai (neeche), taake khamosh na rahe.
  let meraShopKind: string | null = null;
  let shopNahiChuna = false;
  if (user) {
    const { data: me } = await supabase
      .from("profiles")
      .select("shop_id, role")
      .eq("id", user.id)
      .maybeSingle();
    const shopId = (me?.shop_id as string | null) ?? null;
    // Owner/Admin kisi ek dukan ke nahi hote -- un ko poora maal dikhna
    // chahiye, aur un par ye tanbeeh bemaani hai.
    const sabKuchWala = UNRESTRICTED_ROLES.includes(String(me?.role ?? ""));
    if (shopId) {
      const { data: shop } = await supabase.from("shops").select("business_type").eq("id", shopId).maybeSingle();
      meraShopKind = (shop?.business_type as string | null) ?? null;
    } else if (!sabKuchWala) {
      shopNahiChuna = true;
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
      {shopNahiChuna && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-200">
          <b>Aap ki dukan set nahi hai</b>, is liye yahan <b>saara maal</b> nazar aa raha hai — karyana bhi
          aur agri input bhi. Admin se kahein ke <b>Users</b> par aap ka shop chun dein; us ke baad sirf aap
          ki dukan ka maal aayega.
        </div>
      )}
      <NewOrderForm branches={branches ?? []} products={productsFormatted} categories={categories ?? []} />
    </div>
  );
}