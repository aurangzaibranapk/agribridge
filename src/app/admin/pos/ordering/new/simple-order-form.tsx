"use client";
import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { CheckCircle } from "lucide-react";
import { createBranchAgriOrder, type ActionState } from "@/actions/agri-orders";
import { ProductCardGrid } from "@/app/admin/agri-orders/new/product-card-grid";
import { PaymentModeSelect } from "@/app/admin/agri-orders/new/payment-mode-select";
import { SourcingSelect } from "@/app/admin/agri-orders/new/sourcing-select";
import { t } from "@/lib/i18n/translations";
import { useLang } from "@/lib/i18n/lang-context";

const initialState: ActionState = {};

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
  units_per_carton: number | null;
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

function businessTypeToOrderType(businessType: string): string {
  if (businessType === "agri_inputs") return "Fertilizer";
  return "FMCG / Other";
}

export function SimpleOrderForm({
  products,
  categories,
  branches,
  ownBranchId,
  shopName,
  godamId,
  godamName,
  businessType,
}: {
  products: Product[];
  categories: Category[];
  branches: Branch[];
  ownBranchId: string;
  shopName: string;
  godamId: string | null;
  godamName: string;
  businessType: string;
}) {
  const [state, formAction] = useFormState(createBranchAgriOrder, initialState);
  const lang = useLang();
  const orderType = businessTypeToOrderType(businessType);
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

  if (state.success && state.orderId) {
    return (
      <div className="mx-auto max-w-sm rounded-card border border-green-200 bg-green-50 p-8 text-center shadow-card dark:border-green-900/40 dark:bg-green-950/20">
        <CheckCircle className="mx-auto h-12 w-12 text-green-600" />
        <h2 className="mt-3 font-display text-xl font-semibold text-green-900 dark:text-green-200">Order Submit Ho Gaya!</h2>
        <p className="mt-1 text-sm text-green-700 dark:text-green-300">
          Order Number: <strong>{state.orderNumber}</strong>
        </p>
        <a
          href={`/admin/agri-orders/${state.orderId}`}
          className="mt-5 inline-block rounded-lg bg-brand-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
        >
          Order Dekhein →
        </a>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="order_type" value={orderType} />
      <input type="hidden" name="order_to_warehouse_id" value={godamId ?? ""} />
      <input type="hidden" name="items_json" value={JSON.stringify(activeItems)} />

      {state.error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
      )}

      {/* Order kis ke liye hai */}
      <div className="rounded-card border border-surface-200 bg-surface-50 p-4 shadow-card dark:border-surface-800 dark:bg-surface-900/60">
        <p className="text-sm font-medium text-surface-700 dark:text-surface-300">
          Order for:{" "}
          <span className="font-semibold text-surface-900 dark:text-white">{shopName}</span>
          {godamName && (
            <>
              {" "}—{" "}
              <span className="text-surface-600 dark:text-surface-400">{godamName}</span>
            </>
          )}
        </p>
      </div>

      {/* Maal kahan se aayega */}
      <div className="rounded-card border border-surface-200 bg-white p-5 shadow-card dark:border-surface-800 dark:bg-surface-900">
        <h2 className="mb-3 font-display text-base font-semibold text-surface-900 dark:text-white">
          {t("ao_where_from", lang)}
        </h2>
        <SourcingSelect branches={branches} excludeBranchId={ownBranchId} />
      </div>

      {/* Payment */}
      <div className="rounded-card border border-surface-200 bg-white p-5 shadow-card dark:border-surface-800 dark:bg-surface-900">
        <h2 className="mb-3 font-display text-base font-semibold text-surface-900 dark:text-white">
          {t("c_payment_mode", lang)}
        </h2>
        <PaymentModeSelect />
      </div>

      {/* Products */}
      <div className="rounded-card border border-surface-200 bg-white p-5 shadow-card dark:border-surface-800 dark:bg-surface-900">
        <h2 className="mb-3 font-display text-base font-semibold text-surface-900 dark:text-white">
          {t("so_select_products", lang)}
        </h2>
        <ProductCardGrid
          products={products}
          categories={categories}
          rows={rows}
          onUpdateRow={updateRow}
          warehouseLabel="Central mein available:"
        />
      </div>

      {/* Total */}
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

      <textarea
        name="notes"
        rows={2}
        placeholder={t("ar_notes_if_any", lang)}
        className="w-full rounded-lg border border-surface-200 p-2 text-sm"
      />

      <SubmitButton />
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      data-guide="shop-order-submit"
      type="submit"
      disabled={pending}
      className="w-full rounded-lg bg-brand-600 py-3 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
    >
      {pending ? "Order Submit Ho Raha Hai..." : "Order Bhejein"}
    </button>
  );
}
