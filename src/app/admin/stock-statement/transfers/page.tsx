import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, Package } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { t, type Lang } from "@/lib/i18n/translations";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";
import { PageHeader, Card } from "@/components/ui/layout-primitives";

export const dynamic = "force-dynamic";

type TransferRow = {
  id: string;
  movement_type: string;
  quantity: number;
  reference_type: string | null;
  reference_id: string | null;
  created_at: string;
  product_name: string;
  warehouse_name: string;
  // resolved
  dispatch_number?: string;
  order_number?: string;
  dest_branch?: string;
};

export default async function TransferStatementPage({
  searchParams,
}: {
  searchParams: { branch?: string; wh?: string };
}) {
  const supabase = createClient();
  const lang = getLanguageFromCookies("rm") as Lang;

  // All transfer_out movements
  const { data: rawMoves } = await supabase
    .from("stock_movements")
    .select(
      "id, movement_type, quantity, reference_type, reference_id, created_at, inventory_id"
    )
    .eq("movement_type", "transfer_out")
    .order("created_at", { ascending: false });

  if (!rawMoves || rawMoves.length === 0) {
    return (
      <div className="space-y-4">
        <PageHeader
          title={t("tr_stmt_title", lang)}
          description={t("tr_stmt_desc", lang)}
          actions={
            <Link href="/admin/stock-statement" className="inline-flex items-center gap-1 text-sm text-brand-600 hover:underline">
              <ArrowLeft className="h-4 w-4" /> {t("tr_stmt_back", lang)}
            </Link>
          }
        />
        <Card><p className="text-sm text-surface-500">{t("tr_stmt_no_data", lang)}</p></Card>
      </div>
    );
  }

  // Batch-fetch inventory → product + warehouse
  const invIds = [...new Set(rawMoves.map((m) => m.inventory_id))];
  const { data: invRows } = await supabase
    .from("inventory")
    .select("id, product_id, warehouse_id, products(name), warehouses(name)")
    .in("id", invIds);

  const invMap = new Map<string, { productName: string; warehouseName: string }>();
  for (const r of invRows ?? []) {
    const pName = (Array.isArray(r.products) ? r.products[0] : r.products)?.name ?? "—";
    const wName = (Array.isArray(r.warehouses) ? r.warehouses[0] : r.warehouses)?.name ?? "—";
    invMap.set(r.id, { productName: pName, warehouseName: wName });
  }

  // Batch-fetch agri_dispatches → dispatch_number + order
  const dispatchIds = [
    ...new Set(
      rawMoves
        .filter((m) => m.reference_type === "agri_dispatch" && m.reference_id)
        .map((m) => m.reference_id!)
    ),
  ];
  const dispatchMap = new Map<
    string,
    { dispatch_number: string; order_number: string; dest_branch: string }
  >();
  if (dispatchIds.length) {
    const { data: dispatches } = await supabase
      .from("agri_dispatches")
      .select("id, dispatch_number, order_id, agri_orders(order_number, shop_dealer_name, order_to_branch_id, branches!agri_orders_order_to_branch_id_fkey(name))")
      .in("id", dispatchIds);
    for (const d of dispatches ?? []) {
      const order: any = Array.isArray(d.agri_orders) ? d.agri_orders[0] : d.agri_orders;
      const branch = order
        ? ((Array.isArray(order.branches) ? order.branches[0] : order.branches)?.name ??
            order.shop_dealer_name ??
            "—")
        : "—";
      dispatchMap.set(d.id, {
        dispatch_number: d.dispatch_number,
        order_number: order?.order_number ?? "—",
        dest_branch: branch,
      });
    }
  }

  const moves: TransferRow[] = rawMoves.map((m) => {
    const inv = invMap.get(m.inventory_id);
    const row: TransferRow = {
      ...m,
      quantity: Number(m.quantity ?? 0),
      product_name: inv?.productName ?? "—",
      warehouse_name: inv?.warehouseName ?? "—",
    };
    if (m.reference_type === "agri_dispatch" && m.reference_id) {
      const d = dispatchMap.get(m.reference_id);
      if (d) {
        row.dispatch_number = d.dispatch_number;
        row.order_number = d.order_number;
        row.dest_branch = d.dest_branch;
      }
    }
    return row;
  });

  // Unique branches + warehouses for filters
  const branches = [...new Set(moves.map((m) => m.dest_branch).filter(Boolean))].sort() as string[];
  const warehouses = [...new Set(moves.map((m) => m.warehouse_name).filter(Boolean))].sort() as string[];

  const filterBranch = searchParams.branch ?? "";
  const filterWh = searchParams.wh ?? "";

  const filtered = moves.filter(
    (m) =>
      (!filterBranch || m.dest_branch === filterBranch) &&
      (!filterWh || m.warehouse_name === filterWh)
  );

  const totalQty = filtered.reduce((s, m) => s + m.quantity, 0);
  const dispatchSet = new Set(filtered.map((m) => m.dispatch_number).filter(Boolean));

  return (
    <div className="space-y-4">
      <PageHeader
        title={t("tr_stmt_title", lang)}
        description={t("tr_stmt_desc", lang)}
        actions={
          <Link href="/admin/stock-statement" className="inline-flex items-center gap-1 text-sm text-brand-600 hover:underline">
            <ArrowLeft className="h-4 w-4" /> {t("tr_stmt_back", lang)}
          </Link>
        }
      />

      {/* Summary tiles */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Card className="p-4">
          <p className="text-[11px] font-medium uppercase tracking-wide text-surface-500">{t("tr_stmt_total_items", lang)}</p>
          <p className="mt-1 font-display text-2xl font-semibold tabular-nums text-red-600">−{totalQty}</p>
        </Card>
        <Card className="p-4">
          <p className="text-[11px] font-medium uppercase tracking-wide text-surface-500">{t("tr_stmt_dispatches", lang)}</p>
          <p className="mt-1 font-display text-2xl font-semibold tabular-nums text-surface-900 dark:text-white">{dispatchSet.size}</p>
        </Card>
        <Card className="p-4">
          <p className="text-[11px] font-medium uppercase tracking-wide text-surface-500">{t("tr_stmt_dest", lang)}</p>
          <p className="mt-1 font-display text-2xl font-semibold tabular-nums text-surface-900 dark:text-white">{branches.length}</p>
        </Card>
      </div>

      {/* Branch filter */}
      <div className="flex flex-wrap gap-2">
        <Link
          href="/admin/stock-statement/transfers"
          className={`rounded-full px-3 py-1 text-xs font-medium transition ${!filterBranch && !filterWh ? "bg-brand-600 text-white" : "bg-surface-100 text-surface-600 hover:bg-surface-200 dark:bg-surface-800 dark:text-surface-300"}`}
        >
          {t("tr_stmt_all_branches", lang)}
        </Link>
        {branches.map((br) => (
          <Link
            key={br}
            href={`/admin/stock-statement/transfers?branch=${encodeURIComponent(br)}`}
            className={`rounded-full px-3 py-1 text-xs font-medium transition ${filterBranch === br ? "bg-brand-600 text-white" : "bg-surface-100 text-surface-600 hover:bg-surface-200 dark:bg-surface-800 dark:text-surface-300"}`}
          >
            {br}
          </Link>
        ))}
      </div>

      {/* Ledger table */}
      <Card className="overflow-x-auto">
        {filtered.length === 0 ? (
          <p className="text-sm text-surface-500">{t("tr_stmt_no_data", lang)}</p>
        ) : (
          <table className="w-full min-w-[700px] text-sm">
            <thead>
              <tr className="border-b border-surface-200 bg-surface-50 text-left text-xs text-surface-500 dark:border-surface-800 dark:bg-surface-800">
                <th className="px-3 py-2 font-medium">Tareekh</th>
                <th className="px-3 py-2 font-medium">{t("tr_stmt_dispatch", lang)}</th>
                <th className="px-3 py-2 font-medium">{t("tr_stmt_order", lang)}</th>
                <th className="px-3 py-2 font-medium">{t("tr_stmt_from_wh", lang)}</th>
                <th className="px-3 py-2 font-medium">{t("tr_stmt_dest", lang)}</th>
                <th className="px-3 py-2 font-medium">{t("tr_stmt_product", lang)}</th>
                <th className="px-3 py-2 text-right font-medium text-red-600">{t("tr_stmt_qty", lang)}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-100 dark:divide-surface-800">
              {filtered.map((m) => (
                <tr key={m.id} className="hover:bg-surface-50/60 dark:hover:bg-surface-800/30">
                  <td className="px-3 py-2 text-xs text-surface-500 dark:text-surface-400">
                    {new Date(m.created_at).toLocaleDateString("en-PK", { day: "2-digit", month: "short", year: "numeric" })}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs text-brand-600 dark:text-brand-400">
                    {m.dispatch_number ?? "—"}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs text-surface-600 dark:text-surface-400">
                    {m.order_number ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-xs text-surface-600 dark:text-surface-400">
                    {m.warehouse_name}
                  </td>
                  <td className="px-3 py-2">
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-surface-800 dark:text-surface-200">
                      <ArrowRight className="h-3 w-3 text-surface-400" />
                      {m.dest_branch ?? "—"}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-sm font-medium text-surface-800 dark:text-surface-200">
                    {m.product_name}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums font-semibold text-red-600">
                    −{m.quantity}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-surface-300 bg-surface-50 dark:border-surface-700 dark:bg-surface-800">
                <td colSpan={6} className="px-3 py-2 text-xs font-semibold text-surface-700 dark:text-surface-300">
                  {t("tr_stmt_total_items", lang)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums font-bold text-red-600">−{totalQty}</td>
              </tr>
            </tfoot>
          </table>
        )}
      </Card>
    </div>
  );
}
