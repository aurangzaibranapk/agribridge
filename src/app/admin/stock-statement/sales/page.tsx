import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { t, type Lang } from "@/lib/i18n/translations";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";
import { PageHeader, Card } from "@/components/ui/layout-primitives";

export const dynamic = "force-dynamic";

type SaleRow = {
  id: string;
  movement_type: string;
  quantity: number;
  reference_type: string | null;
  reference_id: string | null;
  created_at: string;
  product_name: string;
  warehouse_name: string;
  // resolved
  invoice_number?: string;
  customer_name?: string;
};

export default async function SalesStatementPage({
  searchParams,
}: {
  searchParams: { shop?: string };
}) {
  const supabase = createClient();
  const lang = getLanguageFromCookies("rm") as Lang;

  // All sale_out movements
  const { data: rawMoves } = await supabase
    .from("stock_movements")
    .select("id, movement_type, quantity, reference_type, reference_id, created_at, inventory_id")
    .eq("movement_type", "sale_out")
    .order("created_at", { ascending: false });

  if (!rawMoves || rawMoves.length === 0) {
    return (
      <div className="space-y-4">
        <PageHeader
          title={t("sl_stmt_title", lang)}
          description={t("sl_stmt_desc", lang)}
          actions={
            <Link href="/admin/stock-statement" className="inline-flex items-center gap-1 text-sm text-brand-600 hover:underline">
              <ArrowLeft className="h-4 w-4" /> {t("sl_stmt_back", lang)}
            </Link>
          }
        />
        <Card><p className="text-sm text-surface-500">{t("sl_stmt_no_data", lang)}</p></Card>
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

  // Batch-fetch sales → invoice_number + customer
  const saleIds = [
    ...new Set(
      rawMoves
        .filter((m) => m.reference_type === "pos_sale" && m.reference_id)
        .map((m) => m.reference_id!)
    ),
  ];
  const saleMap = new Map<string, { invoice_number: string; customer_name: string }>();
  if (saleIds.length) {
    const { data: sales } = await supabase
      .from("sales")
      .select("id, invoice_number, customers(name)")
      .in("id", saleIds);
    for (const s of sales ?? []) {
      const cust = (Array.isArray(s.customers) ? s.customers[0] : s.customers)?.name ?? "";
      saleMap.set(s.id, {
        invoice_number: s.invoice_number,
        customer_name: cust || t("sl_stmt_walk_in", lang),
      });
    }
  }

  const moves: SaleRow[] = rawMoves.map((m) => {
    const inv = invMap.get(m.inventory_id);
    const row: SaleRow = {
      ...m,
      quantity: Number(m.quantity ?? 0),
      product_name: inv?.productName ?? "—",
      warehouse_name: inv?.warehouseName ?? "—",
    };
    if (m.reference_type === "pos_sale" && m.reference_id) {
      const s = saleMap.get(m.reference_id);
      if (s) {
        row.invoice_number = s.invoice_number;
        row.customer_name = s.customer_name;
      }
    }
    return row;
  });

  // Unique shops for filter
  const shops = [...new Set(moves.map((m) => m.warehouse_name))].sort();
  const filterShop = searchParams.shop ?? "";
  const filtered = moves.filter((m) => !filterShop || m.warehouse_name === filterShop);

  const totalQty = filtered.reduce((s, m) => s + m.quantity, 0);
  const invoiceSet = new Set(filtered.map((m) => m.invoice_number).filter(Boolean));

  return (
    <div className="space-y-4">
      <PageHeader
        title={t("sl_stmt_title", lang)}
        description={t("sl_stmt_desc", lang)}
        actions={
          <Link href="/admin/stock-statement" className="inline-flex items-center gap-1 text-sm text-brand-600 hover:underline">
            <ArrowLeft className="h-4 w-4" /> {t("sl_stmt_back", lang)}
          </Link>
        }
      />

      {/* Summary tiles */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Card className="p-4">
          <p className="text-[11px] font-medium uppercase tracking-wide text-surface-500">{t("sl_stmt_total_qty", lang)}</p>
          <p className="mt-1 font-display text-2xl font-semibold tabular-nums text-red-600">−{totalQty}</p>
        </Card>
        <Card className="p-4">
          <p className="text-[11px] font-medium uppercase tracking-wide text-surface-500">{t("sl_stmt_invoices", lang)}</p>
          <p className="mt-1 font-display text-2xl font-semibold tabular-nums text-surface-900 dark:text-white">{invoiceSet.size}</p>
        </Card>
        <Card className="p-4">
          <p className="text-[11px] font-medium uppercase tracking-wide text-surface-500">{t("sl_stmt_shop", lang)}</p>
          <p className="mt-1 font-display text-2xl font-semibold tabular-nums text-surface-900 dark:text-white">{shops.length}</p>
        </Card>
      </div>

      {/* Shop filter */}
      {shops.length > 1 && (
        <div className="flex flex-wrap gap-2">
          <Link
            href="/admin/stock-statement/sales"
            className={`rounded-full px-3 py-1 text-xs font-medium transition ${!filterShop ? "bg-brand-600 text-white" : "bg-surface-100 text-surface-600 hover:bg-surface-200 dark:bg-surface-800 dark:text-surface-300"}`}
          >
            {t("sl_stmt_all_shops", lang)}
          </Link>
          {shops.map((sh) => (
            <Link
              key={sh}
              href={`/admin/stock-statement/sales?shop=${encodeURIComponent(sh)}`}
              className={`rounded-full px-3 py-1 text-xs font-medium transition ${filterShop === sh ? "bg-brand-600 text-white" : "bg-surface-100 text-surface-600 hover:bg-surface-200 dark:bg-surface-800 dark:text-surface-300"}`}
            >
              {sh}
            </Link>
          ))}
        </div>
      )}

      {/* Ledger table */}
      <Card className="overflow-x-auto">
        {filtered.length === 0 ? (
          <p className="text-sm text-surface-500">{t("sl_stmt_no_data", lang)}</p>
        ) : (
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-surface-200 bg-surface-50 text-left text-xs text-surface-500 dark:border-surface-800 dark:bg-surface-800">
                <th className="px-3 py-2 font-medium">Tareekh</th>
                <th className="px-3 py-2 font-medium">{t("sl_stmt_invoice", lang)}</th>
                {shops.length > 1 && !filterShop && (
                  <th className="px-3 py-2 font-medium">{t("sl_stmt_shop", lang)}</th>
                )}
                <th className="px-3 py-2 font-medium">{t("sl_stmt_product", lang)}</th>
                <th className="px-3 py-2 font-medium">{t("sl_stmt_customer", lang)}</th>
                <th className="px-3 py-2 text-right font-medium text-red-600">{t("sl_stmt_qty", lang)}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-100 dark:divide-surface-800">
              {filtered.map((m) => (
                <tr key={m.id} className="hover:bg-surface-50/60 dark:hover:bg-surface-800/30">
                  <td className="px-3 py-2 text-xs text-surface-500 dark:text-surface-400">
                    {new Date(m.created_at).toLocaleDateString("en-PK", { day: "2-digit", month: "short", year: "numeric" })}
                    <span className="ml-1 text-[10px] text-surface-400">
                      {new Date(m.created_at).toLocaleTimeString("en-PK", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </td>
                  <td className="px-3 py-2 font-mono text-xs text-brand-600 dark:text-brand-400">
                    {m.invoice_number ?? "—"}
                  </td>
                  {shops.length > 1 && !filterShop && (
                    <td className="px-3 py-2 text-xs text-surface-600 dark:text-surface-400">{m.warehouse_name}</td>
                  )}
                  <td className="px-3 py-2 text-sm font-medium text-surface-800 dark:text-surface-200">
                    {m.product_name}
                  </td>
                  <td className="px-3 py-2 text-sm text-surface-600 dark:text-surface-400">
                    {m.customer_name ?? t("sl_stmt_walk_in", lang)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums font-semibold text-red-600">
                    −{m.quantity}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-surface-300 bg-surface-50 dark:border-surface-700 dark:bg-surface-800">
                <td colSpan={shops.length > 1 && !filterShop ? 5 : 4} className="px-3 py-2 text-xs font-semibold text-surface-700 dark:text-surface-300">
                  {t("sl_stmt_total_qty", lang)}
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
