"use client";
import { useState, useMemo } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { requestInternalTransfer, type ActionState } from "@/actions/stock-transfer-workflow";
import { Button, Label, Select } from "@/components/ui/form";
import { ProductCardGrid } from "@/app/admin/agri-orders/new/product-card-grid";
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
}
interface Category { id: string; name: string; }
interface ShopOpt { id: string; name: string; business_type: string; branch_name: string | null; warehouse_id: string | null; }

const BUSINESS_TYPE_LABELS: Record<string, string> = {
  karyana: "Karyana",
  agri_inputs: "Agri Inputs",
  grain_procurement: "Grain",
  dairy: "Dairy",
  machinery_fleet: "Machinery",
};

export function RequestTransferForm({
  products,
  categories,
  isAdminLevel,
  shops,
  currentShopId,
  centralWarehouseId,
  stockByWarehouse,
}: {
  products: Product[];
  categories: Category[];
  isAdminLevel: boolean;
  shops: ShopOpt[];
  currentShopId: string | null;
  centralWarehouseId: string | null;
  stockByWarehouse: Record<string, Record<string, number>>;
}) {
  const lang = useLang();
  const [state, formAction] = useFormState(requestInternalTransfer, initialState);
  const [fromLocation, setFromLocation] = useState(currentShopId ?? "central");
  const [toLocation, setToLocation] = useState("");
  const [rows, setRows] = useState<Record<string, { qty: number; price: number }>>({});

  function handleUpdateRow(productId: string, field: "qty" | "price", value: number, defaultPrice: number) {
    setRows((prev) => ({
      ...prev,
      [productId]: {
        qty: prev[productId]?.qty ?? 0,
        price: prev[productId]?.price ?? defaultPrice,
        [field]: value,
      },
    }));
  }

  function shopLabel(s: ShopOpt) {
    return `${s.branch_name ? `${s.branch_name} - ` : ""}${BUSINESS_TYPE_LABELS[s.business_type] ?? s.business_type} (${s.name})`;
  }

  const fromWarehouseId = useMemo(() => {
    if (fromLocation === "central") return centralWarehouseId;
    return shops.find((s) => s.id === fromLocation)?.warehouse_id ?? null;
  }, [fromLocation, shops, centralWarehouseId]);

  const productsWithStock = useMemo(() => {
    const stockMap = fromWarehouseId ? stockByWarehouse[fromWarehouseId] ?? {} : {};
    return products.map((p) => ({ ...p, warehouse_stock: stockMap[p.id] ?? 0 }));
  }, [products, fromWarehouseId, stockByWarehouse]);

  const activeItems = useMemo(
    () =>
      Object.entries(rows)
        .filter(([, r]) => r.qty > 0)
        .map(([productId, r]) => {
          const p = products.find((pp) => pp.id === productId);
          return { product_id: productId, name: p?.name ?? "", quantity: r.qty, unit_price: r.price };
        }),
    [rows, products]
  );

  const itemsJson = JSON.stringify(activeItems.map((i) => ({ product_id: i.product_id, quantity: i.quantity, unit_price: i.unit_price })));
  const total = activeItems.reduce((sum, i) => sum + i.quantity * i.unit_price, 0);

  return (
    <div className="rounded-card border border-surface-200 bg-white p-5 shadow-card dark:border-surface-800 dark:bg-surface-900">
      <h2 className="mb-4 font-display text-base font-semibold text-surface-900 dark:text-white">{t("at_shop_to_shop", lang)}</h2>
      <p className="mb-3 text-xs text-surface-400">{t("at_transfer_note", lang)}</p>
      {state.error && (
        <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-300">{state.error}</p>
      )}
      {state.success && (
        <p className="mb-3 rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-700 dark:bg-brand-900/30 dark:text-brand-300">
          {t("st_request_sent", lang)}
        </p>
      )}
      <form action={formAction} className="space-y-3">
        <input type="hidden" name="items_json" value={itemsJson} />
        {isAdminLevel && <input type="hidden" name="from_location" value={fromLocation} />}
        <input type="hidden" name="to_location" value={toLocation} />

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {isAdminLevel ? (
            <div>
              <Label>{t("st_from_source", lang)}</Label>
              <Select value={fromLocation} onChange={(e) => { setFromLocation(e.target.value); setRows({}); }} required>
                <option value="central">{t("st_central_warehouse", lang)}</option>
                {shops.map((s) => (
                  <option key={s.id} value={s.id}>{shopLabel(s)}</option>
                ))}
              </Select>
            </div>
          ) : (
            <div>
              <Label>{t("st_from_your_shop", lang)}</Label>
              <p className="mt-1 rounded-lg border border-surface-200 bg-surface-50 p-2 text-sm text-surface-600 dark:bg-surface-800">
                {shops.find((s) => s.id === currentShopId) ? shopLabel(shops.find((s) => s.id === currentShopId)!) : t("st_your_shop", lang)}
              </p>
            </div>
          )}

          <div>
            <Label>{t("st_to_destination", lang)}</Label>
            <Select value={toLocation} onChange={(e) => setToLocation(e.target.value)} required>
              <option value="">{t("st_pick_shop", lang)}</option>
              {/* Central Warehouse pehle sirf BHEJNE wali jagah tha,
                  lene wali nahi -- form us ko destination mein dikhata
                  hi nahi tha. Malik ko 5 September ko dukan ke godam se
                  Central (HQ) mein maal bhejna tha aur raasta band mila.

                  Server ye pehle se kar sakta tha (`resolveWarehouseId`
                  "central" ko dono taraf samajhta hai) -- kami sirf is
                  fehrist mein thi.

                  Sirf Admin ke liye: dukan wala banda apni hi dukan se
                  bhejta hai, aur us ke liye HQ ki taraf bhejna alag
                  faisla hai. */}
              {isAdminLevel && fromLocation !== "central" && (
                <option value="central">{t("st_central_warehouse", lang)}</option>
              )}
              {shops.filter((s) => s.id !== fromLocation).map((s) => (
                <option key={s.id} value={s.id}>{shopLabel(s)}</option>
              ))}
            </Select>
          </div>
        </div>

        <div>
          <Label>{t("st_pick_products", lang)}</Label>
          <div className="mt-1">
            <ProductCardGrid products={productsWithStock} categories={categories} rows={rows} onUpdateRow={handleUpdateRow} />
          </div>
        </div>

        {activeItems.length > 0 && (
          <div className="rounded-lg border border-surface-200 bg-surface-50 p-3 text-sm dark:bg-surface-800">
            {activeItems.map((i) => (
              <div key={i.product_id} className="flex justify-between text-xs text-surface-600">
                <span>{i.name} x {i.quantity} @ Rs {i.unit_price.toLocaleString()}</span>
                <span>Rs {(i.quantity * i.unit_price).toLocaleString()}</span>
              </div>
            ))}
            <div className="mt-1 flex justify-between border-t border-surface-200 pt-1 font-semibold dark:border-surface-700">
              <span>{t("st_total", lang)}</span>
              <span>Rs. {total.toLocaleString()}</span>
            </div>
          </div>
        )}

        <SubmitButton disabled={activeItems.length === 0 || !toLocation} />
      </form>
    </div>
  );
}

function SubmitButton({ disabled }: { disabled: boolean }) {
  const lang = useLang();
  const { pending } = useFormStatus();
  return (
    <Button type="submit" data-guide="transfer-request" className="w-full" disabled={pending || disabled}>
      {pending ? t("st_submitting", lang) : t("st_submit", lang)}
    </Button>
  );
}