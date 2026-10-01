import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { PageHeader } from "@/components/ui/layout-primitives";
import Link from "next/link";
import { ArrowLeft, ChevronRight } from "lucide-react";

export const dynamic = "force-dynamic";

function rs(n: number) {
  return `Rs ${Math.round(n).toLocaleString()}`;
}

export default async function WarehouseStatementPage({
  params,
}: {
  params: Promise<{ warehouseId: string }>;
}) {
  const { warehouseId } = await params;

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, is_active")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile?.is_active) redirect("/login");
  if (!["owner", "admin", "super_admin"].includes(profile.role)) redirect("/admin");

  const service = createServiceClient();

  const [warehouseResult, invResult] = await Promise.all([
    service
      .from("warehouses")
      .select("id, name, branches(name)")
      .eq("id", warehouseId)
      .maybeSingle(),
    service
      .from("inventory")
      .select("id, product_id, quantity_on_hand, products!inner(id, name, purchase_price)")
      .eq("warehouse_id", warehouseId),
  ]);

  if (!warehouseResult.data) redirect("/admin/stock-statement");

  const warehouse = warehouseResult.data as any;
  const branchName =
    (Array.isArray(warehouse.branches) ? warehouse.branches[0]?.name : warehouse.branches?.name) ?? "";
  const invRows = invResult.data ?? [];
  const inventoryIds = invRows.map((r: any) => r.id);

  const { data: movements } =
    inventoryIds.length > 0
      ? await service
          .from("stock_movements")
          .select("inventory_id, movement_type, quantity")
          .in("inventory_id", inventoryIds)
      : { data: [] };

  // Build per-product map
  const invToProduct = new Map<string, string>();
  const byProduct = new Map<
    string,
    { productId: string; name: string; price: number; currentQty: number; totalIn: number; totalOut: number }
  >();

  for (const inv of invRows) {
    const p = Array.isArray((inv as any).products) ? (inv as any).products[0] : (inv as any).products;
    const pid: string = p?.id ?? inv.product_id;
    if (!pid) continue;
    invToProduct.set(inv.id, pid);
    if (!byProduct.has(pid)) {
      byProduct.set(pid, {
        productId: pid,
        name: p?.name ?? pid,
        price: Number(p?.purchase_price ?? 0),
        currentQty: Number(inv.quantity_on_hand ?? 0),
        totalIn: 0,
        totalOut: 0,
      });
    }
  }

  for (const mv of movements ?? []) {
    const pid = invToProduct.get((mv as any).inventory_id ?? "");
    if (!pid) continue;
    const row = byProduct.get(pid);
    if (!row) continue;
    const qty = Number((mv as any).quantity ?? 0);
    const mt = (mv as any).movement_type;
    if (["purchase_in", "return_in", "adjustment_increase", "transfer_in"].includes(mt)) {
      row.totalIn += qty;
    } else {
      row.totalOut += qty;
    }
  }

  const productRows = [...byProduct.values()].sort(
    (a, b) => b.currentQty * b.price - a.currentQty * a.price
  );

  const totalValue = productRows.reduce((s, r) => s + r.currentQty * r.price, 0);

  return (
    <div>
      <Link
        href="/admin/stock-statement"
        className="mb-4 inline-flex items-center gap-1 text-sm text-surface-500 hover:text-brand-600"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Stock Statement
      </Link>

      <PageHeader
        title={warehouse.name}
        description={`${branchName} — har product ki haalat`}
      />

      <div className="mb-4 flex gap-4 text-sm text-surface-500">
        <span><strong className="text-surface-900 dark:text-white">{productRows.length}</strong> products</span>
        <span>Kul Value: <strong className="text-green-700 dark:text-green-400">{rs(totalValue)}</strong></span>
      </div>

      <div className="overflow-hidden rounded-card border border-surface-200 bg-white shadow-card dark:border-surface-800 dark:bg-surface-900">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-200 bg-surface-50 text-left dark:border-surface-800 dark:bg-surface-800">
                <th className="px-4 py-3 text-xs font-medium text-surface-500">Product</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-brand-600">Kul Aya</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-red-600">Kul Gaya</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-green-700">Abhi Bacha</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-surface-500">Value</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {productRows.map((p) => (
                <tr
                  key={p.productId}
                  className="border-b border-surface-100 last:border-0 dark:border-surface-800"
                >
                  <td className="px-4 py-3 font-medium text-surface-900 dark:text-white">{p.name}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-brand-700 dark:text-brand-300">
                    {Math.round(p.totalIn)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-red-600 dark:text-red-400">
                    {p.totalOut > 0 ? Math.round(p.totalOut) : "—"}
                  </td>
                  <td
                    className={`px-4 py-3 text-right tabular-nums font-semibold ${
                      p.currentQty === 0
                        ? "text-red-600 dark:text-red-400"
                        : "text-green-700 dark:text-green-400"
                    }`}
                  >
                    {Math.round(p.currentQty)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-surface-700 dark:text-surface-300">
                    {p.currentQty > 0 ? rs(p.currentQty * p.price) : "—"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/admin/stock-statement/product/${p.productId}?wh=${warehouseId}`}
                      className="inline-flex items-center gap-0.5 text-xs font-medium text-brand-600 hover:underline dark:text-brand-400"
                    >
                      Statement <ChevronRight className="h-3 w-3" />
                    </Link>
                  </td>
                </tr>
              ))}
              {productRows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-sm text-surface-400">
                    Is godam mein koi inventory nahi mili.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
