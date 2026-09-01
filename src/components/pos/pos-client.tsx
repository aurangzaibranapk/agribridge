"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { t, type Lang } from "@/lib/i18n/translations";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { posCheckout } from "@/actions/pos";
import { Button, Input, Select, Label } from "@/components/ui/form";
import { Card } from "@/components/ui/layout-primitives";
import { ShoppingCart, Trash2, Search, ScanLine, Camera, Plus, X, PackagePlus, Paperclip, Check } from "lucide-react";
import { ReceiptModal } from "@/components/pos/receipt-modal";
import { BarcodeCameraModal } from "@/components/pos/barcode-camera-modal";

interface InventoryItem {
  id: string;
  product_id: string;
  stock_quantity: number;
  selling_price: number;
  /** NULL = is par thok ka rate nahi (retail lagega). Sifar se ALAG hai. */
  wholesale_price: number | null;
  products: { name: string; pack_size: string | null; barcode: string | null } | null;
}
interface Customer {
  id: string;
  name: string;
  phone: string | null;
  /** Wo dukan jise hum maal dete hain -- us par thok ka rate lagta hai (246). */
  isWholesaleShop: boolean;
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

interface PaymentLine {
  id: string;
  method: PaymentMethod;
  amount: string;
  reference: string;
  receiptFile: File | null;
  receiptUrl: string | null;
  uploading: boolean;
}

export function PosClient({
  sellerName,
  inventory,
  customers,
  lang,
}: {
  sellerName: string;
  inventory: InventoryItem[];
  customers: Customer[];
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
  const [cart, setCart] = useState<CartLine[]>([]);
  const [customerId, setCustomerId] = useState<string>("");
  // "Thok" par click karte hi neeche sirf wo dukanein khulti hain jinhen
  // hum maal dete hain. Aam gahak ki fehrist us waqt dikhti hi nahi --
  // warna galti se aam aadmi par thok ka rate lag sakta hai.
  const [wholesaleMode, setWholesaleMode] = useState(false);

  const wholesaleShops = customers.filter((c) => c.isWholesaleShop);
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

  const filteredInventory = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return inventory;
    return inventory.filter((item) => item.products?.name?.toLowerCase().includes(q));
  }, [inventory, search]);

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
  }

  function findByBarcode(code: string): InventoryItem | undefined {
    const trimmed = code.trim();
    if (!trimmed) return undefined;
    return inventory.find((item) => item.products?.barcode === trimmed);
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
      setCart((prev) => prev.filter((l) => l.product_id !== product_id));
      return;
    }
    setCart((prev) => prev.map((l) => (l.product_id === product_id ? { ...l, quantity } : l)));
  }

  function removeLine(product_id: string) {
    setCart((prev) => prev.filter((l) => l.product_id !== product_id));
  }

  function resetSale() {
    setCart([]);
    setCustomerId("");
    setWholesaleMode(false);
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
    if (khataTotal > 0 && !customerId) {
      setMessage({ type: "error", text: t("pos_khata_needs_customer", lang) });
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

  return (
    <div className="grid grid-cols-1 gap-6 p-4 lg:h-[calc(100vh-7rem)] lg:grid-cols-[1fr_380px] lg:overflow-hidden">
      <div className="flex flex-col lg:min-h-0">
        <div className="mb-4 flex shrink-0 items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-xl font-semibold text-surface-900 dark:text-white">
              {sellerName} - POS
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/admin/pos/ordering"
              className="flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-brand-200 bg-brand-50 px-3 py-2 text-sm font-medium text-brand-700 hover:bg-brand-100 dark:border-brand-900/40 dark:bg-brand-950/30 dark:text-brand-300"
            >
              <PackagePlus className="h-4 w-4" /> {t("pos_karyana_ordering", lang)}
            </Link>
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-400" />
              <Input
                placeholder={t("pos_search_products", lang)}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
        </div>

        <form onSubmit={handleBarcodeSubmit} className="mb-4 flex shrink-0 gap-2">
          <div className="relative flex-1">
            <ScanLine className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-500" />
            <Input
              ref={barcodeRef}
              value={barcodeInput}
              onChange={(e) => setBarcodeInput(e.target.value)}
              placeholder={t("pos_scan_hint", lang)}
              className="pl-9"
            />
          </div>
          <Button type="button" variant="secondary" onClick={() => setShowCameraModal(true)}>
            <Camera className="h-4 w-4" />
          </Button>
        </form>
        {barcodeError && (
          <p className="-mt-3 mb-4 text-sm text-red-600 dark:text-red-400">{barcodeError}</p>
        )}

        <div className="lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:pr-1">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
            {filteredInventory.map((item) => (
              <button
                key={item.id}
                onClick={() => addToCart(item)}
                className="rounded-card border border-surface-200 bg-white p-3 text-left shadow-card transition hover:border-brand-400 hover:shadow-md dark:border-surface-800 dark:bg-surface-900"
              >
                <p className="text-sm font-medium text-surface-900 dark:text-surface-100 line-clamp-2">
                  {item.products?.name}
                </p>
                {item.products?.pack_size && (
                  <p className="mt-0.5 text-xs text-surface-400">{item.products.pack_size}</p>
                )}
                <p className="mt-2 font-display text-sm font-semibold text-brand-700 dark:text-brand-300">
                  Rs {item.selling_price.toLocaleString()}
                </p>
                <p className="mt-1 text-xs text-surface-400">Stock: {item.stock_quantity}</p>
              </button>
            ))}
            {filteredInventory.length === 0 && (
              <p className="col-span-full py-10 text-center text-sm text-surface-400">
                {t("pos_no_products", lang)}
              </p>
            )}
          </div>
        </div>
      </div>

      <Card className="flex h-fit flex-col gap-4 lg:h-full lg:min-h-0 lg:overflow-y-auto">
        <div className="flex items-center gap-2">
          <ShoppingCart className="h-5 w-5 text-brand-600" />
          <h2 className="font-display text-base font-semibold text-surface-900 dark:text-surface-100">{t("at_cart", lang)}</h2>
        </div>

        <div className="max-h-64 space-y-2 overflow-y-auto">
          {cart.length === 0 && (
            <p className="py-6 text-center text-sm text-surface-400">{t("pos_cart_empty", lang)}</p>
          )}
          {cart.map((line) => (
            <div key={line.product_id} className="flex items-center gap-2 rounded-lg border border-surface-100 p-2 dark:border-surface-800">
              <div className="flex-1">
                <p className="text-sm font-medium text-surface-800 dark:text-surface-200">{line.name}</p>
                <p className="text-xs text-surface-400">
                  Rs {line.unit_price.toLocaleString()} each
                  {/* Thok chalu ho magar is cheez par rate na ho to saaf
                      likha jata hai -- warna dukandar samajhta hai ke
                      usay thok mila hai. */}
                  {wholesaleOn &&
                    inventory.find((i) => i.product_id === line.product_id)?.wholesale_price == null && (
                      <span className="ml-1 text-amber-700">{t("pf_pos_no_wholesale_rate", lang)}</span>
                    )}
                </p>
              </div>
              <Input
                type="number"
                min={1}
                value={line.quantity}
                onChange={(e) => updateQuantity(line.product_id, parseInt(e.target.value) || 0)}
                className="h-8 w-16 text-center"
              />
              <button onClick={() => removeLine(line.product_id)} className="text-surface-400 hover:text-red-600">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>

        <div className="border-t border-surface-100 pt-3 dark:border-surface-800">
          <Label>Customer {khataTotal > 0 && <span className="text-red-500">*</span>}</Label>

          {/* Do alag darwaze, jaan boojh kar. Ek hi fehrist mein aam
              gahak aur thok wali dukanein mila dene par galti se aam
              aadmi par thok ka rate lag jata hai -- aur us ka pata
              mahine baad munafa ginte waqt chalta hai. */}
          <div className="mb-2 flex gap-2">
            <button
              type="button"
              onClick={() => {
                setWholesaleMode(false);
                applyCustomer("");
              }}
              className={`flex-1 rounded-lg border px-3 py-1.5 text-sm font-medium ${
                !wholesaleMode
                  ? "border-brand-500 bg-brand-50 text-brand-800"
                  : "border-surface-300 text-surface-600"
              }`}
            >
              {t("pf_pos_retail_customer", lang)}
            </button>
            <button
              type="button"
              onClick={() => {
                setWholesaleMode(true);
                applyCustomer("");
              }}
              className={`flex-1 rounded-lg border px-3 py-1.5 text-sm font-medium ${
                wholesaleMode
                  ? "border-amber-500 bg-amber-50 text-amber-900"
                  : "border-surface-300 text-surface-600"
              }`}
            >
              {t("pf_pos_wholesale_shop", lang)}
            </button>
          </div>

          {wholesaleMode ? (
            wholesaleShops.length === 0 ? (
              <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                {t("pf_pos_no_shops", lang)}
              </p>
            ) : (
              <Select value={customerId} onChange={(e) => applyCustomer(e.target.value)}>
                <option value="">{t("pf_pos_pick_shop", lang)}</option>
                {wholesaleShops.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                    {c.phone ? ` - ${c.phone}` : ""}
                  </option>
                ))}
              </Select>
            )
          ) : (
            <Select value={customerId} onChange={(e) => applyCustomer(e.target.value)}>
              <option value="">{t("pos_walk_in", lang)}</option>
              {customers
                .filter((c) => !c.isWholesaleShop)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                    {c.phone ? ` - ${c.phone}` : ""}
                  </option>
                ))}
            </Select>
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
          <div className="space-y-2">
            {paymentLines.map((line) => (
              <div key={line.id} className="rounded-lg border border-surface-200 p-2 dark:border-surface-700">
                <div className="flex items-center gap-1.5">
                  <Select value={line.method} onChange={(e) => updatePaymentLine(line.id, "method", e.target.value)} className="flex-1 text-xs">
                    {PAYMENT_METHODS.map((m) => (
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
          <span className="font-medium text-surface-900 dark:text-surface-100">
            {cart.reduce((s, l) => s + l.quantity, 0)}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="font-display text-base font-semibold text-surface-900 dark:text-white">{t("pos_grand_total", lang)}</span>
          <span className="font-display text-xl font-bold text-brand-700 dark:text-brand-300">
            Rs {total.toLocaleString()}
          </span>
        </div>
        <div className={`flex items-center justify-between text-sm ${Math.abs(remaining) > 0.5 ? "text-amber-600" : "text-green-600"}`}>
          <span>{remaining > 0 ? "Baaqi Rakam" : remaining < 0 ? "Zyada Amount" : "Poora Paid"}</span>
          <span className="font-semibold">Rs {Math.abs(remaining).toLocaleString()}</span>
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
        <div className="flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={resetSale} disabled={submitting}>
            {t("pos_clear_cart", lang)}
          </Button>
          <Button className="flex-1" onClick={handleCheckout} disabled={submitting || cart.length === 0}>
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