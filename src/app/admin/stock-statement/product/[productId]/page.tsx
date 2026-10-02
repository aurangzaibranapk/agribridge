import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { PageHeader } from "@/components/ui/layout-primitives";
import Link from "next/link";
import { ArrowLeft, TrendingUp, TrendingDown, Package } from "lucide-react";

export const dynamic = "force-dynamic";

function rs(n: number) {
  return `Rs ${Math.round(n).toLocaleString()}`;
}

const MOVEMENT_LABELS: Record<string, { label: string; dir: "in" | "out" }> = {
  purchase_in:         { label: "Kharida — Aya",   dir: "in" },
  return_in:           { label: "Wapsi — Aya",      dir: "in" },
  transfer_in:         { label: "Transfer — Aya",   dir: "in" },
  adjustment_increase: { label: "Taadaad +",         dir: "in" },
  sale_out:            { label: "Bika",              dir: "out" },
  transfer_out:        { label: "Transfer Gaya",     dir: "out" },
  adjustment_decrease: { label: "Taadaad −",         dir: "out" },
  damaged_out:         { label: "Kharaab",           dir: "out" },
  expired_out:         { label: "Meaad Guzri",       dir: "out" },
  loss_write_off:      { label: "Nuksan",            dir: "out" },
};

export default async function ProductStatementPage({
  params,
  searchParams,
}: {
  params: Promise<{ productId: string }>;
  searchParams: Promise<{ wh?: string }>;
}) {
  const { productId } = await params;
  const { wh: warehouseId } = await searchParams;

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

  // Product info
  const { data: product } = await service
    .from("products")
    .select("id, name, purchase_price")
    .eq("id", productId)
    .maybeSingle();

  if (!product) redirect("/admin/stock-statement");

  // Inventory rows for this product (filter by warehouse if provided)
  let invQuery = service
    .from("inventory")
    .select("id, warehouse_id, quantity_on_hand, warehouses(id, name, branches(name))")
    .eq("product_id", productId);
  if (warehouseId) invQuery = invQuery.eq("warehouse_id", warehouseId);

  const { data: invRows } = await invQuery;
  const inventoryIds = (invRows ?? []).map((r: any) => r.id);

  // Stock movements for these inventory rows
  const { data: movements } =
    inventoryIds.length > 0
      ? await service
          .from("stock_movements")
          .select("id, inventory_id, movement_type, quantity, balance_after, reference_type, reference_id, notes, created_at")
          .in("inventory_id", inventoryIds)
          .order("created_at", { ascending: true })
      : { data: [] };

  // Map inventory_id → warehouse info
  const invMap = new Map<string, { warehouseName: string; branchName: string; currentQty: number }>();
  for (const inv of invRows ?? []) {
    const wh = Array.isArray((inv as any).warehouses) ? (inv as any).warehouses[0] : (inv as any).warehouses;
    const br = Array.isArray(wh?.branches) ? wh.branches[0] : wh?.branches;
    invMap.set(inv.id, {
      warehouseName: wh?.name ?? "—",
      branchName: br?.name ?? "—",
      currentQty: Number(inv.quantity_on_hand ?? 0),
    });
  }

  // Build movement rows
  type MvRow = {
    id: string;
    date: string;
    typeLabel: string;
    dir: "in" | "out";
    qty: number;
    balanceAfter: number;
    refType: string;
    notes: string;
    warehouseName: string;
  };

  const mvRows: MvRow[] = (movements ?? []).map((mv: any) => {
    const inv = invMap.get(mv.inventory_id) ?? { warehouseName: "—", branchName: "—", currentQty: 0 };
    const meta = MOVEMENT_LABELS[mv.movement_type] ?? { label: mv.movement_type, dir: "out" as const };
    return {
      id: mv.id,
      date: new Date(mv.created_at).toLocaleDateString("en-PK", { day: "2-digit", month: "short", year: "2-digit" }),
      typeLabel: meta.label,
      dir: meta.dir,
      qty: Number(mv.quantity ?? 0),
      balanceAfter: Number(mv.balance_after ?? 0),
      refType: mv.reference_type ?? "",
      notes: mv.notes ?? "",
      warehouseName: inv.warehouseName,
    };
  });

  // Totals
  const totalIn  = mvRows.filter((r) => r.dir === "in").reduce((s, r) => s + r.qty, 0);
  const totalOut = mvRows.filter((r) => r.dir === "out").reduce((s, r) => s + r.qty, 0);
  const currentStock = (invRows ?? []).reduce((s, r: any) => s + Number(r.quantity_on_hand ?? 0), 0);
  const currentValue = currentStock * Number(product.purchase_price ?? 0);

  const backHref = warehouseId
    ? `/admin/stock-statement/warehouse/${warehouseId}`
    : "/admin/stock-statement";

  return (
    <div>
      <Link
        href={backHref}
        className="mb-4 inline-flex items-center gap-1 text-sm text-surface-500 hover:text-brand-600"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Wapas
      </Link>

      <PageHeader
        title={product.name}
        description="Stock ka poora hisaab — aya, gaya, bacha"
      />

      {/* Summary cards */}
      <div className="mt-4 grid grid-cols-3 gap-4">
        <div className="rounded-card border border-brand-200 bg-brand-50 p-4 dark:border-brand-900/40 dark:bg-brand-950/20">
          <div className="flex items-center gap-2 text-xs font-medium text-brand-700 dark:text-brand-400">
            <TrendingUp className="h-3.5 w-3.5" /> Kul Aya (Debit)
          </div>
          <p className="mt-1 text-2xl font-bold tabular-nums text-brand-800 dark:text-brand-300">
            {Math.round(totalIn).toLocaleString()}
          </p>
          <p className="text-xs text-brand-600 dark:text-brand-500">units</p>
        </div>

        <div className="rounded-card border border-red-200 bg-red-50 p-4 dark:border-red-900/40 dark:bg-red-950/20">
          <div className="flex items-center gap-2 text-xs font-medium text-red-700 dark:text-red-400">
            <TrendingDown className="h-3.5 w-3.5" /> Kul Gaya (Credit)
          </div>
          <p className="mt-1 text-2xl font-bold tabular-nums text-red-800 dark:text-red-300">
            {Math.round(totalOut).toLocaleString()}
          </p>
          <p className="text-xs text-red-600 dark:text-red-500">units</p>
        </div>

        <div className="rounded-card border border-green-200 bg-green-50 p-4 dark:border-green-900/40 dark:bg-green-950/20">
          <div className="flex items-center gap-2 text-xs font-medium text-green-700 dark:text-green-400">
            <Package className="h-3.5 w-3.5" /> Abhi Available
          </div>
          <p className="mt-1 text-2xl font-bold tabular-nums text-green-800 dark:text-green-300">
            {Math.round(currentStock).toLocaleString()}
          </p>
          <p className="text-xs text-green-600 dark:text-green-500">{rs(currentValue)}</p>
        </div>
      </div>

      {/* Movement table */}
      <div className="mt-6 overflow-hidden rounded-card border border-surface-200 bg-white shadow-card dark:border-surface-800 dark:bg-surface-900">
        <div className="border-b border-surface-200 px-4 py-3 dark:border-surface-800">
          <h2 className="text-sm font-semibold text-surface-900 dark:text-white">
            Poori Tariikh — {mvRows.length} entries
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-200 bg-surface-50 text-left dark:border-surface-800 dark:bg-surface-800">
                <th className="px-4 py-2.5 text-xs font-medium text-surface-500">Tarikh</th>
                <th className="px-4 py-2.5 text-xs font-medium text-surface-500">Qism</th>
                {!warehouseId && (
                  <th className="px-4 py-2.5 text-xs font-medium text-surface-500">Godam</th>
                )}
                <th className="px-4 py-2.5 text-right text-xs font-medium text-brand-600">Aya</th>
                <th className="px-4 py-2.5 text-right text-xs font-medium text-red-600">Gaya</th>
                <th className="px-4 py-2.5 text-right text-xs font-medium text-green-700">Bacha</th>
                <th className="px-4 py-2.5 text-xs font-medium text-surface-500">Note</th>
              </tr>
            </thead>
            <tbody>
              {mvRows.map((r) => (
                <tr
                  key={r.id}
                  className="border-b border-surface-100 last:border-0 dark:border-surface-800"
                >
                  <td className="px-4 py-2.5 tabular-nums text-surface-500 dark:text-surface-400">
                    {r.date}
                  </td>
                  <td className="px-4 py-2.5">
                    <span
                      className={`inline-block rounded px-1.5 py-0.5 text-xs font-medium ${
                        r.dir === "in"
                          ? "bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300"
                          : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
                      }`}
                    >
                      {r.typeLabel}
                    </span>
                  </td>
                  {!warehouseId && (
                    <td className="px-4 py-2.5 text-xs text-surface-500 dark:text-surface-400">
                      {r.warehouseName}
                    </td>
                  )}
                  <td className="px-4 py-2.5 text-right tabular-nums font-medium text-brand-700 dark:text-brand-300">
                    {r.dir === "in" ? Math.round(r.qty) : "—"}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums font-medium text-red-600 dark:text-red-400">
                    {r.dir === "out" ? Math.round(r.qty) : "—"}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-surface-700 dark:text-surface-300">
                    {Math.round(r.balanceAfter)}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-surface-400 dark:text-surface-500">
                    {r.notes || r.refType || "—"}
                  </td>
                </tr>
              ))}
              {mvRows.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-sm text-surface-400">
                    Koi movement nahi mili.
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
