import { createClient } from "@/lib/supabase/server";
import { t } from "@/lib/i18n/translations";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";
import { PageHeader } from "@/components/ui/layout-primitives";
import { InventoryClient } from "@/app/admin/inventory/inventory-client";

export const dynamic = "force-dynamic";

export default async function AdminInventoryPage() {
  const supabase = createClient();
  const lang = getLanguageFromCookies("rm");

  const [{ data: rawInventory }, { data: warehouses }, { data: liveBatches }] = await Promise.all([
    supabase
      .from("inventory")
      .select(
        "id, product_id, batch_id, quantity_on_hand, warehouses(id, name), stock_batches(batch_number, expiry_date), products(name, pack_size, purchase_price, min_stock_threshold)"
      )
      .order("quantity_on_hand", { ascending: true }),
    supabase.from("warehouses").select("id, name").eq("is_active", true).order("name"),
    // Miyaad batch ki hoti hai (257): har product/godam ka sab se
    // qareeb wala maal wala batch, aur kitne batch hain.
    supabase
      .from("v_product_batches")
      .select("product_id, warehouse_id, batch_number, expiry_date, days_left")
      .order("expiry_date", { ascending: true, nullsFirst: false }),
  ]);

  const nearest = new Map<string, { batch_number: string | null; expiry_date: string | null; days_left: number | null; count: number }>();
  for (const b of liveBatches ?? []) {
    const k = `${b.product_id}|${b.warehouse_id}`;
    const cur = nearest.get(k);
    if (cur) cur.count += 1;
    else nearest.set(k, { batch_number: b.batch_number, expiry_date: b.expiry_date, days_left: b.days_left, count: 1 });
  }

  const rows = (rawInventory ?? []).map((row: any) => {
    const warehouse = Array.isArray(row.warehouses) ? row.warehouses[0] : row.warehouses;
    const batch = Array.isArray(row.stock_batches) ? row.stock_batches[0] : row.stock_batches;
    const product = Array.isArray(row.products) ? row.products[0] : row.products;
    const near = nearest.get(`${row.product_id}|${warehouse?.id ?? ""}`);

    return {
      id: row.id,
      product_id: row.product_id,
      batch_id: row.batch_id,
      product_name: product?.name ?? "Unknown Product",
      pack_size: product?.pack_size ?? null,
      batch_number: batch?.batch_number ?? near?.batch_number ?? null,
      expiry_date: batch?.expiry_date ?? near?.expiry_date ?? null,
      days_left: batch?.expiry_date ? null : near?.days_left ?? null,
      batch_count: near?.count ?? 0,
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