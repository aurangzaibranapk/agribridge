"use client";
import { useState, useMemo, useTransition, useRef, useEffect } from "react";
import { Printer, Download, Mail, MessageCircle, FileText, Pencil, Check, X, ChevronDown } from "lucide-react";
import { t } from "@/lib/i18n/translations";
import { useLang } from "@/lib/i18n/lang-context";
import { updateProductNamePackSize } from "@/actions/products";

interface Company {
  id: string;
  name: string;
}

interface Product {
  id: string;
  name: string;
  category_id: string | null;
  company_id: string | null;
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
  qty_sold: number;
  sales_amount: number;
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
  { key: "qty_sold", label: "Qty Sold" },
  { key: "sales_amount", label: "Sales Amount (Rs)" },
];

export function CatalogExportClient({ products: initialProducts, categories, companies, shopGroups, warehouses, shops }: { products: Product[]; categories: Category[]; companies: Company[]; shopGroups: ShopGroup[]; warehouses: Warehouse[]; shops: Shop[] }) {
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editPackSize, setEditPackSize] = useState("");
  const [editCategoryId, setEditCategoryId] = useState<string>("");
  const [editCompanyId, setEditCompanyId] = useState<string>("");
  const [editSellingPrice, setEditSellingPrice] = useState<string>("");
  const [editWholesalePrice, setEditWholesalePrice] = useState<string>("");
  const [editMrpPrice, setEditMrpPrice] = useState<string>("");
  const [editUnit, setEditUnit] = useState<string>("");
  const [editManufactureDate, setEditManufactureDate] = useState<string>("");
  const [editExpiryDate, setEditExpiryDate] = useState<string>("");
  const [editBarcode, setEditBarcode] = useState<string>("");
  const [editError, setEditError] = useState("");
  const [isPending, startTransition] = useTransition();
  const [categoryFilters, setCategoryFilters] = useState<string[]>([]);
  const [catDropOpen, setCatDropOpen] = useState(false);
  const catDropRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (catDropRef.current && !catDropRef.current.contains(e.target as Node)) setCatDropOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);
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
    if (categoryFilters.length > 0) list = list.filter((p) => p.category != null && categoryFilters.includes(p.category));
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
  }, [products, shopGroupFilter, categoryFilters, search, warehouseFilter, shopWarehouseIds, dateField, dateFrom, dateTo]);

  const stockValueTotals = useMemo(() => ({
    purchase: filtered.reduce((s, p) => s + (p.stock_value_purchase ?? 0), 0),
    selling: filtered.reduce((s, p) => s + (p.stock_value_selling ?? 0), 0),
    wholesale: filtered.reduce((s, p) => s + (p.stock_value_wholesale ?? 0), 0),
    qty_sold: filtered.reduce((s, p) => s + (p.qty_sold ?? 0), 0),
    sales_amount: filtered.reduce((s, p) => s + (p.sales_amount ?? 0), 0),
  }), [filtered]);

  function startEdit(p: Product) {
    setEditingId(p.id);
    setEditName(p.name);
    setEditPackSize(p.pack_size ?? "");
    setEditCategoryId(p.category_id ?? "");
    setEditCompanyId(p.company_id ?? "");
    setEditSellingPrice(p.selling_price != null ? String(p.selling_price) : "");
    setEditWholesalePrice(p.wholesale_price != null ? String(p.wholesale_price) : "");
    setEditMrpPrice(p.mrp_price != null ? String(p.mrp_price) : "");
    setEditUnit(p.unit ?? "");
    setEditManufactureDate(p.manufacture_date ?? "");
    setEditExpiryDate(p.expiry_date ?? "");
    setEditBarcode(p.barcode ?? "");
    setEditError("");
  }

  function cancelEdit() {
    setEditingId(null);
    setEditError("");
  }

  function saveEdit() {
    if (!editingId) return;
    setEditError("");
    const newCategoryId = editCategoryId || null;
    const newCompanyId = editCompanyId || null;
    const newSellingPrice = editSellingPrice !== "" && !isNaN(Number(editSellingPrice)) ? Number(editSellingPrice) : null;
    const newWholesalePrice = editWholesalePrice !== "" && !isNaN(Number(editWholesalePrice)) ? Number(editWholesalePrice) : null;
    const newMrpPrice = editMrpPrice !== "" && !isNaN(Number(editMrpPrice)) ? Number(editMrpPrice) : null;
    startTransition(async () => {
      const res = await updateProductNamePackSize(
        editingId,
        editName,
        editPackSize || null,
        newCategoryId,
        newSellingPrice ?? undefined,
        {
          wholesale_price: newWholesalePrice,
          mrp_price: newMrpPrice,
          unit: editUnit || null,
          manufacture_date: editManufactureDate || null,
          expiry_date: editExpiryDate || null,
          barcode: editBarcode || null,
          company_id: newCompanyId,
        },
      );
      if (res.error) {
        setEditError(res.error);
        return;
      }
      const newCategoryName = newCategoryId ? categories.find((c) => c.id === newCategoryId)?.name ?? null : null;
      const newCompanyName = newCompanyId ? companies.find((c) => c.id === newCompanyId)?.name ?? null : null;
      setProducts((prev) =>
        prev.map((p) => {
          if (p.id !== editingId) return p;
          const sp = newSellingPrice ?? p.selling_price;
          const wp = newWholesalePrice ?? p.wholesale_price;
          return {
            ...p,
            name: editName.trim(),
            pack_size: editPackSize || null,
            category_id: newCategoryId,
            category: newCategoryName,
            company_id: newCompanyId,
            brand: newCompanyName,
            selling_price: sp,
            wholesale_price: wp,
            mrp_price: newMrpPrice ?? p.mrp_price,
            unit: editUnit || null,
            manufacture_date: editManufactureDate || null,
            expiry_date: editExpiryDate || null,
            barcode: editBarcode || null,
            stock_value_selling: sp != null ? sp * (p.stock_qty ?? 0) : null,
            stock_value_wholesale: wp != null ? wp * (p.stock_qty ?? 0) : null,
          };
        })
      );
      setEditingId(null);
    });
  }

  function toggleField(key: string) {
    setSelectedFields((prev) => (prev.includes(key) ? prev.filter((f) => f !== key) : [...prev, key]));
  }

  function formatValue(p: Product, key: keyof Product): string {
    const value = p[key];
    if (value === null || value === undefined) return "-";
    if (key === "purchase_price" || key === "selling_price" || key === "wholesale_price" || key === "mrp_price") return `Rs ${Number(value).toLocaleString()}`;
    if (key === "stock_value_purchase" || key === "stock_value_selling" || key === "stock_value_wholesale") return `Rs ${Number(value).toLocaleString()}`;
    if (key === "stock_qty" || key === "qty_sold") return Number(value).toLocaleString();
    if (key === "sales_amount") return `Rs ${Number(value).toLocaleString()}`;
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
  const titleSuffix = [groupLabel, ...categoryFilters].filter(Boolean).join(" - ");

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
        <div ref={catDropRef} className="relative">
          <button
            type="button"
            onClick={() => setCatDropOpen((v) => !v)}
            className="flex items-center gap-1.5 rounded-lg border border-surface-200 p-2 text-sm text-surface-700 hover:bg-surface-50 dark:border-surface-700 dark:text-surface-300"
          >
            {categoryFilters.length === 0 ? t("cx_all_categories", lang) : `${categoryFilters.length} Categories`}
            <ChevronDown className="h-3.5 w-3.5 text-surface-400" />
          </button>
          {catDropOpen && (
            <div className="absolute left-0 top-full z-20 mt-1 max-h-64 w-56 overflow-y-auto rounded-lg border border-surface-200 bg-white py-1 shadow-lg dark:border-surface-700 dark:bg-surface-900">
              <button
                type="button"
                onClick={() => setCategoryFilters([])}
                className="w-full px-3 py-1.5 text-left text-xs font-medium text-brand-600 hover:bg-surface-50 dark:hover:bg-surface-800"
              >
                Sab clear karein
              </button>
              {categories.map((c) => (
                <label key={c.id} className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm hover:bg-surface-50 dark:hover:bg-surface-800">
                  <input
                    type="checkbox"
                    checked={categoryFilters.includes(c.name)}
                    onChange={() => setCategoryFilters((prev) =>
                      prev.includes(c.name) ? prev.filter((n) => n !== c.name) : [...prev, c.name]
                    )}
                    className="rounded"
                  />
                  {c.name}
                </label>
              ))}
            </div>
          )}
        </div>
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

      {((selectedFields.includes("stock_value_purchase") || selectedFields.includes("purchase_price")) ||
        (selectedFields.includes("stock_value_selling") || selectedFields.includes("selling_price")) ||
        (selectedFields.includes("stock_value_wholesale") || selectedFields.includes("wholesale_price"))) && (
        <div className="mb-4 flex flex-wrap gap-3">
          {(selectedFields.includes("stock_value_purchase") || selectedFields.includes("purchase_price")) && (
            <div className="rounded-card border border-amber-200 bg-amber-50 p-3 shadow-card dark:border-amber-800 dark:bg-amber-950/30">
              <p className="text-xs font-medium text-amber-600 dark:text-amber-400">Total Stock Value (Trade Rate)</p>
              <p className="mt-0.5 font-display text-xl font-bold text-amber-800 tabular-nums dark:text-amber-300">Rs {stockValueTotals.purchase.toLocaleString()}</p>
            </div>
          )}
          {(selectedFields.includes("stock_value_selling") || selectedFields.includes("selling_price")) && (
            <div className="rounded-card border border-brand-200 bg-brand-50 p-3 shadow-card dark:border-brand-800 dark:bg-brand-950/30">
              <p className="text-xs font-medium text-brand-600 dark:text-brand-400">Total Stock Value (Sale Rate)</p>
              <p className="mt-0.5 font-display text-xl font-bold text-brand-800 tabular-nums dark:text-brand-300">Rs {stockValueTotals.selling.toLocaleString()}</p>
            </div>
          )}
          {(selectedFields.includes("stock_value_wholesale") || selectedFields.includes("wholesale_price")) && (
            <div className="rounded-card border border-indigo-200 bg-indigo-50 p-3 shadow-card dark:border-indigo-800 dark:bg-indigo-950/30">
              <p className="text-xs font-medium text-indigo-600 dark:text-indigo-400">Total Stock Value (Wholesale Rate)</p>
              <p className="mt-0.5 font-display text-xl font-bold text-indigo-800 tabular-nums dark:text-indigo-300">Rs {stockValueTotals.wholesale.toLocaleString()}</p>
            </div>
          )}
        </div>
      )}
      {(selectedFields.includes("qty_sold") || selectedFields.includes("sales_amount")) && (
        <div className="mb-4 flex flex-wrap gap-3">
          {selectedFields.includes("qty_sold") && (
            <div className="rounded-card border border-sky-200 bg-sky-50 p-3 shadow-card dark:border-sky-800 dark:bg-sky-950/30">
              <p className="text-xs font-medium text-sky-600 dark:text-sky-400">Total Qty Sold</p>
              <p className="mt-0.5 font-display text-xl font-bold text-sky-800 tabular-nums dark:text-sky-300">{stockValueTotals.qty_sold.toLocaleString()}</p>
            </div>
          )}
          {selectedFields.includes("sales_amount") && (
            <div className="rounded-card border border-violet-200 bg-violet-50 p-3 shadow-card dark:border-violet-800 dark:bg-violet-950/30">
              <p className="text-xs font-medium text-violet-600 dark:text-violet-400">Total Sales Amount</p>
              <p className="mt-0.5 font-display text-xl font-bold text-violet-800 tabular-nums dark:text-violet-300">Rs {stockValueTotals.sales_amount.toLocaleString()}</p>
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
              <th className="px-3 py-2 font-medium text-surface-500 print:hidden"></th>
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
                  <td className="px-3 py-2 font-medium text-surface-800 dark:text-surface-200">
                    {editingId === p.id ? (
                      <input
                        autoFocus
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") saveEdit(); if (e.key === "Escape") cancelEdit(); }}
                        className="w-full min-w-[140px] rounded border border-brand-400 px-1.5 py-0.5 text-sm focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-brand-600 dark:bg-surface-800"
                      />
                    ) : p.name}
                  </td>
                  {FIELD_OPTIONS.filter((f) => selectedFields.includes(f.key)).map((f) => (
                    <td key={f.key} className="px-3 py-2 text-surface-600 dark:text-surface-400">
                      {editingId === p.id && f.key === "pack_size" ? (
                        <input
                          value={editPackSize}
                          onChange={(e) => setEditPackSize(e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Enter") saveEdit(); if (e.key === "Escape") cancelEdit(); }}
                          placeholder="e.g. 1kg"
                          className="w-full min-w-[80px] rounded border border-brand-400 px-1.5 py-0.5 text-sm focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-brand-600 dark:bg-surface-800"
                        />
                      ) : editingId === p.id && f.key === "category" ? (
                        <select
                          value={editCategoryId}
                          onChange={(e) => setEditCategoryId(e.target.value)}
                          className="w-full min-w-[120px] rounded border border-brand-400 px-1.5 py-0.5 text-sm focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-brand-600 dark:bg-surface-800"
                        >
                          <option value="">— Category nahi —</option>
                          {categories.map((c) => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                          ))}
                        </select>
                      ) : editingId === p.id && f.key === "brand" ? (
                        <select
                          value={editCompanyId}
                          onChange={(e) => setEditCompanyId(e.target.value)}
                          className="w-full min-w-[120px] rounded border border-brand-400 px-1.5 py-0.5 text-sm focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-brand-600 dark:bg-surface-800"
                        >
                          <option value="">— Company nahi —</option>
                          {companies.map((c) => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                          ))}
                        </select>
                      ) : editingId === p.id && f.key === "selling_price" ? (
                        <input
                          type="number"
                          inputMode="decimal"
                          value={editSellingPrice}
                          onChange={(e) => setEditSellingPrice(e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Enter") saveEdit(); if (e.key === "Escape") cancelEdit(); }}
                          placeholder="Rate"
                          className="w-full min-w-[80px] rounded border border-brand-400 px-1.5 py-0.5 text-sm focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-brand-600 dark:bg-surface-800"
                        />
                      ) : editingId === p.id && f.key === "wholesale_price" ? (
                        <input
                          type="number"
                          inputMode="decimal"
                          value={editWholesalePrice}
                          onChange={(e) => setEditWholesalePrice(e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Enter") saveEdit(); if (e.key === "Escape") cancelEdit(); }}
                          placeholder="Rate"
                          className="w-full min-w-[80px] rounded border border-brand-400 px-1.5 py-0.5 text-sm focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-brand-600 dark:bg-surface-800"
                        />
                      ) : editingId === p.id && f.key === "mrp_price" ? (
                        <input
                          type="number"
                          inputMode="decimal"
                          value={editMrpPrice}
                          onChange={(e) => setEditMrpPrice(e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Enter") saveEdit(); if (e.key === "Escape") cancelEdit(); }}
                          placeholder="MRP"
                          className="w-full min-w-[80px] rounded border border-brand-400 px-1.5 py-0.5 text-sm focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-brand-600 dark:bg-surface-800"
                        />
                      ) : editingId === p.id && f.key === "unit" ? (
                        <input
                          value={editUnit}
                          onChange={(e) => setEditUnit(e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Enter") saveEdit(); if (e.key === "Escape") cancelEdit(); }}
                          placeholder="e.g. kg"
                          className="w-full min-w-[60px] rounded border border-brand-400 px-1.5 py-0.5 text-sm focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-brand-600 dark:bg-surface-800"
                        />
                      ) : editingId === p.id && f.key === "manufacture_date" ? (
                        <input
                          type="date"
                          value={editManufactureDate}
                          onChange={(e) => setEditManufactureDate(e.target.value)}
                          className="w-full rounded border border-brand-400 px-1.5 py-0.5 text-sm focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-brand-600 dark:bg-surface-800"
                        />
                      ) : editingId === p.id && f.key === "expiry_date" ? (
                        <input
                          type="date"
                          value={editExpiryDate}
                          onChange={(e) => setEditExpiryDate(e.target.value)}
                          className="w-full rounded border border-brand-400 px-1.5 py-0.5 text-sm focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-brand-600 dark:bg-surface-800"
                        />
                      ) : editingId === p.id && f.key === "barcode" ? (
                        <input
                          value={editBarcode}
                          onChange={(e) => setEditBarcode(e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Enter") saveEdit(); if (e.key === "Escape") cancelEdit(); }}
                          placeholder="Barcode"
                          className="w-full min-w-[100px] rounded border border-brand-400 px-1.5 py-0.5 text-sm focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-brand-600 dark:bg-surface-800"
                        />
                      ) : formatValue(p, f.key)}
                    </td>
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
                  <td className="px-3 py-2 print:hidden">
                    {editingId === p.id ? (
                      <span className="flex items-center gap-1">
                        <button
                          onClick={saveEdit}
                          disabled={isPending}
                          title="Save"
                          className="rounded p-1 text-emerald-600 hover:bg-emerald-50 disabled:opacity-50 dark:hover:bg-emerald-950/30"
                        ><Check className="h-4 w-4" /></button>
                        <button
                          onClick={cancelEdit}
                          disabled={isPending}
                          title="Cancel"
                          className="rounded p-1 text-rose-500 hover:bg-rose-50 disabled:opacity-50 dark:hover:bg-rose-950/30"
                        ><X className="h-4 w-4" /></button>
                        {editError && <span className="ml-1 text-xs text-rose-600">{editError}</span>}
                      </span>
                    ) : (
                      <button
                        onClick={() => startEdit(p)}
                        title="Edit name / pack size"
                        className="rounded p-1 text-surface-400 hover:bg-surface-50 hover:text-surface-700 dark:hover:bg-surface-800"
                      ><Pencil className="h-3.5 w-3.5" /></button>
                    )}
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr><td colSpan={selectedFields.length + 3 + (includeCountColumns ? 2 : 0)} className="px-3 py-8 text-center text-surface-400">{t("c_no_products", lang)}</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}