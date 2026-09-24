"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import {
  ArrowLeft, Check, ChevronDown, FileText, FileUp, PackagePlus, Plus, Search,
  ShoppingCart, Trash2, X,
} from "lucide-react";
import { createPurchase, type ActionState } from "@/actions/purchases";
import { quickCreateProduct } from "@/actions/products";
import { aajKaKhana } from "@/lib/utils/format";
import { looksBinary, parseDelimited } from "@/lib/csv";

type Category = { id: string; name: string; parent_category_id: string | null; category_kind: string };
type Product = {
  id: string; name: string; company_id: string | null; category_id: string | null; pack_size: string | null; units_per_pack: number | null; unit: string | null;
  purchase_price: number; selling_price: number; wholesale_price: number | null; mrp_price: number | null; trade_rate_pending: boolean;
};
type Line = {
  product_id: string; query: string; quantity: string; unit_cost: string;
  sale_rate: string; mrp_rate: string; wholesale_rate: string;
  batch_number: string; manufacture_date: string; expiry_date: string; pickerOpen: boolean;
};
type StockGroup = "karyana" | "khaad" | "wanda" | "pesticide";
const GROUPS: { id: StockGroup; label: string; roots: string[] }[] = [
  { id: "karyana", label: "Karyana", roots: ["grocery", "karyana"] },
  { id: "khaad", label: "Khaad", roots: ["fertilizer", "fertiliser", "khaad"] },
  { id: "wanda", label: "Wanda", roots: ["wanda", "animal feed", "animal feed (wanda)"] },
  { id: "pesticide", label: "Pesticide", roots: ["pesticide", "pesticides"] },
];
const emptyLine = (): Line => ({ product_id: "", query: "", quantity: "", unit_cost: "", sale_rate: "", mrp_rate: "", wholesale_rate: "", batch_number: "", manufacture_date: "", expiry_date: "", pickerOpen: false });
const initialState: ActionState = {};
const inputClass = "h-10 w-full rounded-lg border border-surface-200 bg-white px-3 text-sm text-surface-900 outline-none transition placeholder:text-surface-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:border-surface-700 dark:bg-surface-950 dark:text-surface-100 dark:focus:ring-brand-900/30";
const labelClass = "mb-1.5 block text-xs font-medium text-surface-600 dark:text-surface-300";

function groupForCategory(categoryId: string | null, categories: Category[]): StockGroup | null {
  if (!categoryId) return null;
  const byId = new Map(categories.map((category) => [category.id, category]));
  let current = byId.get(categoryId);
  const visited = new Set<string>();
  while (current && !visited.has(current.id)) {
    visited.add(current.id);
    if (!current.parent_category_id) {
      const name = current.name.trim().toLowerCase();
      return GROUPS.find((group) => group.roots.includes(name))?.id ?? null;
    }
    current = byId.get(current.parent_category_id);
  }
  return null;
}

const normalizeCsvHeader = (value: string) => value.trim().toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ");
const normalizeProductName = (value: string) => value.trim().toLowerCase().replace(/[^a-z0-9\u0600-\u06ff]+/g, " ").replace(/\s+/g, " ");
const csvNumber = (value: string | undefined) => {
  const cleaned = String(value ?? "").replace(/[^0-9.]/g, "");
  return cleaned && Number.isFinite(Number(cleaned)) ? String(Number(cleaned)) : "";
};
const CSV_ALIASES = {
  product: ["product", "product name", "item", "item name", "name", "naam", "cheez"],
  pack: ["pack", "pack size", "unit", "size"],
  qty: ["qty", "quantity", "tadad", "stock"],
  purchase: ["purchase rate", "purchase price", "trade rate", "trade", "cost", "lagat"],
  sale: ["sale rate", "sale price", "selling rate", "selling price", "retail", "retail rate"],
  mrp: ["mrp", "mrp rate", "mrp price", "printed price"],
  wholesale: ["wholesale", "wholesale rate", "wholesale price", "thok", "thok rate"],
} as const;

export function SupplierBillClient({
  suppliers, products: initialProducts, categories, companies, warehouses, accounts, units,
}: {
  suppliers: { id: string; name: string; companyName: string | null; phone: string | null }[];
  products: Product[];
  categories: Category[];
  companies: { id: string; name: string }[];
  warehouses: { id: string; name: string; branchId: string; shopName: string | null; branchName: string | null }[];
  accounts: { id: string; name: string; account_type: string }[];
  units: { code: string; label: string }[];
}) {
  const [state, formAction] = useFormState(createPurchase, initialState);
  const [products, setProducts] = useState(initialProducts);
  const [supplierId, setSupplierId] = useState("");
  const [warehouseId, setWarehouseId] = useState(warehouses[0]?.id ?? "");
  const [billDate, setBillDate] = useState(aajKaKhana());
  const [activeGroup, setActiveGroup] = useState<StockGroup | "all">("all");
  const [lines, setLines] = useState<Line[]>([emptyLine()]);
  const [terms, setTerms] = useState<"paid" | "partial" | "credit">("credit");
  const [paidNow, setPaidNow] = useState("");
  const [productModal, setProductModal] = useState(false);
  const [newProductError, setNewProductError] = useState("");
  const [newProductBusy, setNewProductBusy] = useState(false);
  const [newProductGroup, setNewProductGroup] = useState<StockGroup>("khaad");
  const [newProductCategory, setNewProductCategory] = useState("");
  const [newProductCompany, setNewProductCompany] = useState("");
  const [newProductName, setNewProductName] = useState("");
  const [newProductPack, setNewProductPack] = useState("");
  const [newProductUnit, setNewProductUnit] = useState("");
  const [newProductPurchase, setNewProductPurchase] = useState("");
  const [newProductSale, setNewProductSale] = useState("");
  const [newProductMrp, setNewProductMrp] = useState("");
  const [newProductWholesale, setNewProductWholesale] = useState("");
  const [csvNotice, setCsvNotice] = useState("");
  const [billNo, setBillNo] = useState("");
  const [billNoGenerating, setBillNoGenerating] = useState(false);
  const csvInputRef = useRef<HTMLInputElement>(null);

  const selectedSupplier = suppliers.find((s) => s.id === supplierId) ?? null;

  async function autoGenerateBillNo() {
    setBillNoGenerating(true);
    try {
      const { getNextSupplierBillNo } = await import("@/actions/purchases");
      const result = await getNextSupplierBillNo();
      if ("billNo" in result) setBillNo(result.billNo);
    } finally {
      setBillNoGenerating(false);
    }
  }

  const roots = useMemo(() => categories.filter((category) => !category.parent_category_id && GROUPS.some((group) => group.roots.includes(category.name.trim().toLowerCase()))), [categories]);
  const rootForGroup = (group: StockGroup) => roots.find((category) => GROUPS.find((item) => item.id === group)?.roots.includes(category.name.trim().toLowerCase()));
  const newProductCategories = useMemo(() => {
    const byId = new Map(categories.map((category) => [category.id, category]));
    return [...categories].sort((a, b) => {
      const aParent = a.parent_category_id ? byId.get(a.parent_category_id)?.name ?? "" : a.name;
      const bParent = b.parent_category_id ? byId.get(b.parent_category_id)?.name ?? "" : b.name;
      return `${a.category_kind} ${aParent} ${a.parent_category_id ? "1" : "0"} ${a.name}`.localeCompare(`${b.category_kind} ${bParent} ${b.parent_category_id ? "1" : "0"} ${b.name}`);
    });
  }, [categories]);

  const subtotal = useMemo(() => lines.reduce((sum, line) => sum + (Number(line.quantity) || 0) * (Number(line.unit_cost) || 0), 0), [lines]);
  const existingMatches = useMemo(() => {
    const q = newProductName.trim().toLowerCase();
    if (q.length < 2) return [];
    return products.filter((p) => p.name.toLowerCase().includes(q)).slice(0, 5);
  }, [newProductName, products]);
  const [discount, setDiscount] = useState("");
  const [tax, setTax] = useState("");
  const grandTotal = Math.max(0, subtotal - (Number(discount) || 0) + (Number(tax) || 0));
  const paidAmount = terms === "paid" ? grandTotal : terms === "partial" ? Number(paidNow) || 0 : 0;
  const amountDue = Math.max(0, grandTotal - paidAmount);
  const itemPayload = JSON.stringify(lines.filter((line) => line.product_id && Number(line.quantity) > 0 && line.unit_cost.trim() !== "" && Number(line.unit_cost) >= 0).map((line) => ({
    product_id: line.product_id, quantity: Number(line.quantity), unit_cost: Number(line.unit_cost),
    sale_rate: Number(line.sale_rate) > 0 ? Number(line.sale_rate) : undefined,
    mrp_rate: Number(line.mrp_rate) > 0 ? Number(line.mrp_rate) : undefined,
    wholesale_rate: Number(line.wholesale_rate) > 0 ? Number(line.wholesale_rate) : undefined,
    batch_number: line.batch_number || undefined, manufacture_date: line.manufacture_date || undefined, expiry_date: line.expiry_date || undefined,
  })));

  function updateLine(index: number, patch: Partial<Line>) {
    setLines((previous) => previous.map((line, i) => i === index ? { ...line, ...patch } : line));
  }
  function selectProduct(index: number, product: Product) {
    updateLine(index, {
      product_id: product.id,
      query: `${product.name}${product.pack_size ? ` · ${product.pack_size}` : ""}`,
      unit_cost: product.trade_rate_pending ? "" : String(product.purchase_price),
      sale_rate: product.selling_price > 0 ? String(product.selling_price) : "",
      mrp_rate: product.mrp_price != null && product.mrp_price > 0 ? String(product.mrp_price) : "",
      wholesale_rate: product.wholesale_price != null && product.wholesale_price > 0 ? String(product.wholesale_price) : "",
      pickerOpen: false,
    });
  }
  function openNewProduct() {
    const group = activeGroup === "all" ? "khaad" : activeGroup;
    setNewProductGroup(group);
    const root = rootForGroup(group);
    setNewProductCategory(root?.id ?? "");
    setNewProductError("");
    setProductModal(true);
  }
  async function saveNewProduct(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNewProductError("");
    setNewProductBusy(true);
    const purchaseRate = Number(newProductPurchase);
    const result = await quickCreateProduct({
      name: newProductName, packSize: newProductPack, categoryId: newProductCategory || null,
      companyId: newProductCompany || null, unit: newProductUnit || null, purchasePrice: purchaseRate,
      sellingPrice: Number(newProductSale) || 0,
      mrpPrice: Number(newProductMrp) || null,
      wholesalePrice: Number(newProductWholesale) || null,
    });
    setNewProductBusy(false);
    if ("error" in result) { setNewProductError(result.error); return; }
    const created: Product = {
      id: result.id, name: newProductName.trim(), company_id: newProductCompany || null, category_id: newProductCategory || null,
      pack_size: newProductPack.trim() || null, units_per_pack: null, unit: units.find((unit) => unit.code === newProductUnit)?.label ?? null,
      purchase_price: purchaseRate, selling_price: Number(newProductSale) || 0,
      mrp_price: Number(newProductMrp) || null, wholesale_price: Number(newProductWholesale) || null,
      trade_rate_pending: false,
    };
    setProducts((previous) => [...previous, created].sort((a, b) => a.name.localeCompare(b.name)));
    setLines((previous) => {
      const index = previous.findIndex((line) => !line.product_id);
      const selectedRates = {
        sale_rate: created.selling_price > 0 ? String(created.selling_price) : "",
        mrp_rate: created.mrp_price ? String(created.mrp_price) : "",
        wholesale_rate: created.wholesale_price ? String(created.wholesale_price) : "",
      };
      if (index < 0) return [...previous, { ...emptyLine(), product_id: created.id, query: `${created.name}${created.pack_size ? ` · ${created.pack_size}` : ""}`, unit_cost: String(created.purchase_price), ...selectedRates, pickerOpen: false }];
      return previous.map((line, i) => i === index ? { ...line, product_id: created.id, query: `${created.name}${created.pack_size ? ` · ${created.pack_size}` : ""}`, unit_cost: String(created.purchase_price), ...selectedRates, pickerOpen: false } : line);
    });
    setProductModal(false);
    setNewProductName(""); setNewProductPack(""); setNewProductUnit(""); setNewProductCompany("");
    setNewProductPurchase(""); setNewProductSale(""); setNewProductMrp(""); setNewProductWholesale("");
  }

  function addExistingToLine(product: Product) {
    setLines((previous) => {
      const index = previous.findIndex((line) => !line.product_id);
      const entry = {
        ...emptyLine(),
        product_id: product.id,
        query: `${product.name}${product.pack_size ? ` · ${product.pack_size}` : ""}`,
        unit_cost: String(product.purchase_price),
        sale_rate: product.selling_price > 0 ? String(product.selling_price) : "",
        mrp_rate: product.mrp_price ? String(product.mrp_price) : "",
        wholesale_rate: product.wholesale_price ? String(product.wholesale_price) : "",
        pickerOpen: false,
      };
      if (index < 0) return [...previous, entry];
      return previous.map((line, i) => (i === index ? entry : line));
    });
    setProductModal(false);
    setNewProductName("");
  }

  async function loadBillCsv(file: File | null) {
    if (!file) return;
    setCsvNotice("");
    const text = await file.text();
    if (looksBinary(text)) {
      setCsvNotice("Excel .xlsx file nahi chalegi. Excel se File → Save As → CSV bana kar upload karein.");
      return;
    }
    const rows = parseDelimited(text);
    if (rows.length < 2) {
      setCsvNotice("CSV mein heading aur kam az kam ek product line honi chahiye.");
      return;
    }
    const headers = rows[0].map(normalizeCsvHeader);
    const column = (aliases: readonly string[]) => headers.findIndex((header) => aliases.includes(header));
    const productColumn = column(CSV_ALIASES.product);
    if (productColumn < 0) {
      setCsvNotice("CSV mein Product ya Product Name ka column nahi mila.");
      return;
    }
    const packColumn = column(CSV_ALIASES.pack);
    const qtyColumn = column(CSV_ALIASES.qty);
    const purchaseColumn = column(CSV_ALIASES.purchase);
    const saleColumn = column(CSV_ALIASES.sale);
    const mrpColumn = column(CSV_ALIASES.mrp);
    const wholesaleColumn = column(CSV_ALIASES.wholesale);
    const imported: Line[] = [];
    const missing: string[] = [];

    for (const row of rows.slice(1)) {
      const rawName = String(row[productColumn] ?? "").trim();
      if (!rawName) continue;
      const wantedName = normalizeProductName(rawName);
      const wantedPack = packColumn >= 0 ? normalizeProductName(row[packColumn] ?? "") : "";
      const candidates = products.filter((product) => normalizeProductName(product.name) === wantedName);
      const product = (wantedPack
        ? candidates.find((candidate) => normalizeProductName(candidate.pack_size ?? candidate.unit ?? "") === wantedPack)
        : null) ?? candidates[0];
      if (!product) {
        missing.push(rawName);
        // Line add karo — data saved rahega, user search se link kar sakta hai
        imported.push({
          ...emptyLine(),
          query: rawName,
          quantity: qtyColumn >= 0 ? csvNumber(row[qtyColumn]) : "",
          unit_cost: purchaseColumn >= 0 ? csvNumber(row[purchaseColumn]) : "",
          sale_rate: saleColumn >= 0 ? csvNumber(row[saleColumn]) : "",
          mrp_rate: mrpColumn >= 0 ? csvNumber(row[mrpColumn]) : "",
          wholesale_rate: wholesaleColumn >= 0 ? csvNumber(row[wholesaleColumn]) : "",
        });
        continue;
      }
      imported.push({
        ...emptyLine(),
        product_id: product.id,
        query: `${product.name}${product.pack_size ? ` · ${product.pack_size}` : ""}`,
        quantity: qtyColumn >= 0 ? csvNumber(row[qtyColumn]) : "",
        unit_cost: purchaseColumn >= 0 ? csvNumber(row[purchaseColumn]) : (product.trade_rate_pending ? "" : String(product.purchase_price)),
        sale_rate: saleColumn >= 0 ? csvNumber(row[saleColumn]) : (product.selling_price > 0 ? String(product.selling_price) : ""),
        mrp_rate: mrpColumn >= 0 ? csvNumber(row[mrpColumn]) : (product.mrp_price ? String(product.mrp_price) : ""),
        wholesale_rate: wholesaleColumn >= 0 ? csvNumber(row[wholesaleColumn]) : (product.wholesale_price ? String(product.wholesale_price) : ""),
      });
    }

    if (imported.length) setLines(imported);
    const parts = [`${imported.length} product lines CSV se bill mein aa gayin.`];
    if (missing.length) parts.push(`${missing.length} naam Product Master mein nahi mile: ${missing.slice(0, 5).join(", ")}${missing.length > 5 ? "…" : ""} — amber lines mein search kar ke link karein.`);
    setCsvNotice(parts.join(" "));
    if (csvInputRef.current) csvInputRef.current.value = "";
  }

  return (
    <div className="mx-auto w-full max-w-[1500px] space-y-4 pb-8">
      <Link href="/admin/purchases" className="inline-flex items-center gap-1.5 text-sm text-surface-500 hover:text-brand-700">
        <ArrowLeft className="h-4 w-4" /> Purchase
      </Link>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-[0.14em] text-brand-700">Admin Panel / Purchases</p>
          <h1 className="font-display text-2xl font-semibold text-surface-950 dark:text-white">Supplier Purchase Bill</h1>
          <p className="mt-1 text-sm text-surface-500">Product master se item chunein, supplier ka bill save karein aur receiving ke liye bhejein.</p>
        </div>
        <Link href="/admin/products" className="inline-flex items-center gap-2 rounded-lg border border-surface-200 bg-white px-3 py-2 text-sm font-medium text-surface-700 hover:border-brand-400 hover:text-brand-800 dark:border-surface-700 dark:bg-surface-900 dark:text-surface-200">
          <ShoppingCart className="h-4 w-4" /> Product Master
        </Link>
      </div>

      {state.success && <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200"><span className="flex items-center gap-2"><Check className="h-4 w-4" /> Bill save ho gaya. Stock tab charhega jab GRN par maal receive/count hoga.</span><Link href="/admin/purchases" className="font-semibold underline">Purchase kholein</Link></div>}
      {state.error && <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200">{state.error}</p>}

      <form action={formAction} className="grid items-start gap-4 xl:min-h-0 xl:flex-1 xl:grid-cols-[minmax(0,1fr)_330px] xl:overflow-hidden">
        <input type="hidden" name="supplier_bill_workspace" value="on" />
        <input type="hidden" name="items_json" value={itemPayload} />
        <input type="hidden" name="purchase_date" value={billDate} />
        <input type="hidden" name="branch_id" value={warehouses.find((item) => item.id === warehouseId)?.branchId ?? ""} />
        <input type="hidden" name="warehouse_id" value={warehouseId} />
        <input type="hidden" name="discount_amount" value={discount} />
        <input type="hidden" name="tax_amount" value={tax} />
        <input type="hidden" name="invoice_total" value={grandTotal} />

        <div className="space-y-4 xl:flex xl:min-h-0 xl:flex-col xl:space-y-3 xl:overflow-hidden">
          <section className="rounded-2xl border border-surface-200 bg-white p-4 shadow-sm dark:border-surface-800 dark:bg-surface-900">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className="sm:col-span-2 xl:col-span-1">
                <label className={labelClass}>Supplier</label>
                <div className="flex gap-2">
                  <select name="supplier_id" value={supplierId} onChange={(event) => setSupplierId(event.target.value)} className={inputClass} required>
                    <option value="">Supplier chunein</option>
                    {suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}
                  </select>
                  <Link href="/admin/suppliers" title="Supplier fehrist" className="inline-flex h-10 shrink-0 items-center gap-1 rounded-lg border border-brand-200 px-2.5 text-xs font-semibold text-brand-700 hover:bg-brand-50"><Plus className="h-4 w-4" /> Add</Link>
                </div>
                {selectedSupplier && (selectedSupplier.companyName || selectedSupplier.phone) && (
                  <p className="mt-1 text-[11px] text-surface-500 dark:text-surface-400">
                    {selectedSupplier.companyName ?? ""}{selectedSupplier.companyName && selectedSupplier.phone ? " · " : ""}{selectedSupplier.phone ?? ""}
                  </p>
                )}
              </div>
              <div>
                <label className={labelClass}>Invoice No.</label>
                <div className="flex gap-1.5">
                  <input name="supplier_bill_no" value={billNo} onChange={(e) => setBillNo(e.target.value)} className={inputClass} placeholder="e.g. GF-2026-0912" required maxLength={120} autoComplete="off" />
                  <button type="button" onClick={autoGenerateBillNo} disabled={billNoGenerating} title="System se auto number" className="inline-flex h-10 shrink-0 items-center gap-1 rounded-lg border border-surface-200 px-2.5 text-xs font-semibold text-surface-600 hover:bg-surface-50 disabled:opacity-50 dark:border-surface-700 dark:text-surface-300 dark:hover:bg-surface-800">
                    {billNoGenerating ? "…" : "Auto"}
                  </button>
                </div>
              </div>
              <div><label className={labelClass}>Bill Date</label><input type="date" value={billDate} onChange={(event) => setBillDate(event.target.value)} className={inputClass} required /></div>
              <div><label className={labelClass}>Shop / Warehouse</label><select className={inputClass} value={warehouseId} onChange={(event) => setWarehouseId(event.target.value)} required><option value="">Warehouse chunein</option>{warehouses.map((warehouse) => <option key={warehouse.id} value={warehouse.id}>{warehouse.name}{warehouse.shopName ? ` · ${warehouse.shopName}` : warehouse.branchName ? ` · ${warehouse.branchName}` : ""}</option>)}</select></div>
            </div>
          </section>

          <section className="overflow-visible rounded-2xl border border-surface-200 bg-white p-4 shadow-sm dark:border-surface-800 dark:bg-surface-900 xl:flex xl:min-h-0 xl:flex-1 xl:flex-col">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div><h2 className="font-display text-base font-semibold text-surface-900 dark:text-white">Bill ke Products</h2><p className="mt-0.5 text-xs text-surface-500">Product name ek martaba master mein save karein; agli dafa search se chunein.</p></div>
              <div className="flex flex-wrap items-center gap-2">
                <input ref={csvInputRef} type="file" accept=".csv,text/csv,text/plain" className="hidden" onChange={(event) => void loadBillCsv(event.target.files?.[0] ?? null)} />
                <button type="button" onClick={() => csvInputRef.current?.click()} className="inline-flex items-center gap-1.5 rounded-lg border border-surface-200 bg-white px-3 py-2 text-sm font-semibold text-surface-700 hover:border-brand-300 hover:text-brand-800 dark:border-surface-700 dark:bg-surface-900 dark:text-surface-200"><FileUp className="h-4 w-4" /> CSV Bill Upload</button>
                <button type="button" onClick={openNewProduct} className="inline-flex items-center gap-1.5 rounded-lg border border-brand-200 bg-brand-50 px-3 py-2 text-sm font-semibold text-brand-800 hover:bg-brand-100 dark:border-brand-900 dark:bg-brand-950/40 dark:text-brand-200"><PackagePlus className="h-4 w-4" /> New Product</button>
              </div>
            </div>
            {csvNotice && <p className={`mb-3 rounded-lg px-3 py-2 text-xs ${csvNotice.includes("nahi") || csvNotice.includes("mila") ? "bg-amber-50 text-amber-800 dark:bg-amber-950/30 dark:text-amber-200" : "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200"}`}>{csvNotice}</p>}
            <div className="mb-4 flex flex-wrap gap-2">
              <CategoryChip active={activeGroup === "all"} onClick={() => setActiveGroup("all")}>All Products</CategoryChip>
              {GROUPS.map((group) => <CategoryChip key={group.id} active={activeGroup === group.id} onClick={() => setActiveGroup(group.id)}>{group.label}</CategoryChip>)}
            </div>

            <div className="overflow-x-auto rounded-xl border border-surface-200 dark:border-surface-800 xl:min-h-0 xl:flex-1 xl:overflow-auto">
              <table className="w-full min-w-[780px] border-collapse text-sm">
                <thead><tr className="bg-surface-50 text-left text-xs text-surface-500 dark:bg-surface-800"><th className="w-10 px-3 py-2.5">#</th><th className="px-3 py-2.5">Product</th><th className="w-28 px-3 py-2.5">Pack / Unit</th><th className="w-24 px-3 py-2.5">Qty</th><th className="w-32 px-3 py-2.5">Purchase Rate</th><th className="w-28 px-3 py-2.5 text-right">Line Total</th><th className="w-12 px-3 py-2.5"></th></tr></thead>
                <tbody>
                  {lines.map((line, index) => {
                    const selected = products.find((product) => product.id === line.product_id);
                    const lineTotal = (Number(line.quantity) || 0) * (Number(line.unit_cost) || 0);
                    const normalizedQuery = line.query.trim().toLowerCase();
                    const matches = products.filter((product) => {
                      const group = groupForCategory(product.category_id, categories);
                      // Text search ho to category filter hatao — "egg" karyana
                      // mein na ho to bhi milna chahiye.
                      const categoryOk = normalizedQuery ? true : (activeGroup === "all" || group === activeGroup);
                      const textOk = !normalizedQuery || `${product.name} ${product.pack_size ?? ""} ${product.unit ?? ""}`.toLowerCase().includes(normalizedQuery);
                      return categoryOk && textOk;
                    }).slice(0, 12);
                    const csvUnmatched = !line.product_id && line.query.trim().length > 0;
                    return <tr key={index} className={`border-t border-surface-100 align-top dark:border-surface-800 ${csvUnmatched ? "bg-amber-50 dark:bg-amber-950/20" : ""}`}>
                      <td className="px-3 py-3 text-xs text-surface-400">{index + 1}</td>
                      <td className="relative px-3 py-2.5">
                        <div className="relative">
                          <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-surface-400" />
                          <input className={`${inputClass} pl-9`} value={line.query} onFocus={() => updateLine(index, { pickerOpen: true })} onChange={(event) => updateLine(index, { query: event.target.value, product_id: "", pickerOpen: true })} placeholder="Search and select product..." autoComplete="off" />
                          {line.pickerOpen && <>
                            <button aria-label="Close product search" type="button" className="fixed inset-0 z-10 cursor-default" onClick={() => updateLine(index, { pickerOpen: false })} />
                            <div className="absolute left-0 right-0 top-[calc(100%+4px)] z-20 max-h-64 overflow-auto rounded-xl border border-surface-200 bg-white p-1 shadow-xl dark:border-surface-700 dark:bg-surface-900">
                              {matches.map((product) => <button key={product.id} type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => selectProduct(index, product)} className="flex w-full items-center justify-between gap-3 rounded-lg px-2.5 py-2 text-left hover:bg-brand-50 dark:hover:bg-brand-950/40"><span className="flex min-w-0 items-center gap-2"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface-100 text-brand-700 dark:bg-surface-800"><FileText className="h-4 w-4" /></span><span className="min-w-0"><span className="block truncate font-medium text-surface-800 dark:text-surface-100">{product.name}</span><span className="block text-[11px] text-surface-400">{product.pack_size || product.unit || "Unit set nahi"}</span></span></span><span className="shrink-0 text-[11px] text-surface-500">{GROUPS.find((group) => group.id === groupForCategory(product.category_id, categories))?.label ?? "Other"}</span></button>)}
                              {matches.length === 0 && <p className="px-3 py-4 text-center text-xs text-surface-500">Product nahi mila. New Product se master mein add karein.</p>}
                              <button type="button" onClick={() => { updateLine(index, { pickerOpen: false }); openNewProduct(); }} className="flex w-full items-center gap-2 rounded-lg border-t border-surface-100 px-3 py-2.5 text-sm font-semibold text-brand-700 hover:bg-brand-50 dark:border-surface-800 dark:text-brand-300"><Plus className="h-4 w-4" /> New Product Master</button>
                            </div>
                          </>}
                        </div>
                        {csvUnmatched && <span className="mt-1 block text-[11px] text-amber-600 dark:text-amber-400">CSV se aaya — product search kar ke link karein ya New Product banayein</span>}
                        {selected && <span className="mt-1 block text-[11px] text-surface-400">{GROUPS.find((group) => group.id === groupForCategory(selected.category_id, categories))?.label ?? "Other"}</span>}
                        {selected && <details className="mt-1.5 text-[11px] text-surface-500"><summary className="w-fit cursor-pointer select-none">Sale / MRP / Wholesale rates <ChevronDown className="ml-1 inline h-3 w-3" /></summary><div className="mt-2 grid grid-cols-3 gap-2"><input aria-label="Sale rate" className={inputClass} type="number" min="0" step="0.01" value={line.sale_rate} onChange={(event) => updateLine(index, { sale_rate: event.target.value })} placeholder="Sale" /><input aria-label="MRP rate" className={inputClass} type="number" min="0" step="0.01" value={line.mrp_rate} onChange={(event) => updateLine(index, { mrp_rate: event.target.value })} placeholder="MRP" /><input aria-label="Wholesale rate" className={inputClass} type="number" min="0" step="0.01" value={line.wholesale_rate} onChange={(event) => updateLine(index, { wholesale_rate: event.target.value })} placeholder="Wholesale" /></div></details>}
                        {selected && <details className="mt-1.5 text-[11px] text-surface-500"><summary className="w-fit cursor-pointer select-none">Batch / expiry details <ChevronDown className="ml-1 inline h-3 w-3" /></summary><div className="mt-2 grid grid-cols-3 gap-2"><input aria-label="Batch number" className={inputClass} value={line.batch_number} onChange={(event) => updateLine(index, { batch_number: event.target.value })} placeholder="Batch no." /><input aria-label="Manufacture date" className={inputClass} type="date" value={line.manufacture_date} onChange={(event) => updateLine(index, { manufacture_date: event.target.value })} /><input aria-label="Expiry date" className={inputClass} type="date" value={line.expiry_date} onChange={(event) => updateLine(index, { expiry_date: event.target.value })} /></div></details>}
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="block truncate pt-2 text-xs text-surface-600 dark:text-surface-300">
                          {selected ? (
                            <>
                              {selected.pack_size || selected.unit || "—"}
                              {selected.units_per_pack && selected.units_per_pack > 1 && (
                                <span className="ml-1.5 rounded bg-surface-100 px-1 py-0.5 text-[10px] font-semibold text-surface-500 dark:bg-surface-800">
                                  ×{selected.units_per_pack}
                                </span>
                              )}
                            </>
                          ) : "—"}
                        </span>
                      </td>
                      <td className="px-3 py-2.5"><input aria-label="Quantity" className={inputClass} type="number" min="0.001" step="0.001" value={line.quantity} required={Boolean(line.product_id)} onChange={(event) => updateLine(index, { quantity: event.target.value })} /></td>
                      <td className="px-3 py-2.5"><div className="relative"><span className="absolute left-2.5 top-2.5 text-xs text-surface-400">Rs</span><input aria-label="Purchase rate" className={`${inputClass} pl-8`} type="number" min="0" step="0.01" value={line.unit_cost} required={Boolean(line.product_id)} onChange={(event) => updateLine(index, { unit_cost: event.target.value })} /></div></td>
                      <td className="px-3 py-3 text-right font-semibold tabular-nums text-surface-800 dark:text-surface-100">Rs {lineTotal.toLocaleString("en-PK", { maximumFractionDigits: 2 })}</td>
                      <td className="px-3 py-2.5"><button type="button" disabled={lines.length === 1} onClick={() => setLines((previous) => previous.filter((_, i) => i !== index))} className="rounded-lg p-2 text-surface-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-30"><Trash2 className="h-4 w-4" /></button></td>
                    </tr>;
                  })}
                </tbody>
              </table>
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2"><button type="button" onClick={() => setLines((previous) => [...previous, emptyLine()])} className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-sm font-semibold text-brand-700 hover:bg-brand-50 dark:text-brand-300 dark:hover:bg-brand-950/30"><Plus className="h-4 w-4" /> Add bill line</button><span className="text-xs text-surface-400">{lines.filter((line) => line.product_id).length} product lines</span></div>
          </section>
          <p className="rounded-xl border border-blue-100 bg-blue-50/70 px-4 py-3 text-xs leading-relaxed text-blue-900 dark:border-blue-900/60 dark:bg-blue-950/25 dark:text-blue-200">Bill save hone ke baad maal approved purchase mein rahega. Asal stock sirf <strong>GRN / Maal Receive</strong> par ginti ke baad warehouse mein charhega.</p>
        </div>

        <aside className="xl:h-full xl:min-h-0 xl:overflow-hidden">
          <section className="rounded-2xl border border-surface-200 bg-white p-4 shadow-sm dark:border-surface-800 dark:bg-surface-900 xl:h-full xl:overflow-y-auto xl:overscroll-contain">
            <div className="mb-4 flex items-center gap-2"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 text-brand-700 dark:bg-brand-950/40 dark:text-brand-300"><FileText className="h-5 w-5" /></span><div><h2 className="font-display font-semibold text-surface-900 dark:text-white">Bill Summary</h2><p className="text-[11px] text-surface-400">Supplier invoice ka hisaab</p></div></div>
            <div className="space-y-3 border-b border-surface-100 pb-4 dark:border-surface-800"><SummaryLine label="Subtotal" value={subtotal} /><div className="grid grid-cols-[1fr_112px] items-center gap-3"><label htmlFor="discount" className="text-sm text-surface-500">Discount</label><input id="discount" type="number" min="0" max={subtotal} step="0.01" value={discount} onChange={(event) => setDiscount(event.target.value)} className={`${inputClass} text-right`} placeholder="0" /></div><div className="grid grid-cols-[1fr_112px] items-center gap-3"><label htmlFor="tax" className="text-sm text-surface-500">Tax</label><input id="tax" type="number" min="0" step="0.01" value={tax} onChange={(event) => setTax(event.target.value)} className={`${inputClass} text-right`} placeholder="0" /></div></div>
            <div className="my-4 rounded-xl bg-brand-50 px-3.5 py-3 dark:bg-brand-950/30"><SummaryLine label="Total Amount" value={grandTotal} strong /></div>
            <div className="space-y-3 border-b border-surface-100 pb-4 dark:border-surface-800"><div><label className={labelClass}>Payment Status</label><select name="payment_terms" value={terms} onChange={(event) => { setTerms(event.target.value as typeof terms); setPaidNow(""); }} className={inputClass}><option value="credit">Credit / Udhaar</option><option value="partial">Partial Payment</option><option value="paid">Fully Paid</option></select></div>{terms === "partial" && <div><label className={labelClass}>Paid Now</label><input name="paid_now" type="number" min="0.01" max={Math.max(0, grandTotal - 0.01)} step="0.01" value={paidNow} onChange={(event) => setPaidNow(event.target.value)} className={inputClass} placeholder="Paid amount" required /></div>}{terms !== "paid" && <div className="grid grid-cols-2 gap-2"><div><label className={labelClass}>Credit Days</label><input name="credit_days" type="number" min="0" step="1" defaultValue="30" className={inputClass} /></div><div><label className={labelClass}>Due Date</label><input name="due_date" type="date" className={inputClass} /></div></div>}<div className="flex items-center justify-between text-sm"><span className="text-surface-500">Paid</span><span className="font-semibold text-surface-800 dark:text-surface-100">Rs {Math.min(grandTotal, Math.max(0, paidAmount)).toLocaleString("en-PK", { maximumFractionDigits: 2 })}</span></div><div className="flex items-center justify-between rounded-lg bg-emerald-50 px-3 py-2 text-sm dark:bg-emerald-950/30"><span className="font-medium text-emerald-800 dark:text-emerald-200">Due</span><span className="font-bold tabular-nums text-emerald-800 dark:text-emerald-200">Rs {amountDue.toLocaleString("en-PK", { maximumFractionDigits: 2 })}</span></div></div>
            <div className="mt-4 space-y-3"><div><label className={labelClass}>Payment Method</label><select name="payment_method" className={inputClass}><option value="cash">Cash</option><option value="bank_transfer">Bank Transfer</option><option value="cheque">Cheque</option><option value="easypaisa">Easypaisa</option><option value="jazzcash">JazzCash</option></select></div><div><label className={labelClass}>Paid From Account</label><select name="finance_account_id" defaultValue={accounts.find((account) => account.account_type === "cash")?.id ?? ""} className={inputClass}><option value="">Default cash account</option>{accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select></div><div><label className={labelClass}>Reference / Note</label><textarea name="notes" rows={3} className="w-full resize-y rounded-lg border border-surface-200 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500 dark:border-surface-700 dark:bg-surface-950 dark:text-surface-100" placeholder="Payment ref, bill remarks..." /></div>
              <SaveBillButton />
              <p className="text-center text-[11px] leading-relaxed text-surface-400">Payment ledger mein record hogi. Stock GRN ke baad update hoga.</p>
            </div>
          </section>
        </aside>
      </form>

      {productModal && <div className="fixed inset-0 z-[80] flex items-center justify-center bg-surface-950/50 p-4" role="dialog" aria-modal="true" aria-labelledby="new-product-title" onMouseDown={(event) => { if (event.target === event.currentTarget) setProductModal(false); }}><form onSubmit={saveNewProduct} className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl dark:bg-surface-900"><div className="mb-4 flex items-start justify-between"><div><h2 id="new-product-title" className="font-display text-lg font-semibold text-surface-900 dark:text-white">Product Master mein add karein</h2><p className="mt-1 text-xs text-surface-500">Naam aur category save rahegi; agli purchase mein search se mil jayegi.</p></div><button type="button" onClick={() => setProductModal(false)} className="rounded-lg p-2 text-surface-400 hover:bg-surface-100"><X className="h-5 w-5" /></button></div>
        {newProductError && <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{newProductError}</p>}
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2"><label className={labelClass}>Quick Stock Group</label><div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{GROUPS.map((group) => <button key={group.id} type="button" onClick={() => { setNewProductGroup(group.id); const root = rootForGroup(group.id); setNewProductCategory(root?.id ?? ""); }} className={`rounded-lg border px-3 py-2 text-sm font-medium ${newProductGroup === group.id ? "border-brand-600 bg-brand-50 text-brand-800" : "border-surface-200 text-surface-600 hover:border-brand-300"}`}>{group.label}</button>)}</div></div>
          <div className="sm:col-span-2">
              <label className={labelClass}>Product Name</label>
              <input required maxLength={120} autoFocus value={newProductName} onChange={(event) => setNewProductName(event.target.value)} className={inputClass} placeholder="e.g. Urea 46% 50 kg" />
              {existingMatches.length > 0 && (
                <div className="mt-1.5 rounded-lg border border-emerald-200 bg-emerald-50 p-2 dark:border-emerald-900/50 dark:bg-emerald-950/30">
                  <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">Ye system mein pehle se hain — seedha bill mein add kar lein:</p>
                  <div className="space-y-1">
                    {existingMatches.map((product) => (
                      <button key={product.id} type="button" onClick={() => addExistingToLine(product)} className="flex w-full items-center justify-between gap-2 rounded-lg bg-white px-3 py-2 text-left hover:bg-emerald-50 dark:bg-surface-900 dark:hover:bg-emerald-950/30">
                        <span>
                          <span className="text-sm font-medium text-surface-900 dark:text-white">{product.name}</span>
                          {product.pack_size && <span className="ml-1.5 text-xs text-surface-500">{product.pack_size}</span>}
                        </span>
                        <span className="shrink-0 text-xs font-semibold text-emerald-700 dark:text-emerald-400">Rs {product.purchase_price} → Add</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          <div><label className={labelClass}>Product Category ({categories.length} available)</label><select required value={newProductCategory} onChange={(event) => setNewProductCategory(event.target.value)} className={inputClass}><option value="">Category chunein</option>{newProductCategories.map((category) => { const parent = category.parent_category_id ? categories.find((item) => item.id === category.parent_category_id)?.name : null; return <option key={category.id} value={category.id}>{parent ? `${parent} → ${category.name}` : category.name}</option>; })}</select></div>
          <div><label className={labelClass}>Company Name ({companies.length} available)</label><select value={newProductCompany} onChange={(event) => setNewProductCompany(event.target.value)} className={inputClass}><option value="">Company chunein (optional)</option>{companies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}</select></div>
          <div><label className={labelClass}>Pack / Unit</label><input value={newProductPack} onChange={(event) => setNewProductPack(event.target.value)} className={inputClass} placeholder="Bag (50 kg)" /></div>
          <div><label className={labelClass}>Unit (optional)</label><select value={newProductUnit} onChange={(event) => setNewProductUnit(event.target.value)} className={inputClass}><option value="">Pack size se liya jayega</option>{units.map((unit) => <option key={unit.code} value={unit.code}>{unit.label}</option>)}</select></div>
          <div><label className={labelClass}>Purchase Rate</label><input required type="number" min="0" step="0.01" value={newProductPurchase} onChange={(event) => setNewProductPurchase(event.target.value)} className={inputClass} placeholder="0" /></div>
          <div><label className={labelClass}>Sale Rate</label><input type="number" min="0" step="0.01" value={newProductSale} onChange={(event) => setNewProductSale(event.target.value)} className={inputClass} placeholder="0" /></div>
          <div><label className={labelClass}>MRP Rate</label><input type="number" min="0" step="0.01" value={newProductMrp} onChange={(event) => setNewProductMrp(event.target.value)} className={inputClass} placeholder="0" /></div>
          <div><label className={labelClass}>Wholesale Rate</label><input type="number" min="0" step="0.01" value={newProductWholesale} onChange={(event) => setNewProductWholesale(event.target.value)} className={inputClass} placeholder="0" /></div>
        </div>
        <div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => setProductModal(false)} className="rounded-lg border border-surface-200 px-4 py-2 text-sm text-surface-600">Cancel</button><button type="submit" disabled={newProductBusy || !newProductCategories.length} className="inline-flex items-center gap-2 rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-800 disabled:opacity-50">{newProductBusy ? "Saving..." : <><Check className="h-4 w-4" /> Save to Product Master</>}</button></div>
      </form></div>}
    </div>
  );
}

function CategoryChip({ active, children, onClick }: { active: boolean; children: React.ReactNode; onClick: () => void }) {
  return <button type="button" onClick={onClick} className={`rounded-lg border px-3 py-2 text-xs font-semibold transition ${active ? "border-brand-700 bg-brand-700 text-white shadow-sm" : "border-surface-200 bg-white text-surface-600 hover:border-brand-300 hover:text-brand-800 dark:border-surface-700 dark:bg-surface-900 dark:text-surface-300"}`}>{children}</button>;
}

function SummaryLine({ label, value, strong = false }: { label: string; value: number; strong?: boolean }) {
  return <div className={`flex items-center justify-between gap-3 ${strong ? "text-base font-semibold text-surface-900 dark:text-white" : "text-sm text-surface-500"}`}><span>{label}</span><span className="tabular-nums">Rs {value.toLocaleString("en-PK", { maximumFractionDigits: 2 })}</span></div>;
}

function SaveBillButton() {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={pending} className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-800 disabled:cursor-wait disabled:opacity-60"><FileText className="h-4 w-4" />{pending ? "Bill save ho raha hai..." : "Save & Post Bill"}</button>;
}
