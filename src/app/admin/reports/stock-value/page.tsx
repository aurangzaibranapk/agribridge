import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/layout-primitives";
import Link from "next/link";
import { TrendingUp, PackageOpen, Boxes, ArrowDownCircle, Tag, ShoppingCart, Wrench } from "lucide-react";

export const dynamic = "force-dynamic";
export const metadata = { title: "Stock Value Report" };

function fmt(n: number) {
  return "Rs " + Math.round(n).toLocaleString("en-PK");
}

export default async function StockValueReportPage({
  searchParams,
}: {
  searchParams: Promise<{ warehouse?: string; category?: string }>;
}) {
  const params = await searchParams;
  const supabase = createClient();

  // Warehouses
  const { data: warehouses } = await supabase
    .from("warehouses")
    .select("id, name")
    .order("name");

  // All categories
  const { data: categories } = await supabase
    .from("categories")
    .select("id, name, parent_category_id")
    .order("name");

  const warehouseId = params.warehouse ?? "";
  const categoryId = params.category ?? "";

  // Inventory with product + category + warehouse
  let invQ = (supabase as any)
    .from("inventory")
    .select("product_id, quantity_on_hand, warehouse_id, products(name, pack_size, purchase_price, selling_price, category_id, categories(id, name, parent_category_id)), warehouses(name)")
    .gt("quantity_on_hand", 0);
  if (warehouseId) invQ = invQ.eq("warehouse_id", warehouseId);
  const { data: inventoryRows } = await invQ;

  // Resolve root category name for a given category_id
  const catMap = new Map<string, { id: string; name: string; parent_category_id: string | null }>();
  (categories ?? []).forEach((c: any) => catMap.set(c.id, c));

  function getRootCategoryName(catId: string | null): string {
    if (!catId) return "Uncategorized";
    let cur = catMap.get(catId);
    const visited = new Set<string>();
    while (cur && !visited.has(cur.id)) {
      visited.add(cur.id);
      if (!cur.parent_category_id) return cur.name;
      cur = catMap.get(cur.parent_category_id);
    }
    return catMap.get(catId)?.name ?? "Uncategorized";
  }

  function getCategoryName(catId: string | null): string {
    if (!catId) return "Uncategorized";
    return catMap.get(catId)?.name ?? "Uncategorized";
  }

  // Filter by category subtree
  function isInCategory(productCatId: string | null, filterCatId: string): boolean {
    if (!productCatId) return false;
    let cur = catMap.get(productCatId);
    const visited = new Set<string>();
    while (cur && !visited.has(cur.id)) {
      if (cur.id === filterCatId) return true;
      visited.add(cur.id);
      if (!cur.parent_category_id) break;
      cur = catMap.get(cur.parent_category_id);
    }
    return false;
  }

  // Build product rows
  type ProductRow = {
    product_id: string;
    name: string;
    pack_size: string | null;
    category: string;
    root_category: string;
    total_qty: number;
    purchase_value: number;
    sale_value: number;
    location: string;
  };

  const productMap = new Map<string, ProductRow>();
  (inventoryRows ?? []).forEach((row: any) => {
    const p = row.products;
    const wh = row.warehouses;
    if (!p) return;
    const catId = p.category_id ?? null;
    if (categoryId && !isInCategory(catId, categoryId)) return;
    const qty = Number(row.quantity_on_hand ?? 0);
    const purchaseRate = Number(p.purchase_price ?? 0);
    const saleRate = Number(p.selling_price ?? 0);
    const location = wh?.name ?? "—";
    const key = row.product_id;
    if (productMap.has(key)) {
      const e = productMap.get(key)!;
      e.total_qty += qty;
      e.purchase_value += qty * purchaseRate;
      e.sale_value += qty * saleRate;
    } else {
      productMap.set(key, {
        product_id: key,
        name: p.name,
        pack_size: p.pack_size,
        category: getCategoryName(catId),
        root_category: getRootCategoryName(catId),
        total_qty: qty,
        purchase_value: qty * purchaseRate,
        sale_value: qty * saleRate,
        location,
      });
    }
  });

  const productRows = Array.from(productMap.values()).sort((a, b) => b.purchase_value - a.purchase_value);

  // Category-wise summary
  const categoryGroupMap = new Map<string, { name: string; qty: number; purchase_value: number; sale_value: number; products: number }>();
  productRows.forEach((r) => {
    const key = r.root_category;
    const cur = categoryGroupMap.get(key) ?? { name: key, qty: 0, purchase_value: 0, sale_value: 0, products: 0 };
    cur.qty += r.total_qty;
    cur.purchase_value += r.purchase_value;
    cur.sale_value += r.sale_value;
    cur.products += 1;
    categoryGroupMap.set(key, cur);
  });
  const categoryRows = Array.from(categoryGroupMap.values()).sort((a, b) => b.purchase_value - a.purchase_value);

  // Warehouse-wise summary
  const warehouseMap = new Map<string, { name: string; qty: number; purchase_value: number; sale_value: number }>();
  (inventoryRows ?? []).forEach((row: any) => {
    const wh = row.warehouses;
    const p = row.products;
    if (!wh || !p) return;
    const catId = p.category_id ?? null;
    if (categoryId && !isInCategory(catId, categoryId)) return;
    const qty = Number(row.quantity_on_hand ?? 0);
    const cur = warehouseMap.get(row.warehouse_id) ?? { name: wh.name, qty: 0, purchase_value: 0, sale_value: 0 };
    cur.qty += qty;
    cur.purchase_value += qty * Number(p.purchase_price ?? 0);
    cur.sale_value += qty * Number(p.selling_price ?? 0);
    warehouseMap.set(row.warehouse_id, cur);
  });
  const warehouseRows = Array.from(warehouseMap.values()).sort((a, b) => b.purchase_value - a.purchase_value);

  // Purchase total — received GRNs se actual kharida
  let purchaseQ = (supabase as any)
    .from("purchase_items")
    .select("line_total, product_id, purchases!inner(status, warehouse_id)")
    .or("status.eq.received,status.eq.approved,status.eq.verified", { referencedTable: "purchases" });
  const { data: purchaseItems } = await purchaseQ;

  const totalPurchaseValue = (purchaseItems ?? []).reduce((s: number, r: any) => {
    if (warehouseId && r.purchases?.warehouse_id !== warehouseId) return s;
    if (categoryId) {
      const row = inventoryRows?.find((i: any) => i.product_id === r.product_id);
      const catId = row?.products?.category_id ?? null;
      if (!isInCategory(catId, categoryId)) return s;
    }
    return s + Number(r.line_total ?? 0);
  }, 0);

  // Sales total — confirmed sale orders se
  let salesQ = (supabase as any)
    .from("sale_order_items")
    .select("line_total, product_id, sale_orders!inner(status, warehouse_id)")
    .or("status.eq.confirmed,status.eq.delivered,status.eq.completed", { referencedTable: "sale_orders" });
  const { data: saleItems } = await salesQ;

  const totalSalesValue = (saleItems ?? []).reduce((s: number, r: any) => {
    if (warehouseId && r.sale_orders?.warehouse_id !== warehouseId) return s;
    if (categoryId) {
      const row = inventoryRows?.find((i: any) => i.product_id === r.product_id);
      const catId = row?.products?.category_id ?? null;
      if (!isInCategory(catId, categoryId)) return s;
    }
    return s + Number(r.line_total ?? 0);
  }, 0);

  const totalCurrentPurchaseValue = productRows.reduce((s, r) => s + r.purchase_value, 0);
  const totalCurrentSaleValue = productRows.reduce((s, r) => s + r.sale_value, 0);
  const totalQty = productRows.reduce((s, r) => s + r.total_qty, 0);

  // Root categories for filter (only ones that have stock)
  const activeRootCats = Array.from(new Set(productRows.map((r) => r.root_category)));

  return (
    <div className="space-y-6 pb-10">
      <PageHeader
        title="Stock Value Report"
        description="Category, warehouse aur product ke mutabiq — cost value aur sale value dono"
      />

      {/* Filters */}
      <form method="GET" className="flex flex-wrap items-end gap-3 px-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-surface-600 dark:text-surface-300">Warehouse</label>
          <select
            name="warehouse"
            defaultValue={warehouseId}
            className="h-9 rounded-lg border border-surface-200 bg-white px-3 text-sm text-surface-700 focus:border-brand-500 focus:outline-none dark:border-surface-700 dark:bg-surface-900 dark:text-surface-200"
          >
            <option value="">Sab warehouses</option>
            {(warehouses ?? []).map((w: any) => (
              <option key={w.id} value={w.id}>{w.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-surface-600 dark:text-surface-300">Category</label>
          <select
            name="category"
            defaultValue={categoryId}
            className="h-9 rounded-lg border border-surface-200 bg-white px-3 text-sm text-surface-700 focus:border-brand-500 focus:outline-none dark:border-surface-700 dark:bg-surface-900 dark:text-surface-200"
          >
            <option value="">Sab categories</option>
            {(categories ?? []).map((c: any) => (
              <option key={c.id} value={c.id}>
                {c.parent_category_id ? "  └ " : ""}{c.name}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" className="h-9 rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700">
          Filter
        </button>
        {(warehouseId || categoryId) && (
          <a href="/admin/reports/stock-value" className="flex h-9 items-center rounded-lg border border-surface-200 px-4 text-sm text-surface-600 hover:bg-surface-50 dark:border-surface-700 dark:text-surface-400">
            Reset
          </a>
        )}
      </form>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-4 px-4 sm:grid-cols-5">
        <div className="rounded-2xl border border-surface-200 bg-white p-4 shadow-sm dark:border-surface-800 dark:bg-surface-900">
          <div className="mb-1 flex items-center gap-2 text-xs font-medium text-surface-500">
            <TrendingUp className="h-3.5 w-3.5 text-brand-500" /> Total Kharida
          </div>
          <p className="font-display text-xl font-bold text-surface-900 dark:text-white">{fmt(totalPurchaseValue)}</p>
          <p className="mt-0.5 text-[11px] text-surface-400">Received bills se</p>
        </div>
        <div className="rounded-2xl border border-surface-200 bg-white p-4 shadow-sm dark:border-surface-800 dark:bg-surface-900">
          <div className="mb-1 flex items-center gap-2 text-xs font-medium text-surface-500">
            <Boxes className="h-3.5 w-3.5 text-purple-500" /> Baqi Stock (Cost)
          </div>
          <p className="font-display text-xl font-bold text-surface-900 dark:text-white">{fmt(totalCurrentPurchaseValue)}</p>
          <p className="mt-0.5 text-[11px] text-surface-400">Purchase rate × qty</p>
        </div>
        <div className="rounded-2xl border border-surface-200 bg-white p-4 shadow-sm dark:border-surface-800 dark:bg-surface-900">
          <div className="mb-1 flex items-center gap-2 text-xs font-medium text-surface-500">
            <ArrowDownCircle className="h-3.5 w-3.5 text-emerald-500" /> Baqi Stock (Sale)
          </div>
          <p className="font-display text-xl font-bold text-emerald-700 dark:text-emerald-400">{fmt(totalCurrentSaleValue)}</p>
          <p className="mt-0.5 text-[11px] text-surface-400">Sale rate × qty</p>
        </div>
        <div className="rounded-2xl border border-surface-200 bg-white p-4 shadow-sm dark:border-surface-800 dark:bg-surface-900">
          <div className="mb-1 flex items-center gap-2 text-xs font-medium text-surface-500">
            <ShoppingCart className="h-3.5 w-3.5 text-orange-500" /> Kitna Bika
          </div>
          <p className="font-display text-xl font-bold text-orange-600 dark:text-orange-400">{fmt(totalSalesValue)}</p>
          <p className="mt-0.5 text-[11px] text-surface-400">Confirmed orders se</p>
        </div>
        <div className="rounded-2xl border border-surface-200 bg-white p-4 shadow-sm dark:border-surface-800 dark:bg-surface-900">
          <div className="mb-1 flex items-center gap-2 text-xs font-medium text-surface-500">
            <PackageOpen className="h-3.5 w-3.5 text-blue-500" /> Products
          </div>
          <p className="font-display text-xl font-bold text-surface-900 dark:text-white">{productRows.length}</p>
          <p className="mt-0.5 text-[11px] text-surface-400">{Math.round(totalQty).toLocaleString()} total qty</p>
        </div>
      </div>

      {/* Category-wise Summary */}
      <div className="px-4">
        <div className="rounded-2xl border border-surface-200 bg-white shadow-sm dark:border-surface-800 dark:bg-surface-900">
          <div className="border-b border-surface-100 px-4 py-3 dark:border-surface-800">
            <h2 className="flex items-center gap-2 font-display text-sm font-semibold text-surface-900 dark:text-white">
              <Tag className="h-4 w-4 text-brand-500" /> Category ke mutabiq stock value
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-100 bg-surface-50 text-left text-xs text-surface-500 dark:border-surface-800 dark:bg-surface-800">
                  <th className="px-4 py-2.5 font-medium">Category</th>
                  <th className="px-4 py-2.5 text-right font-medium">Products</th>
                  <th className="px-4 py-2.5 text-right font-medium">Total Qty</th>
                  <th className="px-4 py-2.5 text-right font-medium">Cost Value</th>
                  <th className="px-4 py-2.5 text-right font-medium">Sale Value</th>
                  <th className="px-4 py-2.5 text-right font-medium">% of Total</th>
                </tr>
              </thead>
              <tbody>
                {categoryRows.map((c, i) => (
                  <tr key={i} className="border-b border-surface-50 last:border-0 hover:bg-surface-50/50 dark:border-surface-800">
                    <td className="px-4 py-3 font-semibold text-surface-800 dark:text-surface-200">
                      <div className="flex items-center gap-2">
                        {c.name}
                        {c.name === "Uncategorized" && (
                          <Link
                            href="/admin/products?filter=no-category"
                            className="inline-flex items-center gap-1 rounded-md bg-red-100 px-2 py-0.5 text-[11px] font-semibold text-red-700 hover:bg-red-200 dark:bg-red-950/40 dark:text-red-400 dark:hover:bg-red-900/50"
                          >
                            <Wrench className="h-3 w-3" /> Fix
                          </Link>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-surface-500">{c.products}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-surface-600">{Math.round(c.qty).toLocaleString()}</td>
                    <td className="px-4 py-3 text-right tabular-nums font-semibold text-surface-900 dark:text-white">{fmt(c.purchase_value)}</td>
                    <td className="px-4 py-3 text-right tabular-nums font-semibold text-emerald-700 dark:text-emerald-400">{fmt(c.sale_value)}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-surface-500">
                      {totalCurrentPurchaseValue > 0 ? Math.round((c.purchase_value / totalCurrentPurchaseValue) * 100) : 0}%
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-surface-200 bg-surface-50 dark:border-surface-700 dark:bg-surface-800">
                  <td className="px-4 py-3 text-xs font-bold text-surface-700 dark:text-surface-300">Total</td>
                  <td className="px-4 py-3 text-right tabular-nums text-xs font-bold text-surface-700">{productRows.length}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-xs font-bold text-surface-700">{Math.round(totalQty).toLocaleString()}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-xs font-bold text-surface-900 dark:text-white">{fmt(totalCurrentPurchaseValue)}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-xs font-bold text-emerald-700 dark:text-emerald-400">{fmt(totalCurrentSaleValue)}</td>
                  <td className="px-4 py-3 text-right text-xs font-bold text-surface-700">100%</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>

      {/* Warehouse summary (only if multiple warehouses) */}
      {warehouseRows.length > 1 && (
        <div className="px-4">
          <div className="rounded-2xl border border-surface-200 bg-white shadow-sm dark:border-surface-800 dark:bg-surface-900">
            <div className="border-b border-surface-100 px-4 py-3 dark:border-surface-800">
              <h2 className="font-display text-sm font-semibold text-surface-900 dark:text-white">Warehouse ke mutabiq</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-surface-100 bg-surface-50 text-left text-xs text-surface-500 dark:border-surface-800 dark:bg-surface-800">
                    <th className="px-4 py-2.5 font-medium">Warehouse</th>
                    <th className="px-4 py-2.5 text-right font-medium">Qty</th>
                    <th className="px-4 py-2.5 text-right font-medium">Cost Value</th>
                    <th className="px-4 py-2.5 text-right font-medium">Sale Value</th>
                  </tr>
                </thead>
                <tbody>
                  {warehouseRows.map((w, i) => (
                    <tr key={i} className="border-b border-surface-50 last:border-0 dark:border-surface-800">
                      <td className="px-4 py-3 font-medium text-surface-800 dark:text-surface-200">{w.name}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-surface-600">{Math.round(w.qty).toLocaleString()}</td>
                      <td className="px-4 py-3 text-right tabular-nums font-semibold text-surface-900 dark:text-white">{fmt(w.purchase_value)}</td>
                      <td className="px-4 py-3 text-right tabular-nums font-semibold text-emerald-700 dark:text-emerald-400">{fmt(w.sale_value)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Product-wise Table */}
      <div className="px-4">
        <div className="rounded-2xl border border-surface-200 bg-white shadow-sm dark:border-surface-800 dark:bg-surface-900">
          <div className="border-b border-surface-100 px-4 py-3 dark:border-surface-800">
            <h2 className="font-display text-sm font-semibold text-surface-900 dark:text-white">
              Product-wise detail ({productRows.length} products)
            </h2>
          </div>
          {productRows.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-surface-400">Koi stock nahi mila.</p>
          ) : (
            <div className="max-h-[60vh] overflow-x-auto overflow-y-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="sticky top-0 z-10 border-b border-surface-100 bg-surface-50 text-left text-xs text-surface-500 dark:border-surface-800 dark:bg-surface-800">
                    <th className="px-4 py-2.5 font-medium">#</th>
                    <th className="px-4 py-2.5 font-medium">Product</th>
                    <th className="px-4 py-2.5 font-medium">Category</th>
                    <th className="px-4 py-2.5 text-right font-medium">Qty</th>
                    <th className="px-4 py-2.5 text-right font-medium">Cost Value</th>
                    <th className="px-4 py-2.5 text-right font-medium">Sale Value</th>
                    <th className="px-4 py-2.5 font-medium">Location</th>
                  </tr>
                </thead>
                <tbody>
                  {productRows.map((r, i) => (
                    <tr key={r.product_id} className="border-b border-surface-50 last:border-0 hover:bg-surface-50/50 dark:border-surface-800 dark:hover:bg-surface-800/50">
                      <td className="px-4 py-3 text-xs text-surface-400">{i + 1}</td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-surface-900 dark:text-white">{r.name}</p>
                        {r.pack_size && <p className="text-[11px] text-surface-400">{r.pack_size}</p>}
                      </td>
                      <td className="px-4 py-3 text-xs text-surface-500">{r.category}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-surface-700 dark:text-surface-300">
                        {r.total_qty % 1 === 0 ? r.total_qty.toLocaleString() : r.total_qty.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums font-semibold text-surface-900 dark:text-white">
                        {fmt(r.purchase_value)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums font-semibold text-emerald-700 dark:text-emerald-400">
                        {fmt(r.sale_value)}
                      </td>
                      <td className="px-4 py-3 text-xs text-surface-500">{r.location}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-surface-200 bg-surface-50 dark:border-surface-700 dark:bg-surface-800">
                    <td colSpan={3} className="px-4 py-3 text-xs font-bold text-surface-700 dark:text-surface-300">TOTAL</td>
                    <td className="px-4 py-3 text-right tabular-nums text-xs font-bold text-surface-700 dark:text-surface-300">
                      {Math.round(totalQty).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-sm font-bold text-surface-900 dark:text-white">
                      {fmt(totalCurrentPurchaseValue)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-sm font-bold text-emerald-700 dark:text-emerald-400">
                      {fmt(totalCurrentSaleValue)}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
