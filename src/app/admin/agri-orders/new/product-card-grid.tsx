"use client";
import { useState, useMemo } from "react";
import { Search, Minus, Plus, Package, ShoppingCart } from "lucide-react";
import { t } from "@/lib/i18n/translations";
import { useLang } from "@/lib/i18n/lang-context";

interface Product {
  id: string;
  name: string;
  pack_size: string | null;
  selling_price: number;
  purchase_price: number;
  image_url: string | null;
  category_id: string | null;
  category: string | null;
  brand: string | null;
  warehouse_stock: number;
}
interface Category {
  id: string;
  name: string;
}
interface RowState {
  qty: number;
  price: number;
}

export function ProductCardGrid({
  products,
  categories,
  rows,
  onUpdateRow,
}: {
  products: Product[];
  categories: Category[];
  rows: Record<string, RowState>;
  onUpdateRow: (productId: string, field: keyof RowState, value: number, defaultPrice: number) => void;
}) {
  const [categoryFilter, setCategoryFilter] = useState<string>("");
  const lang = useLang();
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("stock_desc");

  const filtered = useMemo(() => {
    let list = products;
    if (categoryFilter) list = list.filter((p) => p.category_id === categoryFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((p) => p.name.toLowerCase().includes(q));
    }
    const sorted = [...list];
    if (sortBy === "name_asc") sorted.sort((a, b) => a.name.localeCompare(b.name));
    if (sortBy === "name_desc") sorted.sort((a, b) => b.name.localeCompare(a.name));
    if (sortBy === "price_asc") sorted.sort((a, b) => a.selling_price - b.selling_price);
    if (sortBy === "price_desc") sorted.sort((a, b) => b.selling_price - a.selling_price);
    if (sortBy === "stock_asc") sorted.sort((a, b) => a.warehouse_stock - b.warehouse_stock);
    if (sortBy === "stock_desc") {
      sorted.sort((a, b) => {
        if (a.warehouse_stock <= 0 && b.warehouse_stock > 0) return 1;
        if (a.warehouse_stock > 0 && b.warehouse_stock <= 0) return -1;
        return b.warehouse_stock - a.warehouse_stock;
      });
    }
    return sorted;
  }, [products, categoryFilter, search, sortBy]);

  const activeCount = Object.values(rows).filter((r) => r.qty > 0).length;

  function clampQty(desired: number, stock: number) {
    if (stock <= 0) return 0;
    return Math.max(0, Math.min(desired, stock));
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="pointer-events-none absolute right-3 top-2.5 h-4 w-4 text-surface-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("c_search_product", lang)}
            className="w-full rounded-lg border border-surface-200 p-2 pr-9 text-sm"
          />
        </div>
        <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="rounded-lg border border-surface-200 p-2 text-sm">
          <option value="stock_desc">{t("ao_sort_stock_first", lang)}</option>
          <option value="name_asc">{t("ao_sort_az", lang)}</option>
          <option value="name_desc">{t("ao_sort_za", lang)}</option>
          <option value="price_asc">{t("ao_sort_price_low", lang)}</option>
          <option value="price_desc">{t("ao_sort_price_high", lang)}</option>
          <option value="stock_asc">{t("ao_sort_stock_low", lang)}</option>
        </select>
        {activeCount > 0 && (
          <span className="flex items-center gap-1 rounded-full bg-brand-100 px-3 py-1.5 text-xs font-medium text-brand-700">
            <ShoppingCart className="h-3.5 w-3.5" /> {activeCount} products selected
          </span>
        )}
      </div>
      <div className="mb-4 flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => setCategoryFilter("")}
          className={`rounded-full px-3 py-1.5 text-xs font-medium ${categoryFilter === "" ? "bg-brand-600 text-white" : "bg-surface-100 text-surface-600 hover:bg-surface-200"}`}
        >
          Sab
        </button>
        {categories.map((c) => (
          <button
            type="button"
            key={c.id}
            onClick={() => setCategoryFilter(c.id)}
            className={`rounded-full px-3 py-1.5 text-xs font-medium ${categoryFilter === c.id ? "bg-brand-600 text-white" : "bg-surface-100 text-surface-600 hover:bg-surface-200"}`}
          >
            {c.name}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {filtered.map((p) => {
          const row = rows[p.id];
          const qty = row?.qty ?? 0;
          const price = row?.price ?? p.selling_price;
          const isActive = qty > 0;
          const outOfStock = p.warehouse_stock <= 0;
          const stockStatus = outOfStock ? "out" : p.warehouse_stock < 10 ? "low" : "ok";
          return (
            <div
              key={p.id}
              className={`rounded-card border p-3 shadow-card transition ${
                outOfStock
                  ? "border-surface-100 bg-surface-50 opacity-60 dark:border-surface-800 dark:bg-surface-900/50"
                  : isActive
                    ? "border-brand-400 bg-brand-50/50 dark:bg-brand-900/10"
                    : "border-surface-200 bg-white dark:border-surface-800 dark:bg-surface-900"
              }`}
            >
              <div className="mb-2 flex h-24 items-center justify-center overflow-hidden rounded-lg bg-surface-50 dark:bg-surface-800">
                {p.image_url ? (
                  <img src={p.image_url} alt={p.name} className="h-full w-full object-contain" />
                ) : (
                  <Package className="h-10 w-10 text-surface-300" />
                )}
              </div>
              <p className="line-clamp-2 text-sm font-semibold text-surface-900 dark:text-white">{p.name}</p>
              <p className="text-xs text-surface-400">{p.pack_size ?? ""} {p.brand ? `- ${p.brand}` : ""}</p>
              <div className="mt-1.5 space-y-0.5 text-xs">
                <p className="flex justify-between"><span className="text-surface-400">{t("ao_rate_label", lang)}</span> <span className="font-semibold text-brand-600">Rs {p.selling_price.toLocaleString()}</span></p>
                <p className="flex justify-between"><span className="text-surface-400">{t("ao_purchase_label", lang)}</span> <span className="text-surface-500">Rs {p.purchase_price.toLocaleString()}</span></p>
              </div>
              <div className="mt-1.5 flex items-center justify-between text-xs">
                <span className="text-surface-400">{t("ao_warehouse_label", lang)}</span>
                <span className={`font-medium ${stockStatus === "out" ? "text-red-600" : stockStatus === "low" ? "text-amber-600" : "text-green-600"}`}>
                  {p.warehouse_stock} {stockStatus === "out" ? "(Khatam)" : stockStatus === "low" ? "(Kam)" : ""}
                </span>
              </div>
              {outOfStock ? (
                <div className="mt-2 rounded-lg bg-red-50 py-1.5 text-center text-xs font-medium text-red-600 dark:bg-red-950/30">
                  Stock Khatam - Order Nahi Ho Sakta
                </div>
              ) : (
                <>
                  <div className="mt-2 flex items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => onUpdateRow(p.id, "qty", clampQty(qty - 1, p.warehouse_stock), p.selling_price)}
                      className="flex h-7 w-7 items-center justify-center rounded-lg border border-surface-200 text-surface-600 hover:bg-surface-50"
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </button>
                    <input
                      type="number"
                      value={qty || ""}
                      max={p.warehouse_stock}
                      onChange={(e) => onUpdateRow(p.id, "qty", clampQty(Number(e.target.value), p.warehouse_stock), p.selling_price)}
                      placeholder="0"
                      className="w-14 rounded-lg border border-surface-200 p-1 text-center text-sm font-semibold"
                    />
                    <button
                      type="button"
                      onClick={() => onUpdateRow(p.id, "qty", clampQty(qty + 1, p.warehouse_stock), p.selling_price)}
                      className="flex h-7 w-7 items-center justify-center rounded-lg border border-surface-200 text-surface-600 hover:bg-surface-50"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  {qty >= p.warehouse_stock && qty > 0 && (
                    <p className="mt-1 text-center text-[10px] text-amber-600">{t("ao_all_stock_selected", lang)}</p>
                  )}
                  {isActive && (
                    <button
                      type="button"
                      onClick={() => onUpdateRow(p.id, "qty", 0, p.selling_price)}
                      className="mt-2 w-full rounded-lg bg-brand-600 py-1.5 text-xs font-medium text-white hover:bg-red-600"
                    >
                      Order Se Hatayein
                    </button>
                  )}
                </>
              )}
            </div>
          );
        })}
        {filtered.length === 0 && (
          <p className="col-span-full py-8 text-center text-sm text-surface-400">{t("c_no_products", lang)}</p>
        )}
      </div>
    </div>
  );
}