"use client";
import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { placeProduceOrder, type ActionState } from "@/actions/produce";
import { Wheat, CheckCircle2, X } from "lucide-react";
import { t } from "@/lib/i18n/translations";
import { useLang } from "@/lib/i18n/lang-context";

const initialState: ActionState = {};

interface Listing {
  id: string;
  crop_name: string;
  quantity_available: number;
  unit: string;
  asking_price_per_unit: number;
  quality_grade: string | null;
}

export function BuyerMarketplaceClient({ listings }: { listings: Listing[] }) {
  const lang = useLang();
  const [selected, setSelected] = useState<Listing | null>(null);

  return (
    <div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {listings.map((l) => (
          <button
            key={l.id}
            onClick={() => setSelected(l)}
            className="rounded-card border border-surface-200 bg-white p-4 text-left shadow-card transition hover:border-brand-400 hover:shadow-md dark:border-surface-800 dark:bg-surface-900"
          >
            <div className="flex items-center gap-2">
              <Wheat className="h-5 w-5 text-brand-600" />
              <p className="font-medium text-surface-900 dark:text-surface-100">{l.crop_name}</p>
            </div>
            {l.quality_grade && <p className="mt-1 text-xs text-surface-400">Grade: {l.quality_grade}</p>}
            <p className="mt-2 text-sm text-surface-600 dark:text-surface-400">
              {l.quantity_available} {l.unit} available
            </p>
            <p className="mt-1 font-display text-lg font-bold text-brand-700 dark:text-brand-300">
              Rs {l.asking_price_per_unit} / {l.unit}
            </p>
          </button>
        ))}
        {listings.length === 0 && (
          <p className="col-span-full py-10 text-center text-sm text-surface-400">{t("ou_no_listings", lang)}</p>
        )}
      </div>

      {selected && <OrderModal listing={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

function OrderModal({ listing, onClose }: { listing: Listing; onClose: () => void }) {
  const lang = useLang();
  const [state, formAction] = useFormState(placeProduceOrder, initialState);

  if (state.success) {
    setTimeout(onClose, 1000);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-sm rounded-card bg-white p-5 shadow-xl dark:bg-surface-900">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display text-base font-semibold text-surface-900 dark:text-white">{t("ou_place_order", lang)}</h3>
          <button onClick={onClose} className="text-surface-400 hover:text-surface-700 dark:hover:text-surface-200">
            <X className="h-5 w-5" />
          </button>
        </div>
        <p className="mb-3 text-sm text-surface-600 dark:text-surface-400">
          {listing.crop_name} - Rs {listing.asking_price_per_unit}/{listing.unit} ({listing.quantity_available} {listing.unit} available)
        </p>
        {state.error && <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-900/30 dark:text-red-300">{state.error}</p>}
        {state.success && (
          <p className="mb-3 flex items-center gap-2 rounded-lg bg-brand-50 px-3 py-2 text-xs text-brand-700 dark:bg-brand-900/30 dark:text-brand-300">
            <CheckCircle2 className="h-4 w-4" />{t("ou_order_placed", lang)}</p>
        )}
        <form action={formAction} className="space-y-3">
          <input type="hidden" name="listing_id" value={listing.id} />
          <div>
            <label className="text-xs font-medium text-surface-500">Quantity ({listing.unit})</label>
            <input
              type="number"
              name="quantity"
              step="0.1"
              max={listing.quantity_available}
              required
              className="mt-1 w-full rounded-lg border border-surface-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
            />
          </div>
          <SubmitButton />
        </form>
      </div>
    </div>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
    >
      {pending ? "Placing Order..." : "Place Order"}
    </button>
  );
}