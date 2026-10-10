"use client";
import { importBillCsv } from "@/lib/purchases/bill-csv-import";
import { buildNewProductPrefill, pickPrefillLine } from "@/lib/purchases/new-product-prefill";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import {
  AlertCircle, ArrowLeft, Check, CheckCircle2, FileText, FileUp,
  PackagePlus, Plus, Search, ShoppingCart, Trash2, X,
} from "lucide-react";
import { createPurchase, type ActionState } from "@/actions/purchases";
import { quickCreateProduct } from "@/actions/products";
import { aajKaKhana } from "@/lib/utils/format";
import { looksBinary } from "@/lib/csv";
import { parseBillNumber, purchaseLineTotal, purchaseBillTotals, patchBillRow } from "@/lib/purchases/bill-math";

type Category = { id: string; name: string; parent_category_id: string | null; category_kind: string };
type Product = {
  id: string; name: string; company_id: string | null; category_id: string | null; pack_size: string | null; units_per_pack: number | null; unit: string | null;
  purchase_price: number; selling_price: number; wholesale_price: number | null; mrp_price: number | null; trade_rate_pending: boolean;
  product_code: string | null;
};
type Line = {
  row_id: string;
  product_id: string; query: string; quantity: string; unit_cost: string;
  sale_rate: string; mrp_rate: string; wholesale_rate: string;
  batch_number: string; manufacture_date: string; expiry_date: string; pickerOpen: boolean;
  pack_override: string; units_per_pack_override: string;
  source_pack?: string; source_company?: string; source_category?: string; source_group?: string;
};
type StockGroup = "karyana" | "khaad" | "wanda" | "pesticide";
const GROUPS: { id: StockGroup; label: string; roots: string[] }[] = [
  { id: "karyana", label: "Karyana", roots: ["grocery", "karyana"] },
  { id: "khaad", label: "Khaad", roots: ["fertilizer", "fertiliser", "khaad"] },
  { id: "wanda", label: "Wanda", roots: ["wanda", "animal feed", "animal feed (wanda)"] },
  { id: "pesticide", label: "Pesticide", roots: ["pesticide", "pesticides"] },
];
let nextRowId = 0;
const emptyLine = (): Line => ({ row_id: `bill-row-${++nextRowId}`, product_id: "", query: "", quantity: "", unit_cost: "", sale_rate: "", mrp_rate: "", wholesale_rate: "", batch_number: "", manufacture_date: "", expiry_date: "", pickerOpen: false, pack_override: "", units_per_pack_override: "" });
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

const csvNumber = (value: string | undefined) => {
  const parsed = parseBillNumber(value);
  return parsed === null ? String(value ?? "").trim() : String(parsed);
};

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
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [activeBrand, setActiveBrand] = useState<string>("all");
  const [lines, setLines] = useState<Line[]>([emptyLine()]);
  const [terms, setTerms] = useState<"paid" | "partial" | "credit">("credit");
  const [paidNow, setPaidNow] = useState("");
  const [discount, setDiscount] = useState("");
  const [tax, setTax] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [financeAccountId, setFinanceAccountId] = useState(accounts.find((a) => a.account_type === "cash")?.id ?? "");
  const [creditDays, setCreditDays] = useState("30");
  const [dueDate, setDueDate] = useState("");
  const [billNotes, setBillNotes] = useState("");
  const [newProductRowId, setNewProductRowId] = useState<string | null>(null);
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
  const [newProductUnitsPerPack, setNewProductUnitsPerPack] = useState("");
  const [csvNotice, setCsvNotice] = useState("");
  const [csvPreview, setCsvPreview] = useState<ReturnType<typeof importBillCsv> | null>(null);
  const [validationError, setValidationError] = useState("");
  const [billNo, setBillNo] = useState("");
  const [billNoGenerating, setBillNoGenerating] = useState(false);
  const csvInputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const prevBillNoRef = useRef("");
  const paymentProofInputRef = useRef<HTMLInputElement>(null);
  const [isOnline, setIsOnline] = useState(true);
  const [syncStatus, setSyncStatus] = useState<"idle" | "queued" | "syncing" | "synced" | "sync_error">("idle");
  const [paymentProofUrl, setPaymentProofUrl] = useState("");
  const [paymentProofUploading, setPaymentProofUploading] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [goToGrn, setGoToGrn] = useState(false);
  const reviewApprovedRef = useRef(false);
  const router = useRouter();

  // Online/offline detect + auto-sync when internet returns
  useEffect(() => {
    setIsOnline(navigator.onLine);
    const off = () => setIsOnline(false);
    const on = () => {
      setIsOnline(true);
      // Check if there's a pending offline bill to auto-submit
      let pending: string | null = null;
      try { pending = localStorage.getItem("offline_bill_pending"); } catch { /* ignore */ }
      if (!pending) return;
      setSyncStatus("syncing");
      let fd: FormData;
      try {
        const entries = JSON.parse(pending) as Record<string, string>;
        fd = new FormData();
        for (const [k, v] of Object.entries(entries)) fd.append(k, v);
      } catch { setSyncStatus("sync_error"); return; }
      createPurchase({}, fd).then((result) => {
        if (result.success) {
          try { localStorage.removeItem("offline_bill_pending"); localStorage.removeItem("supplier_bill_draft"); } catch { /* ignore */ }
          setSyncStatus("synced");
        } else { setSyncStatus("sync_error"); }
      }).catch(() => setSyncStatus("sync_error"));
    };
    window.addEventListener("offline", off);
    window.addEventListener("online", on);
    return () => { window.removeEventListener("offline", off); window.removeEventListener("online", on); };
  }, []);

  // Redirect to purchases list after save+GRN
  useEffect(() => {
    if (state.success && goToGrn && state.purchaseId) {
      router.push("/admin/purchases");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.success]);

  // Intercept form submit — show review modal first (online), or queue offline
  function handleFormSubmit(e: React.FormEvent<HTMLFormElement>) {
    if (csvPreview) { e.preventDefault(); setValidationError("Pehle CSV preview mein import ya cancel chunein. Purana draft galti se submit nahi hoga."); return; }
    const active = lines.filter((l) => l.query.trim() || l.product_id || l.quantity.trim() || l.unit_cost.trim());
    const unmapped = active.findIndex((l) => !l.product_id);
    const totals = purchaseBillTotals(active, discount, tax, paidAmount);
    const error = unmapped >= 0 ? `Line ${unmapped + 1}: Product Master se link karein. Koi CSV row save se chhori nahi jayegi.` : totals.errors[0];
    if (error) { e.preventDefault(); setValidationError(error); return; }
    setValidationError("");

    if (isOnline && !reviewApprovedRef.current) {
      e.preventDefault();
      setReviewOpen(true);
      return;
    }
    reviewApprovedRef.current = false; // reset after approved submit passes through
    if (isOnline) return; // approved online submit: let server action handle normally
    e.preventDefault();
    if (!formRef.current) return;
    try {
      const fd = new FormData(formRef.current);
      const entries: Record<string, string> = {};
      fd.forEach((value, key) => { entries[key] = String(value); });
      localStorage.setItem("offline_bill_pending", JSON.stringify(entries));
      setSyncStatus("queued");
    } catch { /* storage full — ignore */ }
  }

  // Clear draft on successful submit
  useEffect(() => {
    if (state.success) { try { localStorage.removeItem("supplier_bill_draft"); } catch { /* ignore */ } }
  }, [state.success]);

  // Draft restore on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem("supplier_bill_draft");
      if (!raw) return;
      const d = JSON.parse(raw);
      if (d.supplierId) setSupplierId(d.supplierId);
      if (d.warehouseId) setWarehouseId(d.warehouseId);
      if (d.billDate) setBillDate(d.billDate);
      if (d.billNo) setBillNo(d.billNo);
      if (d.terms) setTerms(d.terms);
      if (d.paidNow) setPaidNow(d.paidNow);
      if (d.discount !== undefined) setDiscount(d.discount);
      if (d.tax !== undefined) setTax(d.tax);
      if (d.paymentMethod) setPaymentMethod(d.paymentMethod);
      if (d.financeAccountId) setFinanceAccountId(d.financeAccountId);
      if (d.creditDays !== undefined) setCreditDays(d.creditDays);
      if (d.dueDate !== undefined) setDueDate(d.dueDate);
      if (d.billNotes !== undefined) setBillNotes(d.billNotes);
      if (d.paymentProofUrl) setPaymentProofUrl(d.paymentProofUrl);
      if (Array.isArray(d.lines) && d.lines.length > 0) setLines(d.lines.map((l: Line) => ({ ...emptyLine(), ...l, row_id: emptyLine().row_id, query: String(l.query ?? ""), quantity: csvNumber(String(l.quantity ?? "")), unit_cost: csvNumber(String(l.unit_cost ?? "")), pack_override: String(l.pack_override ?? ""), units_per_pack_override: String(l.units_per_pack_override ?? ""), pickerOpen: false })));
    } catch { /* ignore */ }
  }, []);

  // Auto-save draft (debounced 800ms) whenever key fields change
  useEffect(() => {
    const t = setTimeout(() => {
      try {
        const hasData = lines.some((l) => l.product_id || l.query.trim() || l.quantity.trim() || l.unit_cost.trim()) || supplierId;
        if (!hasData) { localStorage.removeItem("supplier_bill_draft"); return; }
        localStorage.setItem("supplier_bill_draft", JSON.stringify({ version: 2, supplierId, warehouseId, billDate, billNo, terms, paidNow, lines, discount, tax, paymentMethod, financeAccountId, creditDays, dueDate, billNotes, paymentProofUrl }));
      } catch { /* quota ignore */ }
    }, 800);
    return () => clearTimeout(t);
  }, [supplierId, warehouseId, billDate, billNo, terms, paidNow, lines, discount, tax, paymentMethod, financeAccountId, creditDays, dueDate, billNotes, paymentProofUrl]);

  const selectedSupplier = suppliers.find((s) => s.id === supplierId) ?? null;

  async function autoGenerateBillNo() {
    setBillNoGenerating(true);
    try {
      const { getNextSupplierBillNo } = await import("@/actions/purchases");
      const result = await getNextSupplierBillNo();
      if ("billNo" in result) handleBillNoChange(result.billNo);
    } finally {
      setBillNoGenerating(false);
    }
  }

  function handleBillNoChange(newNo: string) {
    const prev = prevBillNoRef.current;
    setBillNo(newNo);
    prevBillNoRef.current = newNo;
    setLines((prevLines) =>
      prevLines.map((line) =>
        line.batch_number === "" || line.batch_number === prev
          ? { ...line, batch_number: newNo }
          : line
      )
    );
  }

  function handleBillDateChange(newDate: string) {
    setBillDate(newDate);
    setLines((prevLines) =>
      prevLines.map((line) =>
        line.manufacture_date === "" ? { ...line, manufacture_date: newDate } : line
      )
    );
  }

  function newLineWithDefaults(): Line {
    return { ...emptyLine(), batch_number: billNo, manufacture_date: billDate };
  }

  async function handlePaymentProofChange(file: File | null) {
    if (!file) { setPaymentProofUrl(""); return; }
    setPaymentProofUploading(true);
    try {
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
      const path = `payment-proofs/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error } = await supabase.storage.from("payment-proofs").upload(path, file, { cacheControl: "3600", upsert: false });
      if (error) { console.error("Screenshot upload error:", error); return; }
      const { data: { publicUrl } } = supabase.storage.from("payment-proofs").getPublicUrl(path);
      setPaymentProofUrl(publicUrl);
    } finally {
      setPaymentProofUploading(false);
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

  const subtotal = useMemo(() => purchaseBillTotals(lines).subtotal, [lines]);
  const existingMatches = useMemo(() => {
    const q = newProductName.trim().toLowerCase();
    if (q.length < 2) return [];
    return products.filter((p) => p.name.toLowerCase().includes(q)).slice(0, 5);
  }, [newProductName, products]);
  const grandTotal = purchaseBillTotals(lines, discount, tax).total;
  const paidAmount = terms === "paid" ? grandTotal : terms === "partial" ? Number(paidNow) || 0 : 0;
  const amountDue = purchaseBillTotals(lines, discount, tax, paidAmount).due;
  const discountRatio = subtotal > 0 && Number(discount) > 0 ? Number(discount) / subtotal : 0;
  const itemPayload = JSON.stringify(lines.filter((line) => line.product_id && Number(line.quantity) > 0 && line.unit_cost.trim() !== "" && Number(line.unit_cost) >= 0).map((line) => {
    const rawCost = Number(line.unit_cost);
    const effectiveCost = rawCost;
    return {
      product_id: line.product_id, quantity: Number(line.quantity), unit_cost: effectiveCost,
      sale_rate: Number(line.sale_rate) > 0 ? Number(line.sale_rate) : undefined,
      mrp_rate: Number(line.mrp_rate) > 0 ? Number(line.mrp_rate) : undefined,
      wholesale_rate: Number(line.wholesale_rate) > 0 ? Number(line.wholesale_rate) : undefined,
      batch_number: line.batch_number || undefined, manufacture_date: line.manufacture_date || undefined, expiry_date: line.expiry_date || undefined,
      pack_size_override: line.pack_override.trim() || undefined,
      units_per_pack: Number(line.units_per_pack_override) > 1 ? Number(line.units_per_pack_override) : undefined,
    };
  }));
  // Invoice rows retain trade rates; the header discount is applied once.
  const backendDiscount = parseBillNumber(discount) ?? 0;

  function updateLine(index: number, patch: Partial<Line>) {
    const rowId = lines[index]?.row_id;
    if (rowId) setLines((previous) => patchBillRow(previous, rowId, patch));
  }
  function selectProduct(index: number, product: Product) {
    const importedUnits = Number(lines[index]?.units_per_pack_override);
    if (!lines[index]?.product_id && importedUnits > 1 && product.units_per_pack && product.units_per_pack > 1 && importedUnits !== product.units_per_pack) {
      setValidationError(`Is CSV row mein ${importedUnits} items/pack hain, ${product.name} mein ${product.units_per_pack}. Sahi pack wala product chunein; stock ki ginti khud se nahi badlegi.`);
      return;
    }
    setValidationError("");
    updateLine(index, {
      product_id: product.id,
      query: `${product.name}${product.pack_size ? ` · ${product.pack_size}` : ""}`,
      unit_cost: !lines[index]?.product_id && lines[index]?.unit_cost.trim() ? lines[index].unit_cost : product.trade_rate_pending ? "" : String(product.purchase_price),
      sale_rate: !lines[index]?.product_id && lines[index]?.sale_rate.trim() ? lines[index].sale_rate : product.selling_price > 0 ? String(product.selling_price) : "",
      mrp_rate: !lines[index]?.product_id && lines[index]?.mrp_rate.trim() ? lines[index].mrp_rate : product.mrp_price != null && product.mrp_price > 0 ? String(product.mrp_price) : "",
      wholesale_rate: !lines[index]?.product_id && lines[index]?.wholesale_rate.trim() ? lines[index].wholesale_rate : product.wholesale_price != null && product.wholesale_price > 0 ? String(product.wholesale_price) : "",
      pickerOpen: false,
      pack_override: product.pack_size ?? product.unit ?? "",
      units_per_pack_override: !lines[index]?.product_id ? lines[index]?.units_per_pack_override || "" : "",
    });
  }
  function openNewProduct(rowId?: string) {
    // Every entry path (CSV warning row, row search "New Product Master", top "New Product") prefills from the CSV line.
    const row = pickPrefillLine(lines, rowId);
    const prefill = buildNewProductPrefill({
      line: row, products, categories, companies, supplierCompany: selectedSupplier?.companyName,
      fallbackGroup: activeGroup === "all" ? "khaad" : activeGroup,
      groupForCategory: (id) => groupForCategory(id, categories), rootForGroup,
    });
    setNewProductRowId(prefill.rowId);
    setNewProductName(prefill.name);
    setNewProductPack(prefill.pack);
    setNewProductPurchase(prefill.purchase);
    setNewProductSale(prefill.sale);
    setNewProductMrp(prefill.mrp);
    setNewProductWholesale(prefill.wholesale);
    setNewProductUnitsPerPack(prefill.unitsPerPack);
    setNewProductGroup(prefill.group);
    setNewProductCategory(prefill.categoryId);
    setNewProductCompany(prefill.companyId);
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
      unitsPerPack: Number(newProductUnitsPerPack) > 1 ? Number(newProductUnitsPerPack) : null,
    });
    setNewProductBusy(false);
    if ("error" in result) { setNewProductError(result.error); return; }
    const created: Product = {
      id: result.id, name: newProductName.trim(), company_id: newProductCompany || null, category_id: newProductCategory || null,
      pack_size: newProductPack.trim() || null, units_per_pack: Number(newProductUnitsPerPack) > 1 ? Math.round(Number(newProductUnitsPerPack)) : null, unit: units.find((unit) => unit.code === newProductUnit)?.label ?? null,
      purchase_price: purchaseRate, selling_price: Number(newProductSale) || 0,
      mrp_price: Number(newProductMrp) || null, wholesale_price: Number(newProductWholesale) || null,
      trade_rate_pending: false, product_code: result.productCode,
    };
    setProducts((previous) => [...previous.filter((p) => p.id !== created.id), created].sort((a, b) => a.name.localeCompare(b.name)));
    setLines((previous) => {
      const index = previous.findIndex((line) => newProductRowId ? line.row_id === newProductRowId : !line.product_id && !line.query.trim());
      const selectedRates = {
        sale_rate: created.selling_price > 0 ? String(created.selling_price) : "",
        mrp_rate: created.mrp_price ? String(created.mrp_price) : "",
        wholesale_rate: created.wholesale_price ? String(created.wholesale_price) : "",
      };
      if (index < 0) return [...previous, { ...newLineWithDefaults(), product_id: created.id, query: `${created.name}${created.pack_size ? ` · ${created.pack_size}` : ""}`, unit_cost: String(created.purchase_price), ...selectedRates, pickerOpen: false, pack_override: created.pack_size ?? "" }];
      return previous.map((line, i) => i === index ? { ...line, product_id: created.id, query: `${created.name}${created.pack_size ? ` · ${created.pack_size}` : ""}`, unit_cost: line.unit_cost.trim() || String(created.purchase_price), ...selectedRates, sale_rate: line.sale_rate.trim() || selectedRates.sale_rate, mrp_rate: line.mrp_rate.trim() || selectedRates.mrp_rate, wholesale_rate: line.wholesale_rate.trim() || selectedRates.wholesale_rate, pickerOpen: false, pack_override: created.pack_size ?? line.pack_override ?? "", units_per_pack_override: created.units_per_pack && created.units_per_pack > 1 ? "" : line.units_per_pack_override } : line);
    });
    setProductModal(false);
    setNewProductName(""); setNewProductPack(""); setNewProductUnit(""); setNewProductCompany("");
    setNewProductPurchase(""); setNewProductSale(""); setNewProductMrp(""); setNewProductWholesale(""); setNewProductUnitsPerPack("");
  }

  function addExistingToLine(product: Product) {
    setLines((previous) => {
      const index = previous.findIndex((line) => newProductRowId ? line.row_id === newProductRowId : !line.product_id && !line.query.trim());
      const entry = {
        ...newLineWithDefaults(),
        product_id: product.id,
        query: `${product.name}${product.pack_size ? ` · ${product.pack_size}` : ""}`,
        unit_cost: String(product.purchase_price),
        sale_rate: product.selling_price > 0 ? String(product.selling_price) : "",
        mrp_rate: product.mrp_price ? String(product.mrp_price) : "",
        wholesale_rate: product.wholesale_price ? String(product.wholesale_price) : "",
        pickerOpen: false,
        pack_override: product.pack_size ?? product.unit ?? "",
      };
      if (index < 0) return [...previous, entry];
      return previous.map((line, i) => (i === index ? { ...line, ...entry, row_id: line.row_id, quantity: line.quantity, unit_cost: line.unit_cost.trim() || entry.unit_cost } : line));
    });
    setProductModal(false);
    setNewProductName("");
  }

  async function loadBillCsv(file: File | null) {
    if (!file) return;
    setCsvNotice("");
    let text: string;
    try { text = await file.text(); }
    catch { setCsvNotice("CSV file parhi nahi ja saki. Dobara file chunein; bill draft mehfooz hai."); if (csvInputRef.current) csvInputRef.current.value = ""; return; }
    if (looksBinary(text)) {
      setCsvNotice("Excel .xlsx file nahi chalegi. Excel se File → Save As → CSV bana kar upload karein.");
      if (csvInputRef.current) csvInputRef.current.value = "";
      return;
    }
    const imported = importBillCsv(text, products);
    const draftHasData = lines.some((line) => line.product_id || line.query.trim() || line.quantity.trim() || line.unit_cost.trim());
    if (!imported.errors.length && imported.rows.length > 0 && !draftHasData) {
      applyCsv(imported, false);
    } else {
      setCsvPreview(imported);
    }
    if (csvInputRef.current) csvInputRef.current.value = "";
  }

  function applyCsv(csv: ReturnType<typeof importBillCsv>, append: boolean) {
    const imported = csv.rows.map(row => ({
      ...newLineWithDefaults(), ...row, row_id: emptyLine().row_id,
      query: row.name, pickerOpen: false,
      batch_number: row.batch_number || billNo,
      manufacture_date: row.manufacture_date || billDate,
    }));
    setLines(previous => append ? [...previous.filter(row => row.query.trim() || row.product_id || row.quantity.trim()), ...imported] : imported);
    setCsvNotice(`${imported.length} CSV lines auto-fill ho gayin. Code, pack, quantity aur tamam rates CSV se aa gaye. Qty packs mein hai; sale/MRP per item. ${csv.warnings.join(" ")}`);
    setValidationError("");
    setCsvPreview(null);
  }

  function acceptCsv(append: boolean) {
    if (!csvPreview || csvPreview.errors.length) return;
    applyCsv(csvPreview, append);
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

      {!isOnline && syncStatus !== "queued" && <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200"><span className="h-2 w-2 animate-pulse rounded-full bg-amber-500" />Offline Mode — Bill ka data save ho raha hai. Submit karo — internet aate hi khud chala jayega.</div>}
      {syncStatus === "queued" && <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200"><span className="h-2 w-2 animate-pulse rounded-full bg-amber-500" />Bill saved — internet aate hi auto-submit ho jayega, kuch karna nahi.</div>}
      {syncStatus === "syncing" && <div className="flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-medium text-blue-800 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-200"><span className="h-2 w-2 animate-pulse rounded-full bg-blue-500" />Internet aa gaya — Bill auto-submit ho raha hai...</div>}
      {syncStatus === "synced" && <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200"><span className="flex items-center gap-2"><Check className="h-4 w-4" /> Offline bill auto-submit ho gaya! Stock GRN ke baad charhega.</span><Link href="/admin/purchases" className="font-semibold underline">Purchase kholein</Link></div>}
      {syncStatus === "sync_error" && <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200">Auto-sync mein masla aaya. Dobara submit karein.</p>}
      {state.success && syncStatus !== "synced" && <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200"><span className="flex items-center gap-2"><Check className="h-4 w-4" /> Bill save ho gaya. Stock tab charhega jab GRN par maal receive/count hoga.</span><Link href="/admin/purchases" className="font-semibold underline">Purchase kholein</Link></div>}
      {validationError && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{validationError}</p>}
      {state.error && <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200">{state.error}</p>}

      {csvPreview && <section role="dialog" aria-label="CSV Import Preview" className="rounded-2xl border border-brand-200 bg-white p-4 shadow-sm dark:bg-surface-900">
        <h2 className="text-lg font-semibold">CSV Import Preview — {csvPreview.rows.length} lines</h2>
        <p className="my-2 text-sm text-surface-600">Bill quantity packs mein hai. Pack 10×6 aur Quantity 60 bottles ho to 10 packs × trade rate calculate hoga. Product Code se exact master link hoga. Amount column purana total overwrite nahi karega.</p>
        {csvPreview.errors.map((message, i) => <p key={`error-${i}`} role="alert" className="my-1 text-xs text-red-700">{message}</p>)}
        {csvPreview.warnings.map((message, i) => <p key={`warning-${i}`} className="my-1 text-xs text-amber-800">{message}</p>)}
        <div className="my-3 max-h-80 overflow-auto"><table className="w-full min-w-[1180px] text-left text-xs"><thead><tr><th className="p-2">Code</th><th className="p-2">Product / Master link</th><th className="p-2">Pack</th><th className="p-2">Total items</th><th className="p-2">Bill Qty</th><th className="p-2">Trade / pack</th><th className="p-2">Wholesale / pack</th><th className="p-2">Retail / item</th><th className="p-2">MRP / item</th><th className="p-2">Calculated amount</th><th className="p-2">Expiry</th></tr></thead><tbody>
          {csvPreview.rows.map(row => <tr key={row.sourceRow} className="border-t"><td className="p-2 font-mono">{row.systemCode || <span className="font-sans text-surface-500">Auto on create</span>}</td><td className="p-2">{row.name}<span className="block text-surface-500">{row.product_id ? "Existing product linked" : "Search se link karna hai"}</span>{row.sourceCode && row.sourceCode !== row.systemCode && <span className="block text-[10px] text-surface-400">CSV reference: {row.sourceCode}</span>}</td><td className="p-2">{row.sourcePack || "—"}</td><td className="p-2">{row.sourceQuantity}</td><td className="p-2">{row.quantity} packs</td><td className="p-2">Rs {row.unit_cost}</td><td className="p-2">{row.wholesale_rate ? `Rs ${row.wholesale_rate}` : "—"}</td><td className="p-2">{row.sale_rate ? `Rs ${row.sale_rate}` : "—"}</td><td className="p-2">{row.mrp_rate ? `Rs ${row.mrp_rate}` : "—"}</td><td className="p-2">{row.lineTotal === null ? "Invalid" : `Rs ${row.lineTotal.toLocaleString("en-PK")}`}</td><td className="p-2">{row.expiry_date || "—"}</td></tr>)}
        </tbody></table></div>
        <p className="mb-3 font-semibold">CSV Subtotal: Rs {purchaseBillTotals(csvPreview.rows).subtotal.toLocaleString("en-PK")}</p>
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={Boolean(csvPreview.errors.length) || !csvPreview.rows.length} onClick={() => acceptCsv(true)} className="rounded-lg bg-brand-700 px-4 py-2 text-sm text-white disabled:opacity-40">Bill mein add karein</button>
          <button type="button" disabled={Boolean(csvPreview.errors.length) || !csvPreview.rows.length} onClick={() => acceptCsv(false)} className="rounded-lg border px-4 py-2 text-sm disabled:opacity-40">Draft lines replace karein</button>
          <button type="button" onClick={() => setCsvPreview(null)} className="rounded-lg border px-4 py-2 text-sm">Cancel — draft rakhein</button>
        </div>
      </section>}

      <form ref={formRef} action={formAction} onSubmit={handleFormSubmit} className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_330px]">
        <input type="hidden" name="supplier_bill_workspace" value="on" />
        <input type="hidden" name="items_json" value={itemPayload} />
        <input type="hidden" name="expected_row_count" value={lines.filter((l) => l.query.trim() || l.product_id || l.quantity.trim() || l.unit_cost.trim()).length} />
        <input type="hidden" name="purchase_date" value={billDate} />
        <input type="hidden" name="branch_id" value={warehouses.find((item) => item.id === warehouseId)?.branchId ?? ""} />
        <input type="hidden" name="warehouse_id" value={warehouseId} />
        <input type="hidden" name="discount_amount" value={backendDiscount} />
        <input type="hidden" name="go_to_grn" value={goToGrn ? "1" : ""} />
        <input type="hidden" name="tax_amount" value={tax} />
        <input type="hidden" name="invoice_total" value={grandTotal} />

        <div className="space-y-4 xl:space-y-3">
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
                  <input name="supplier_bill_no" value={billNo} onChange={(e) => handleBillNoChange(e.target.value)} className={inputClass} placeholder="e.g. GF-2026-0912" required maxLength={120} autoComplete="off" />
                  <button type="button" onClick={autoGenerateBillNo} disabled={billNoGenerating} title="System se auto number" className="inline-flex h-10 shrink-0 items-center gap-1 rounded-lg border border-surface-200 px-2.5 text-xs font-semibold text-surface-600 hover:bg-surface-50 disabled:opacity-50 dark:border-surface-700 dark:text-surface-300 dark:hover:bg-surface-800">
                    {billNoGenerating ? "…" : "Auto"}
                  </button>
                </div>
              </div>
              <div><label className={labelClass}>Bill Date</label><input type="date" value={billDate} onChange={(event) => handleBillDateChange(event.target.value)} className={inputClass} required /></div>
              <div><label className={labelClass}>Shop / Warehouse</label><select className={inputClass} value={warehouseId} onChange={(event) => setWarehouseId(event.target.value)} required><option value="">Warehouse chunein</option>{warehouses.map((warehouse) => <option key={warehouse.id} value={warehouse.id}>{warehouse.name}{warehouse.shopName ? ` · ${warehouse.shopName}` : warehouse.branchName ? ` · ${warehouse.branchName}` : ""}</option>)}</select></div>
            </div>
          </section>

          <section className="overflow-visible rounded-2xl border border-surface-200 bg-white p-4 shadow-sm dark:border-surface-800 dark:bg-surface-900">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div><h2 className="font-display text-base font-semibold text-surface-900 dark:text-white">Bill ke Products</h2><p className="mt-0.5 text-xs text-surface-500">Product name ek martaba master mein save karein; agli dafa search se chunein.</p></div>
              <div className="flex flex-wrap items-center gap-2">
                <input ref={csvInputRef} type="file" accept=".csv,text/csv,text/plain" className="hidden" onChange={(event) => void loadBillCsv(event.target.files?.[0] ?? null)} />
                <button type="button" onClick={() => csvInputRef.current?.click()} className="inline-flex items-center gap-1.5 rounded-lg border border-surface-200 bg-white px-3 py-2 text-sm font-semibold text-surface-700 hover:border-brand-300 hover:text-brand-800 dark:border-surface-700 dark:bg-surface-900 dark:text-surface-200"><FileUp className="h-4 w-4" /> CSV Bill Upload</button>
                <button type="button" onClick={() => openNewProduct()} className="inline-flex items-center gap-1.5 rounded-lg border border-brand-200 bg-brand-50 px-3 py-2 text-sm font-semibold text-brand-800 hover:bg-brand-100 dark:border-brand-900 dark:bg-brand-950/40 dark:text-brand-200"><PackagePlus className="h-4 w-4" /> New Product</button>
              </div>
            </div>
            {csvNotice && <p className={`mb-3 rounded-lg px-3 py-2 text-xs ${csvNotice.includes("nahi") || csvNotice.includes("mila") ? "bg-amber-50 text-amber-800 dark:bg-amber-950/30 dark:text-amber-200" : "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200"}`}>{csvNotice}</p>}
            <div className="mb-3 flex flex-wrap gap-2">
              <CategoryChip active={activeGroup === "all"} onClick={() => { setActiveGroup("all"); setActiveCategory("all"); }}>All Products</CategoryChip>
              {GROUPS.map((group) => <CategoryChip key={group.id} active={activeGroup === group.id} onClick={() => { setActiveGroup(group.id); setActiveCategory("all"); }}>{group.label}</CategoryChip>)}
            </div>
            <div className="mb-4 flex flex-wrap gap-2">
              <select
                className="h-8 rounded-lg border border-surface-200 bg-white px-2 text-xs text-surface-700 focus:border-brand-500 focus:outline-none dark:border-surface-700 dark:bg-surface-900 dark:text-surface-200"
                value={activeCategory}
                onChange={(e) => setActiveCategory(e.target.value)}
              >
                <option value="all">Saari categories</option>
                {categories
                  .filter((c) => {
                    if (activeGroup === "all") return true;
                    const root = groupForCategory(c.id, categories);
                    return root === activeGroup || (c.parent_category_id && groupForCategory(c.parent_category_id, categories) === activeGroup);
                  })
                  .map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <select
                className="h-8 rounded-lg border border-surface-200 bg-white px-2 text-xs text-surface-700 focus:border-brand-500 focus:outline-none dark:border-surface-700 dark:bg-surface-900 dark:text-surface-200"
                value={activeBrand}
                onChange={(e) => setActiveBrand(e.target.value)}
              >
                <option value="all">Saare brands</option>
                {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>

            <div className="max-h-[55vh] overflow-x-auto overflow-y-auto rounded-xl border border-surface-200 dark:border-surface-800">
              <table className="w-full min-w-[820px] border-collapse text-sm">
                <thead>
                  <tr className="sticky top-0 z-10 bg-surface-50 text-left text-xs text-surface-500 dark:bg-surface-800">
                    <th className="w-8 px-3 py-2">#</th>
                    <th className="px-3 py-2">Product</th>
                    <th className="w-32 px-3 py-2"><div>Pack / Unit</div><div className="text-[10px] font-normal text-surface-400">× items/pack</div></th>
                    <th className="w-20 px-3 py-2">Qty</th>
                    <th className="w-36 px-3 py-2"><div>Trade Rate</div><div className="text-[10px] font-normal text-surface-400">per pack</div></th>
                    <th className="w-28 px-3 py-2 text-right">Line Total</th>
                    <th className="w-10 px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line, index) => {
                    const selected = products.find((product) => product.id === line.product_id);
                    const lineTotal = purchaseLineTotal(line.quantity, line.unit_cost);
                    const normalizedQuery = line.query.trim().toLowerCase();
                    const matches = products.filter((product) => {
                      const group = groupForCategory(product.category_id, categories);
                      const categoryOk = normalizedQuery ? true : (activeGroup === "all" || group === activeGroup);
                      const subCatOk = activeCategory === "all" || product.category_id === activeCategory || (() => {
                        const byId = new Map(categories.map((c) => [c.id, c]));
                        let cur = product.category_id ? byId.get(product.category_id) : undefined;
                        while (cur) { if (cur.id === activeCategory) return true; cur = cur.parent_category_id ? byId.get(cur.parent_category_id) : undefined; }
                        return false;
                      })();
                      const brandOk = activeBrand === "all" || product.company_id === activeBrand;
                      const textOk = !normalizedQuery || `${product.product_code ?? ""} ${product.name} ${product.pack_size ?? ""} ${product.unit ?? ""}`.toLowerCase().includes(normalizedQuery);
                      return categoryOk && subCatOk && brandOk && textOk;
                    }).slice(0, 12);
                    const csvUnmatched = !line.product_id && line.query.trim().length > 0;
                    const u = selected?.units_per_pack;
                    const uOvr = Number(line.units_per_pack_override);
                    const uEff = (u && u > 1) ? u : (uOvr > 1 ? uOvr : null);
                    const bStr = `${selected?.unit ?? ""} ${selected?.pack_size ?? ""} ${line.pack_override}`.toLowerCase();
                    const isBt = bStr.includes("botal") || bStr.includes("liter") || bStr.includes("litr");
                    const itemLabel = isBt ? "botal" : "item";
                    return <Fragment key={line.row_id}><tr onFocus={(e) => { if (e.target === e.currentTarget) return; const tr = e.currentTarget; const container = tr.closest('.overflow-y-auto') as HTMLElement | null; if (container) { const trRect = tr.getBoundingClientRect(); const cRect = container.getBoundingClientRect(); if (trRect.bottom > cRect.bottom - 80) { tr.scrollIntoView({ behavior: "smooth", block: "start" }); } else if (trRect.top < cRect.top) { tr.scrollIntoView({ behavior: "smooth", block: "nearest" }); } } else { tr.scrollIntoView({ behavior: "smooth", block: "nearest" }); } }} className={`border-t border-surface-100 align-top dark:border-surface-800 ${csvUnmatched ? "bg-amber-50 dark:bg-amber-950/20" : ""}`}>
                      <td className="px-3 py-3 text-xs text-surface-400">{index + 1}</td>
                      {/* Product column — search + category hint + batch/expiry */}
                      <td className="relative px-3 py-2.5">
                        <div className="relative">
                          <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-surface-400" />
                          <input className={`${inputClass} pl-9`} value={line.query} onFocus={() => updateLine(index, { pickerOpen: true })} onChange={(event) => updateLine(index, { query: event.target.value, product_id: "", pickerOpen: true })} placeholder="Search and select product..." autoComplete="off" />
                          {line.pickerOpen && <>
                            <button aria-label="Close product search" type="button" className="fixed inset-0 z-10 cursor-default" onClick={() => updateLine(index, { pickerOpen: false })} />
                            <div className="absolute left-0 right-0 top-[calc(100%+4px)] z-20 max-h-64 overflow-auto rounded-xl border border-surface-200 bg-white p-1 shadow-xl dark:border-surface-700 dark:bg-surface-900">
                              {matches.map((product) => <button key={product.id} type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => selectProduct(index, product)} className="flex w-full items-center justify-between gap-3 rounded-lg px-2.5 py-2 text-left hover:bg-brand-50 dark:hover:bg-brand-950/40"><span className="flex min-w-0 items-center gap-2"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface-100 text-brand-700 dark:bg-surface-800"><FileText className="h-4 w-4" /></span><span className="min-w-0"><span className="flex items-center gap-1.5"><span className="truncate font-medium text-surface-800 dark:text-surface-100">{product.name}</span>{product.product_code && <span className="shrink-0 rounded bg-brand-100 px-1 py-0.5 font-mono text-[10px] font-semibold text-brand-700 dark:bg-brand-900/40 dark:text-brand-300">{product.product_code}</span>}</span><span className="block text-[11px] text-surface-400">{product.pack_size || product.unit || "Unit set nahi"}</span></span></span><span className="shrink-0 text-[11px] text-surface-500">{GROUPS.find((group) => group.id === groupForCategory(product.category_id, categories))?.label ?? "Other"}</span></button>)}
                              {matches.length === 0 && <p className="px-3 py-4 text-center text-xs text-surface-500">Product nahi mila. New Product se master mein add karein.</p>}
                              <button type="button" onClick={() => { updateLine(index, { pickerOpen: false }); openNewProduct(line.row_id); }} className="flex w-full items-center gap-2 rounded-lg border-t border-surface-100 px-3 py-2.5 text-sm font-semibold text-brand-700 hover:bg-brand-50 dark:border-surface-800 dark:text-brand-300"><Plus className="h-4 w-4" /> New Product Master</button>
                            </div>
                          </>}
                        </div>
                        {csvUnmatched && <span className="mt-1 block text-[11px] text-amber-600 dark:text-amber-400">CSV se aaya — product search kar ke link karein ya <button type="button" onClick={() => openNewProduct(line.row_id)} className="font-semibold underline">New Product banayein</button></span>}
                        {selected && <span className="mt-1 flex items-center gap-1.5 text-[11px] text-surface-400">{GROUPS.find((group) => group.id === groupForCategory(selected.category_id, categories))?.label ?? "Other"}{selected.product_code && <span className="rounded bg-brand-100 px-1 py-0.5 font-mono text-[10px] font-semibold text-brand-700 dark:bg-brand-900/40 dark:text-brand-300">{selected.product_code}</span>}</span>}
                      </td>
                      {/* Pack / Unit + items per pack */}
                      <td className="px-3 py-2.5">
                        {selected ? (
                          (selected.pack_size || selected.unit) ? (
                            <div className="space-y-1.5 pt-1">
                              <span className="block text-xs font-medium text-surface-700 dark:text-surface-200">{selected.pack_size || selected.unit}</span>
                              {selected.units_per_pack != null && selected.units_per_pack > 1 ? (
                                <span className="inline-block rounded bg-brand-50 px-1.5 py-0.5 text-[10px] font-semibold text-brand-700 dark:bg-brand-950/40 dark:text-brand-300">×{selected.units_per_pack} {itemLabel}/pack</span>
                              ) : (
                                <div className="flex items-center gap-1">
                                  <span className="text-[10px] text-surface-400">×</span>
                                  <input aria-label="Items per pack" type="number" min="1" step="1" value={line.units_per_pack_override} onChange={(e) => updateLine(index, { units_per_pack_override: e.target.value })} placeholder="items" className="h-7 w-full rounded border border-dashed border-surface-300 bg-white px-1.5 text-[11px] text-surface-700 outline-none focus:border-brand-400 focus:border-solid dark:border-surface-600 dark:bg-surface-900 dark:text-surface-200" />
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="space-y-1.5">
                              <input aria-label="Pack / Unit" className={`${inputClass} text-xs`} list={`units-list-${index}`} value={line.pack_override} onChange={(e) => updateLine(index, { pack_override: e.target.value })} placeholder="350ml, 1kg…" />
                              <datalist id={`units-list-${index}`}>{units.map((u) => <option key={u.code} value={u.label} />)}</datalist>
                              <div className="flex items-center gap-1">
                                <span className="text-[10px] text-surface-400">×</span>
                                <input aria-label="Items per pack" type="number" min="1" step="1" value={line.units_per_pack_override} onChange={(e) => updateLine(index, { units_per_pack_override: e.target.value })} placeholder="items" className="h-7 w-full rounded border border-dashed border-surface-300 bg-white px-1.5 text-[11px] text-surface-700 outline-none focus:border-brand-400 focus:border-solid dark:border-surface-600 dark:bg-surface-900 dark:text-surface-200" />
                              </div>
                            </div>
                          )
                        ) : <span className="block pt-2 text-xs text-surface-400">—</span>}
                      </td>
                      {/* Qty */}
                      <td className="px-3 py-2.5">
                        <input aria-label="Quantity" className={inputClass} type="number" min="0.001" step="0.001" value={line.quantity} required={Boolean(line.product_id)} onInput={(event) => updateLine(index, { quantity: event.currentTarget.value })} />
                        {(() => {
                          const q = Number(line.quantity);
                          if (!q || !selected) return null;
                          if (uEff) return <span className="mt-1 block text-[10px] font-medium text-brand-700">{q} pack = {Math.round(q * uEff * 100) / 100} {itemLabel}</span>;
                          return <span className="mt-1 block text-[10px] text-surface-400">{q} pack</span>;
                        })()}
                      </td>
                      {/* Purchase Rate (per pack) */}
                      <td className="px-3 py-2.5">
                        <div className="relative"><span className="absolute left-2.5 top-2.5 text-xs text-surface-400">Rs</span><input aria-label="Purchase rate" className={`${inputClass} pl-8`} type="number" min="0" step="0.01" value={line.unit_cost} required={Boolean(line.product_id)} onInput={(event) => updateLine(index, { unit_cost: event.currentTarget.value })} /></div>
                        {(() => {
                          const r = Number(line.unit_cost);
                          if (!r || !uEff) return null;
                          return <span className="mt-1 block text-[10px] font-medium text-brand-700">1 {itemLabel}: Rs {(Math.round((r / uEff) * 100) / 100).toLocaleString()}</span>;
                        })()}
                      </td>
                      <td className="px-3 py-3 text-right font-semibold tabular-nums text-surface-800 dark:text-surface-100">{lineTotal === null ? "—" : `Rs ${lineTotal.toLocaleString("en-PK", { maximumFractionDigits: 2 })}`}</td>
                      <td className="px-3 py-2.5"><button type="button" onClick={() => setLines((previous) => { const next = previous.filter((_, i) => i !== index); return next.length > 0 ? next : [emptyLine()]; })} className="rounded-lg p-2 text-surface-400 hover:bg-red-50 hover:text-red-600"><Trash2 className="h-4 w-4" /></button></td>
                    </tr>
                    {(selected || line.query.trim()) && <tr className={csvUnmatched ? "bg-amber-50 dark:bg-amber-950/20" : ""}>
                      <td />
                      <td colSpan={5} className="px-3 pb-3 pt-0">
                        <div className="flex flex-wrap items-start gap-3">
                          {/* Batch + Expiry */}
                          <div className="flex items-center gap-2 rounded-lg border border-surface-200 bg-surface-50 px-3 py-2 dark:border-surface-700 dark:bg-surface-800">
                            <div>
                              <div className="mb-1 text-[10px] font-medium text-surface-500">Batch No.</div>
                              <input aria-label="Batch number" className="h-8 w-28 rounded border border-surface-200 bg-white px-2 text-[11px] text-surface-700 outline-none placeholder:text-surface-400 focus:border-brand-400 dark:border-surface-600 dark:bg-surface-900 dark:text-surface-200" value={line.batch_number} onChange={(event) => updateLine(index, { batch_number: event.target.value })} placeholder="e.g. JX0032" />
                            </div>
                            <div>
                              <div className="mb-1 text-[10px] font-medium text-surface-500">Expiry Date</div>
                              <input aria-label="Expiry date" className="h-8 w-32 rounded border border-surface-200 bg-white px-2 text-[11px] text-surface-700 outline-none focus:border-brand-400 dark:border-surface-600 dark:bg-surface-900 dark:text-surface-200" type="date" value={line.expiry_date} onChange={(event) => updateLine(index, { expiry_date: event.target.value })} />
                            </div>
                          </div>
                          {/* Rates */}
                          <div className="flex flex-wrap items-start gap-2 rounded-lg border border-surface-200 bg-surface-50 px-3 py-2 dark:border-surface-700 dark:bg-surface-800">
                            <div className="w-28">
                              <div className="mb-1 text-[10px] font-medium text-surface-500">Wholesale <span className="font-normal text-surface-400">/ pack</span></div>
                              <div className="relative">
                                <span className="absolute left-2 top-2 text-[10px] text-surface-400">Rs</span>
                                <input aria-label="Wholesale rate" className="h-8 w-full rounded border border-surface-200 bg-white pl-7 pr-1 text-xs text-surface-900 outline-none focus:border-brand-400 dark:border-surface-600 dark:bg-surface-900 dark:text-surface-100" type="number" min="0" step="0.01" value={line.wholesale_rate} onChange={(event) => updateLine(index, { wholesale_rate: event.target.value })} placeholder="0" />
                              </div>
                              {(() => { const w = Number(line.wholesale_rate); if (!w || !uEff) return null; return <span className="mt-0.5 block text-[10px] text-brand-700">1 {itemLabel}: Rs {(Math.round((w / uEff) * 100) / 100).toLocaleString()}</span>; })()}
                            </div>
                            <div className="w-28">
                              <div className="mb-1 text-[10px] font-medium text-surface-500">Sale Rate <span className="font-normal text-surface-400">/ item</span></div>
                              <div className="relative">
                                <span className="absolute left-2 top-2 text-[10px] text-surface-400">Rs</span>
                                <input aria-label="Sale rate" className="h-8 w-full rounded border border-surface-200 bg-white pl-7 pr-1 text-xs text-surface-900 outline-none focus:border-brand-400 dark:border-surface-600 dark:bg-surface-900 dark:text-surface-100" type="number" min="0" step="0.01" value={line.sale_rate} onChange={(event) => updateLine(index, { sale_rate: event.target.value })} placeholder="0" />
                              </div>
                            </div>
                            <div className="w-28">
                              <div className="mb-1 text-[10px] font-medium text-surface-500">MRP <span className="font-normal text-surface-400">/ item</span></div>
                              <div className="relative">
                                <span className="absolute left-2 top-2 text-[10px] text-surface-400">Rs</span>
                                <input aria-label="MRP rate" className="h-8 w-full rounded border border-surface-200 bg-white pl-7 pr-1 text-xs text-surface-900 outline-none focus:border-brand-400 dark:border-surface-600 dark:bg-surface-900 dark:text-surface-100" type="number" min="0" step="0.01" value={line.mrp_rate} onChange={(event) => updateLine(index, { mrp_rate: event.target.value })} placeholder="0" />
                              </div>
                            </div>
                          </div>
                        </div>
                      </td>
                      <td />
                    </tr>}
                  </Fragment>;
                  })}
                </tbody>
              </table>
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setLines((previous) => [...previous, newLineWithDefaults()])} className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-sm font-semibold text-brand-700 hover:bg-brand-50 dark:text-brand-300 dark:hover:bg-brand-950/30"><Plus className="h-4 w-4" /> Add bill line</button>
                <button type="button" onClick={() => setLines([emptyLine()])} className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30"><Trash2 className="h-4 w-4" /> Clear All</button>
              </div>
              <span className="text-xs text-surface-400">{lines.filter((line) => line.product_id).length} product lines</span>
            </div>
          </section>
          <p className="rounded-xl border border-blue-100 bg-blue-50/70 px-4 py-3 text-xs leading-relaxed text-blue-900 dark:border-blue-900/60 dark:bg-blue-950/25 dark:text-blue-200">Bill save hone ke baad maal approved purchase mein rahega. Asal stock sirf <strong>GRN / Maal Receive</strong> par ginti ke baad warehouse mein charhega.</p>
        </div>

        <aside className="xl:sticky xl:top-4">
          <section className="rounded-2xl border border-surface-200 bg-white p-4 shadow-sm dark:border-surface-800 dark:bg-surface-900">
            <div className="mb-4 flex items-center gap-2"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 text-brand-700 dark:bg-brand-950/40 dark:text-brand-300"><FileText className="h-5 w-5" /></span><div><h2 className="font-display font-semibold text-surface-900 dark:text-white">Bill Summary</h2><p className="text-[11px] text-surface-400">Supplier invoice ka hisaab</p></div></div>
            <div className="space-y-3 border-b border-surface-100 pb-4 dark:border-surface-800"><SummaryLine label="Subtotal" value={subtotal} /><div className="grid grid-cols-[1fr_112px] items-center gap-3"><label htmlFor="discount" className="text-sm text-surface-500">Discount</label><input id="discount" type="number" min="0" max={subtotal} step="0.01" value={discount} onChange={(event) => setDiscount(event.target.value)} className={`${inputClass} text-right`} placeholder="0" /></div><div className="grid grid-cols-[1fr_112px] items-center gap-3"><label htmlFor="tax" className="text-sm text-surface-500">Tax</label><input id="tax" type="number" min="0" step="0.01" value={tax} onChange={(event) => setTax(event.target.value)} className={`${inputClass} text-right`} placeholder="0" /></div></div>
            <div className="my-4 rounded-xl bg-brand-50 px-3.5 py-3 dark:bg-brand-950/30"><SummaryLine label="Total Amount" value={grandTotal} strong /></div>
            <div className="space-y-3 border-b border-surface-100 pb-4 dark:border-surface-800"><div><label className={labelClass}>Payment Status</label><select name="payment_terms" value={terms} onChange={(event) => { setTerms(event.target.value as typeof terms); setPaidNow(""); }} className={inputClass}><option value="credit">Credit / Udhaar</option><option value="partial">Partial Payment</option><option value="paid">Fully Paid</option></select></div>{terms === "partial" && <div><label className={labelClass}>Paid Now</label><input name="paid_now" type="number" min="0.01" max={Math.max(0, grandTotal - 0.01)} step="0.01" value={paidNow} onChange={(event) => setPaidNow(event.target.value)} className={inputClass} placeholder="Paid amount" required /></div>}{terms !== "paid" && <div className="grid grid-cols-2 gap-2"><div><label className={labelClass}>Credit Days</label><input name="credit_days" type="number" min="0" step="1" value={creditDays} onChange={(e) => setCreditDays(e.target.value)} className={inputClass} /></div><div><label className={labelClass}>Due Date</label><input name="due_date" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={inputClass} /></div></div>}<div className="flex items-center justify-between text-sm"><span className="text-surface-500">Paid</span><span className="font-semibold text-surface-800 dark:text-surface-100">Rs {Math.min(grandTotal, Math.max(0, paidAmount)).toLocaleString("en-PK", { maximumFractionDigits: 2 })}</span></div><div className="flex items-center justify-between rounded-lg bg-emerald-50 px-3 py-2 text-sm dark:bg-emerald-950/30"><span className="font-medium text-emerald-800 dark:text-emerald-200">Due</span><span className="font-bold tabular-nums text-emerald-800 dark:text-emerald-200">Rs {amountDue.toLocaleString("en-PK", { maximumFractionDigits: 2 })}</span></div></div>
            <div className="mt-4 space-y-3"><div><label className={labelClass}>Payment Method</label><select name="payment_method" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} className={inputClass}><option value="cash">Cash</option><option value="bank_transfer">Bank Transfer</option><option value="cheque">Cheque</option><option value="easypaisa">Easypaisa</option><option value="jazzcash">JazzCash</option></select></div><div><label className={labelClass}>Paid From Account</label><select name="finance_account_id" value={financeAccountId} onChange={(e) => setFinanceAccountId(e.target.value)} className={inputClass}><option value="">Default cash account</option>{accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select></div><div><label className={labelClass}>Reference / Note</label><textarea name="notes" value={billNotes} onChange={(e) => setBillNotes(e.target.value)} rows={3} className="w-full resize-y rounded-lg border border-surface-200 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500 dark:border-surface-700 dark:bg-surface-950 dark:text-surface-100" placeholder="Payment ref, bill remarks..." /></div>
              {terms !== "credit" && (
                <div>
                  <label className={labelClass}>Payment Screenshot <span className="font-normal text-surface-400">(optional)</span></label>
                  <input ref={paymentProofInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => void handlePaymentProofChange(e.target.files?.[0] ?? null)} />
                  {paymentProofUrl ? (
                    <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 dark:border-emerald-900/50 dark:bg-emerald-950/30">
                      <Check className="h-4 w-4 text-emerald-600" />
                      <span className="flex-1 truncate text-xs text-emerald-800 dark:text-emerald-200">Screenshot upload ho gaya</span>
                      <button type="button" onClick={() => { setPaymentProofUrl(""); if (paymentProofInputRef.current) paymentProofInputRef.current.value = ""; }} className="shrink-0 text-xs text-red-600 hover:underline">Hatao</button>
                    </div>
                  ) : (
                    <button type="button" onClick={() => paymentProofInputRef.current?.click()} disabled={paymentProofUploading} className={`${inputClass} flex cursor-pointer items-center gap-2 text-left text-surface-500 hover:border-brand-400 disabled:opacity-50`}>
                      {paymentProofUploading ? "Upload ho raha hai..." : "Screenshot chunein…"}
                    </button>
                  )}
                  {paymentProofUrl && <input type="hidden" name="payment_proof_url" value={paymentProofUrl} />}
                </div>
              )}
              <ReviewSaveButton disabled={!isOnline} />
              <p className="text-center text-[11px] leading-relaxed text-surface-400">Payment ledger mein record hogi. Stock GRN ke baad update hoga.</p>
            </div>
          </section>
        </aside>
      </form>

      {reviewOpen && (
        <div className="fixed inset-0 z-[85] flex items-center justify-center bg-surface-950/60 p-4" role="dialog" aria-modal="true">
          <div className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-surface-900">
            {/* Header */}
            <div className="flex shrink-0 items-start justify-between border-b border-surface-100 px-6 py-4 dark:border-surface-800">
              <div>
                <h2 className="font-display text-lg font-semibold text-surface-900 dark:text-white">Bill Review — Save karne se pehle dekhein</h2>
                <p className="mt-0.5 text-xs text-surface-500">{lines.filter((l) => l.product_id && Number(l.quantity) > 0).length} products · Confirm karo phir Purchase ya GRN mein bhejen</p>
              </div>
              <button type="button" onClick={() => setReviewOpen(false)} className="ml-4 shrink-0 rounded-lg p-2 text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-800"><X className="h-5 w-5" /></button>
            </div>
            {/* Products table */}
            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
              <div className="overflow-x-auto rounded-xl border border-surface-200 dark:border-surface-700">
                <table className="w-full min-w-[580px] border-collapse text-sm">
                  <thead>
                    <tr className="bg-surface-50 text-left text-xs font-semibold uppercase tracking-wider text-surface-500 dark:bg-surface-800">
                      <th className="px-4 py-3">#</th>
                      <th className="px-4 py-3">Product</th>
                      <th className="px-4 py-3 text-right">Qty</th>
                      <th className="px-4 py-3 text-right">Trade Rate</th>
                      {discountRatio > 0 && <th className="px-4 py-3 text-right text-emerald-700 dark:text-emerald-400">Effective Rate</th>}
                      <th className="px-4 py-3 text-right">Line Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lines.filter((l) => l.product_id && Number(l.quantity) > 0).map((line, i) => {
                      const prod = products.find((p) => p.id === line.product_id);
                      const qty = Number(line.quantity);
                      const cost = Number(line.unit_cost);
                      const effCost = discountRatio > 0 ? Math.round(cost * (1 - discountRatio) * 100) / 100 : cost;
                      const lineTotal = purchaseLineTotal(line.quantity, line.unit_cost);
                      return (
                        <tr key={line.row_id} className="border-t border-surface-100 dark:border-surface-800">
                          <td className="px-4 py-3 text-xs text-surface-400">{i + 1}</td>
                          <td className="px-4 py-3">
                            <div className="font-medium text-surface-800 dark:text-surface-100">{prod?.name ?? line.query}</div>
                            {prod?.pack_size && <div className="text-[11px] text-surface-400">{prod.pack_size}</div>}
                            {(Number(line.sale_rate) > 0 || Number(line.wholesale_rate) > 0) && (
                              <div className="mt-0.5 flex gap-2 text-[10px] text-surface-400">
                                {Number(line.sale_rate) > 0 && <span>Sale: Rs {Number(line.sale_rate).toLocaleString()}</span>}
                                {Number(line.wholesale_rate) > 0 && <span>Wholesale: Rs {Number(line.wholesale_rate).toLocaleString()}</span>}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums">{qty.toLocaleString()}</td>
                          <td className="px-4 py-3 text-right tabular-nums">Rs {cost.toLocaleString("en-PK", { maximumFractionDigits: 2 })}</td>
                          {discountRatio > 0 && <td className="px-4 py-3 text-right tabular-nums font-medium text-emerald-700 dark:text-emerald-400">Rs {effCost.toLocaleString("en-PK", { maximumFractionDigits: 2 })}</td>}
                          <td className="px-4 py-3 text-right tabular-nums font-semibold text-surface-800 dark:text-surface-100">{lineTotal === null ? "—" : `Rs ${lineTotal.toLocaleString("en-PK", { maximumFractionDigits: 2 })}`}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {/* Totals */}
              <div className="ml-auto mt-4 max-w-xs space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-surface-500">Subtotal</span><span className="tabular-nums">Rs {subtotal.toLocaleString("en-PK", { maximumFractionDigits: 2 })}</span></div>
                {Number(discount) > 0 && <div className="flex justify-between font-medium text-emerald-700 dark:text-emerald-400"><span>Bach (Discount)</span><span className="tabular-nums">− Rs {Number(discount).toLocaleString("en-PK", { maximumFractionDigits: 2 })}</span></div>}
                {Number(tax) > 0 && <div className="flex justify-between"><span className="text-surface-500">Tax</span><span className="tabular-nums">+ Rs {Number(tax).toLocaleString("en-PK", { maximumFractionDigits: 2 })}</span></div>}
                <div className="flex justify-between rounded-xl bg-brand-50 px-4 py-2.5 text-base font-bold dark:bg-brand-950/30"><span className="text-brand-800 dark:text-brand-200">Total</span><span className="tabular-nums text-brand-900 dark:text-brand-100">Rs {grandTotal.toLocaleString("en-PK", { maximumFractionDigits: 2 })}</span></div>
              </div>
              {discountRatio > 0 && (
                <div className="mt-3 flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-200">
                  <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span><strong>Bach apply hogi:</strong> Rs {Number(discount).toLocaleString("en-PK", { maximumFractionDigits: 2 })} ki bach bill total se ek baar minus hogi. Trade rate aur line total asal invoice ke mutabiq rahenge; stock receiving par net lagat lagegi.</span>
                </div>
              )}
              {state.error && (
                <div className="mt-3 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
                  <AlertCircle className="h-4 w-4 shrink-0" />{state.error}
                </div>
              )}
            </div>
            {/* Footer buttons */}
            <div className="shrink-0 border-t border-surface-100 bg-surface-50 px-6 py-4 dark:border-surface-800 dark:bg-surface-900">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <button type="button" onClick={() => setReviewOpen(false)} className="rounded-lg border border-surface-200 px-4 py-2.5 text-sm font-medium text-surface-600 hover:bg-surface-100 dark:border-surface-700 dark:text-surface-300 dark:hover:bg-surface-800">Wapas — Bill edit karein</button>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => { setGoToGrn(false); reviewApprovedRef.current = true; setReviewOpen(false); setTimeout(() => formRef.current?.requestSubmit(), 10); }}
                    className="inline-flex items-center gap-2 rounded-xl border border-brand-700 bg-white px-5 py-2.5 text-sm font-semibold text-brand-700 hover:bg-brand-50 dark:bg-surface-900 dark:hover:bg-brand-950/20"
                  >
                    <FileText className="h-4 w-4" /> Purchase Order Save Karein
                  </button>
                  <button
                    type="button"
                    onClick={() => { setGoToGrn(true); reviewApprovedRef.current = true; setReviewOpen(false); setTimeout(() => formRef.current?.requestSubmit(), 10); }}
                    className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-800"
                  >
                    <PackagePlus className="h-4 w-4" /> Save & GRN Mein Bhejen
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

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
          <div><label className={labelClass}>Items per Pack (optional)</label><input type="number" min="1" step="1" value={newProductUnitsPerPack} onChange={(event) => setNewProductUnitsPerPack(event.target.value)} className={inputClass} placeholder="e.g. 6" /></div>
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

function ReviewSaveButton({ disabled: extraDisabled }: { disabled?: boolean }) {
  const { pending } = useFormStatus();
  const isDisabled = pending || extraDisabled;
  return (
    <button type="submit" disabled={isDisabled} className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-brand-700 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-60">
      <FileText className="h-4 w-4" />
      {pending ? "Bill save ho raha hai..." : extraDisabled ? "Offline — internet ka intezaar karein" : "Review & Save Bill"}
    </button>
  );
}
