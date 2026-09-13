"use client";
import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { createBranchAgriOrder, type ActionState } from "@/actions/agri-orders";
import { ProductCardGrid } from "@/app/admin/agri-orders/new/product-card-grid";
import { PaymentModeSelect } from "@/app/admin/agri-orders/new/payment-mode-select";
import { SourcingSelect } from "@/app/admin/agri-orders/new/sourcing-select";
import { t } from "@/lib/i18n/translations";
import { useLang } from "@/lib/i18n/lang-context";

const initialState: ActionState = {};

const ORDER_TYPES = ["FMCG / Other", "Fertilizer", "Pesticide", "Seed", "Animal Feed", "Veterinary Products", "Agricultural Equipment"];

interface Product {
  id: string;
  name: string;
  pack_size: string | null;
  selling_price: number;
  purchase_price: number;
  image_url: string | null;
  category_id: string | null;
  category: string | null;
  brand: string | null;
  warehouse_stock: number;
}

interface Category {
  id: string;
  name: string;
}

interface RowState {
  qty: number;
  price: number;
}

interface Branch {
  id: string;
  name: string;
}

export function SimpleOrderForm({
  products,
  categories,
  branches,
  ownBranchId,
}: {
  products: Product[];
  categories: Category[];
  branches: Branch[];
  ownBranchId: string;
}) {
  const [state, formAction] = useFormState(createBranchAgriOrder, initialState);
  const lang = useLang();
  const [orderType, setOrderType] = useState("FMCG / Other");
  const [rows, setRows] = useState<Record<string, RowState>>({});

  function updateRow(productId: string, field: keyof RowState, value: number, defaultPrice: number) {
    setRows((prev) => ({
      ...prev,
      [productId]: {
        qty: prev[productId]?.qty ?? 0,
        price: prev[productId]?.price ?? defaultPrice,
        [field]: value,
      },
    }));
  }

  const activeItems = products
    .filter((p) => (rows[p.id]?.qty ?? 0) > 0)
    .map((p) => {
      const row = rows[p.id];
      return {
        product_id: p.id,
        product_name: p.name,
        brand: p.brand ?? "",
        category: p.category ?? "",
        pack_size: p.pack_size ?? "",
        order_qty: row.qty,
        unit_price: row.price,
        discount: 0,
        tax: 0,
      };
    });

  const grandTotal = activeItems.reduce((sum, i) => sum + i.order_qty * i.unit_price, 0);

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="order_type" value={orderType} />
      <input type="hidden" name="items_json" value={JSON.stringify(activeItems)} />

      {state.error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}

      <div className="rounded-card border border-surface-200 bg-white p-5 shadow-card dark:border-surface-800 dark:bg-surface-900">
        <label className="text-xs font-medium text-surface-600">{t("so_order_type", lang)}</label>
        <select value={orderType} onChange={(e) => setOrderType(e.target.value)} className="mt-1 w-full rounded-lg border border-surface-200 p-2 text-sm">
          {ORDER_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>

      <div className="rounded-card border border-surface-200 bg-white p-5 shadow-card dark:border-surface-800 dark:bg-surface-900">
        <h2 className="mb-3 font-display text-base font-semibold text-surface-900 dark:text-white">{t("ao_where_from", lang)}</h2>
        <SourcingSelect branches={branches} excludeBranchId={ownBranchId} />
      </div>

      <div className="rounded-card border border-surface-200 bg-white p-5 shadow-card dark:border-surface-800 dark:bg-surface-900">
        <h2 className="mb-3 font-display text-base font-semibold text-surface-900 dark:text-white">{t("c_payment_mode", lang)}</h2>
        <PaymentModeSelect />
      </div>

      <div className="rounded-card border border-surface-200 bg-white p-5 shadow-card dark:border-surface-800 dark:bg-surface-900">
        <h2 className="mb-3 font-display text-base font-semibold text-surface-900 dark:text-white">{t("so_select_products", lang)}</h2>
        <ProductCardGrid products={products} categories={categories} rows={rows} onUpdateRow={updateRow} />
      </div>

      <div className="rounded-card border border-surface-200 bg-white p-5 shadow-card dark:border-surface-800 dark:bg-surface-900">
        <div className="flex items-center justify-between text-sm">
          <span className="text-surface-500">{t("so_total_items", lang)}</span>
          <span className="font-medium text-surface-900 dark:text-white">{activeItems.length}</span>
        </div>
        <div className="mt-1 flex items-center justify-between border-t border-surface-100 pt-2 text-base font-semibold dark:border-surface-800">
          <span className="text-surface-900 dark:text-white">{t("c_grand_total", lang)}</span>
          <span className="text-brand-600">Rs {grandTotal.toLocaleString()}</span>
        </div>
      </div>

      <textarea name="notes" rows={2} placeholder={t("ar_notes_if_any", lang)} className="w-full rounded-lg border border-surface-200 p-2 text-sm" />

      <SubmitButton />
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button data-guide="shop-order-submit" type="submit" disabled={pending} className="w-full rounded-lg bg-brand-600 py-3 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60">
      {pending ? "Order Submit Ho Raha Hai..." : "Order Submit Karein"}
    </button>
  );
}