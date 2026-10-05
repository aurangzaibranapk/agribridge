import Link from "next/link";
import { ArrowLeft, CheckCircle2, Search, TriangleAlert } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, Card, EmptyState } from "@/components/ui/layout-primitives";

export const dynamic = "force-dynamic";

type Params = Promise<{ scope?: string; warehouse?: string; category?: string; view?: string; q?: string }>;

const money = (n: number) => `Rs. ${Math.round(n).toLocaleString("en-PK")}`;

export default async function StockReconciliationPage({ searchParams }: { searchParams: Params }) {
  const params = await searchParams;
  const db = createClient();
  const scope = params.scope === "karyana" ? "karyana" : "all";
  const warehouseFilter = params.warehouse ?? "";
  const categoryFilter = params.category ?? "";
  const showAll = params.view === "all";
  const search = (params.q ?? "").trim().toLowerCase();

  const [{ data: warehouses }, { data: shops }, { data: categories }, { data: allCategories }] = await Promise.all([
    db.from("warehouses").select("id, name, shop_id, branch_id").eq("is_active", true).order("name"),
    db.from("shops").select("id, name, business_type").eq("is_active", true).order("name"),
    db.from("categories").select("id, name, parent_category_id").order("name"),
    db.from("categories").select("id, name, parent_category_id").order("name"),
  ]);

  const warehouseIds = warehouseFilter ? [warehouseFilter] : (warehouses ?? []).map((w: any) => w.id);
  const [{ data: inventory }, { data: batches }, { data: products }] = await Promise.all([
    warehouseIds.length ? db.from("inventory").select("product_id, warehouse_id, quantity_on_hand").in("warehouse_id", warehouseIds) : Promise.resolve({ data: [] as any[] }),
    warehouseIds.length ? db.from("stock_batches").select("product_id, warehouse_id, remaining_quantity, unit_cost").in("warehouse_id", warehouseIds) : Promise.resolve({ data: [] as any[] }),
    db.from("products").select("id, name, pack_size, purchase_price, category_id").eq("is_deleted", false),
  ]);

  const categoryMap = new Map((allCategories ?? []).map((c: any) => [c.id, c]));
  const warehouseMap = new Map((warehouses ?? []).map((w: any) => [w.id, w]));
  const shopMap = new Map((shops ?? []).map((s: any) => [s.id, s]));
  const productMap = new Map((products ?? []).map((p: any) => [p.id, p]));

  function rootCategory(categoryId: string | null) {
    let current = categoryId ? categoryMap.get(categoryId) : null;
    const visited = new Set<string>();
    while (current && !visited.has(current.id)) {
      visited.add(current.id);
      if (!current.parent_category_id) return current.name;
      current = categoryMap.get(current.parent_category_id);
    }
    return "Uncategorized";
  }

  function inCategory(categoryId: string | null) {
    if (!categoryFilter) return true;
    let current = categoryId ? categoryMap.get(categoryId) : null;
    const visited = new Set<string>();
    while (current && !visited.has(current.id)) {
      if (current.id === categoryFilter) return true;
      visited.add(current.id);
      current = current.parent_category_id ? categoryMap.get(current.parent_category_id) : null;
    }
    return false;
  }

  function isKaryana(warehouseId: string, categoryId: string | null) {
    const warehouse = warehouseMap.get(warehouseId);
    const shop = warehouse?.shop_id ? shopMap.get(warehouse.shop_id) : null;
    const shopType = String(shop?.business_type ?? "").toLowerCase();
    const root = rootCategory(categoryId).toLowerCase();
    return shopType.includes("karyana") || shopType.includes("retail") || root.includes("karyana") || root.includes("grocery");
  }

  const inventoryQty = new Map<string, number>();
  for (const row of inventory ?? []) {
    const key = `${row.product_id}:${row.warehouse_id}`;
    inventoryQty.set(key, (inventoryQty.get(key) ?? 0) + Number(row.quantity_on_hand ?? 0));
  }
  const batchQty = new Map<string, number>();
  const batchValue = new Map<string, number>();
  for (const row of batches ?? []) {
    const key = `${row.product_id}:${row.warehouse_id}`;
    const qty = Number(row.remaining_quantity ?? 0);
    batchQty.set(key, (batchQty.get(key) ?? 0) + qty);
    batchValue.set(key, (batchValue.get(key) ?? 0) + qty * Number(row.unit_cost ?? 0));
  }

  const keys = new Set([...inventoryQty.keys(), ...batchQty.keys()]);
  const rows = [...keys].map((key) => {
    const [productId, warehouseId] = key.split(":");
    const product = productMap.get(productId);
    const inventoryQuantity = inventoryQty.get(key) ?? 0;
    const batchQuantity = batchQty.get(key) ?? 0;
    const difference = inventoryQuantity - batchQuantity;
    const rate = Number(product?.purchase_price ?? 0);
    const warehouse = warehouseMap.get(warehouseId);
    const shop = warehouse?.shop_id ? shopMap.get(warehouse.shop_id) : null;
    return {
      key, productId, productName: product?.name ?? "Unknown product", packSize: product?.pack_size ?? null,
      categoryId: product?.category_id ?? null, category: rootCategory(product?.category_id ?? null), warehouseId,
      warehouseName: warehouse?.name ?? "Unknown warehouse", shopName: shop?.name ?? "HQ / no shop", inventoryQuantity,
      batchQuantity, difference, differenceValue: difference * rate, fifoValue: batchValue.get(key) ?? 0,
    };
  }).filter((row) => inCategory(row.categoryId) && (scope !== "karyana" || isKaryana(row.warehouseId, row.categoryId)))
    .filter((row) => !search || `${row.productName} ${row.packSize ?? ""} ${row.category} ${row.shopName} ${row.warehouseName}`.toLowerCase().includes(search))
    .filter((row) => showAll || Math.abs(row.difference) > 0.0001)
    .sort((a, b) => Math.abs(b.differenceValue) - Math.abs(a.differenceValue) || a.productName.localeCompare(b.productName));

  const allScopedRows = [...keys].map((key) => {
    const [productId, warehouseId] = key.split(":");
    const product = productMap.get(productId);
    const difference = (inventoryQty.get(key) ?? 0) - (batchQty.get(key) ?? 0);
    const warehouse = warehouseMap.get(warehouseId);
    const shop = warehouse?.shop_id ? shopMap.get(warehouse.shop_id) : null;
    return { difference, categoryId: product?.category_id ?? null, warehouseId, shopName: shop?.name ?? "HQ / no shop", rate: Number(product?.purchase_price ?? 0) };
  }).filter((row) => inCategory(row.categoryId) && (scope !== "karyana" || isKaryana(row.warehouseId, row.categoryId)));
  const differenceUnits = allScopedRows.reduce((sum, row) => sum + row.difference, 0);
  const differenceValue = allScopedRows.reduce((sum, row) => sum + row.difference * row.rate, 0);
  const fifoTotal = rows.reduce((sum, row) => sum + row.fifoValue, 0);
  const categoryTotals = new Map<string, { units: number; value: number; lines: number }>();
  for (const row of rows) {
    const current = categoryTotals.get(row.category) ?? { units: 0, value: 0, lines: 0 };
    categoryTotals.set(row.category, { units: current.units + row.difference, value: current.value + row.differenceValue, lines: current.lines + (Math.abs(row.difference) > 0.0001 ? 1 : 0) });
  }
  const query = (extra: Record<string, string>) => {
    const next = new URLSearchParams({ scope, warehouse: warehouseFilter, category: categoryFilter, view: showAll ? "all" : "diff", q: params.q ?? "" });
    Object.entries(extra).forEach(([k, v]) => next.set(k, v));
    [...next.keys()].forEach((k) => { if (!next.get(k)) next.delete(k); });
    return `/admin/reports/stock-reconcile?${next.toString()}`;
  };

  return <div className="space-y-5 pb-10">
    <PageHeader title="Stock Reconciliation Command Center" description="Inventory, FIFO batches aur categories ka farq — Karyana, sab shops aur product-wise ek hi control center." actions={<Link href="/admin/reports/sales" className="inline-flex items-center gap-1 text-sm text-brand-600 hover:underline"><ArrowLeft className="h-4 w-4" /> Sales report</Link>} />

    <Card className="border-brand-200 bg-brand-50 dark:border-surface-800 dark:bg-surface-900">
      <div className="flex flex-wrap gap-2 text-sm">
        <Link href={query({ scope: "all" })} className={`rounded-lg px-3 py-2 font-semibold ${scope === "all" ? "bg-brand-600 text-white" : "bg-white text-surface-700 dark:bg-surface-800 dark:text-surface-200"}`}>Sab shops</Link>
        <Link href={query({ scope: "karyana" })} className={`rounded-lg px-3 py-2 font-semibold ${scope === "karyana" ? "bg-brand-600 text-white" : "bg-white text-surface-700 dark:bg-surface-800 dark:text-surface-200"}`}>Sirf Karyana</Link>
        <Link href={query({ view: "diff" })} className={`rounded-lg px-3 py-2 font-semibold ${!showAll ? "bg-red-600 text-white" : "bg-white text-surface-700 dark:bg-surface-800 dark:text-surface-200"}`}>Sirf farq</Link>
        <Link href={query({ view: "all" })} className={`rounded-lg px-3 py-2 font-semibold ${showAll ? "bg-slate-700 text-white" : "bg-white text-surface-700 dark:bg-surface-800 dark:text-surface-200"}`}>Tamam products</Link>
      </div>
    </Card>

    <form method="get" className="flex flex-wrap items-end gap-3">
      <input type="hidden" name="scope" value={scope} /><input type="hidden" name="view" value={showAll ? "all" : "diff"} />
      <label className="text-xs font-medium text-surface-600">Warehouse / Shop<select name="warehouse" defaultValue={warehouseFilter} className="mt-1 h-10 rounded-lg border border-surface-200 bg-white px-3 text-sm dark:border-surface-700 dark:bg-surface-900"><option value="">Sab locations</option>{(warehouses ?? []).map((w: any) => <option key={w.id} value={w.id}>{w.name}</option>)}</select></label>
      <label className="text-xs font-medium text-surface-600">Category<select name="category" defaultValue={categoryFilter} className="mt-1 h-10 rounded-lg border border-surface-200 bg-white px-3 text-sm dark:border-surface-700 dark:bg-surface-900"><option value="">Sab categories</option>{(categories ?? []).map((c: any) => <option key={c.id} value={c.id}>{c.parent_category_id ? "└ " : ""}{c.name}</option>)}</select></label>
      <label className="min-w-[240px] flex-1 text-xs font-medium text-surface-600">Product search<div className="relative mt-1"><Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-surface-400" /><input name="q" defaultValue={params.q ?? ""} placeholder="Product, category ya shop" className="h-10 w-full rounded-lg border border-surface-200 bg-white pl-9 pr-3 text-sm dark:border-surface-700 dark:bg-surface-900" /></div></label>
      <button className="h-10 rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white">Apply</button>
    </form>

    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      <Card className="p-4"><p className="text-xs text-surface-500">Difference lines</p><p className="mt-1 text-2xl font-bold text-red-700">{rows.filter((r) => Math.abs(r.difference) > 0.0001).length}</p></Card>
      <Card className="p-4"><p className="text-xs text-surface-500">Quantity farq</p><p className="mt-1 text-2xl font-bold">{Math.round(differenceUnits).toLocaleString()}</p></Card>
      <Card className="p-4"><p className="text-xs text-surface-500">Value farq</p><p className="mt-1 text-2xl font-bold text-red-700">{money(differenceValue)}</p></Card>
      <Card className="p-4"><p className="text-xs text-surface-500">FIFO current value</p><p className="mt-1 text-2xl font-bold text-emerald-700">{money(fifoTotal)}</p></Card>
    </div>

    <Card className="p-0 overflow-x-auto"><div className="border-b border-surface-100 px-4 py-3 dark:border-surface-800"><h2 className="font-display text-base font-semibold">Product-wise reconciliation</h2><p className="text-xs text-surface-500">Inventory quantity ko stock_batches FIFO quantity se compare kiya gaya hai.</p></div>{rows.length === 0 ? <EmptyState title="Koi farq nahi mila" description="Selected filter mein inventory aur FIFO batches match kar rahe hain." /> : <table className="w-full min-w-[1050px] text-sm"><thead><tr className="border-b bg-surface-50 text-left text-xs text-surface-500 dark:bg-surface-800"><th className="px-4 py-3">Product</th><th className="px-4 py-3">Category</th><th className="px-4 py-3">Shop / Godam</th><th className="px-4 py-3 text-right">Inventory</th><th className="px-4 py-3 text-right">FIFO batch</th><th className="px-4 py-3 text-right">Farq</th><th className="px-4 py-3 text-right">Value farq</th><th className="px-4 py-3">Detail</th></tr></thead><tbody>{rows.map((row) => <tr key={row.key} className="border-b border-surface-100 last:border-0 dark:border-surface-800"><td className="px-4 py-3 font-semibold">{row.productName}{row.packSize ? <span className="ml-1 text-xs font-normal text-surface-500">({row.packSize})</span> : null}</td><td className="px-4 py-3 text-surface-600">{row.category}</td><td className="px-4 py-3 text-surface-600">{row.shopName}<span className="block text-[11px] text-surface-400">{row.warehouseName}</span></td><td className="px-4 py-3 text-right tabular-nums">{row.inventoryQuantity.toLocaleString()}</td><td className="px-4 py-3 text-right tabular-nums">{row.batchQuantity.toLocaleString()}</td><td className={`px-4 py-3 text-right font-bold tabular-nums ${row.difference > 0 ? "text-red-700" : "text-emerald-700"}`}>{row.difference > 0 ? "+" : ""}{row.difference.toLocaleString()}</td><td className="px-4 py-3 text-right tabular-nums">{money(row.differenceValue)}</td><td className="px-4 py-3"><Link href={`/admin/inventory/product/${row.productId}/statement?warehouse=${row.warehouseId}`} className="text-brand-600 hover:underline">Statement →</Link></td></tr>)}</tbody></table>}</Card>

    <div className="grid gap-4 lg:grid-cols-2"><Card className="p-0 overflow-x-auto"><div className="border-b px-4 py-3"><h2 className="font-display text-base font-semibold">Category-wise farq</h2></div><table className="w-full text-sm"><thead><tr className="border-b bg-surface-50 text-left text-xs text-surface-500"><th className="px-4 py-2">Category</th><th className="px-4 py-2 text-right">Lines</th><th className="px-4 py-2 text-right">Units</th><th className="px-4 py-2 text-right">Value</th></tr></thead><tbody>{[...categoryTotals.entries()].sort((a,b) => Math.abs(b[1].value)-Math.abs(a[1].value)).map(([name, value]) => <tr key={name} className="border-b last:border-0"><td className="px-4 py-2 font-medium">{name}</td><td className="px-4 py-2 text-right">{value.lines}</td><td className="px-4 py-2 text-right">{Math.round(value.units).toLocaleString()}</td><td className="px-4 py-2 text-right font-semibold">{money(value.value)}</td></tr>)}</tbody></table></Card><Card className="border-amber-200 bg-amber-50 p-4 dark:border-surface-800 dark:bg-surface-900"><div className="flex items-start gap-2"><TriangleAlert className="mt-0.5 h-5 w-5 text-amber-600" /><div><h2 className="font-semibold text-amber-900 dark:text-amber-300">Farq ka matlab</h2><p className="mt-2 text-xs leading-relaxed text-amber-800 dark:text-amber-400">Positive farq ka matlab inventory mein quantity FIFO batches se zyada hai; negative farq ka matlab batch record zyada hai. Har row ka Statement khol kar purchase, sale, transfer aur stock-count movement verify karein. Koi automatic data correction nahi ki gayi.</p></div></div></Card></div>
    {rows.length > 0 ? <p className="flex items-center gap-1 text-xs text-amber-700"><TriangleAlert className="h-3.5 w-3.5" /> Pehle audit/statement verify karein; system ne old data ko delete ya adjust nahi kiya.</p> : <p className="flex items-center gap-1 text-xs text-emerald-700"><CheckCircle2 className="h-3.5 w-3.5" /> Selected scope mein reconciliation match hai.</p>}
  </div>;
}
