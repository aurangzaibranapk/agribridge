import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, Card, EmptyState } from "@/components/ui/layout-primitives";
import { Button } from "@/components/ui/form";
import { Package, DollarSign, AlertTriangle, ShoppingCart, Plus } from "lucide-react";
import { formatDate } from "@/lib/utils/format";
import { t } from "@/lib/i18n/translations";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";
export async function CategoryDashboard({ categoryName, title }: { categoryName: string; title: string }) {
  const lang = getLanguageFromCookies("rm");
  const supabase = createClient();
  const { data: category } = await supabase
    .from("categories")
    .select("id")
    .eq("name", categoryName)
    .single();
  if (!category) {
    return (
      <div>
        <PageHeader title={title} description={`Products, stock, and sales for ${categoryName}`} />
        <EmptyState title={`"${categoryName}" category not found`} description="Add it from the Categories page first." />
      </div>
    );
  }

  const { data: subCategories } = await supabase
    .from("categories")
    .select("id")
    .eq("parent_category_id", category.id);
  const categoryIds = [category.id, ...(subCategories ?? []).map((c) => c.id)];

  const { data: products } = await supabase
    .from("products")
    .select("id, name, pack_size, selling_price, purchase_price, min_stock_threshold")
    .in("category_id", categoryIds)
    .eq("is_deleted", false);
  const productIds = (products ?? []).map((p) => p.id);
  const { data: rawInventory } = productIds.length
    ? await supabase
        .from("inventory")
        .select("product_id, quantity_on_hand, stock_batches(expiry_date)")
        .in("product_id", productIds)
    : { data: [] };
  const stockByProduct: Record<string, number> = {};
  (rawInventory ?? []).forEach((row: any) => {
    stockByProduct[row.product_id] = (stockByProduct[row.product_id] ?? 0) + Number(row.quantity_on_hand);
  });
  const totalStockValue = (products ?? []).reduce(
    (sum, p) => sum + (stockByProduct[p.id] ?? 0) * Number(p.purchase_price),
    0
  );
  const lowStockProducts = (products ?? []).filter(
    (p) => Number(p.min_stock_threshold) > 0 && (stockByProduct[p.id] ?? 0) <= Number(p.min_stock_threshold)
  );
  const now = new Date();
  const sixtyDaysOut = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);
  const expiringBatches = (rawInventory ?? []).filter((row: any) => {
    const batch = Array.isArray(row.stock_batches) ? row.stock_batches[0] : row.stock_batches;
    if (!batch?.expiry_date) return false;
    const exp = new Date(batch.expiry_date);
    return exp <= sixtyDaysOut && exp >= now;
  });
  const { data: recentPurchases } = productIds.length
    ? await supabase
        .from("purchase_items")
        .select("quantity, unit_cost, line_total, purchases(purchase_number, purchase_date, suppliers(name))")
        .in("product_id", productIds)
        .order("id", { ascending: false })
        .limit(10)
    : { data: [] };
  return (
    <div>
      <PageHeader
        title={title}
        description={`Products, stock, and sales for ${categoryName}`}
        actions={
          <Link href="/admin/products/new">
            <Button><Plus className="h-4 w-4" />{t("c_add_product", lang)}</Button>
          </Link>
        }
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <div className="flex items-center gap-2 text-surface-500">
            <Package className="h-4 w-4" />
            <span className="text-xs font-medium uppercase tracking-wide">{t("c_products", lang)}</span>
          </div>
          <p className="mt-2 font-display text-xl font-semibold text-surface-900 dark:text-white">
            {products?.length ?? 0}
          </p>
        </Card>
        <Card className="border-brand-200 bg-brand-50 dark:border-brand-900/40 dark:bg-brand-950/30">
          <div className="flex items-center gap-2 text-brand-600">
            <DollarSign className="h-4 w-4" />
            <span className="text-xs font-medium uppercase tracking-wide">{t("cd_stock_value", lang)}</span>
          </div>
          <p className="mt-2 font-display text-xl font-semibold text-brand-700 dark:text-brand-300">
            Rs {totalStockValue.toLocaleString()}
          </p>
        </Card>
        <Card className="border-red-200 bg-red-50 dark:border-red-900/40 dark:bg-red-950/30">
          <div className="flex items-center gap-2 text-red-600">
            <AlertTriangle className="h-4 w-4" />
            <span className="text-xs font-medium uppercase tracking-wide">{t("cd_low_stock", lang)}</span>
          </div>
          <p className="mt-2 font-display text-xl font-semibold text-red-700 dark:text-red-300">
            {lowStockProducts.length}
          </p>
        </Card>
        <Card className="border-amber-200 bg-amber-50 dark:border-amber-900/40 dark:bg-amber-950/30">
          <div className="flex items-center gap-2 text-amber-600">
            <AlertTriangle className="h-4 w-4" />
            <span className="text-xs font-medium uppercase tracking-wide">{t("cd_expiring_60", lang)}</span>
          </div>
          <p className="mt-2 font-display text-xl font-semibold text-amber-700 dark:text-amber-300">
            {expiringBatches.length}
          </p>
        </Card>
      </div>
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div>
          <h2 className="mb-3 font-display text-base font-semibold text-surface-900 dark:text-surface-100">{t("cd_products_in_stock", lang)}</h2>
          <div className="overflow-hidden rounded-card border border-surface-200 bg-white shadow-card dark:border-surface-800 dark:bg-surface-900">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-200 bg-surface-50 text-left dark:border-surface-800 dark:bg-surface-800">
                  <th className="px-3 py-2 font-medium text-surface-500">{t("c_product", lang)}</th>
                  <th className="px-3 py-2 text-right font-medium text-surface-500">{t("c_stock", lang)}</th>
                  <th className="px-3 py-2 text-right font-medium text-surface-500">{t("c_price", lang)}</th>
                </tr>
              </thead>
              <tbody>
                {(products ?? []).map((p) => {
                  const stock = stockByProduct[p.id] ?? 0;
                  const isLow = Number(p.min_stock_threshold) > 0 && stock <= Number(p.min_stock_threshold);
                  return (
                    <tr key={p.id} className="border-b border-surface-100 last:border-0 dark:border-surface-800">
                      <td className="px-3 py-2 text-surface-800 dark:text-surface-200">
                        {p.name}
                        {p.pack_size ? ` (${p.pack_size})` : ""}
                      </td>
                      <td className={`px-3 py-2 text-right ${isLow ? "font-semibold text-red-600" : "text-surface-600 dark:text-surface-400"}`}>
                        {stock}
                      </td>
                      <td className="px-3 py-2 text-right text-surface-600 dark:text-surface-400">
                        Rs {Number(p.selling_price).toLocaleString()}
                      </td>
                    </tr>
                  );
                })}
                {(!products || products.length === 0) && (
                  <tr>
                    <td colSpan={3} className="px-3 py-8 text-center text-surface-400">{t("cd_no_products_cat", lang)}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
        <div>
          <h2 className="mb-3 font-display text-base font-semibold text-surface-900 dark:text-surface-100">{t("cd_recent_purchases", lang)}</h2>
          <div className="overflow-hidden rounded-card border border-surface-200 bg-white shadow-card dark:border-surface-800 dark:bg-surface-900">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-200 bg-surface-50 text-left dark:border-surface-800 dark:bg-surface-800">
                  <th className="px-3 py-2 font-medium text-surface-500">{t("c_supplier", lang)}</th>
                  <th className="px-3 py-2 font-medium text-surface-500">{t("c_date", lang)}</th>
                  <th className="px-3 py-2 text-right font-medium text-surface-500">{t("c_amount", lang)}</th>
                </tr>
              </thead>
              <tbody>
                {(recentPurchases ?? []).map((rp: any, idx: number) => {
                  const purchase = Array.isArray(rp.purchases) ? rp.purchases[0] : rp.purchases;
                  const supplier = Array.isArray(purchase?.suppliers) ? purchase.suppliers[0] : purchase?.suppliers;
                  return (
                    <tr key={idx} className="border-b border-surface-100 last:border-0 dark:border-surface-800">
                      <td className="px-3 py-2 text-surface-800 dark:text-surface-200">{supplier?.name ?? "-"}</td>
                      <td className="px-3 py-2 text-surface-500">{purchase?.purchase_date ? formatDate(purchase.purchase_date) : "-"}</td>
                      <td className="px-3 py-2 text-right text-surface-600 dark:text-surface-400">
                        Rs {Number(rp.line_total).toLocaleString()}
                      </td>
                    </tr>
                  );
                })}
                {(!recentPurchases || recentPurchases.length === 0) && (
                  <tr>
                    <td colSpan={3} className="px-3 py-8 text-center text-surface-400">{t("cd_no_purchases", lang)}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}