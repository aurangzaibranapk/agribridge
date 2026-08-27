import { createClient } from "@/lib/supabase/server";
import { PageHeader, EmptyState } from "@/components/ui/layout-primitives";
import { Badge } from "@/components/ui/form";

export const dynamic = "force-dynamic";

export default async function StockLedgerPage() {
  const supabase = createClient();

  const { data: movements } = await supabase
    .from("stock_movements")
    .select("id, inventory_id, movement_type, quantity, balance_after, created_at")
    .order("created_at", { ascending: false })
    .limit(100);

  const inventoryIds = [...new Set((movements ?? []).map((m) => m.inventory_id))];

  const { data: inventoryRows } = inventoryIds.length
    ? await supabase.from("inventory").select("id, product_id, warehouse_id").in("id", inventoryIds)
    : { data: [] };

  const productIds = [...new Set((inventoryRows ?? []).map((r) => r.product_id))];
  const warehouseIds = [...new Set((inventoryRows ?? []).map((r) => r.warehouse_id))];

  const [{ data: productsRows }, { data: warehouseRows }] = await Promise.all([
    productIds.length
      ? supabase.from("products").select("id, name, pack_size").in("id", productIds)
      : Promise.resolve({ data: [] as { id: string; name: string; pack_size: string | null }[] }),
    warehouseIds.length
      ? supabase.from("warehouses").select("id, name, branch_id").in("id", warehouseIds)
      : Promise.resolve({ data: [] as { id: string; name: string; branch_id: string }[] }),
  ]);

  const branchIds = [...new Set((warehouseRows ?? []).map((w) => w.branch_id))];
  const { data: branchRows } = branchIds.length
    ? await supabase.from("branches").select("id, name").in("id", branchIds)
    : { data: [] };

  const productMap = new Map((productsRows ?? []).map((p) => [p.id, p]));
  const branchMap = new Map((branchRows ?? []).map((b) => [b.id, b.name]));
  const warehouseMap = new Map(
    (warehouseRows ?? []).map((w) => [w.id, branchMap.get(w.branch_id) ?? "-"])
  );
  const inventoryMap = new Map(
    (inventoryRows ?? []).map((r) => [
      r.id,
      { product: productMap.get(r.product_id), branchName: warehouseMap.get(r.warehouse_id) },
    ])
  );

  function toneFor(type: string) {
    if (["purchase_in", "transfer_in", "adjustment_increase", "return_in"].includes(type)) return "green" as const;
    return "red" as const;
  }

  return (
    <div>
      <PageHeader title="Stock Ledger" description="Recent stock movements across all branches" />
      {!movements || movements.length === 0 ? (
        <EmptyState title="No stock movements yet" />
      ) : (
        <div className="overflow-hidden rounded-card border border-surface-200 bg-white shadow-card dark:border-surface-800 dark:bg-surface-900">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-200 bg-surface-50 text-left dark:border-surface-800 dark:bg-surface-800">
                <th className="px-4 py-3 font-medium text-surface-500">Product</th>
                <th className="px-4 py-3 font-medium text-surface-500">Branch</th>
                <th className="px-4 py-3 font-medium text-surface-500">Type</th>
                <th className="px-4 py-3 text-right font-medium text-surface-500">Qty</th>
                <th className="px-4 py-3 text-right font-medium text-surface-500">Balance After</th>
                <th className="px-4 py-3 font-medium text-surface-500">Date</th>
              </tr>
            </thead>
            <tbody>
              {movements.map((m) => {
                const info = inventoryMap.get(m.inventory_id);
                return (
                  <tr key={m.id} className="border-b border-surface-100 last:border-0 dark:border-surface-800">
                    <td className="px-4 py-3 text-surface-800 dark:text-surface-200">
                      {info?.product?.name ?? "-"}
                      {info?.product?.pack_size ? ` (${info.product.pack_size})` : ""}
                    </td>
                    <td className="px-4 py-3 text-surface-600 dark:text-surface-400">{info?.branchName ?? "-"}</td>
                    <td className="px-4 py-3">
                      <Badge tone={toneFor(m.movement_type)}>{m.movement_type.replace(/_/g, " ")}</Badge>
                    </td>
                    <td className="px-4 py-3 text-right text-surface-700 dark:text-surface-300">
                      {Number(m.quantity).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right text-surface-700 dark:text-surface-300">
                      {Number(m.balance_after).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-surface-500">{new Date(m.created_at).toLocaleString()}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}