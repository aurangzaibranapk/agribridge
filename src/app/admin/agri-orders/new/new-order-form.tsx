"use client";
import { useState, useMemo } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { createAgriOrder, type ActionState } from "@/actions/agri-orders";
import { Search, LayoutGrid, List } from "lucide-react";
import { ProductCardGrid } from "./product-card-grid";

const initialState: ActionState = {};

const ORDER_TYPES = ["Fertilizer", "Pesticide", "Seed", "Animal Feed", "Veterinary Products", "Agricultural Equipment", "FMCG / Other"];
const ORDER_TO_TYPES = ["Kisan Dukan", "Agri Dealer", "Kisan Partner", "Branch", "Warehouse", "Farmer"];

interface Branch {
  id: string;
  name: string;
}

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
  discount: number;
  tax: number;
  price: number;
}

export function NewOrderForm({ branches, products, categories }: { branches: Branch[]; products: Product[]; categories: Category[] }) {
  const [state, formAction] = useFormState(createAgriOrder, initialState);
  const [orderType, setOrderType] = useState("Fertilizer");
  const [orderFromKind, setOrderFromKind] = useState<"branch" | "supplier">("branch");
  const [freightCharges, setFreightCharges] = useState(0);
  const [otherCharges, setOtherCharges] = useState(0);
  const [creditLimit, setCreditLimit] = useState(0);
  const [existingOutstanding, setExistingOutstanding] = useState(0);
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<"table" | "card">("card");
  const [rows, setRows] = useState<Record<string, RowState>>({});

  const filteredProducts = useMemo(() => {
    if (!search.trim()) return products;
    const q = search.toLowerCase();
    return products.filter((p) => p.name.toLowerCase().includes(q) || (p.category ?? "").toLowerCase().includes(q));
  }, [search, products]);

  function updateRow(productId: string, field: keyof RowState, value: number, defaultPrice: number) {
    setRows((prev) => ({
      ...prev,
      [productId]: {
        qty: prev[productId]?.qty ?? 0,
        discount: prev[productId]?.discount ?? 0,
        tax: prev[productId]?.tax ?? 0,
        price: prev[productId]?.price ?? defaultPrice,
        [field]: value,
      },
    }));
  }

  const activeItems = products
    .filter((p) => (rows[p.id]?.qty ?? 0) > 0)
    .map((p) => {
      const row = rows[p.id];
      const unitPrice = row.price;
      return {
        product_id: p.id,
        product_name: p.name,
        brand: p.brand ?? "",
        category: p.category ?? "",
        pack_size: p.pack_size ?? "",
        batch_no: "",
        expiry_date: "",
        order_qty: row.qty,
        unit_price: unitPrice,
        discount: row.discount,
        tax: row.tax,
        active_ingredient: "",
        formulation: "",
        registration_no: "",
        variety: "",
        lot_no: "",
        germination_percent: 0,
        production_year: new Date().getFullYear(),
        treatment_status: "",
      };
    });

  const subtotal = activeItems.reduce((sum, i) => sum + i.order_qty * i.unit_price, 0);
  const totalDiscount = activeItems.reduce((sum, i) => sum + i.discount, 0);
  const totalTax = activeItems.reduce((sum, i) => sum + i.tax, 0);
  const grandTotal = subtotal - totalDiscount + totalTax + freightCharges + otherCharges;
  const availableCredit = creditLimit - existingOutstanding;
  const projectedOutstanding = existingOutstanding + grandTotal;

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="items_json" value={JSON.stringify(activeItems)} />
      <input type="hidden" name="credit_limit" value={creditLimit} />
      <input type="hidden" name="existing_outstanding" value={existingOutstanding} />

      {state.error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}

      {/* Order Information */}
      <div className="rounded-card border border-surface-200 bg-white p-5 shadow-card dark:border-surface-800 dark:bg-surface-900">
        <h2 className="mb-3 font-display text-base font-semibold text-surface-900 dark:text-white">Order Information</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="text-xs font-medium text-surface-600">Order Type *</label>
            <select name="order_type" value={orderType} onChange={(e) => setOrderType(e.target.value)} className="mt-1 w-full rounded-lg border border-surface-200 p-2 text-sm">
              {ORDER_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-surface-600">Order To Type *</label>
            <select name="order_to_type" required className="mt-1 w-full rounded-lg border border-surface-200 p-2 text-sm">
              {ORDER_TO_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-surface-600">Order From</label>
            <select value={orderFromKind} onChange={(e) => setOrderFromKind(e.target.value as "branch" | "supplier")} className="mt-1 w-full rounded-lg border border-surface-200 p-2 text-sm">
              <option value="branch">Apni Branch/Warehouse</option>
              <option value="supplier">Bahar Ka Supplier</option>
            </select>
          </div>
          {orderFromKind === "branch" ? (
            <div>
              <label className="text-xs font-medium text-surface-600">From Branch</label>
              <select name="order_from_branch_id" className="mt-1 w-full rounded-lg border border-surface-200 p-2 text-sm">
                <option value="">- Select Karein -</option>
                {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
          ) : (
            <div>
              <label className="text-xs font-medium text-surface-600">Supplier Naam</label>
              <input name="shop_dealer_name" placeholder="Supplier ka naam likhein" className="mt-1 w-full rounded-lg border border-surface-200 p-2 text-sm" />
            </div>
          )}
          <div>
            <label className="text-xs font-medium text-surface-600">Order To Branch (agar internal hai)</label>
            <select name="order_to_branch_id" className="mt-1 w-full rounded-lg border border-surface-200 p-2 text-sm">
              <option value="">- Select Karein -</option>
              {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Location */}
      <div className="rounded-card border border-surface-200 bg-white p-5 shadow-card dark:border-surface-800 dark:bg-surface-900">
        <h2 className="mb-3 font-display text-base font-semibold text-surface-900 dark:text-white">Location / Partner Details</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <input name="partner_name" placeholder="Partner Name" className="rounded-lg border border-surface-200 p-2 text-sm" />
          <input name="partner_code" placeholder="Partner Code" className="rounded-lg border border-surface-200 p-2 text-sm" />
          {orderFromKind === "branch" && <input name="shop_dealer_name" placeholder="Shop/Dealer Naam" className="rounded-lg border border-surface-200 p-2 text-sm" />}
          <input name="location" placeholder="Location" className="rounded-lg border border-surface-200 p-2 text-sm" />
          <input name="city" placeholder="City" className="rounded-lg border border-surface-200 p-2 text-sm" />
          <input name="district" placeholder="District" className="rounded-lg border border-surface-200 p-2 text-sm" />
          <input name="contact_person" placeholder="Contact Person" className="rounded-lg border border-surface-200 p-2 text-sm" />
          <input name="mobile_number" placeholder="Mobile Number" className="rounded-lg border border-surface-200 p-2 text-sm" />
        </div>
      </div>

      {/* Product Selection */}
      <div className="rounded-card border border-surface-200 bg-white p-5 shadow-card dark:border-surface-800 dark:bg-surface-900">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-base font-semibold text-surface-900 dark:text-white">Product Selection</h2>
          <div className="flex gap-1 rounded-lg border border-surface-200 p-0.5">
            <button type="button" onClick={() => setViewMode("card")} className={`flex items-center gap-1 rounded-md px-2 py-1 text-xs ${viewMode === "card" ? "bg-brand-600 text-white" : "text-surface-500"}`}>
              <LayoutGrid className="h-3.5 w-3.5" /> Card
            </button>
            <button type="button" onClick={() => setViewMode("table")} className={`flex items-center gap-1 rounded-md px-2 py-1 text-xs ${viewMode === "table" ? "bg-brand-600 text-white" : "text-surface-500"}`}>
              <List className="h-3.5 w-3.5" /> Table
            </button>
          </div>
        </div>

        {viewMode === "card" ? (
          <ProductCardGrid products={products} categories={categories} rows={rows} onUpdateRow={updateRow} />
        ) : (
          <>
            <div className="relative mb-3">
              <Search className="pointer-events-none absolute right-3 top-2.5 h-4 w-4 text-surface-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Product dhoondein (naam ya category)"
                className="w-full rounded-lg border border-surface-200 p-2 pr-9 text-sm"
              />
            </div>
            <div className="max-h-[60vh] overflow-y-auto rounded-lg border border-surface-200 dark:border-surface-700">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-surface-50 dark:bg-surface-800">
                  <tr className="border-b border-surface-200 text-left dark:border-surface-700">
                    <th className="px-3 py-2 font-medium text-surface-500">Product</th>
                    <th className="px-3 py-2 font-medium text-surface-500">Category</th>
                    <th className="px-3 py-2 text-right font-medium text-surface-500">Rate</th>
                    <th className="px-3 py-2 text-center font-medium text-surface-500">Qty</th>
                    <th className="px-3 py-2 text-right font-medium text-surface-500">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProducts.map((p) => {
                    const row = rows[p.id];
                    const qty = row?.qty ?? 0;
                    const price = row?.price ?? p.selling_price;
                    const lineTotal = qty * price - (row?.discount ?? 0) + (row?.tax ?? 0);
                    const isActive = qty > 0;
                    return (
                      <tr key={p.id} className={`border-b border-surface-100 last:border-0 dark:border-surface-800 ${isActive ? "bg-brand-50 dark:bg-brand-900/10" : ""}`}>
                        <td className="px-3 py-2 text-surface-700 dark:text-surface-300">{p.name} {p.pack_size ? `(${p.pack_size})` : ""}</td>
                        <td className="px-3 py-2 text-xs text-surface-400">{p.category ?? "-"}</td>
                        <td className="px-3 py-2 text-right">
                          <input
                            type="number"
                            step="0.01"
                            value={price}
                            onChange={(e) => updateRow(p.id, "price", Number(e.target.value), p.selling_price)}
                            className="w-20 rounded border border-surface-200 p-1 text-right text-xs"
                          />
                        </td>
                        <td className="px-3 py-2 text-center">
                          <input
                            type="number"
                            min="0"
                            value={qty || ""}
                            onChange={(e) => updateRow(p.id, "qty", Number(e.target.value), p.selling_price)}
                            placeholder="0"
                            className={`w-16 rounded border p-1.5 text-center text-sm font-semibold ${isActive ? "border-brand-400 bg-white" : "border-surface-200"}`}
                          />
                        </td>
                        <td className="px-3 py-2 text-right font-medium text-surface-900 dark:text-white">
                          {isActive ? `Rs ${lineTotal.toLocaleString()}` : "-"}
                        </td>
                      </tr>
                    );
                  })}
                  {filteredProducts.length === 0 && (
                    <tr><td colSpan={5} className="px-3 py-8 text-center text-surface-400">Koi product nahi mila.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* Order Summary */}
      <div className="rounded-card border border-surface-200 bg-white p-5 shadow-card dark:border-surface-800 dark:bg-surface-900">
        <h2 className="mb-3 font-display text-base font-semibold text-surface-900 dark:text-white">Order Summary</h2>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-surface-600">Freight/Delivery Charges</label>
            <input type="number" value={freightCharges} onChange={(e) => setFreightCharges(Number(e.target.value))} className="mt-1 w-full rounded-lg border border-surface-200 p-2 text-sm" />
          </div>
          <div>
            <label className="text-xs font-medium text-surface-600">Other Charges</label>
            <input type="number" value={otherCharges} onChange={(e) => setOtherCharges(Number(e.target.value))} className="mt-1 w-full rounded-lg border border-surface-200 p-2 text-sm" />
          </div>
        </div>
        <div className="mt-3 space-y-1 border-t border-surface-100 pt-3 text-sm dark:border-surface-800">
          <div className="flex justify-between"><span className="text-surface-500">Subtotal</span><span>Rs {subtotal.toLocaleString()}</span></div>
          <div className="flex justify-between"><span className="text-surface-500">Discount</span><span>- Rs {totalDiscount.toLocaleString()}</span></div>
          <div className="flex justify-between"><span className="text-surface-500">Tax</span><span>+ Rs {totalTax.toLocaleString()}</span></div>
          <div className="flex justify-between"><span className="text-surface-500">Freight + Other</span><span>+ Rs {(freightCharges + otherCharges).toLocaleString()}</span></div>
          <div className="flex justify-between border-t border-surface-100 pt-1 font-semibold text-surface-900 dark:border-surface-800 dark:text-white"><span>Grand Total</span><span>Rs {grandTotal.toLocaleString()}</span></div>
        </div>
      </div>

      {/* Payment Terms & Credit */}
      <div className="rounded-card border border-surface-200 bg-white p-5 shadow-card dark:border-surface-800 dark:bg-surface-900">
        <h2 className="mb-3 font-display text-base font-semibold text-surface-900 dark:text-white">Payment Terms</h2>
        <select name="payment_terms" className="mb-3 w-full rounded-lg border border-surface-200 p-2 text-sm">
          <option value="Cash">Cash</option>
          <option value="Bank Transfer">Bank Transfer</option>
          <option value="Credit">Credit</option>
          <option value="Advance Payment">Advance Payment</option>
          <option value="Partial Payment">Partial Payment</option>
        </select>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-surface-600">Credit Limit (Rs)</label>
            <input type="number" value={creditLimit} onChange={(e) => setCreditLimit(Number(e.target.value))} className="mt-1 w-full rounded-lg border border-surface-200 p-2 text-sm" />
          </div>
          <div>
            <label className="text-xs font-medium text-surface-600">Existing Outstanding (Rs)</label>
            <input type="number" value={existingOutstanding} onChange={(e) => setExistingOutstanding(Number(e.target.value))} className="mt-1 w-full rounded-lg border border-surface-200 p-2 text-sm" />
          </div>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3 rounded-lg bg-surface-50 p-3 text-sm dark:bg-surface-800">
          <div><span className="text-surface-500">Available Credit:</span> <strong className={availableCredit < 0 ? "text-red-600" : "text-green-600"}>Rs {availableCredit.toLocaleString()}</strong></div>
          <div><span className="text-surface-500">Projected Outstanding:</span> <strong>Rs {projectedOutstanding.toLocaleString()}</strong></div>
        </div>
      </div>

      <textarea name="notes" rows={2} placeholder="Notes" className="w-full rounded-lg border border-surface-200 p-2 text-sm" />

      <SubmitButton />
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={pending} className="w-full rounded-lg bg-brand-600 py-3 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60">{pending ? "Order Submit Ho Raha Hai..." : "Order Submit Karein"}</button>;
}