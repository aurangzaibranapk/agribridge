import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/layout-primitives";
import { NewOrderForm } from "./new-order-form";

export const dynamic = "force-dynamic";

export default async function NewAgriOrderPage() {
  const supabase = createClient();

  const { data: branches } = await supabase.from("branches").select("id, name").eq("is_active", true).order("name");

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

  const { data: categories } = await supabase.from("categories").select("id, name").order("name");

  const productsFormatted = (products ?? []).map((p: any) => ({
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
      <PageHeader title="Naya Agri Order" description="Product select karein, order details bharein" />
      <NewOrderForm branches={branches ?? []} products={productsFormatted} categories={categories ?? []} />
    </div>
  );
}