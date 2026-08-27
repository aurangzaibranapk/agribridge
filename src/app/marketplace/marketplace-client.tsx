"use client";
import { useState, useMemo } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { createClient } from "@/lib/supabase/client";
import { submitMarketplaceCart, type CartState } from "@/actions/marketplace-cart";
import { ShoppingCart, Search, Plus, Minus, X, CheckCircle2, Loader2, MapPin } from "lucide-react";

const initialState: CartState = {};

interface Category { id: string; name: string; }
interface Product {
  id: string;
  name: string;
  image_url: string | null;
  selling_price: number | null;
  mrp_price: number | null;
  pack_size: string | null;
  unit: string | null;
  category_id: string | null;
}
interface CartLine { product: Product; quantity: number; }

const T = {
  en: {
    title: "Marketplace",
    subtitle: "Fertilizer, Pesticide, Seeds, Grocery, Ghee, Wanda - all in one place",
    search: "Search products...",
    allCategories: "All",
    addToCart: "Add",
    inCart: "In Cart",
    cart: "Cart",
    empty: "Your cart is empty",
    total: "Total",
    checkout: "Checkout",
    yourName: "Your Name",
    mobile: "Mobile Number",
    address: "Delivery Address",
    district: "District",
    tehsil: "Tehsil (optional)",
    paymentMethod: "Payment Method",
    advance: "Full Advance Payment",
    cod: "Cash on Delivery (20% Advance Required)",
    placeOrder: "Place Order",
    placing: "Placing Order...",
    orderPlaced: "Order Placed Successfully",
    orderNumbers: "Order Number(s)",
    backToShop: "Continue Shopping",
    or: "or",
    continueGoogle: "Continue with Google",
    continueFacebook: "Continue with Facebook",
    fillManually: "or fill the form manually",
    locationLabel: "Your Location (required for Cash on Delivery)",
    locationCaptured: "Location Captured",
    locationGetting: "Getting Location...",
    locationUse: "Use My Current Location",
  },
  ur: {
    title: "مارکیٹ پلیس",
    subtitle: "کھاد، کیڑے مار دوا، بیج، کریانہ، گھی، ونڈا - سب ایک جگہ",
    search: "پروڈکٹس تلاش کریں...",
    allCategories: "تمام",
    addToCart: "شامل کریں",
    inCart: "کارٹ میں",
    cart: "کارٹ",
    empty: "آپ کا کارٹ خالی ہے",
    total: "کل رقم",
    checkout: "چیک آؤٹ",
    yourName: "آپ کا نام",
    mobile: "موبائل نمبر",
    address: "ڈیلیوری کا پتہ",
    district: "ضلع",
    tehsil: "تحصیل (اختیاری)",
    paymentMethod: "ادائیگی کا طریقہ",
    advance: "پوری ادائیگی پیشگی",
    cod: "ڈیلیوری پر نقد (20% پیشگی ضروری)",
    placeOrder: "آرڈر کریں",
    placing: "آرڈر بھیجا جا رہا ہے...",
    orderPlaced: "آرڈر کامیابی سے ہو گیا",
    orderNumbers: "آرڈر نمبر",
    backToShop: "خریداری جاری رکھیں",
    or: "یا",
    continueGoogle: "Google کے ساتھ جاری رکھیں",
    continueFacebook: "Facebook کے ساتھ جاری رکھیں",
    fillManually: "یا نیچے فارم بھریں",
    locationLabel: "آپ کا مقام (ڈیلیوری پر نقد ادائیگی کے لیے ضروری)",
    locationCaptured: "مقام مل گیا",
    locationGetting: "مقام حاصل کیا جا رہا ہے...",
    locationUse: "میرا موجودہ مقام استعمال کریں",
  },
};

export function MarketplaceClient({ categories, products }: { categories: Category[]; products: Product[] }) {
  const [lang, setLang] = useState<"en" | "ur">("ur");
  const t = T[lang];
  const dir = lang === "ur" ? "rtl" : "ltr";

  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<Record<string, number>>({});
  const [showCart, setShowCart] = useState(false);
  const [showCheckout, setShowCheckout] = useState(false);

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      if (selectedCategory !== "all" && p.category_id !== selectedCategory) return false;
      if (search.trim() && !p.name.toLowerCase().includes(search.trim().toLowerCase())) return false;
      return true;
    });
  }, [products, selectedCategory, search]);

  const cartLines: CartLine[] = useMemo(() => {
    return Object.entries(cart)
      .filter(([, qty]) => qty > 0)
      .map(([productId, qty]) => ({ product: products.find((p) => p.id === productId)!, quantity: qty }))
      .filter((l) => l.product);
  }, [cart, products]);

  const cartTotal = cartLines.reduce((s, l) => s + (l.product.selling_price ?? l.product.mrp_price ?? 0) * l.quantity, 0);
  const cartCount = cartLines.reduce((s, l) => s + l.quantity, 0);

  function addToCart(productId: string) {
    setCart((prev) => ({ ...prev, [productId]: (prev[productId] ?? 0) + 1 }));
  }
  function updateQty(productId: string, delta: number) {
    setCart((prev) => {
      const next = Math.max(0, (prev[productId] ?? 0) + delta);
      return { ...prev, [productId]: next };
    });
  }

  return (
    <div dir={dir} className="min-h-screen bg-surface-50">
      <div className="sticky top-0 z-40 border-b border-surface-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div>
            <h1 className="font-display text-lg font-bold text-surface-900">{t.title}</h1>
            <p className="text-xs text-surface-500">{t.subtitle}</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setLang(lang === "en" ? "ur" : "en")} className="rounded-lg border border-surface-200 px-2.5 py-1.5 text-xs font-medium text-surface-600 hover:bg-surface-50">
              {lang === "en" ? "اردو" : "English"}
            </button>
            <button onClick={() => setShowCart(true)} className="relative flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700">
              <ShoppingCart className="h-4 w-4" /> {t.cart}
              {cartCount > 0 && <span className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">{cartCount}</span>}
            </button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 py-4">
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-400 rtl:left-auto rtl:right-3" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t.search}
            className="w-full rounded-lg border border-surface-200 py-2 pl-9 pr-3 text-sm focus:border-brand-500 focus:outline-none rtl:pl-3 rtl:pr-9"
          />
        </div>

        <div className="mb-4 flex gap-2 overflow-x-auto pb-2">
          <button
            onClick={() => setSelectedCategory("all")}
            className={`shrink-0 rounded-full px-4 py-1.5 text-xs font-medium ${selectedCategory === "all" ? "bg-brand-600 text-white" : "bg-white text-surface-600 border border-surface-200"}`}
          >
            {t.allCategories}
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              onClick={() => setSelectedCategory(c.id)}
              className={`shrink-0 rounded-full px-4 py-1.5 text-xs font-medium ${selectedCategory === c.id ? "bg-brand-600 text-white" : "bg-white text-surface-600 border border-surface-200"}`}
            >
              {c.name}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {filteredProducts.map((p) => {
            const inCartQty = cart[p.id] ?? 0;
            const price = p.selling_price ?? p.mrp_price ?? 0;
            return (
              <div key={p.id} className="rounded-card border border-surface-200 bg-white p-3 shadow-card">
                <div className="mb-2 flex h-24 items-center justify-center overflow-hidden rounded-lg bg-surface-50">
                  {p.image_url ? (
                    <img src={p.image_url} alt={p.name} className="h-full w-full object-contain" />
                  ) : (
                    <ShoppingCart className="h-8 w-8 text-surface-200" />
                  )}
                </div>
                <p className="line-clamp-2 text-xs font-medium text-surface-900">{p.name}</p>
                {p.pack_size && <p className="text-[10px] text-surface-400">{p.pack_size}</p>}
                <p className="mt-1 text-sm font-semibold text-brand-700">Rs {price.toLocaleString()}</p>
                {inCartQty === 0 ? (
                  <button onClick={() => addToCart(p.id)} className="mt-2 flex w-full items-center justify-center gap-1 rounded-lg bg-brand-600 py-1.5 text-xs font-medium text-white hover:bg-brand-700">
                    <Plus className="h-3 w-3" /> {t.addToCart}
                  </button>
                ) : (
                  <div className="mt-2 flex items-center justify-between rounded-lg bg-brand-50 px-2 py-1">
                    <button onClick={() => updateQty(p.id, -1)} className="rounded bg-white p-1 shadow-sm"><Minus className="h-3 w-3" /></button>
                    <span className="text-xs font-semibold text-brand-700">{inCartQty}</span>
                    <button onClick={() => updateQty(p.id, 1)} className="rounded bg-white p-1 shadow-sm"><Plus className="h-3 w-3" /></button>
                  </div>
                )}
              </div>
            );
          })}
          {filteredProducts.length === 0 && <p className="col-span-full py-10 text-center text-sm text-surface-400">-</p>}
        </div>
      </div>

      {showCart && (
        <CartDrawer
          t={t}
          cartLines={cartLines}
          cartTotal={cartTotal}
          updateQty={updateQty}
          onClose={() => setShowCart(false)}
          onCheckout={() => {
            setShowCart(false);
            setShowCheckout(true);
          }}
        />
      )}

      {showCheckout && (
        <CheckoutModal t={t} lang={lang} cartLines={cartLines} cartTotal={cartTotal} onClose={() => setShowCheckout(false)} />
      )}
    </div>
  );
}

function CartDrawer({
  t,
  cartLines,
  cartTotal,
  updateQty,
  onClose,
  onCheckout,
}: {
  t: typeof T.en;
  cartLines: CartLine[];
  cartTotal: number;
  updateQty: (id: string, delta: number) => void;
  onClose: () => void;
  onCheckout: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/50">
      <div className="flex h-full w-full max-w-sm flex-col bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-surface-200 p-4">
          <h3 className="font-display text-base font-semibold text-surface-900">{t.cart}</h3>
          <button onClick={onClose} className="text-surface-400 hover:text-surface-700"><X className="h-5 w-5" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {cartLines.length === 0 && <p className="py-10 text-center text-sm text-surface-400">{t.empty}</p>}
          <div className="space-y-3">
            {cartLines.map((l) => {
              const price = l.product.selling_price ?? l.product.mrp_price ?? 0;
              return (
                <div key={l.product.id} className="flex items-center gap-3 border-b border-surface-100 pb-3">
                  <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-surface-50">
                    {l.product.image_url ? <img src={l.product.image_url} alt={l.product.name} className="h-full w-full object-contain" /> : null}
                  </div>
                  <div className="flex-1">
                    <p className="line-clamp-1 text-xs font-medium text-surface-900">{l.product.name}</p>
                    <p className="text-xs text-brand-600">Rs {price.toLocaleString()}</p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button onClick={() => updateQty(l.product.id, -1)} className="rounded bg-surface-100 p-1"><Minus className="h-3 w-3" /></button>
                    <span className="w-5 text-center text-xs font-semibold">{l.quantity}</span>
                    <button onClick={() => updateQty(l.product.id, 1)} className="rounded bg-surface-100 p-1"><Plus className="h-3 w-3" /></button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        {cartLines.length > 0 && (
          <div className="border-t border-surface-200 p-4">
            <div className="mb-3 flex items-center justify-between text-sm">
              <span className="text-surface-500">{t.total}</span>
              <span className="font-semibold text-surface-900">Rs {cartTotal.toLocaleString()}</span>
            </div>
            <button onClick={onCheckout} className="w-full rounded-lg bg-brand-600 py-2.5 text-sm font-medium text-white hover:bg-brand-700">{t.checkout}</button>
          </div>
        )}
      </div>
    </div>
  );
}

function CheckoutModal({
  t,
  lang,
  cartLines,
  cartTotal,
  onClose,
}: {
  t: typeof T.en;
  lang: "en" | "ur";
  cartLines: CartLine[];
  cartTotal: number;
  onClose: () => void;
}) {
  const [state, formAction] = useFormState(submitMarketplaceCart, initialState);
  const [paymentMode, setPaymentMode] = useState<"advance" | "cod">("advance");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const dir = lang === "ur" ? "rtl" : "ltr";

  function handleUseMyLocation() {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocating(false);
      },
      () => setLocating(false)
    );
  }

  const cartJson = JSON.stringify(cartLines.map((l) => ({ product_id: l.product.id, quantity: l.quantity })));
  const advanceAmount = paymentMode === "cod" ? Math.round(cartTotal * 0.2) : cartTotal;

  async function handleOAuth(provider: "google" | "facebook") {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  }

  if (state.success) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
        <div dir={dir} className="w-full max-w-sm rounded-card bg-white p-6 text-center shadow-xl">
          <CheckCircle2 className="mx-auto h-10 w-10 text-green-600" />
          <p className="mt-3 font-display text-base font-semibold text-surface-900">{t.orderPlaced}</p>
          <p className="mt-2 text-xs text-surface-500">{t.orderNumbers}: {state.orderNumbers?.join(", ")}</p>
          <button onClick={onClose} className="mt-4 w-full rounded-lg bg-brand-600 py-2 text-sm font-medium text-white hover:bg-brand-700">{t.backToShop}</button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div dir={dir} className="max-h-[90vh] w-full max-w-sm overflow-y-auto rounded-card bg-white p-5 shadow-xl">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display text-base font-semibold text-surface-900">{t.checkout}</h3>
          <button onClick={onClose} className="text-surface-400 hover:text-surface-700"><X className="h-5 w-5" /></button>
        </div>

        <div className="mb-3 space-y-2">
          <button type="button" onClick={() => handleOAuth("google")} className="flex w-full items-center justify-center gap-2 rounded-lg border border-surface-200 bg-white px-4 py-2 text-sm font-medium text-surface-700 hover:bg-surface-50">
            {t.continueGoogle}
          </button>
          <button type="button" onClick={() => handleOAuth("facebook")} className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#1877F2] px-4 py-2 text-sm font-medium text-white hover:bg-[#166FE5]">
            {t.continueFacebook}
          </button>
        </div>
        <div className="my-3 flex items-center gap-3">
          <div className="h-px flex-1 bg-surface-200" />
          <span className="text-xs text-surface-400">{t.fillManually}</span>
          <div className="h-px flex-1 bg-surface-200" />
        </div>

        {state.error && <p className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{state.error}</p>}

        <form action={formAction} className="space-y-2">
          <input type="hidden" name="cart_json" value={cartJson} />
          <input type="hidden" name="payment_mode" value={paymentMode} />
          <input type="text" name="full_name" required placeholder={t.yourName} className="w-full rounded-lg border border-surface-200 p-2 text-sm" />
          <input type="tel" name="phone_number" required placeholder={t.mobile} className="w-full rounded-lg border border-surface-200 p-2 text-sm" />
          <textarea name="delivery_address" required rows={2} placeholder={t.address} className="w-full rounded-lg border border-surface-200 p-2 text-sm" />
          <div className="flex gap-2">
            <input type="text" name="district" required placeholder={t.district} className="w-1/2 rounded-lg border border-surface-200 p-2 text-sm" />
            <input type="text" name="tehsil" placeholder={t.tehsil} className="w-1/2 rounded-lg border border-surface-200 p-2 text-sm" />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-surface-600">{t.locationLabel}</label>
            <button
              type="button"
              onClick={handleUseMyLocation}
              disabled={locating}
              className="mt-1 flex w-full items-center justify-center gap-2 rounded-lg border border-brand-200 bg-brand-50 px-3 py-2 text-xs font-medium text-brand-700 hover:bg-brand-100 disabled:opacity-60"
            >
              {locating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <MapPin className="h-3.5 w-3.5" />}
              {coords ? `${t.locationCaptured} \u2713` : locating ? t.locationGetting : t.locationUse}
            </button>
            <input type="hidden" name="customer_lat" value={coords?.lat ?? ""} />
            <input type="hidden" name="customer_lng" value={coords?.lng ?? ""} />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-surface-600">{t.paymentMethod}</label>
            <div className="space-y-2">
              <button type="button" onClick={() => setPaymentMode("advance")} className={`w-full rounded-lg border-2 p-2 text-left text-xs ${paymentMode === "advance" ? "border-brand-500 bg-brand-50" : "border-surface-200"}`}>
                {t.advance}
              </button>
              <button type="button" onClick={() => setPaymentMode("cod")} className={`w-full rounded-lg border-2 p-2 text-left text-xs ${paymentMode === "cod" ? "border-brand-500 bg-brand-50" : "border-surface-200"}`}>
                {t.cod}
              </button>
            </div>
          </div>

          <div className="rounded-lg bg-surface-50 p-3 text-sm">
            <div className="flex justify-between"><span className="text-surface-500">{t.total}</span><span className="font-medium">Rs {cartTotal.toLocaleString()}</span></div>
            <div className="mt-1 flex justify-between font-semibold text-brand-700"><span>{paymentMode === "cod" ? "Advance (20%)" : t.advance}</span><span>Rs {advanceAmount.toLocaleString()}</span></div>
          </div>

          <SubmitButton label={t.placeOrder} pendingLabel={t.placing} />
        </form>
      </div>
    </div>
  );
}

function SubmitButton({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand-600 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60">
      {pending && <Loader2 className="h-4 w-4 animate-spin" />}
      {pending ? pendingLabel : label}
    </button>
  );
}