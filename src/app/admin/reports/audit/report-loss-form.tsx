"use client";
import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { reportLoss, type ActionState } from "@/actions/stock-loss";
import { Plus, X } from "lucide-react";
import { t } from "@/lib/i18n/translations";
import { useLang } from "@/lib/i18n/lang-context";

const initialState: ActionState = {};

interface Shop {
  id: string;
  name: string;
  warehouse_id: string | null;
}
interface Product {
  id: string;
  name: string;
  pack_size: string | null;
  purchase_price: number;
}

const LOSS_TYPES = [
  { value: "damage", label: "Damage (toota/kharab)" },
  { value: "theft", label: "Theft (chori)" },
  { value: "shrinkage", label: "Shrinkage (kami)" },
  { value: "expiry", label: "Expiry (manually mark)" },
  { value: "other", label: "Other" },
];

export function ReportLossForm({ shops, products }: { shops: Shop[]; products: Product[] }) {
  const [state, formAction] = useFormState(reportLoss, initialState);
  const lang = useLang();
  const [showForm, setShowForm] = useState(false);
  const [shopId, setShopId] = useState("");
  const [productId, setProductId] = useState("");

  const selectedShop = shops.find((s) => s.id === shopId);
  const selectedProduct = products.find((p) => p.id === productId);

  if (state.success && showForm) setTimeout(() => setShowForm(false), 800);

  return (
    <div>
      {!showForm && (
        <button onClick={() => setShowForm(true)} className="flex items-center gap-1.5 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700">
          <Plus className="h-4 w-4" />{t("rl_title_full", lang)}</button>
      )}
      {showForm && (
        <div className="rounded-card border border-surface-200 bg-white p-4 shadow-card dark:border-surface-800 dark:bg-surface-900">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-display text-base font-semibold text-surface-900 dark:text-white">{t("rl_report_loss", lang)}</h3>
            <button onClick={() => setShowForm(false)} className="text-surface-400 hover:text-surface-700"><X className="h-5 w-5" /></button>
          </div>
          {state.error && <p className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{state.error}</p>}
          {state.success && <p className="mb-2 rounded-lg bg-brand-50 px-3 py-2 text-xs text-brand-700">{t("rl_reported", lang)}</p>}
          <form action={formAction} encType="multipart/form-data" className="space-y-2">
            <input type="hidden" name="warehouse_id" value={selectedShop?.warehouse_id ?? ""} />
            <div>
              <label className="text-xs text-surface-500">{t("rl_shop_req", lang)}</label>
              <select value={shopId} onChange={(e) => setShopId(e.target.value)} required className="mt-1 w-full rounded-lg border border-surface-200 p-2 text-sm">
                <option value="">- Shop Select Karein -</option>
                {shops.map((s) => (
                  <option key={s.id} value={s.id} disabled={!s.warehouse_id}>{s.name}{!s.warehouse_id ? " (warehouse nahi hai)" : ""}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-surface-500">{t("rl_product_req", lang)}</label>
              <select name="product_id" value={productId} onChange={(e) => setProductId(e.target.value)} required className="mt-1 w-full rounded-lg border border-surface-200 p-2 text-sm">
                <option value="">- Product Select Karein -</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}{p.pack_size ? ` (${p.pack_size})` : ""}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-surface-500">{t("rl_qty_req", lang)}</label>
                <input type="number" step="0.01" name="quantity" required placeholder={t("rl_how_much_qty", lang)} className="mt-1 w-full rounded-lg border border-surface-200 p-2 text-sm" />
              </div>
              <div>
                <label className="text-xs text-surface-500">{t("rl_type_req", lang)}</label>
                <select name="loss_type" required className="mt-1 w-full rounded-lg border border-surface-200 p-2 text-sm">
                  <option value="">- Select -</option>
                  {LOSS_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
            </div>
            {selectedProduct && (
              <p className="text-[11px] text-surface-400">Estimated cost per unit: Rs {selectedProduct.purchase_price.toLocaleString()}</p>
            )}
            <textarea name="reason" required rows={2} placeholder={t("rl_reason_ph", lang)} className="w-full rounded-lg border border-surface-200 p-2 text-sm" />
            <div>
              <label className="text-xs text-surface-500">{t("rl_photo_recommended", lang)}</label>
              <input type="file" name="photo" accept="image/*" className="mt-1 w-full text-xs" />
            </div>
            <SubmitButton />
          </form>
        </div>
      )}
    </div>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={pending} className="w-full rounded-lg bg-red-600 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60">{pending ? "..." : "Loss Report Submit Karein"}</button>;
}