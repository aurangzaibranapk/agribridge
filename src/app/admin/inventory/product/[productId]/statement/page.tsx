import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { t, type Lang } from "@/lib/i18n/translations";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";
import { PageHeader, Card } from "@/components/ui/layout-primitives";

export const dynamic = "force-dynamic";

type MovementRow = {
  id: string;
  inventory_id: string;
  movement_type: string;
  quantity: number;
  reference_type: string | null;
  reference_id: string | null;
  notes: string | null;
  created_at: string;
  balance_after: number | null;
  warehouse_name: string;
  // resolved after lookup
  ref_label?: string;
  ref_sub?: string;
};

function movementLabel(m: MovementRow, lang: Lang): string {
  switch (m.movement_type) {
    case "purchase_in":         return t("inv_stmt_purchase_in", lang);
    case "sale_out":            return t("inv_stmt_sale_out", lang);
    case "adjustment_increase": return t("inv_stmt_adj_inc", lang);
    case "adjustment_decrease": return t("inv_stmt_adj_dec", lang);
    case "transfer_out":        return t("inv_stmt_transfer_out", lang);
    case "return_in":           return t("inv_stmt_return_in", lang);
    default:                    return m.movement_type;
  }
}

function isInbound(type: string) {
  return ["purchase_in", "adjustment_increase", "return_in"].includes(type);
}

export default async function ProductStatementPage({
  params,
  searchParams,
}: {
  params: { productId: string };
  searchParams: { wh?: string };
}) {
  const supabase = createClient();
  const lang = getLanguageFromCookies("rm") as Lang;

  const { data: product } = await supabase
    .from("products")
    .select("id, name, pack_size, units_per_pack")
    .eq("id", params.productId)
    .maybeSingle();
  if (!product) notFound();

  // Inventory rows for this product (one per warehouse)
  const { data: invRows } = await supabase
    .from("inventory")
    .select("id, warehouse_id, quantity_on_hand, warehouses(name)")
    .eq("product_id", params.productId);

  const invMap = new Map<string, { warehouseName: string; quantityOnHand: number }>();
  for (const r of invRows ?? []) {
    const wName = (Array.isArray(r.warehouses) ? r.warehouses[0] : r.warehouses)?.name ?? "—";
    invMap.set(r.id, { warehouseName: wName, quantityOnHand: Number(r.quantity_on_hand ?? 0) });
  }

  // All warehouses for filter dropdown
  const warehouses = Array.from(invMap.entries()).map(([, v]) => v.warehouseName).filter((v, i, a) => a.indexOf(v) === i).sort();

  // Filter by warehouse if requested
  const filterWh = searchParams.wh ?? "";
  const filteredInvIds = Array.from(invMap.entries())
    .filter(([, v]) => !filterWh || v.warehouseName === filterWh)
    .map(([id]) => id);

  if (filteredInvIds.length === 0) {
    return (
      <div className="space-y-4">
        <PageHeader
          title={t("inv_stmt_title", lang)}
          description={product.name}
          actions={
            <Link href={`/admin/inventory/product/${params.productId}`} className="inline-flex items-center gap-1 text-sm text-brand-600 hover:underline">
              <ArrowLeft className="h-4 w-4" /> {t("inv_stmt_back", lang)}
            </Link>
          }
        />
        <Card><p className="text-sm text-surface-500">{t("inv_stmt_no_movements", lang)}</p></Card>
      </div>
    );
  }

  // Fetch ALL movements for filtered inventory IDs
  const { data: rawMoves } = await supabase
    .from("stock_movements")
    .select("id, inventory_id, movement_type, quantity, reference_type, reference_id, notes, created_at, balance_after")
    .in("inventory_id", filteredInvIds)
    .order("created_at", { ascending: true });

  const moves: MovementRow[] = (rawMoves ?? []).map((m: any) => ({
    ...m,
    quantity: Number(m.quantity ?? 0),
    balance_after: m.balance_after != null ? Number(m.balance_after) : null,
    warehouse_name: invMap.get(m.inventory_id)?.warehouseName ?? "—",
  }));

  // Batch-resolve purchase references
  const purchaseIds = Array.from(new Set(
    moves.filter(m => m.reference_type === "purchase" && m.reference_id).map(m => m.reference_id!)
  ));
  const purchaseMap = new Map<string, { purchase_number: string; supplier: string }>();
  if (purchaseIds.length) {
    const { data: pu } = await supabase
      .from("purchases")
      .select("id, purchase_number, purchase_date, suppliers(name)")
      .in("id", purchaseIds);
    for (const p of pu ?? []) {
      const sup = (Array.isArray(p.suppliers) ? p.suppliers[0] : p.suppliers)?.name ?? "";
      purchaseMap.set(p.id, { purchase_number: p.purchase_number, supplier: sup });
    }
  }

  // Batch-resolve agri_grn references
  const agriGrnIds = Array.from(new Set(
    moves.filter(m => m.reference_type === "agri_grn" && m.reference_id).map(m => m.reference_id!)
  ));
  const agriGrnMap = new Map<string, { purchase_number: string; supplier: string }>();
  if (agriGrnIds.length) {
    const { data: pu } = await supabase
      .from("purchases")
      .select("id, purchase_number, suppliers(name)")
      .in("id", agriGrnIds);
    for (const p of pu ?? []) {
      const sup = (Array.isArray(p.suppliers) ? p.suppliers[0] : p.suppliers)?.name ?? "";
      agriGrnMap.set(p.id, { purchase_number: p.purchase_number, supplier: sup });
    }
  }

  // Batch-resolve sale references
  const saleIds = Array.from(new Set(
    moves.filter(m => m.reference_type === "pos_sale" && m.reference_id).map(m => m.reference_id!)
  ));
  const saleMap = new Map<string, { invoice_number: string; customer: string }>();
  if (saleIds.length) {
    const { data: sl } = await supabase
      .from("sales")
      .select("id, invoice_number, customers(name)")
      .in("id", saleIds);
    for (const s of sl ?? []) {
      const cust = (Array.isArray(s.customers) ? s.customers[0] : s.customers)?.name ?? "";
      saleMap.set(s.id, { invoice_number: s.invoice_number, customer: cust });
    }
  }

  // Attach resolved labels to each movement
  for (const m of moves) {
    if (m.reference_type === "purchase" && m.reference_id) {
      const p = purchaseMap.get(m.reference_id);
      if (p) { m.ref_label = p.purchase_number; m.ref_sub = p.supplier; }
    } else if (m.reference_type === "agri_grn" && m.reference_id) {
      const p = agriGrnMap.get(m.reference_id);
      if (p) { m.ref_label = p.purchase_number; m.ref_sub = p.supplier; }
    } else if (m.reference_type === "pos_sale" && m.reference_id) {
      const s = saleMap.get(m.reference_id);
      if (s) { m.ref_label = s.invoice_number; m.ref_sub = s.customer; }
    } else if (m.notes) {
      m.ref_label = m.notes.length > 60 ? m.notes.slice(0, 60) + "…" : m.notes;
    }
  }

  // Compute running balance per warehouse (for when balance_after is missing)
  const runningBalance = new Map<string, number>();
  for (const m of moves) {
    const prev = runningBalance.get(m.warehouse_name) ?? 0;
    const next = isInbound(m.movement_type) ? prev + m.quantity : prev - m.quantity;
    runningBalance.set(m.warehouse_name, next);
    if (m.balance_after == null) m.balance_after = next;
  }

  // Summary totals
  let totalIn = 0, totalOut = 0;
  for (const m of moves) {
    if (isInbound(m.movement_type)) totalIn += m.quantity;
    else totalOut += m.quantity;
  }

  // Final balance per warehouse
  const finalBalances = Array.from(invMap.entries())
    .filter(([, v]) => !filterWh || v.warehouseName === filterWh)
    .map(([, v]) => ({ wh: v.warehouseName, qty: v.quantityOnHand }));

  return (
    <div className="space-y-4">
      <PageHeader
        title={t("inv_stmt_title", lang)}
        description={`${product.name}${product.pack_size ? ` (${product.pack_size})` : ""}${product.units_per_pack ? ` · ${product.units_per_pack} per pack` : ""}`}
        actions={
          <Link href={`/admin/inventory/product/${params.productId}`} className="inline-flex items-center gap-1 text-sm text-brand-600 hover:underline">
            <ArrowLeft className="h-4 w-4" /> {t("inv_stmt_back", lang)}
          </Link>
        }
      />

      {/* Summary tiles */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card className="p-4">
          <p className="text-[11px] font-medium uppercase tracking-wide text-surface-500">{t("inv_stmt_total_in", lang)}</p>
          <p className="mt-1 font-display text-2xl font-semibold tabular-nums text-emerald-700">+{totalIn}</p>
        </Card>
        <Card className="p-4">
          <p className="text-[11px] font-medium uppercase tracking-wide text-surface-500">{t("inv_stmt_total_out", lang)}</p>
          <p className="mt-1 font-display text-2xl font-semibold tabular-nums text-red-600">−{totalOut}</p>
        </Card>
        {finalBalances.map((fb) => (
          <Card key={fb.wh} className="p-4">
            <p className="text-[11px] font-medium uppercase tracking-wide text-surface-500">{t("inv_stmt_closing", lang)}</p>
            <p className="mt-1 font-display text-2xl font-semibold tabular-nums text-surface-900 dark:text-white">{fb.qty}</p>
            <p className="text-[11px] text-surface-400">{fb.wh}</p>
          </Card>
        ))}
      </div>

      {/* Warehouse filter */}
      {warehouses.length > 1 && (
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/admin/inventory/product/${params.productId}/statement`}
            className={`rounded-full px-3 py-1 text-xs font-medium transition ${!filterWh ? "bg-brand-600 text-white" : "bg-surface-100 text-surface-600 hover:bg-surface-200 dark:bg-surface-800 dark:text-surface-300"}`}
          >
            {t("inv_stmt_all_wh", lang)}
          </Link>
          {warehouses.map((wh) => (
            <Link
              key={wh}
              href={`/admin/inventory/product/${params.productId}/statement?wh=${encodeURIComponent(wh)}`}
              className={`rounded-full px-3 py-1 text-xs font-medium transition ${filterWh === wh ? "bg-brand-600 text-white" : "bg-surface-100 text-surface-600 hover:bg-surface-200 dark:bg-surface-800 dark:text-surface-300"}`}
            >
              {wh}
            </Link>
          ))}
        </div>
      )}

      {/* Ledger table */}
      <Card className="overflow-x-auto">
        {moves.length === 0 ? (
          <p className="text-sm text-surface-500">{t("inv_stmt_no_movements", lang)}</p>
        ) : (
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-surface-200 bg-surface-50 text-left text-xs text-surface-500 dark:border-surface-800 dark:bg-surface-800">
                <th className="px-3 py-2 font-medium">{t("inv_stmt_date", lang)}</th>
                {warehouses.length > 1 && !filterWh && (
                  <th className="px-3 py-2 font-medium">{t("inv_stmt_warehouse", lang)}</th>
                )}
                <th className="px-3 py-2 font-medium">{t("inv_stmt_details", lang)}</th>
                <th className="px-3 py-2 text-right font-medium text-emerald-700">{t("inv_stmt_in", lang)}</th>
                <th className="px-3 py-2 text-right font-medium text-red-600">{t("inv_stmt_out", lang)}</th>
                <th className="px-3 py-2 text-right font-medium">{t("inv_stmt_balance", lang)}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-100 dark:divide-surface-800">
              {moves.map((m) => {
                const inbound = isInbound(m.movement_type);
                return (
                  <tr key={m.id} className="hover:bg-surface-50/60 dark:hover:bg-surface-800/30">
                    <td className="px-3 py-2 text-xs text-surface-500 dark:text-surface-400">
                      {new Date(m.created_at).toLocaleDateString("en-PK", { day: "2-digit", month: "short", year: "numeric" })}
                      <span className="ml-1 text-[10px] text-surface-400">
                        {new Date(m.created_at).toLocaleTimeString("en-PK", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </td>
                    {warehouses.length > 1 && !filterWh && (
                      <td className="px-3 py-2 text-xs text-surface-600 dark:text-surface-400">{m.warehouse_name}</td>
                    )}
                    <td className="px-3 py-2">
                      <span className="font-medium text-surface-800 dark:text-surface-200">{movementLabel(m, lang)}</span>
                      {m.ref_label && (
                        <span className="ml-2 font-mono text-xs text-brand-600 dark:text-brand-400">{m.ref_label}</span>
                      )}
                      {m.ref_sub && (
                        <span className="ml-1 text-xs text-surface-400">— {m.ref_sub}</span>
                      )}
                    </td>
                    <td className={`px-3 py-2 text-right tabular-nums font-medium ${inbound ? "text-emerald-700" : "text-surface-200 dark:text-surface-700"}`}>
                      {inbound ? `+${m.quantity}` : ""}
                    </td>
                    <td className={`px-3 py-2 text-right tabular-nums font-medium ${!inbound ? "text-red-600" : "text-surface-200 dark:text-surface-700"}`}>
                      {!inbound ? `−${m.quantity}` : ""}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-surface-700 dark:text-surface-300">
                      {m.balance_after ?? ""}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-surface-300 bg-surface-50 dark:border-surface-700 dark:bg-surface-800">
                <td colSpan={warehouses.length > 1 && !filterWh ? 3 : 2} className="px-3 py-2 text-xs font-semibold text-surface-700 dark:text-surface-300">
                  {t("inv_stmt_closing", lang)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums font-semibold text-emerald-700">+{totalIn}</td>
                <td className="px-3 py-2 text-right tabular-nums font-semibold text-red-600">−{totalOut}</td>
                <td className="px-3 py-2 text-right tabular-nums font-bold text-surface-900 dark:text-white">
                  {finalBalances.reduce((s, fb) => s + fb.qty, 0)}
                </td>
              </tr>
            </tfoot>
          </table>
        )}
      </Card>
    </div>
  );
}
