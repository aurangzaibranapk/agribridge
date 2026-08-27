"use client";
import { useMemo, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { placeMarketplaceOrder, type ActionState } from "@/actions/marketplace";
import { Search, ShoppingCart, CheckCircle2 } from "lucide-react";

interface Product {
  id: string;
  name: string;
  pack_size: string | null;
}

const initialState: ActionState = {};

export function MarketplaceForm({ products }: { products: Product[] }) {
  const [state, formAction] = useFormState(placeMarketplaceOrder, initialState);
  const [search, setSearch] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [quantity, setQuantity] = useState("1");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) => p.name.toLowerCase().includes(q));
  }, [products, search]);

  if (state.success) {
    return (
      <div className="rounded-card border border-brand-200 bg-brand-50 p-6 text-center dark:border-brand-900/40 dark:bg-brand-950/30">
        <CheckCircle2 className="mx-auto mb-2 h-8 w-8 text-brand-600" />
        <p className="font-medium text-brand-800 dark:text-brand-300">Order placed successfully!</p>
        <p className="mt-1 text-sm text-brand-600 dark:text-brand-400">
          We automatically matched you with the best available price. You'll be updated as your order progresses.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
      <div>
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search fertilizer, seeds, pesticide..."
            className="w-full rounded-lg border border-surface-200 py-2 pl-9 pr-3 text-sm focus:border-brand-500 focus:outline-none"
          />
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {filtered.map((p) => (
            <button
              key={p.id}
              onClick={() => setSelectedProduct(p)}
              className={`rounded-card border p-3 text-left shadow-card transition ${
                selectedProduct?.id === p.id
                  ? "border-brand-500 bg-brand-50 dark:bg-brand-950/30"
                  : "border-surface-200 bg-white hover:border-brand-300 dark:border-surface-800 dark:bg-surface-900"
              }`}
            >
              <p className="text-sm font-medium text-surface-900 dark:text-surface-100 line-clamp-2">{p.name}</p>
              {p.pack_size && <p className="mt-0.5 text-xs text-surface-400">{p.pack_size}</p>}
            </button>
          ))}
          {filtered.length === 0 && (
            <p className="col-span-full py-10 text-center text-sm text-surface-400">No products found.</p>
          )}
        </div>
      </div>

      <div className="h-fit rounded-card border border-surface-200 bg-white p-4 shadow-card dark:border-surface-800 dark:bg-surface-900">
        <div className="mb-3 flex items-center gap-2">
          <ShoppingCart className="h-5 w-5 text-brand-600" />
          <h2 className="font-display text-base font-semibold text-surface-900 dark:text-surface-100">Your Order</h2>
        </div>

        {state.error && (
          <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-900/30 dark:text-red-300">
            {state.error}
          </p>
        )}

        {selectedProduct ? (
          <div className="mb-3 rounded-lg bg-surface-50 p-3 text-sm dark:bg-surface-800">
            <p className="font-medium text-surface-900 dark:text-surface-100">{selectedProduct.name}</p>
            {selectedProduct.pack_size && <p className="text-xs text-surface-400">{selectedProduct.pack_size}</p>}
          </div>
        ) : (
          <p className="mb-3 py-6 text-center text-sm text-surface-400">Select a product to order</p>
        )}

        <form action={formAction} className="space-y-3">
          <input type="hidden" name="product_id" value={selectedProduct?.id ?? ""} />
          <div>
            <label className="text-xs font-medium text-surface-500">Quantity</label>
            <input
              type="number"
              name="quantity"
              min={1}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="mt-1 w-full rounded-lg border border-surface-200 px-3 py-1.5 text-sm focus:border-brand-500 focus:outline-none"
            />
          </div>
          <p className="text-xs text-surface-400">
            We'll automatically match you with the seller offering the best price for your quantity.
          </p>
          <SubmitButton disabled={!selectedProduct} />
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