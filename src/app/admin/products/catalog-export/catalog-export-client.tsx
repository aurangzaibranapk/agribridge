"use client";
import { useState, useMemo } from "react";
import { Printer, Download, Mail, MessageCircle, FileText } from "lucide-react";
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
  wholesale_price: number | null;
  mrp_price: number | null;
  unit: string | null;
  barcode: string | null;
  manufacture_date: string | null;
  expiry_date: string | null;
  stock_qty: number | null;
  stock_value_purchase: number | null;
  stock_value_selling: number | null;
  stock_value_wholesale: number | null;
  warehouse_ids: string[];
  /** Kis kis dukan-qism (Karyana/Agri Inputs/Dairy) ka maal hai -- ek se zyada bhi ho sakta hai. */
  shopGroups: string[];
}

interface Category {
  id: string;
  name: string;
}

interface ShopGroup {
  key: string;
  label: string;
}

interface Warehouse {
  id: string;
  name: string;
  shop_id: string | null;
}

interface Shop {
  id: string;
  name: string;
}

const FIELD_OPTIONS: { key: keyof Product; label: string }[] = [
  { key: "category", label: "Category" },
  { key: "brand", label: "Brand" },
  { key: "pack_size", label: "Pack Size" },
  { key: "purchase_price", label: "Purchase Rate" },
  { key: "stock_value_purchase", label: "Stock Value (Trade)" },
  { key: "selling_price", label: "Selling Rate" },
  { key: "stock_value_selling", label: "Stock Value (Sale)" },
  { key: "wholesale_price", label: "Wholesale Rate" },
  { key: "stock_value_wholesale", label: "Stock Value (Wholesale)" },
  { key: "mrp_price", label: "MRP" },
  { key: "stock_qty", label: "Available Stock" },
  { key: "unit", label: "Unit" },
  { key: "barcode", label: "Barcode" },
  { key: "manufacture_date", label: "Manufacturing Date" },
  { key: "expiry_date", label: "Expiry Date" },
];

export function CatalogExportClient({ products, categories, shopGroups, warehouses, shops }: { products: Product[]; categories: Category[]; shopGroups: ShopGroup[]; warehouses: Warehouse[]; shops: Shop[] }) {
  const [categoryFilter, setCategoryFilter] = useState("");
  // Karyana chunte hi uski saari categories (Grocery, Cold/Soft Drink,
  // Dairy Products aur unki har aulaad) ek sath aati hain -- ek-ek
  // category alag se chunne ki zaroorat nahi, aur pesticide/khad wali
  // categories khud-ba-khud bahar rehti hain.
  const [shopGroupFilter, setShopGroupFilter] = useState("");
  const [shopFilter, setShopFilter] = useState("");
  const [warehouseFilter, setWarehouseFilter] = useState("");
  const [dateField, setDateField] = useState<"manufacture_date" | "expiry_date">("expiry_date");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const lang = useLang();
  const [selectedFields, setSelectedFields] = useState<string[]>(["category", "selling_price"]);
  const [search, setSearch] = useState("");
  const [includeCountColumns, setIncludeCountColumns] = useState(false);
  // Ginti sheet ab kaghaz tak mehdood nahi -- yahin screen par bhi
  // "Actual Stock" likha ja sakta hai, aur Farq khud ban jata hai.
  // Malik (11 September): "next bhi yahan stock likhna hai, farq wahan
  // box hona chahiye."
  const [actualStock, setActualStock] = useState<Record<string, string>>({});

  const shopWarehouseIds = useMemo(
    () => shopFilter ? new Set(warehouses.filter((w) => w.shop_id === shopFilter).map((w) => w.id)) : null,
    [shopFilter, warehouses]
  );
  const visibleWarehouses = useMemo(
    () => shopFilter ? warehouses.filter((w) => w.shop_id === shopFilter) : warehouses,
    [shopFilter, warehouses]
  );

  function diffFor(p: Product): number | null {
    const raw = actualStock[p.id];
    if (raw === undefined || raw.trim() === "") return null;
    const n = Number(raw);
    if (!Number.isFinite(n)) return null;
    return n - Number(p.stock_qty ?? 0);
  }

  const filtered = useMemo(() => {
    let list = products;
    if (shopGroupFilter) list = list.filter((p) => p.shopGroups.includes(shopGroupFilter));
    if (categoryFilter) list = list.filter((p) => p.category === categoryFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((p) => p.name.toLowerCase().includes(q));
    }
    if (warehouseFilter) {
      list = list.filter((p) => p.warehouse_ids.includes(warehouseFilter));
    } else if (shopWarehouseIds) {
      list = list.filter((p) => p.warehouse_ids.some((wid) => shopWarehouseIds.has(wid)));
    }
    if (dateFrom || dateTo) {
      list = list.filter((p) => {
        const val = p[dateField];
        if (!val) return false;
        if (dateFrom && val < dateFrom) return false;
        if (dateTo && val > dateTo) return false;
        return true;
      });
    }
    return list;
  }, [products, shopGroupFilter, categoryFilter, search, warehouseFilter, shopWarehouseIds, dateField, dateFrom, dateTo]);

  const stockValueTotals = useMemo(() => ({
    purchase: filtered.reduce((s, p) => s + (p.stock_value_purchase ?? 0), 0),
    selling: filtered.reduce((s, p) => s + (p.stock_value_selling ?? 0), 0),
    wholesale: filtered.reduce((s, p) => s + (p.stock_value_wholesale ?? 0), 0),
  }), [filtered]);

  function toggleField(key: string) {
    setSelectedFields((prev) => (prev.includes(key) ? prev.filter((f) => f !== key) : [...prev, key]));
  }

  function formatValue(p: Product, key: keyof Product): string {
    const value = p[key];
    if (value === null || value === undefined) return "-";
    if (key === "purchase_price" || key === "selling_price" || key === "wholesale_price" || key === "mrp_price") return `Rs ${Number(value).toLocaleString()}`;
    if (key === "stock_value_purchase" || key === "stock_value_selling" || key === "stock_value_wholesale") return `Rs ${Number(value).toLocaleString()}`;
    if (key === "stock_qty") return Number(value).toLocaleString();
    if (key === "manufacture_date" || key === "expiry_date") return new Date(value as string).toLocaleDateString();
    return String(value);
  }

  function buildCsv(): string {
    const headers = [
      "Sr#",
      "Product Name",
      ...FIELD_OPTIONS.filter((f) => selectedFields.includes(f.key)).map((f) => f.label),
      ...(includeCountColumns ? ["Actual Stock", "Farq"] : []),
    ];
    const rows = filtered.map((p, i) => {
      const diff = diffFor(p);
      return [
        String(i + 1),
        p.name,
        ...FIELD_OPTIONS.filter((f) => selectedFields.includes(f.key)).map((f) => formatValue(p, f.key)),
        ...(includeCountColumns ? [actualStock[p.id] ?? "", diff === null ? "" : String(diff)] : []),
      ];
    });
    return [headers.join(","), ...rows.map((r) => r.map((c) => `"${c}"`).join(","))].join("\n");
  }

  const groupLabel = shopGroupFilter ? shopGroups.find((g) => g.key === shopGroupFilter)?.label ?? "" : "";
  const titleSuffix = [groupLabel, categoryFilter].filter(Boolean).join(" - ");

  function buildText(): string {
    const lines = [
      `Product Catalog${titleSuffix ? ` - ${titleSuffix}` : ""}`,
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
    a.download = `product-catalog${titleSuffix ? `-${titleSuffix}` : ""}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }
  async function handleDownloadPdf() {
    // jsPDF ka Node build (jspdf-autotable ke zariye) canvg/@babel-runtime
    // khींchta hai jo har machine par sahi install nahi hota (11
    // September, cPanel build par "Module not found" -- deploy atak
    // gaya). pdf-lib is project mein wallet statement par pehle se
    // chalta hai, koi aisi dependency nahi -- isi ka tareeqa yahan bhi.
    const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const boldFont = await doc.embedFont(StandardFonts.HelveticaBold);

    const visibleFields = FIELD_OPTIONS.filter((f) => selectedFields.includes(f.key));
    const cols: { label: string; width: number }[] = [
      { label: "Sr#", width: 24 },
      { label: "Product", width: 130 },
      ...visibleFields.map((f) => ({ label: f.label, width: 70 })),
      ...(includeCountColumns ? [{ label: "Actual Stock", width: 60 }, { label: "Farq", width: 50 }] : []),
    ];
    // A4 landscape: 842 × 595. Cols ki total width zyada ho to A4 landscape mein fit karna.
    const pageHeight = 595;
    const pageWidth = Math.max(842, 40 + cols.reduce((s, c) => s + c.width, 0));
    const marginX = 20;
    let page = doc.addPage([pageWidth, pageHeight]);
    let y = pageHeight - 30;
    const title = `Product Catalog${titleSuffix ? ` - ${titleSuffix}` : ""}`;

    function drawHeaderRow() {
      let x = marginX;
      for (const c of cols) {
        page.drawText(c.label, { x, y, size: 8, font: boldFont, color: rgb(1, 1, 1) });
        x += c.width;
      }
      y -= 4;
      page.drawLine({ start: { x: marginX, y }, end: { x: pageWidth - marginX, y }, thickness: 0.5, color: rgb(0.7, 0.7, 0.7) });
      y -= 12;
    }

    function drawPageTop() {
      y = pageHeight - 30;
      page.drawText(title, { x: marginX, y, size: 13, font: boldFont, color: rgb(0.1, 0.1, 0.1) });
      y -= 16;
      page.drawText(`Total Products: ${filtered.length}`, { x: marginX, y, size: 8, font, color: rgb(0.4, 0.4, 0.4) });
      y -= 14;
      // Header row ki hari patti.
      let x = marginX - 2;
      page.drawRectangle({ x, y: y - 4, width: pageWidth - 2 * marginX + 4, height: 14, color: rgb(0.16, 0.47, 0.2) });
      drawHeaderRow();
    }

    drawPageTop();

    for (let i = 0; i < filtered.length; i++) {
      if (y < 40) {
        page = doc.addPage([pageWidth, pageHeight]);
        drawPageTop();
      }
      const p = filtered[i];
      const diff = diffFor(p);
      const values = [
        String(i + 1),
        p.name,
        ...visibleFields.map((f) => formatValue(p, f.key)),
        ...(includeCountColumns ? [actualStock[p.id] ?? "", diff === null ? "" : String(diff)] : []),
      ];
      let x = marginX;
      for (let c = 0; c < cols.length; c++) {
        const maxChars = Math.floor(cols[c].width / 4.2);
        const text = values[c].length > maxChars ? values[c].slice(0, maxChars - 1) + "…" : values[c];
        page.drawText(text, { x, y, size: 7.5, font, color: rgb(0.15, 0.15, 0.15) });
        x += cols[c].width;
      }
      // Har product ke neeche lakeer -- kaghaz par likhne/gin kar farq
      // nikalne ke liye (malik, 14 September: har product ki apni line).
      y -= 4;
      page.drawLine({ start: { x: marginX, y }, end: { x: pageWidth - marginX, y }, thickness: 0.4, color: rgb(0.75, 0.75, 0.75) });
      y -= 9;
    }

    const bytes = await doc.save();
    const blob = new Blob([bytes], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `product-catalog${titleSuffix ? `-${titleSuffix}` : ""}.pdf`;
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
      {/* Print par table ke columns barh sakte hain (11 fields tak, +2
          ginti sheet ke liye) -- portrait A4 mein sab nahi aata, dayeen
          taraf ke khane katte hue chhap jate. Landscape + chhota font
          isi liye, sirf print ke waqt (screen par asar nahi). Kaghaz ka
          size Letter, malik ka apna printer/kaghaz isi par set hai. */}
      <style>{`
        @media print {
          @page { size: A4 landscape; margin: 8mm; }
          body { font-size: 10px !important; }
          .catalog-print-table { font-size: 8px; width: 100%; table-layout: auto; }
          .catalog-print-table th, .catalog-print-table td { padding: 2px 3px !important; word-break: break-word; }
          .catalog-print-table td:nth-child(2) { max-width: 140px; }
        }
      `}</style>
      <div className="mb-2 flex flex-wrap items-center gap-1.5 print:hidden">
        <button
          type="button"
          onClick={() => setShopGroupFilter("")}
          className={`rounded-full px-3 py-1 text-xs font-medium ${shopGroupFilter === "" ? "bg-brand-600 text-white" : "bg-surface-100 text-surface-600 dark:bg-surface-800 dark:text-surface-300"}`}
        >
          Sab
        </button>
        {shopGroups.map((g) => (
          <button
            key={g.key}
            type="button"
            onClick={() => setShopGroupFilter(g.key)}
            className={`rounded-full px-3 py-1 text-xs font-medium ${shopGroupFilter === g.key ? "bg-brand-600 text-white" : "bg-surface-100 text-surface-600 dark:bg-surface-800 dark:text-surface-300"}`}
          >
            {g.label}
          </button>
        ))}
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2 print:hidden">
        <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="rounded-lg border border-surface-200 p-2 text-sm">
          <option value="">{t("cx_all_categories", lang)}</option>
          {categories.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
        </select>
        <select
          value={shopFilter}
          onChange={(e) => { setShopFilter(e.target.value); setWarehouseFilter(""); }}
          className="rounded-lg border border-surface-200 p-2 text-sm"
        >
          <option value="">Sab Shops</option>
          {shops.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <select
          value={warehouseFilter}
          onChange={(e) => setWarehouseFilter(e.target.value)}
          className="rounded-lg border border-surface-200 p-2 text-sm"
        >
          <option value="">Sab Godaam</option>
          {visibleWarehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
        </select>
        <select value={dateField} onChange={(e) => setDateField(e.target.value as "manufacture_date" | "expiry_date")} className="rounded-lg border border-surface-200 p-2 text-sm">
          <option value="expiry_date">Expiry Date</option>
          <option value="manufacture_date">Manufacture Date</option>
        </select>
        <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="rounded-lg border border-surface-200 p-2 text-sm" title="Date se" />
        <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="rounded-lg border border-surface-200 p-2 text-sm" title="Date tak" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("pd_search_short", lang)} className="rounded-lg border border-surface-200 p-2 text-sm" />
        <div className="ml-auto flex gap-2">
          <button onClick={handlePrint} title="Print" className="rounded-lg border border-surface-200 p-2 text-surface-600 hover:bg-surface-50"><Printer className="h-4 w-4" /></button>
          <button onClick={handleDownload} title="CSV Download" className="rounded-lg border border-surface-200 p-2 text-surface-600 hover:bg-surface-50"><Download className="h-4 w-4" /></button>
          <button onClick={handleDownloadPdf} title="PDF Download" className="rounded-lg border border-surface-200 p-2 text-surface-600 hover:bg-surface-50"><FileText className="h-4 w-4" /></button>
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
        {/* Ginti sheet: system ka Available Stock chhapa hua, aur uske
            sath do khaali khane -- Actual Stock aur Farq -- jo dukan mein
            khud gin kar haath se likhne hain. Malik (10 September): "farq
            kitna hai mujhe page par likhna hai." */}
        <label className="mt-2 flex items-center gap-1.5 border-t border-surface-100 pt-2 text-sm text-surface-600 dark:border-surface-800 dark:text-surface-300">
          <input type="checkbox" checked={includeCountColumns} onChange={(e) => setIncludeCountColumns(e.target.checked)} />
          {t("cx_count_columns", lang)}
        </label>
      </div>

      {(selectedFields.includes("stock_value_purchase") || selectedFields.includes("stock_value_selling") || selectedFields.includes("stock_value_wholesale")) && (
        <div className="mb-4 flex flex-wrap gap-3">
          {selectedFields.includes("stock_value_purchase") && (
            <div className="rounded-card border border-amber-200 bg-amber-50 p-3 shadow-card dark:border-amber-800 dark:bg-amber-950/30">
              <p className="text-xs font-medium text-amber-600 dark:text-amber-400">Total Stock Value (Trade Rate)</p>
              <p className="mt-0.5 font-display text-xl font-bold text-amber-800 tabular-nums dark:text-amber-300">Rs {stockValueTotals.purchase.toLocaleString()}</p>
            </div>
          )}
          {selectedFields.includes("stock_value_selling") && (
            <div className="rounded-card border border-brand-200 bg-brand-50 p-3 shadow-card dark:border-brand-800 dark:bg-brand-950/30">
              <p className="text-xs font-medium text-brand-600 dark:text-brand-400">Total Stock Value (Sale Rate)</p>
              <p className="mt-0.5 font-display text-xl font-bold text-brand-800 tabular-nums dark:text-brand-300">Rs {stockValueTotals.selling.toLocaleString()}</p>
            </div>
          )}
          {selectedFields.includes("stock_value_wholesale") && (
            <div className="rounded-card border border-indigo-200 bg-indigo-50 p-3 shadow-card dark:border-indigo-800 dark:bg-indigo-950/30">
              <p className="text-xs font-medium text-indigo-600 dark:text-indigo-400">Total Stock Value (Wholesale Rate)</p>
              <p className="mt-0.5 font-display text-xl font-bold text-indigo-800 tabular-nums dark:text-indigo-300">Rs {stockValueTotals.wholesale.toLocaleString()}</p>
            </div>
          )}
        </div>
      )}

      <div className="rounded-card border border-surface-200 bg-white shadow-card dark:border-surface-800 dark:bg-surface-900">
        <div className="border-b border-surface-100 p-4 dark:border-surface-800">
          <h2 className="font-display text-base font-semibold text-surface-900 dark:text-white">
            {titleSuffix || "Sab Products"} <span className="text-sm font-normal text-surface-400">({filtered.length} products)</span>
          </h2>
        </div>
        <table className="catalog-print-table w-full text-sm">
          <thead>
            <tr className="text-left [&>th]:border-b [&>th]:border-surface-300 dark:[&>th]:border-surface-700">
              <th className="px-3 py-2 font-medium text-surface-500">{t("cx_sr_no", lang)}</th>
              <th className="px-3 py-2 font-medium text-surface-500">{t("c_product", lang)}</th>
              {FIELD_OPTIONS.filter((f) => selectedFields.includes(f.key)).map((f) => (
                <th key={f.key} className="px-3 py-2 font-medium text-surface-500">{f.label}</th>
              ))}
              {includeCountColumns && (
                <>
                  <th className="px-3 py-2 font-medium text-surface-500">{t("cx_actual_stock", lang)}</th>
                  <th className="px-3 py-2 font-medium text-surface-500">{t("cx_diff", lang)}</th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {filtered.map((p, i) => {
              const diff = diffFor(p);
              return (
                <tr
                  key={p.id}
                  // Border seedha <tr> par lagana print mein bharosemand
                  // nahi -- kabhi kisi row ke neeche aati hai, kabhi
                  // nahi (malik ne khud print kar ke dikhaya). Har <td>
                  // par lagana hi safe/universal tareeqa hai.
                  className="[&>td]:border-b [&>td]:border-surface-300 last:[&>td]:border-0 dark:[&>td]:border-surface-700"
                >

                  <td className="px-3 py-2 text-surface-500">{i + 1}</td>
                  <td className="px-3 py-2 font-medium text-surface-800 dark:text-surface-200">{p.name}</td>
                  {FIELD_OPTIONS.filter((f) => selectedFields.includes(f.key)).map((f) => (
                    <td key={f.key} className="px-3 py-2 text-surface-600 dark:text-surface-400">{formatValue(p, f.key)}</td>
                  ))}
                  {includeCountColumns && (
                    <>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          inputMode="decimal"
                          value={actualStock[p.id] ?? ""}
                          onChange={(e) => setActualStock((prev) => ({ ...prev, [p.id]: e.target.value }))}
                          className="w-20 rounded border border-surface-300 px-1.5 py-1 text-sm print:border print:border-surface-400 dark:border-surface-600 dark:bg-surface-800"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className={`inline-block min-w-[3.5rem] rounded border px-1.5 py-1 text-center text-sm ${
                            diff === null
                              ? "border-surface-300 text-surface-400 dark:border-surface-600"
                              : diff === 0
                                ? "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-400"
                                : "border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-950/30 dark:text-rose-400"
                          }`}
                        >
                          {diff === null ? "" : diff}
                        </span>
                      </td>
                    </>
                  )}
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr><td colSpan={selectedFields.length + 2 + (includeCountColumns ? 2 : 0)} className="px-3 py-8 text-center text-surface-400">{t("c_no_products", lang)}</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}