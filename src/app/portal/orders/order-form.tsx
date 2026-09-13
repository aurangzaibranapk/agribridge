"use client";
import { useMemo, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { placeBridgeOrder, type ActionState } from "@/actions/bridge-orders";
import { Search, ShoppingCart, Trash2, CheckCircle2 } from "lucide-react";
import { t } from "@/lib/i18n/translations";
import { useLang } from "@/lib/i18n/lang-context";

interface Product {
  id: string;
  name: string;
  pack_size: string | null;
  selling_price: number;
}

interface CartLine {
  product_id: string;
  name: string;
  quantity: number;
  unit_price: number;
}

const initialState: ActionState = {};

export function OrderForm({
  products,
  farmerDistrict,
  farmerTehsil,
}: {
  products: Product[];
  farmerDistrict: string | null;
  farmerTehsil: string | null;
}) {
  const [state, formAction] = useFormState(placeBridgeOrder, initialState);
  const lang = useLang();
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [district, setDistrict] = useState(farmerDistrict ?? "");
  const [tehsil, setTehsil] = useState(farmerTehsil ?? "");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) => p.name.toLowerCase().includes(q));
  }, [products, search]);

  const total = useMemo(() => cart.reduce((sum, l) => sum + l.quantity * l.unit_price, 0), [cart]);

  function addToCart(p: Product) {
    setCart((prev) => {
      const existing = prev.find((l) => l.product_id === p.id);
      if (existing) {
        return prev.map((l) => (l.product_id === p.id ? { ...l, quantity: l.quantity + 1 } : l));
      }
      return [...prev, { product_id: p.id, name: p.name, quantity: 1, unit_price: p.selling_price }];
    });
  }

  function updateQty(id: string, qty: number) {
    if (qty <= 0) {
      setCart((prev) => prev.filter((l) => l.product_id !== id));
      return;
    }
    setCart((prev) => prev.map((l) => (l.product_id === id ? { ...l, quantity: qty } : l)));
  }

  const itemsJson = useMemo(
    () => JSON.stringify(cart.map((l) => ({ product_id: l.product_id, quantity: l.quantity, unit_price: l.unit_price }))),
    [cart]
  );

  if (state.success) {
    return (
      <div className="rounded-card border border-brand-200 bg-brand-50 p-6 text-center dark:border-brand-900/40 dark:bg-brand-950/30">
        <CheckCircle2 className="mx-auto mb-2 h-8 w-8 text-brand-600" />
        <p className="font-medium text-brand-800 dark:text-brand-300">{t("pm_order_placed", lang)}</p>
        <p className="mt-1 text-sm text-brand-600 dark:text-brand-400">{t("pm_dealer_notified", lang)}</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_340px]">
      <div>
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("pm_search_products", lang)}
            className="w-full rounded-lg border border-surface-200 py-2 pl-9 pr-3 text-sm focus:border-brand-500 focus:outline-none"
          />
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {filtered.map((p) => (
            <button
              key={p.id}
              onClick={() => addToCart(p)}
              className="rounded-card border border-surface-200 bg-white p-3 text-left shadow-card transition hover:border-brand-400 hover:shadow-md dark:border-surface-800 dark:bg-surface-900"
            >
              <p className="text-sm font-medium text-surface-900 dark:text-surface-100 line-clamp-2">{p.name}</p>
              {p.pack_size && <p className="mt-0.5 text-xs text-surface-400">{p.pack_size}</p>}
              <p className="mt-2 font-display text-sm font-semibold text-brand-700 dark:text-brand-300">
                Rs {p.selling_price.toLocaleString()}
              </p>
            </button>
          ))}
          {filtered.length === 0 && (
            <p className="col-span-full py-10 text-center text-sm text-surface-400">{t("pm_no_products", lang)}</p>
          )}
        </div>
      </div>

      <div className="h-fit rounded-card border border-surface-200 bg-white p-4 shadow-card dark:border-surface-800 dark:bg-surface-900">
        <div className="mb-3 flex items-center gap-2">
          <ShoppingCart className="h-5 w-5 text-brand-600" />
          <h2 className="font-display text-base font-semibold text-surface-900 dark:text-surface-100">{t("pm_your_order", lang)}</h2>
        </div>

        {state.error && (
          <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-900/30 dark:text-red-300">
            {state.error}
          </p>
        )}

        <div className="max-h-56 space-y-2 overflow-y-auto">
          {cart.length === 0 && <p className="py-6 text-center text-sm text-surface-400">{t("pm_no_items", lang)}</p>}
          {cart.map((l) => (
            <div key={l.product_id} className="flex items-center gap-2 rounded-lg border border-surface-100 p-2 dark:border-surface-800">
              <div className="flex-1">
                <p className="text-sm font-medium text-surface-800 dark:text-surface-200">{l.name}</p>
                <p className="text-xs text-surface-400">Rs {l.unit_price.toLocaleString()} each</p>
              </div>
              <input
                type="number"
                min={1}
                value={l.quantity}
                onChange={(e) => updateQty(l.product_id, parseInt(e.target.value) || 0)}
                className="h-8 w-14 rounded-md border border-surface-200 text-center text-sm"
              />
              <button onClick={() => updateQty(l.product_id, 0)} className="text-surface-400 hover:text-red-600">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>

        <form action={formAction} className="mt-3 space-y-3 border-t border-surface-100 pt-3 dark:border-surface-800">
          <input type="hidden" name="items_json" value={itemsJson} />
          <div>
            <label className="text-xs font-medium text-surface-500">{t("c_district", lang)}</label>
            <input
              name="district"
              value={district}
              onChange={(e) => setDistrict(e.target.value)}
              required
              className="mt-1 w-full rounded-lg border border-surface-200 px-3 py-1.5 text-sm focus:border-brand-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-surface-500">{t("pm_tehsil", lang)}</label>
            <input
              name="tehsil"
              value={tehsil}
              onChange={(e) => setTehsil(e.target.value)}
              className="mt-1 w-full rounded-lg border border-surface-200 px-3 py-1.5 text-sm focus:border-brand-500 focus:outline-none"
            />
          </div>
          <div className="flex items-center justify-between border-t border-surface-100 pt-2 dark:border-surface-800">
            <span className="text-sm font-medium text-surface-700 dark:text-surface-300">{t("c_total", lang)}</span>
            <span className="font-display text-lg font-bold text-brand-700 dark:text-brand-300">
              Rs {total.toLocaleString()}
            </span>
          </div>
          <SubmitButton disabled={cart.length === 0} />
        </form>
      </div>
    </div>
  );
}

function SubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending || disabled}
      className="w-full rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? "Placing Order..." : "Place Order"}
    </button>
  );
}