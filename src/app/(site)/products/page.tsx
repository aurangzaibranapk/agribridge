import Link from "next/link";
import { Package } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { formatCurrency } from "@/lib/utils/format";

export const dynamic = "force-dynamic";

export default async function PublicProductsPage({ searchParams }: { searchParams: { category?: string; company?: string; q?: string } }) {
  const supabase = createClient();

  let query = supabase
    .from("products")
    .select("id, name, pack_size, selling_price, active_ingredient, image_url, company_id, category_id, categories(name), brands(name), companies(name)")
    .eq("is_deleted", false)
    .eq("is_available", true)
    .order("name");

  if (searchParams.q) query = query.ilike("name", `%${searchParams.q}%`);

  const [{ data: products }, { data: categories }, { data: companies }] = await Promise.all([
    query,
    supabase.from("categories").select("id, name").order("name"),
    supabase.from("companies").select("id, name").order("name"),
  ]);

  let filtered = products ?? [];
  if (searchParams.category) filtered = filtered.filter((p: any) => p.categories?.name === searchParams.category);
  if (searchParams.company) filtered = filtered.filter((p: any) => p.companies?.name === searchParams.company);

  // Stock status: sum of on-hand quantity across warehouses per product.
  const ids = filtered.map((p: any) => p.id);
  const stockMap = new Map<string, number>();
  if (ids.length > 0) {
    const { data: inv } = await supabase.from("inventory").select("product_id, quantity_on_hand").in("product_id", ids);
    for (const row of inv ?? []) stockMap.set(row.product_id, (stockMap.get(row.product_id) ?? 0) + row.quantity_on_hand);
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <h1 className="font-display text-3xl font-semibold text-surface-900 dark:text-white">Products</h1>
      <p className="mt-2 text-surface-500 dark:text-surface-400">Seed, fertilizer, and crop protection — updated directly from our inventory.</p>

      <form className="mt-6 flex flex-col gap-3 sm:flex-row">
        <input name="q" defaultValue={searchParams.q} placeholder="Search products..." className="h-10 flex-1 rounded-lg border border-surface-200 bg-white px-3 text-sm dark:border-surface-700 dark:bg-surface-800 dark:text-white" />
        <select name="category" defaultValue={searchParams.category ?? ""} className="h-10 rounded-lg border border-surface-200 bg-white px-3 text-sm dark:border-surface-700 dark:bg-surface-800 dark:text-white">
          <option value="">All Categories</option>
          {(categories ?? []).map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
        </select>
        <select name="company" defaultValue={searchParams.company ?? ""} className="h-10 rounded-lg border border-surface-200 bg-white px-3 text-sm dark:border-surface-700 dark:bg-surface-800 dark:text-white">
          <option value="">All Companies</option>
          {(companies ?? []).map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
        </select>
        <button type="submit" className="h-10 rounded-lg bg-brand-600 px-5 text-sm font-medium text-white hover:bg-brand-700">Filter</button>
      </form>

      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((p: any) => {
          const inStock = (stockMap.get(p.id) ?? 0) > 0;
          return (
            <Link key={p.id} href={`/products/${p.id}`} className="rounded-card border border-surface-200 bg-white p-5 shadow-card transition-shadow hover:shadow-lg dark:border-surface-800 dark:bg-surface-900">
              <div className="mb-3 flex h-28 items-center justify-center overflow-hidden rounded-lg bg-surface-100 dark:bg-surface-800">
                {p.image_url ? <img src={p.image_url} alt={p.name} className="h-full w-full object-cover" /> : <Package className="h-8 w-8 text-surface-300" />}
              </div>
              <div className="mb-1 flex items-center justify-between">
                <p className="font-medium text-surface-900 dark:text-white">{p.name}</p>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${inStock ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"}`}>
                  {inStock ? "In Stock" : "Out of Stock"}
                </span>
              </div>
              <p className="text-xs text-surface-400 dark:text-surface-500">{[p.categories?.name, p.brands?.name].filter(Boolean).join(" — ") || p.pack_size}</p>
              {p.active_ingredient && <p className="mt-1 text-xs text-surface-500 dark:text-surface-400">Active ingredient: {p.active_ingredient}</p>}
              <p className="mt-3 font-display text-lg font-semibold text-brand-700 dark:text-brand-400">{formatCurrency(p.selling_price)}</p>
            </Link>
          );
        })}
        {filtered.length === 0 && <p className="text-surface-400 dark:text-surface-500">No products match your filters.</p>}
      </div>
    </div>
  );
}
