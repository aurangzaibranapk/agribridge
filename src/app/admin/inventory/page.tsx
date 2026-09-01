import { createClient } from "@/lib/supabase/server";
import { t } from "@/lib/i18n/translations";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";
import { PageHeader } from "@/components/ui/layout-primitives";
import { InventoryClient } from "@/app/admin/inventory/inventory-client";

export const dynamic = "force-dynamic";

export default async function AdminInventoryPage() {
  const supabase = createClient();
  const lang = getLanguageFromCookies("rm");

  const [{ data: rawInventory }, { data: warehouses }] = await Promise.all([
    supabase
      .from("inventory")
      .select(
        "id, product_id, batch_id, quantity_on_hand, warehouses(id, name), stock_batches(batch_number, expiry_date), products(name, pack_size, purchase_price, min_stock_threshold)"
      )
      .order("quantity_on_hand", { ascending: true }),
    supabase.from("warehouses").select("id, name").eq("is_active", true).order("name"),
  ]);

  const rows = (rawInventory ?? []).map((row: any) => {
    const warehouse = Array.isArray(row.warehouses) ? row.warehouses[0] : row.warehouses;
    const batch = Array.isArray(row.stock_batches) ? row.stock_batches[0] : row.stock_batches;
    const product = Array.isArray(row.products) ? row.products[0] : row.products;

    return {
      id: row.id,
      product_id: row.product_id,
      batch_id: row.batch_id,
      product_name: product?.name ?? "Unknown Product",
      pack_size: product?.pack_size ?? null,
      batch_number: batch?.batch_number ?? null,
      expiry_date: batch?.expiry_date ?? null,
      warehouse_id: warehouse?.id ?? "",
      warehouse_name: warehouse?.name ?? "Unknown Warehouse",
      quantity_on_hand: Number(row.quantity_on_hand),
      purchase_price: Number(product?.purchase_price ?? 0),
      min_stock_threshold: Number(product?.min_stock_threshold ?? 0),
    };
  });

  return (
    <div>
      <PageHeader title={t("inv_title", lang)} description={t("inv_subtitle", lang)} />
      <InventoryClient rows={rows} warehouses={warehouses ?? []} />
    </div>
  );
}