"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { t, type Lang } from "@/lib/i18n/translations";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { posCheckout } from "@/actions/pos";
import { Button, Input, Select, Label } from "@/components/ui/form";
import { Card } from "@/components/ui/layout-primitives";
import {
  ShoppingCart,
  Trash2,
  RotateCcw,
  ArrowLeft,
  Search,
  ScanLine,
  Camera,
  Plus,
  Minus,
  X,
  PackagePlus,
  Paperclip,
  Check,
  Package,
  Lock,
} from "lucide-react";
import { ReceiptModal } from "@/components/pos/receipt-modal";
import { BarcodeCameraModal } from "@/components/pos/barcode-camera-modal";
import { PosReturn } from "@/components/pos/pos-return";
import type { PosPermissions } from "@/lib/pos/permissions";

interface PosProduct {
  name: string;
  pack_size: string | null;
  barcode: string | null;
  internal_barcode?: string | null;
  image_url?: string | null;
  unit_code?: string | null;
  category_name?: string | null;
  mrp_price?: number | null;
  /** Sirf us ke paas aata hai jise lagat dekhne ki ijazat hai. */
  purchase_price?: number | null;
}

interface InventoryItem {
  id: string;
  product_id: string;
  stock_quantity: number;
  selling_price: number;
  /** NULL = is par thok ka rate nahi (retail lagega). Sifar se ALAG hai. */
  wholesale_price: number | null;
  /** Godam mein aur kitna. NULL = ginti nahi ho saki, sifar se ALAG. */
  warehouse_stock?: number | null;
  batch_number?: string | null;
  batch_count?: number;
  expiry_date?: string | null;
  products: PosProduct | null;
}
interface Customer {
  id: string;
  name: string;
  phone: string | null;
  /** Us par kitna baqi hai. NULL = maloom nahi, sifar se ALAG. */
  balance?: number | null;
  /** Udhaar ki hadd. NULL = hadd darj hi nahi (sifar hadd se ALAG). */
  creditLimit?: number | null;
  /** Wo dukan jise hum maal dete hain -- us par thok ka rate lagta hai (246). */
  isWholesaleShop: boolean;
}
export interface RecentSale {
  id: string;
  created_at: string;
  total_amount: number;
  status: string;
  payment_mode: string;
  customer_name: string | null;
}

interface CartLine {
  product_id: string;
  name: string;
  quantity: number;
  unit_price: number;
}

type PaymentMethod = "cash" | "bank_transfer" | "card" | "jazzcash" | "easypaisa" | "qr" | "khata";
const PAYMENT_METHODS: { key: PaymentMethod; label: string }[] = [
  { key: "cash", label: "Cash" },
  { key: "bank_transfer", label: "Bank" },
  { key: "card", label: "Card" },
  { key: "jazzcash", label: "JazzCash" },
  { key: "easypaisa", label: "Easypaisa" },
  { key: "qr", label: "QR" },
  { key: "khata", label: "Khata" },
];

/**
 * Gahak ki teen qismein -- malik ka usool (4 September).
 *
 * Ye sirf naam ka farq nahi. Poora maali usool inhi teen par khaRa hai:
 * NAQAD par gahak marzi ki baat hai, UDHAAR par gahak LAZMI hai. Bina
 * naam ke udhaar wo raqam hai jo kisi ke zimme nahi -- aur wo kabhi
 * wapas nahi aati.
 */
type CustomerMode = "walkin" | "regular" | "wholesale";

interface PaymentLine {
  id: string;
  method: PaymentMethod;
  amount: string;
  reference: string;
  receiptFile: File | null;
  receiptUrl: string | null;
  uploading: boolean;
}

/** Maal ka rang: khatam ke qareeb / thora / theek. */
function stockTone(qty: number): string {
  if (qty <= 5) return "bg-red-500";
  if (qty <= 20) return "bg-amber-500";
  return "bg-emerald-500";
}

/** "Dec 2026" -- counter par poori tareekh ki zaroorat nahi hoti. */
function shortDate(d: string | null | undefined): string | null {
  if (!d) return null;
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return null;
  return dt.toLocaleDateString("en-GB", { month: "short", year: "numeric" });
}

export function PosClient({
  sellerName,
  inventory,
  groups = [],
  customers,
  recentSales = [],
  rateBaqiCount = 0,
  perms,
  lang,
}: {
  sellerName: string;
  inventory: InventoryItem[];
  /**
   * Qismein -- counter par chhantne ke liye. SAARI aati hain, sirf wo
   * nahi jin par is waqt maal para hai; saath us qism par mojood cheezon
   * ki ginti. Khali qism chhupa dene se banda samajhta hai qism bani hi
   * nahi, aur nayi bana deta hai -- isi se ek cheez ki do qismein ban
   * jati hain.
   */
  groups?: { name: string; count: number }[];
  customers: Customer[];
  /**
   * Haal ki bikriyaan -- wapsi ke liye. Wapsi hamesha ASAL BILL se shuru
   * hoti hai; cheez chun kar wapsi ka koi raasta yahan hai hi nahi.
   */
  recentSales?: RecentSale[];
  /**
   * Kitni cheezein sirf is liye nahi dikh rahin ke un ka rate abhi
   * darj nahi hua (252). Ye adad chhupaya nahi jata -- warna banda
   * apna maal dhoondta reh jata hai aur samajhta hai ke stock hi nahi.
   */
  rateBaqiCount?: number;
  /**
   * Kaun kya dekh sakta hai. Ye safhe ka faisla nahi -- server se aata
   * hai, aur wohi fehrist checkout ke andar dobara parhi jati hai. Yahan
   * jo chhupa hai wo bheja hi nahi gaya, is liye browser ke andar se bhi
   * nahi nikalta.
   */
  perms: PosPermissions;
  /**
   * Zaban server se aati hai, yahan cookie parh kar nahi.
   *
   * useLanguage() cookie browser mein parhta hai -- yani safha pehle ek
   * zaban mein banta hai aur phir doosri mein badal jata hai. Counter
   * par ye jhatka saaf nazar aata hai. Server ko cookie pehle se maloom
   * hai, is liye wahin se bhej di jati hai.
   */
  lang: Lang;
}) {
  const supabase = createClient();
  const [search, setSearch] = useState("");
  const [group, setGroup] = useState("");
  // Gahak ka search: naam, phone ya us ke record ki shanakht se.
  const [custQuery, setCustQuery] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  // Cart mein jis cheez par banda khaRa hai -- us ki tafseel saamne
  // wale khane mein khulti hai. "View Details" ka koi button nahi:
  // qatar KHUD button hai (malik ka usool, 4 September).
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [customerId, setCustomerId] = useState<string>("");
  // Teen alag darwaze, jaan boojh kar. Ek hi fehrist mein aam gahak aur
  // thok wali dukanein mila dene par galti se aam aadmi par thok ka rate
  // lag jata hai -- aur us ka pata mahine baad munafa ginte waqt chalta
  // hai.
  const [custMode, setCustMode] = useState<CustomerMode>("walkin");
  // Bikri ya wapsi -- ek hi counter, ek hi shakl. Malik ka kehna: staff
  // ko alag safhe par na bhejein.
  const [mode, setMode] = useState<"sale" | "return">("sale");

  const chosenCustomer = customers.find((c) => c.id === customerId) ?? null;
  const wholesaleOn = chosenCustomer?.isWholesaleShop === true;

  /**
   * Kis rate par bikega.
   *
   * Thok wali dukan ho AUR us cheez ka thok ka rate darj ho, tabhi thok
   * lagta hai. Rate darj na ho to retail lagta hai -- aur wo baat qatar
   * par likhi bhi jati hai, warna dukandar samajhta hai ke usay thok
   * mila hai jab ke nahi mila.
   */
  function priceFor(item: InventoryItem, forWholesale: boolean): number {
    if (forWholesale && item.wholesale_price != null) return item.wholesale_price;
    return item.selling_price;
  }

  /**
   * Gahak badalne par POORA cart dobara rate par lagta hai.
   *
   * Bina is ke aadha bill retail ke rate par aur aadha thok ke rate par
   * ban jata -- aur wo farq bill par nazar nahi aata.
   */
  function applyCustomer(id: string) {
    setCustomerId(id);
    const nowWholesale = customers.find((c) => c.id === id)?.isWholesaleShop === true;
    setCart((prev) =>
      prev.map((line) => {
        const item = inventory.find((i) => i.product_id === line.product_id);
        return item ? { ...line, unit_price: priceFor(item, nowWholesale) } : line;
      })
    );
  }
  const [paymentLines, setPaymentLines] = useState<PaymentLine[]>([
    { id: "1", method: "cash", amount: "", reference: "", receiptFile: null, receiptUrl: null, uploading: false },
  ]);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [completedSaleId, setCompletedSaleId] = useState<string | null>(null);
  const [barcodeInput, setBarcodeInput] = useState("");
  const [barcodeError, setBarcodeError] = useState<string | null>(null);
  const [showCameraModal, setShowCameraModal] = useState(false);
  const barcodeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    barcodeRef.current?.focus();
  }, []);

  /**
   * Gahak ka darwaza badalna.
   *
   * Chalta-phirta gahak par udhaar ka koi raasta nahi. Is liye darwaza
   * badalte hi khate wali qataarein naqad par aa jati hain -- warna
   * khana chhup jata hai magar raqam us mein baithi reh jati, aur
   * checkout par wo baat "Khata" ke naam se aati jo screen par kahin
   * likhi hi nahi.
   */
  function switchCustomerMode(mode: CustomerMode) {
    setCustMode(mode);
    setCustQuery("");
    applyCustomer("");
    if (mode === "walkin") {
      setPaymentLines((prev) => prev.map((l) => (l.method === "khata" ? { ...l, method: "cash" } : l)));
    }
  }

  const filteredInventory = useMemo(() => {
    const q = search.trim().toLowerCase();
    return inventory.filter((item) => {
      if (group && item.products?.category_name !== group) return false;
      if (!q) return true;
      // Naam se bhi, aur barcode se bhi -- counter par banda dono
      // tarah dhoondta hai.
      const p = item.products;
      return (
        p?.name?.toLowerCase().includes(q) ||
        p?.barcode?.toLowerCase().includes(q) ||
        p?.internal_barcode?.toLowerCase().includes(q)
      );
    });
  }, [inventory, search, group]);

  /**
   * Gahak ki chhoti fehrist.
   *
   * Naam, phone, aur us ke record ki shanakht -- teenon se. Alag "Farmer
   * ID" ka khana is nizam ke gahak wale khaate mein maujood nahi, is
   * liye us ka dawa bhi nahi kiya jata: jo cheez hai hi nahi, us ka naam
   * likh dena bande ko dhoondwata rehta hai.
   */
  const custMatches = useMemo(() => {
    const wantWholesale = custMode === "wholesale";
    const pool = customers.filter((c) => c.isWholesaleShop === wantWholesale);
    const q = custQuery.trim().toLowerCase();
    if (!q) return pool.slice(0, 8);
    return pool
      .filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          (c.phone ?? "").toLowerCase().includes(q) ||
          c.id.toLowerCase().startsWith(q)
      )
      .slice(0, 8);
  }, [customers, custQuery, custMode]);

  const total = useMemo(
    () => cart.reduce((sum, line) => sum + line.quantity * line.unit_price, 0),
    [cart]
  );

  const totalAllocated = useMemo(
    () => paymentLines.reduce((sum, l) => sum + (parseFloat(l.amount) || 0), 0),
    [paymentLines]
  );
  const remaining = total - totalAllocated;
  const khataTotal = paymentLines.filter((l) => l.method === "khata").reduce((s, l) => s + (parseFloat(l.amount) || 0), 0);

  const selectedLine = cart.find((l) => l.product_id === selectedId) ?? null;
  const selectedItem = selectedId ? inventory.find((i) => i.product_id === selectedId) ?? null : null;

  // Chalta-phirta gahak par khata ka khana khulta hi nahi.
  const payMethods = custMode === "walkin" ? PAYMENT_METHODS.filter((m) => m.key !== "khata") : PAYMENT_METHODS;

  function addToCart(item: InventoryItem) {
    if (!item.products) return;
    setCart((prev) => {
      const existing = prev.find((l) => l.product_id === item.product_id);
      if (existing) {
        return prev.map((l) =>
          l.product_id === item.product_id ? { ...l, quantity: l.quantity + 1 } : l
        );
      }
      return [
        ...prev,
        {
          product_id: item.product_id,
          name: item.products!.name,
          quantity: 1,
          unit_price: priceFor(item, wholesaleOn),
        },
      ];
    });
    // Yahan tafseel ka khana jaan boojh kar NAHI kholte. Har cheez
    // daalte hi wo khana khul jaye to cheezon ki jagah har dafa dhak
    // jati hai -- aur counter par sab se zyada dohraya jane wala kaam
    // yehi hai: cheez dhoondo, dabao, agli cheez. Tafseel tab khulti
    // hai jab banda cart ki qatar par ungli rakhta hai.
  }

  function findByBarcode(code: string): InventoryItem | undefined {
    const trimmed = code.trim();
    if (!trimmed) return undefined;
    // Company ka barcode ya apna (261) -- dono se milta hai.
    return inventory.find((item) => item.products?.barcode === trimmed || item.products?.internal_barcode === trimmed);
  }

  function handleBarcodeSubmit(e: React.FormEvent) {
    e.preventDefault();
    const match = findByBarcode(barcodeInput);
    if (match) {
      addToCart(match);
      setBarcodeError(null);
    } else {
      setBarcodeError(`No product found for barcode "${barcodeInput.trim()}"`);
    }
    setBarcodeInput("");
  }

  function handleCameraDetected(code: string) {
    setShowCameraModal(false);
    const match = findByBarcode(code);
    if (match) {
      addToCart(match);
      setBarcodeError(null);
    } else {
      setBarcodeError(`No product found for barcode "${code}"`);
    }
    barcodeRef.current?.focus();
  }

  function updateQuantity(product_id: string, quantity: number) {
    if (quantity <= 0) {
      removeLine(product_id);
      return;
    }
    setCart((prev) => prev.map((l) => (l.product_id === product_id ? { ...l, quantity } : l)));
  }

  /**
   * Bikri ka rate badalna -- sirf jis ke paas ijazat ho.
   *
   * Yahan rok lagana kaafi nahi samjha gaya: yehi jaanch checkout ke
   * andar bhi hai. Safhe ka khana band kar dena us bande ko nahi rokta
   * jo seedha request bhej de.
   */
  function updateRate(product_id: string, rate: number) {
    if (!perms.canEditRate) return;
    setCart((prev) => prev.map((l) => (l.product_id === product_id ? { ...l, unit_price: rate } : l)));
  }

  function removeLine(product_id: string) {
    setCart((prev) => {
      const next = prev.filter((l) => l.product_id !== product_id);
      // Jo cheez hat gayi us ki tafseel khuli na reh jaye -- warna banda
      // us cheez ka rate dekh raha hota hai jo bill mein hai hi nahi.
      if (product_id === selectedId) setSelectedId(next.length ? next[0].product_id : null);
      return next;
    });
  }

  function resetSale() {
    setCart([]);
    setSelectedId(null);
    setCustomerId("");
    setCustMode("walkin");
    setCustQuery("");
    setPaymentLines([{ id: "1", method: "cash", amount: "", reference: "", receiptFile: null, receiptUrl: null, uploading: false }]);
    barcodeRef.current?.focus();
  }

  function addPaymentLine() {
    setPaymentLines((prev) => [
      ...prev,
      { id: Date.now().toString(), method: "cash", amount: "", reference: "", receiptFile: null, receiptUrl: null, uploading: false },
    ]);
  }
  function removePaymentLine(id: string) {
    setPaymentLines((prev) => (prev.length > 1 ? prev.filter((l) => l.id !== id) : prev));
  }
  function updatePaymentLine(id: string, field: keyof PaymentLine, value: any) {
    setPaymentLines((prev) => prev.map((l) => (l.id === id ? { ...l, [field]: value } : l)));
  }
  function fillRemaining(id: string) {
    updatePaymentLine(id, "amount", Math.max(0, remaining + (parseFloat(paymentLines.find((l) => l.id === id)?.amount ?? "0") || 0)).toString());
  }

  async function handleReceiptUpload(id: string, file: File) {
    updatePaymentLine(id, "uploading", true);
    const path = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
    const { error: uploadError } = await supabase.storage.from("pos-payment-receipts").upload(path, file);
    if (uploadError) {
      setMessage({ type: "error", text: `Receipt upload nahi hui: ${uploadError.message}` });
      updatePaymentLine(id, "uploading", false);
      return;
    }
    const { data } = supabase.storage.from("pos-payment-receipts").getPublicUrl(path);
    updatePaymentLine(id, "receiptFile", file);
    updatePaymentLine(id, "receiptUrl", data.publicUrl);
    updatePaymentLine(id, "uploading", false);
  }

  async function handleCheckout() {
    setMessage(null);
    if (cart.length === 0) {
      setMessage({ type: "error", text: t("pos_cart_empty_error", lang) });
      return;
    }
    // ===== Bina naam ka udhaar kabhi nahi =====
    // Ye is safhe ka sab se ahem maali usool hai. Naqad par gahak ka naam
    // marzi ki baat hai; udhaar par LAZMI. Bina naam ki baqi raqam kisi
    // ke zimme nahi hoti, aur jo kisi ke zimme nahi wo kabhi wapas nahi
    // aati. Yehi rok checkout ke andar (server par) bhi lagi hui hai.
    if (khataTotal > 0 && !customerId) {
      setMessage({ type: "error", text: t("pos_credit_needs_customer", lang) });
      return;
    }
    if (Math.abs(remaining) > 0.5) {
      setMessage({ type: "error", text: `Payment poora nahi hai. Baaqi: Rs ${remaining.toLocaleString()}` });
      return;
    }

    const cashCollected = total - khataTotal;
    const primaryMethod = paymentLines.length === 1 ? paymentLines[0].method : "split";

    setSubmitting(true);
    // Bikri ab seedha database ko nahi jati -- server ke raaste jati hai,
    // taake wo ledger mein bhi darj ho. Pehle browser khud create_pos_sale
    // bulata tha aur ledger ko bikri ka pata hi nahi chalta tha; us ka
    // nateeja raat ki ginti par nikalta tha, jahan golak mein har roz
    // poore din ki bikri jitna "zyada" paisa nazar aata.
    const result = await posCheckout({
      customerId: customerId || null,
      paymentMode: primaryMethod,
      cashPaid: cashCollected,
      khataAmount: khataTotal,
      items: cart.map((l) => ({
        product_id: l.product_id,
        quantity: l.quantity,
        unit_price: l.unit_price,
      })),
      paymentLines: paymentLines
        .filter((l) => (parseFloat(l.amount) || 0) > 0)
        .map((l) => ({ method: l.method, amount: parseFloat(l.amount) || 0, reference: l.reference || "", receipt_url: l.receiptUrl || "" })),
    });

    const data = result.saleId;
    if (result.error) {
      setMessage({ type: "error", text: result.error });
      setSubmitting(false);
      return;
    }

    if (!data) {
      setMessage({ type: "error", text: t("pos_sale_failed", lang) });
      setSubmitting(false);
      return;
    }

    // Bikri ho gayi magar ledger mein na ja saki -- ye chhupaya nahi
    // jata. Bikri sahi hai (maal ja chuka hai, paisa aa chuka hai) magar
    // counter par khare bande ko maloom hona chahiye, taake wo raat ki
    // ginti se pehle ise theek karwa sake.
    setMessage(
      result.notice
        ? { type: "error", text: `${t("pos_sale_done", lang)} — magar ${result.notice}` }
        : { type: "success", text: t("pos_sale_done", lang) }
    );
    setCompletedSaleId(data);
    resetSale();
    setSubmitting(false);
  }

  // ===== Wapsi ka darwaza =====
  // Alag safha nahi -- wohi counter, wohi shakl. Malik ka kehna (5
  // September): "Staff ko alag complicated Return page par na bhejein."
  if (mode === "return") {
    return (
      <div className="space-y-3 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setMode("sale")}
            className="inline-flex items-center gap-1.5 rounded-lg border border-surface-200 px-3 py-2 text-sm font-medium text-surface-700 hover:bg-surface-50 dark:border-surface-700 dark:text-surface-200"
          >
            <ArrowLeft className="h-4 w-4" /> {t("pos_mode_sale", lang)}
          </button>
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900 dark:bg-amber-900/30 dark:text-amber-300">
            <RotateCcw className="h-4 w-4" /> {t("pos_mode_return", lang)}
          </span>
        </div>
        <PosReturn lang={lang} recentSales={recentSales} onDone={() => setMode("sale")} />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 p-4 lg:h-[calc(100vh-7rem)] lg:grid-cols-[minmax(0,1fr)_23rem] lg:overflow-hidden">
      {/* ================= BAAYIN TARAF: cheezein ================= */}
      <section className="flex flex-col lg:min-h-0">
        {/* ---- Ek hi patti: naam, scan, talash, qism, ordering ----
            Malik ka kehna (4 September): barcode ke liye alag poori line
            na ho. Wajah saaf hai -- upar jo jagah jati hai wo cheezon ke
            khanon se katti hai, aur counter par nazar cheez par honi
            chahiye. Tarteeb bhi soch kar hai: SCAN pehle, talash baad
            mein. Tez tareen raasta scan se cart tak hai; naam se dhoondna
            us waqt hota hai jab barcode na ho.

            Sab khane ek hi oonchai (h-11) par, warna patti ooper neeche
            hilti nazar aati hai. */}
        <div className="mb-3 flex shrink-0 flex-wrap items-center gap-2.5">
          <h1 className="w-[11rem] shrink-0 truncate font-display text-lg font-semibold leading-tight text-surface-900 dark:text-white">
            {sellerName} - POS
          </h1>

          <form onSubmit={handleBarcodeSubmit} className="flex items-center gap-2">
            <div className="relative w-[20rem] max-w-[60vw]">
              <ScanLine className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-500" />
              <Input
                ref={barcodeRef}
                value={barcodeInput}
                onChange={(e) => setBarcodeInput(e.target.value)}
                placeholder={t("pos_scan_hint", lang)}
                className="h-11 pl-9"
              />
            </div>
            <button
              type="button"
              onClick={() => setShowCameraModal(true)}
              aria-label="Camera"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-surface-200 text-surface-600 hover:bg-surface-50 dark:border-surface-700 dark:text-surface-300 dark:hover:bg-surface-800"
            >
              <Camera className="h-4 w-4" />
            </button>
          </form>

          <div className="relative w-[15rem] max-w-full">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-400" />
            <Input
              placeholder={t("pos_search_products", lang)}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-11 pl-9"
            />
          </div>

          {/* Qism ka filter -- 265 cheezon mein se dhoondna naam se
              mushkil hai, magar "Grocery" chun kar fehrist chhoti ho jati
              hai. Qismein database se aati hain, yahan likhi hui nahi --
              warna nayi qism kabhi is fehrist mein na aati. */}
          {groups.length > 0 && (
            <Select value={group} onChange={(e) => setGroup(e.target.value)} className="h-11 w-[10rem]">
              <option value="">{t("pos_all_groups", lang)}</option>
              {groups.map((g) => (
                <option key={g.name} value={g.name}>
                  {g.name} ({g.count})
                </option>
              ))}
            </Select>
          )}

          <button
            type="button"
            onClick={() => setMode("return")}
            className="flex h-11 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border border-surface-200 px-3 text-sm font-medium text-surface-700 hover:bg-surface-50 dark:border-surface-700 dark:text-surface-200 dark:hover:bg-surface-800"
          >
            <RotateCcw className="h-4 w-4" /> {t("pos_mode_return", lang)}
          </button>

          <Link
            href="/admin/pos/ordering"
            className="flex h-11 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border border-brand-200 bg-brand-50 px-3 text-sm font-medium text-brand-700 hover:bg-brand-100 dark:border-brand-900/40 dark:bg-brand-950/30 dark:text-brand-300"
          >
            <PackagePlus className="h-4 w-4" /> {t("pos_karyana_ordering", lang)}
          </Link>
        </div>

        {/* Jo cheezein rate na hone ki wajah se chhupi hain, un ka adad
            saamne rehta hai -- warna banda apna maal dhoondta reh jata
            hai aur samajhta hai ke stock hi nahi. Patti se bahar, taake
            wo har roz jagah na ghere. */}
        {rateBaqiCount > 0 && (
          <p className="-mt-1 mb-2 shrink-0 text-xs text-amber-700">
            {t("pos_rate_baqi_hidden", lang).replace("{n}", String(rateBaqiCount))}{" "}
            <Link href="/admin/products/rates-baqi" className="underline">
              {t("pos_rate_baqi_link", lang)}
            </Link>
          </p>
        )}
        {barcodeError && <p className="-mt-1 mb-3 shrink-0 text-sm text-red-600 dark:text-red-400">{barcodeError}</p>}

        <div className="lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:pr-1">
          {/* Counter par cheez ki TASVEER sab se tez pehchan hai. Jab tak
              barcode nahi lagte, banda dabba dekh kar pehchanta hai --
              naam parh kar nahi. Isi liye khane ka teen chauthai hissa
              tasveer ka hai aur neeche sirf do line: naam aur qeemat.
              Baqi tafseel yahan nahi -- wo cart se cheez chun kar saamne
              khulti hai. */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
            {filteredInventory.map((item) => {
              const inCart = cart.some((l) => l.product_id === item.product_id);
              const p = item.products;
              return (
                <button
                  key={item.id}
                  onClick={() => addToCart(item)}
                  className={`overflow-hidden rounded-card border bg-white text-left shadow-card transition hover:shadow-md dark:bg-surface-900 ${
                    inCart
                      ? "border-brand-500 ring-1 ring-brand-200 dark:ring-brand-900/50"
                      : "border-surface-200 hover:border-brand-400 dark:border-surface-800"
                  }`}
                >
                  <div className="relative aspect-square bg-surface-50 dark:bg-surface-800">
                    {p?.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={p.image_url}
                        alt={p.name}
                        className="h-full w-full object-contain p-2"
                        loading="lazy"
                      />
                    ) : (
                      // Tasveer na ho to saaf khali nishaan -- naam ka
                      // bara harf nahi. Bare harf ko banda door se
                      // tasveer samajh leta hai aur ghalat dabba uthha
                      // leta hai.
                      <div className="flex h-full w-full items-center justify-center text-surface-300 dark:text-surface-600">
                        <Package className="h-8 w-8" strokeWidth={1.25} />
                      </div>
                    )}
                    {/* Maal upar daayen, chhota nishaan. Adad akela kuch
                        nahi batata -- 8 kisi cheez ke liye bohat hai aur
                        kisi ke liye khatam hone ke barabar. Rang wo
                        faisla ek nazar mein de deta hai. */}
                    <span className="absolute right-1.5 top-1.5 inline-flex items-center gap-1 rounded-md bg-white/90 px-1.5 py-0.5 text-[11px] font-semibold text-surface-700 shadow-sm dark:bg-surface-900/90 dark:text-surface-200">
                      <span className={`h-1.5 w-1.5 rounded-full ${stockTone(item.stock_quantity)}`} />
                      {item.stock_quantity}
                    </span>
                  </div>

                  <div className="border-t border-surface-100 px-2.5 py-2 dark:border-surface-800">
                    <p className="truncate text-[13px] font-medium leading-tight text-surface-900 dark:text-surface-100">
                      {p?.name}
                      {p?.pack_size ? <span className="text-surface-400"> {p.pack_size}</span> : null}
                    </p>
                    <p className="mt-0.5 flex items-baseline justify-between gap-2">
                      <span className="font-display text-sm font-semibold text-brand-700 tabular-nums dark:text-brand-300">
                        Rs {item.selling_price.toLocaleString()}
                      </span>
                      {p?.mrp_price != null && p.mrp_price > 0 && (
                        <span className="shrink-0 text-[11px] text-surface-400 tabular-nums">
                          {t("pos_mrp", lang)} {Number(p.mrp_price).toLocaleString()}
                        </span>
                      )}
                    </p>
                  </div>
                </button>
              );
            })}
            {filteredInventory.length === 0 && (
              <p className="col-span-full py-10 text-center text-sm text-surface-400">
                {t("pos_no_products", lang)}
              </p>
            )}
          </div>
        </div>
      </section>

      {/* ===== Cheez ki tafseel: khulne wala khana, hamesha ka nahi =====
          Malik ki hidayat (5 September): "Item Details default permanent
          column nahi rehna chahiye... close karne par product area wapas
          full width ho jaye."
          Wajah waajib hai: counter par asal kaam cheez pehchan kar cart
          mein daalna hai. Wo jagah kisi aise khane ko de dena jo aksar
          khali para rehta hai, har bande ka har bill dheema kar deta
          hai. Ye khana tab aata hai jab cart ki qatar par ungli lagti
          hai, aur band karte hi jagah wapas cheezon ko mil jati hai. */}
      {selectedLine && selectedItem && (
        <>
          {/* Chhoti screen par peeche ka hissa dhak jata hai; baRi screen
              par nahi -- wahan cart saath hi khula rehta hai taake banda
              tafseel dekhte hue bill bhi dekh sake. */}
          <div
            className="fixed inset-0 z-30 bg-black/30 lg:hidden"
            onClick={() => setSelectedId(null)}
            aria-hidden
          />
          <aside className="fixed inset-0 z-40 overflow-y-auto border-l border-surface-200 bg-white p-4 shadow-2xl dark:border-surface-800 dark:bg-surface-900 lg:inset-x-auto lg:bottom-4 lg:right-[24.5rem] lg:top-[7.5rem] lg:w-[21rem] lg:rounded-card lg:border">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-display text-sm font-semibold text-surface-900 dark:text-surface-100">
                {t("pos_details", lang)}
              </h2>
              <button
                type="button"
                onClick={() => setSelectedId(null)}
                className="rounded-md p-1 text-surface-400 hover:bg-surface-100 hover:text-surface-700 dark:hover:bg-surface-800"
                aria-label={t("sh_cancel", lang)}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <ItemDetails
              line={selectedLine}
              item={selectedItem}
              lang={lang}
              perms={perms}
              onQty={(q) => updateQuantity(selectedLine.product_id, q)}
              onRate={(r) => updateRate(selectedLine.product_id, r)}
              onRemove={() => removeLine(selectedLine.product_id)}
            />
          </aside>
        </>
      )}

      {/* ============ DAAYIN TARAF: gahak, cart, adaigi ============ */}
      <Card className="flex flex-col gap-4 lg:h-full lg:min-h-0 lg:overflow-y-auto">
        <div className="flex items-center gap-2">
          <ShoppingCart className="h-5 w-5 text-brand-600" />
          <h2 className="font-display text-base font-semibold text-surface-900 dark:text-surface-100">{t("at_cart", lang)}</h2>
        </div>

        <div className="max-h-64 space-y-2 overflow-y-auto">
          {cart.length === 0 && (
            <div className="py-6 text-center">
              <p className="text-sm text-surface-500">{t("pos_cart_empty", lang)}</p>
              <p className="mt-1 text-xs text-surface-400">{t("pos_cart_empty_hint", lang)}</p>
            </div>
          )}
          {/* Qatar KHUD button hai. "View Details" ka alag button nahi --
              wo ek zyada qadam hai, aur counter par har zyada qadam ek
              der hai. */}
          {cart.map((line) => {
            const item = inventory.find((i) => i.product_id === line.product_id);
            const active = line.product_id === selectedId;
            return (
              <button
                key={line.product_id}
                type="button"
                onClick={() => setSelectedId(line.product_id)}
                className={`flex w-full items-center gap-2 rounded-lg border p-2 text-left transition ${
                  active
                    ? "border-l-4 border-brand-500 bg-brand-50/70 dark:bg-brand-950/30"
                    : "border-surface-100 hover:bg-surface-50 dark:border-surface-800 dark:hover:bg-surface-800/60"
                }`}
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-md bg-surface-100 dark:bg-surface-800">
                  {item?.products?.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.products.image_url} alt="" className="h-full w-full object-contain" loading="lazy" />
                  ) : (
                    <Package className="h-4 w-4 text-surface-400" strokeWidth={1.5} />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-surface-800 dark:text-surface-200">
                    {line.name}
                  </span>
                  <span className="block text-xs text-surface-400">
                    {line.quantity} × Rs {line.unit_price.toLocaleString()}
                    {/* Thok chalu ho magar is cheez par rate na ho to saaf
                        likha jata hai -- warna dukandar samajhta hai ke
                        usay thok mila hai. */}
                    {wholesaleOn && item?.wholesale_price == null && (
                      <span className="ml-1 text-amber-700">{t("pf_pos_no_wholesale_rate", lang)}</span>
                    )}
                  </span>
                </span>
                <span className="shrink-0 text-sm font-semibold tabular-nums text-surface-900 dark:text-surface-100">
                  Rs {(line.quantity * line.unit_price).toLocaleString()}
                </span>
              </button>
            );
          })}
        </div>

        <div className="border-t border-surface-100 pt-3 dark:border-surface-800">
          <Label>
            {t("pos_customer", lang)} {khataTotal > 0 && <span className="text-red-500">*</span>}
          </Label>

          {/* Teen darwaze, saaf naam ke sath. "Regular" ka lafz pehle
              chalte-phirte gahak par bhi lag raha tha -- aur usi dhundle
              lafz ke peeche bina naam ka udhaar chhup sakta hai. */}
          <div className="mb-2 grid grid-cols-3 gap-1.5">
            {(
              [
                ["walkin", t("pos_walkin", lang)],
                ["regular", t("pos_regular", lang)],
                ["wholesale", t("pos_wholesale", lang)],
              ] as [CustomerMode, string][]
            ).map(([mode, label]) => (
              <button
                key={mode}
                type="button"
                onClick={() => switchCustomerMode(mode)}
                className={`rounded-lg border px-2 py-1.5 text-xs font-medium ${
                  custMode === mode
                    ? mode === "wholesale"
                      ? "border-amber-500 bg-amber-50 text-amber-900"
                      : "border-brand-500 bg-brand-50 text-brand-800"
                    : "border-surface-300 text-surface-600 dark:border-surface-700 dark:text-surface-400"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {custMode === "walkin" ? (
            <p className="rounded-lg bg-surface-50 px-3 py-2 text-xs text-surface-600 dark:bg-surface-800 dark:text-surface-300">
              {t("pos_walkin_note", lang)}
            </p>
          ) : chosenCustomer ? (
            // Chuna hua gahak: naam, phone aur us ka BAQI. Baqi yahan is
            // liye hai ke naya udhaar dene ka faisla usi waqt hota hai --
            // baad mein khata kholne par wo faisla ho chuka hota hai.
            <div className="flex items-start gap-2 rounded-lg border border-surface-200 p-2.5 dark:border-surface-700">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-surface-900 dark:text-white">
                  {chosenCustomer.name}
                </p>
                {chosenCustomer.phone && <p className="text-xs text-surface-500">{chosenCustomer.phone}</p>}
                <p className="mt-0.5 text-xs">
                  <span className="text-surface-500">{t("pos_cust_balance", lang)}: </span>
                  {chosenCustomer.balance == null ? (
                    <span className="text-surface-400">—</span>
                  ) : (
                    <span
                      className={
                        chosenCustomer.balance > 0
                          ? "font-semibold text-red-600"
                          : "font-semibold text-emerald-700"
                      }
                    >
                      Rs {Math.round(chosenCustomer.balance).toLocaleString()}
                    </span>
                  )}
                </p>
                {/* Udhaar ki hadd. Darj hi na ho to "—" -- sifar likh
                    dena "is ko udhaar bilkul nahi" kehne ke barabar hai,
                    aur wo faisla kisi ne kiya hi nahi. */}
                <p className="text-xs">
                  <span className="text-surface-500">{t("pos_credit_limit", lang)}: </span>
                  {chosenCustomer.creditLimit == null || chosenCustomer.creditLimit === 0 ? (
                    <span className="text-surface-400">—</span>
                  ) : (
                    <span className="font-medium text-surface-700 dark:text-surface-200">
                      Rs {Math.round(chosenCustomer.creditLimit).toLocaleString()}
                    </span>
                  )}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  applyCustomer("");
                  setCustQuery("");
                }}
                className="shrink-0 rounded-md px-1.5 text-surface-400 hover:text-surface-700"
                aria-label={t("pos_walk_in", lang)}
              >
                ✕
              </button>
            </div>
          ) : (
            <>
              <Input
                value={custQuery}
                onChange={(e) => setCustQuery(e.target.value)}
                placeholder={custMode === "wholesale" ? t("pos_shop_search", lang) : t("pos_cust_search", lang)}
              />
              <div className="mt-1 max-h-52 overflow-y-auto rounded-lg border border-surface-200 dark:border-surface-700">
                {custMatches.length === 0 ? (
                  <p className="px-3 py-2 text-xs text-surface-400">
                    {custMode === "wholesale" ? t("pf_pos_no_shops", lang) : t("pos_cust_none", lang)}
                  </p>
                ) : (
                  custMatches.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => {
                        applyCustomer(c.id);
                        setCustQuery("");
                      }}
                      className="block w-full border-b border-surface-100 px-3 py-2 text-left last:border-b-0 hover:bg-surface-50 dark:border-surface-800 dark:hover:bg-surface-800"
                    >
                      <p className="text-sm font-medium text-surface-900 dark:text-surface-100">{c.name}</p>
                      <p className="text-xs text-surface-500">
                        {c.phone ?? "—"}
                        {c.balance != null && c.balance > 0
                          ? ` · Rs ${Math.round(c.balance).toLocaleString()}`
                          : ""}
                      </p>
                    </button>
                  ))
                )}
              </div>
            </>
          )}

          {wholesaleOn && (
            <p className="mt-1.5 rounded-lg bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-900">
              {t("pf_pos_wholesale_on", lang)}
            </p>
          )}
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <Label>{t("pos_payment", lang)}</Label>
            <button type="button" onClick={addPaymentLine} className="flex items-center gap-1 text-xs font-medium text-brand-600 hover:underline">
              <Plus className="h-3 w-3" /> {t("pos_add_split", lang)}
            </button>
          </div>
          {custMode === "walkin" && (
            <p className="mb-1.5 text-[11px] text-surface-400">{t("pos_walkin_no_credit", lang)}</p>
          )}
          <div className="space-y-2">
            {paymentLines.map((line) => (
              <div key={line.id} className="rounded-lg border border-surface-200 p-2 dark:border-surface-700">
                <div className="flex items-center gap-1.5">
                  <Select value={line.method} onChange={(e) => updatePaymentLine(line.id, "method", e.target.value)} className="flex-1 text-xs">
                    {payMethods.map((m) => (
                      <option key={m.key} value={m.key}>{m.label}</option>
                    ))}
                  </Select>
                  <Input
                    type="number"
                    min={0}
                    placeholder={t("pos_amount", lang)}
                    value={line.amount}
                    onChange={(e) => updatePaymentLine(line.id, "amount", e.target.value)}
                    className="h-8 w-24 text-xs"
                  />
                  <button type="button" onClick={() => fillRemaining(line.id)} className="whitespace-nowrap text-[10px] text-brand-600 hover:underline">{t("pos_remaining", lang)}</button>
                  {paymentLines.length > 1 && (
                    <button type="button" onClick={() => removePaymentLine(line.id)} className="text-surface-400 hover:text-red-600">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
                {line.method !== "cash" && line.method !== "khata" && (
                  <>
                    <Input
                      placeholder={t("pos_reference_optional", lang)}
                      value={line.reference}
                      onChange={(e) => updatePaymentLine(line.id, "reference", e.target.value)}
                      className="mt-1.5 h-7 text-xs"
                    />
                    <label className="mt-1.5 flex cursor-pointer items-center gap-1.5 rounded border border-dashed border-surface-300 px-2 py-1.5 text-[11px] text-surface-500 hover:bg-surface-50">
                      {line.uploading ? (
                        "Upload ho raha hai..."
                      ) : line.receiptUrl ? (
                        <span className="flex items-center gap-1 text-green-600"><Check className="h-3 w-3" /> {t("pos_receipt_attached", lang)}</span>
                      ) : (
                        <span className="flex items-center gap-1"><Paperclip className="h-3 w-3" /> {t("pos_attach_receipt", lang)}</span>
                      )}
                      <input
                        type="file"
                        accept="image/*,application/pdf"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleReceiptUpload(line.id, file);
                        }}
                      />
                    </label>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-surface-100 pt-3 text-sm dark:border-surface-800">
          <span className="text-surface-500">{t("pos_total_quantity", lang)}</span>
          <span className="font-medium tabular-nums text-surface-900 dark:text-surface-100">
            {cart.reduce((s, l) => s + l.quantity, 0)}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="font-display text-base font-semibold text-surface-900 dark:text-white">{t("pos_grand_total", lang)}</span>
          <span className="font-display text-xl font-bold tabular-nums text-brand-700 dark:text-brand-300">
            Rs {total.toLocaleString()}
          </span>
        </div>
        <div className={`flex items-center justify-between text-sm ${Math.abs(remaining) > 0.5 ? "text-amber-600" : "text-green-600"}`}>
          <span>{remaining > 0 ? "Baaqi Rakam" : remaining < 0 ? "Zyada Amount" : "Poora Paid"}</span>
          <span className="font-semibold tabular-nums">Rs {Math.abs(remaining).toLocaleString()}</span>
        </div>

        {message && (
          <div
            className={`rounded-lg px-3 py-2 text-sm ${
              message.type === "success"
                ? "bg-brand-50 text-brand-700 dark:bg-brand-950/30 dark:text-brand-300"
                : "bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-300"
            }`}
          >
            {message.text}
          </div>
        )}
        {/* Checkout hi asal kaam hai -- wo bara aur sabz. Cart khali karna
            us ke barabar nazar nahi aana chahiye, warna kisi din wo ghalti
            se dab jayega. */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={resetSale}
            disabled={submitting || cart.length === 0}
            className="rounded-lg border border-surface-200 px-3 py-2 text-sm font-medium text-surface-500 hover:bg-surface-50 disabled:opacity-40 dark:border-surface-700 dark:text-surface-400 dark:hover:bg-surface-800"
          >
            {t("pos_clear_cart", lang)}
          </button>
          <Button data-guide="pos-checkout" className="flex-1 py-3 text-base" onClick={handleCheckout} disabled={submitting || cart.length === 0}>
            {submitting ? "Processing..." : "Checkout"}
          </Button>
        </div>
      </Card>
      {completedSaleId && (
        <ReceiptModal saleId={completedSaleId} onClose={() => setCompletedSaleId(null)} lang={lang} />
      )}
      {showCameraModal && (
        <BarcodeCameraModal
          onDetected={handleCameraDetected}
          onClose={() => setShowCameraModal(false)}
          lang={lang}
        />
      )}
    </div>
  );
}

/**
 * Chuni hui cheez ki tafseel.
 *
 * Yahan wohi cheezein hain jin par counter par faisla hota hai: tadaad,
 * rate, kitna maal para hai, aur miyaad. Jo adad maujood na ho us ke
 * saamne "—" aata hai, sifar nahi -- sifar kehta hai "dekh liya, kuch
 * nahi hai", aur usi bharose par banda maal bech deta hai.
 *
 * Lagat (trade / kharid ka rate) yahan tabhi aati hai jab us ka khana
 * server se aaya ho. Bina ijazat wale ko wo bheja hi nahi jata.
 */
function ItemDetails({
  line,
  item,
  lang,
  perms,
  onQty,
  onRate,
  onRemove,
}: {
  line: CartLine;
  item: InventoryItem;
  lang: Lang;
  perms: PosPermissions;
  onQty: (q: number) => void;
  onRate: (r: number) => void;
  onRemove: () => void;
}) {
  const p = item.products;
  const expiry = shortDate(item.expiry_date);
  const barcode = p?.barcode || p?.internal_barcode || null;
  const nishaan = <span className="text-surface-400">—</span>;

  const row = (label: React.ReactNode, value: React.ReactNode) => (
    <div className="flex items-baseline justify-between gap-2 py-1 text-sm">
      <span className="text-surface-500">{label}</span>
      <span className="text-right font-medium tabular-nums text-surface-900 dark:text-surface-100">{value}</span>
    </div>
  );

  return (
    <div className="space-y-3">
      <div className="flex h-32 items-center justify-center overflow-hidden rounded-lg bg-surface-50 dark:bg-surface-800">
        {p?.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={p.image_url} alt={p.name} className="h-full w-full object-contain p-2" loading="lazy" />
        ) : (
          <Package className="h-10 w-10 text-surface-300 dark:text-surface-600" strokeWidth={1.25} />
        )}
      </div>

      <div>
        <p className="font-display text-base font-semibold leading-tight text-surface-900 dark:text-white">
          {line.name}
        </p>
        <p className="mt-0.5 text-xs text-surface-500">
          {[p?.pack_size, p?.unit_code].filter(Boolean).join(" / ") || "—"}
        </p>
      </div>

      {/* Tadaad: do bare button. Counter par ungli se dabana keyboard se
          tez hai, magar seedha likhna bhi khula hai -- barah dane ginte
          waqt barah dafa dabana bewaqoofi hai. */}
      <div>
        <Label>{t("pos_qty", lang)}</Label>
        <div className="mt-1 flex items-center gap-2">
          <button
            type="button"
            onClick={() => onQty(line.quantity - 1)}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-surface-200 text-surface-600 hover:bg-surface-50 dark:border-surface-700 dark:text-surface-300"
            aria-label="-"
          >
            <Minus className="h-4 w-4" />
          </button>
          <Input
            type="number"
            min={1}
            value={line.quantity}
            onChange={(e) => onQty(parseInt(e.target.value) || 0)}
            className="h-9 flex-1 text-center"
          />
          <button
            type="button"
            onClick={() => onQty(line.quantity + 1)}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-surface-200 text-surface-600 hover:bg-surface-50 dark:border-surface-700 dark:text-surface-300"
            aria-label="+"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Bikri ka rate. Ijazat na ho to khana khulta hi nahi -- aadha
          khula khana banda dabata rehta hai aur samajhta hai safha kharab
          hai. */}
      <div>
        <Label>{t("pos_sell_rate", lang)}</Label>
        {perms.canEditRate ? (
          <Input
            type="number"
            min={0}
            step="0.01"
            value={line.unit_price}
            onChange={(e) => onRate(parseFloat(e.target.value) || 0)}
            className="mt-1 h-9"
          />
        ) : (
          <div className="mt-1 flex items-center gap-1.5 rounded-lg bg-surface-50 px-3 py-2 dark:bg-surface-800">
            <span className="text-sm font-semibold tabular-nums text-surface-800 dark:text-surface-100">
              Rs {line.unit_price.toLocaleString()}
            </span>
            <Lock className="h-3 w-3 text-surface-400" />
            <span className="ml-auto text-right text-[11px] text-surface-400">{t("pos_rate_locked", lang)}</span>
          </div>
        )}
      </div>

      <div className="divide-y divide-surface-100 border-t border-surface-100 pt-1 dark:divide-surface-800 dark:border-surface-800">
        {row(
          t("pos_mrp", lang),
          p?.mrp_price != null && p.mrp_price > 0 ? `Rs ${Number(p.mrp_price).toLocaleString()}` : nishaan
        )}
        {/* Lagat sirf ijazat walon ko. Bina ijazat wale ke liye ye khana
            server se aaya hi nahi hota. */}
        {perms.canSeeCost &&
          row(
            t("pos_cost_rate", lang),
            p?.purchase_price != null && p.purchase_price > 0
              ? `Rs ${Number(p.purchase_price).toLocaleString()}`
              : nishaan
          )}
        {perms.canSeeCost &&
          row(
            t("pos_wholesale_rate", lang),
            item.wholesale_price != null ? `Rs ${item.wholesale_price.toLocaleString()}` : nishaan
          )}
        {row(
          t("pos_shop_stock", lang),
          <span className="inline-flex items-center gap-1.5">
            <span className={`h-1.5 w-1.5 rounded-full ${stockTone(item.stock_quantity)}`} />
            {item.stock_quantity}
          </span>
        )}
        {/* Godam ki ginti na ho saki to "—". Sifar likh dena "godam khali
            hai" ka jhoot hai, aur usi par maal mangwana rukta hai. */}
        {row(t("pos_wh_stock", lang), item.warehouse_stock == null ? nishaan : item.warehouse_stock)}
        {row(
          t("pos_barcode", lang),
          barcode ? (
            <span className="font-mono text-xs">{barcode}</span>
          ) : (
            <span className="text-xs text-surface-400">{t("pos_no_barcode", lang)}</span>
          )
        )}
        {row(
          t("pos_batch", lang),
          item.batch_number
            ? item.batch_number
            : (item.batch_count ?? 0) > 1
              ? t("pos_batch_many", lang).replace("{n}", String(item.batch_count))
              : nishaan
        )}
        {row(t("pos_expiry", lang), expiry ?? nishaan)}
        {row(
          <span className="font-semibold text-surface-800 dark:text-surface-200">{t("pos_line_total", lang)}</span>,
          <span className="font-display text-base font-bold text-brand-700 dark:text-brand-300">
            Rs {(line.quantity * line.unit_price).toLocaleString()}
          </span>
        )}
      </div>

      <button
        type="button"
        onClick={onRemove}
        className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 dark:border-red-900/40 dark:text-red-400 dark:hover:bg-red-900/20"
      >
        <Trash2 className="h-4 w-4" /> {t("pos_remove_item", lang)}
      </button>
    </div>
  );
}
