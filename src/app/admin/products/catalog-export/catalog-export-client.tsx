"use client";
import { useState, useMemo } from "react";
import { Printer, Download, Mail, MessageCircle } from "lucide-react";
import { t } from "@/lib/i18n/translations";
import { useLang } from "@/lib/i18n/lang-context";

interface Product {
  id: string;
  name: string;
  category: string | null;
  brand: string | null;
  pack_size: string | null;
  purchase_price: number | null;
  selling_price: number | null;
  mrp_price: number | null;
  unit: string | null;
  barcode: string | null;
  manufacture_date: string | null;
  expiry_date: string | null;
}

interface Category {
  id: string;
  name: string;
}

const FIELD_OPTIONS: { key: keyof Product; label: string }[] = [
  { key: "category", label: "Category" },
  { key: "brand", label: "Brand" },
  { key: "pack_size", label: "Pack Size" },
  { key: "purchase_price", label: "Purchase Rate" },
  { key: "selling_price", label: "Selling Rate" },
  { key: "mrp_price", label: "MRP" },
  { key: "unit", label: "Unit" },
  { key: "barcode", label: "Barcode" },
  { key: "manufacture_date", label: "Manufacturing Date" },
  { key: "expiry_date", label: "Expiry Date" },
];

export function CatalogExportClient({ products, categories }: { products: Product[]; categories: Category[] }) {
  const [categoryFilter, setCategoryFilter] = useState("");
  const lang = useLang();
  const [selectedFields, setSelectedFields] = useState<string[]>(["category", "selling_price"]);
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    let list = products;
    if (categoryFilter) list = list.filter((p) => p.category === categoryFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((p) => p.name.toLowerCase().includes(q));
    }
    return list;
  }, [products, categoryFilter, search]);

  function toggleField(key: string) {
    setSelectedFields((prev) => (prev.includes(key) ? prev.filter((f) => f !== key) : [...prev, key]));
  }

  function formatValue(p: Product, key: keyof Product): string {
    const value = p[key];
    if (value === null || value === undefined) return "-";
    if (key === "purchase_price" || key === "selling_price" || key === "mrp_price") return `Rs ${Number(value).toLocaleString()}`;
    if (key === "manufacture_date" || key === "expiry_date") return new Date(value as string).toLocaleDateString();
    return String(value);
  }

  function buildCsv(): string {
    const headers = ["Product Name", ...FIELD_OPTIONS.filter((f) => selectedFields.includes(f.key)).map((f) => f.label)];
    const rows = filtered.map((p) => [
      p.name,
      ...FIELD_OPTIONS.filter((f) => selectedFields.includes(f.key)).map((f) => formatValue(p, f.key)),
    ]);
    return [headers.join(","), ...rows.map((r) => r.map((c) => `"${c}"`).join(","))].join("\n");
  }

  function buildText(): string {
    const lines = [
      `Product Catalog${categoryFilter ? ` - ${categoryFilter}` : ""}`,
      `Total Products: ${filtered.length}`,
      "",
      ...filtered.map((p) => {
        const details = FIELD_OPTIONS.filter((f) => selectedFields.includes(f.key)).map((f) => `${f.label}: ${formatValue(p, f.key)}`).join(", ");
        return `${p.name} - ${details}`;
      }),
    ];
    return lines.join("\n");
  }

  function handlePrint() {
    window.print();
  }
  function handleDownload() {
    const blob = new Blob([buildCsv()], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `product-catalog${categoryFilter ? `-${categoryFilter}` : ""}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }
  function handleWhatsApp() {
    window.open(`https://wa.me/?text=${encodeURIComponent(buildText())}`, "_blank");
  }
  function handleEmail() {
    window.location.href = `mailto:?subject=${encodeURIComponent("Product Catalog")}&body=${encodeURIComponent(buildText())}`;
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2 print:hidden">
        <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="rounded-lg border border-surface-200 p-2 text-sm">
          <option value="">{t("pd_all_categories", lang)}</option>
          {categories.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
        </select>
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("pd_search_short", lang)} className="rounded-lg border border-surface-200 p-2 text-sm" />
        <div className="ml-auto flex gap-2">
          <button onClick={handlePrint} className="rounded-lg border border-surface-200 p-2 text-surface-600 hover:bg-surface-50"><Printer className="h-4 w-4" /></button>
          <button onClick={handleDownload} className="rounded-lg border border-surface-200 p-2 text-surface-600 hover:bg-surface-50"><Download className="h-4 w-4" /></button>
          <button onClick={handleWhatsApp} className="rounded-lg border border-green-200 bg-green-50 p-2 text-green-700 hover:bg-green-100"><MessageCircle className="h-4 w-4" /></button>
          <button onClick={handleEmail} className="rounded-lg border border-surface-200 p-2 text-surface-600 hover:bg-surface-50"><Mail className="h-4 w-4" /></button>
        </div>
      </div>

      <div className="mb-4 rounded-card border border-surface-200 bg-white p-3 shadow-card print:hidden dark:border-surface-800 dark:bg-surface-900">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-surface-400">{t("pd_select_fields", lang)}</p>
        <div className="flex flex-wrap gap-3">
          {FIELD_OPTIONS.map((f) => (
            <label key={f.key} className="flex items-center gap-1.5 text-sm text-surface-600 dark:text-surface-300">
              <input type="checkbox" checked={selectedFields.includes(f.key)} onChange={() => toggleField(f.key)} />
              {f.label}
            </label>
          ))}
        </div>
      </div>

      <div className="rounded-card border border-surface-200 bg-white shadow-card dark:border-surface-800 dark:bg-surface-900">
        <div className="border-b border-surface-100 p-4 dark:border-surface-800">
          <h2 className="font-display text-base font-semibold text-surface-900 dark:text-white">
            {categoryFilter || "Sab Products"} <span className="text-sm font-normal text-surface-400">({filtered.length} products)</span>
          </h2>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-surface-100 text-left dark:border-surface-800">
              <th className="px-3 py-2 font-medium text-surface-500">{t("c_product", lang)}</th>
              {FIELD_OPTIONS.filter((f) => selectedFields.includes(f.key)).map((f) => (
                <th key={f.key} className="px-3 py-2 font-medium text-surface-500">{f.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => (
              <tr key={p.id} className="border-b border-surface-50 last:border-0 dark:border-surface-800">
                <td className="px-3 py-2 font-medium text-surface-800 dark:text-surface-200">{p.name}</td>
                {FIELD_OPTIONS.filter((f) => selectedFields.includes(f.key)).map((f) => (
                  <td key={f.key} className="px-3 py-2 text-surface-600 dark:text-surface-400">{formatValue(p, f.key)}</td>
                ))}
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={selectedFields.length + 1} className="px-3 py-8 text-center text-surface-400">{t("c_no_products", lang)}</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}