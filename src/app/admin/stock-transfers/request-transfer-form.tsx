"use client";
import { useState, useMemo } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { requestInternalTransfer, type ActionState } from "@/actions/stock-transfer-workflow";
import { Button, Label, Select } from "@/components/ui/form";
import { ProductCardGrid } from "@/app/admin/agri-orders/new/product-card-grid";

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
      <h2 className="mb-4 font-display text-base font-semibold text-surface-900 dark:text-white">Shop-to-Shop Stock Transfer</h2>
      <p className="mb-3 text-xs text-surface-400">
        Koi bhi Shop doosri kisi bhi Shop se stock mang sakti hai (ek dafa mein multiple products bhi) - Admin/Finance approval har stage par zaroori hai.
      </p>
      {state.error && (
        <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-300">{state.error}</p>
      )}
      {state.success && (
        <p className="mb-3 rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-700 dark:bg-brand-900/30 dark:text-brand-300">
          Request submit ho gayi.
        </p>
      )}
      <form action={formAction} className="space-y-3">
        <input type="hidden" name="items_json" value={itemsJson} />
        {isAdminLevel && <input type="hidden" name="from_location" value={fromLocation} />}
        <input type="hidden" name="to_location" value={toLocation} />

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {isAdminLevel ? (
            <div>
              <Label>From (Source Shop)</Label>
              <Select value={fromLocation} onChange={(e) => { setFromLocation(e.target.value); setRows({}); }} required>
                <option value="central">Central Warehouse (HQ)</option>
                {shops.map((s) => (
                  <option key={s.id} value={s.id}>{shopLabel(s)}</option>
                ))}
              </Select>
            </div>
          ) : (
            <div>
              <Label>From (Your Shop)</Label>
              <p className="mt-1 rounded-lg border border-surface-200 bg-surface-50 p-2 text-sm text-surface-600 dark:bg-surface-800">
                {shops.find((s) => s.id === currentShopId) ? shopLabel(shops.find((s) => s.id === currentShopId)!) : "Aapki Shop"}
              </p>
            </div>
          )}

          <div>
            <Label>To (Destination Shop) *</Label>
            <Select value={toLocation} onChange={(e) => setToLocation(e.target.value)} required>
              <option value="">— shop select karein —</option>
              {shops.filter((s) => s.id !== fromLocation).map((s) => (
                <option key={s.id} value={s.id}>{shopLabel(s)}</option>
              ))}
            </Select>
          </div>
        </div>

        <div>
          <Label>Products Select Karein (ek se zyada bhi le sakte hain)</Label>
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
              <span>Total</span>
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
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending || disabled}>
      {pending ? "Submitting..." : "Submit Request"}
    </Button>
  );
}