"use client";
import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { createReturn, type ActionState } from "@/actions/agri-returns";
import { PackageX, PackageMinus } from "lucide-react";

const initialState: ActionState = {};

interface Product {
  id: string;
  name: string;
  pack_size: string | null;
  price: number;
  stock: number;
}

interface Order {
  id: string;
  order_number: string;
  created_at: string;
}

interface RowState {
  qty: number;
  price: number;
  reason: "damaged" | "unsold";
}

const REASONS = [
  { value: "damaged", title: "Maal Kharab Nikla", Icon: PackageX },
  { value: "unsold", title: "Bika Nahi", Icon: PackageMinus },
  { value: "both", title: "Dono", Icon: PackageX },
] as const;

export function NewReturnForm({ products, orders, warehouseMissing }: { products: Product[]; orders: Order[]; warehouseMissing: boolean }) {
  const [state, formAction] = useFormState(createReturn, initialState);
  const [reason, setReason] = useState<string>("damaged");
  const [rows, setRows] = useState<Record<string, RowState>>({});
  const [search, setSearch] = useState("");

  function updateRow(id: string, field: keyof RowState, value: number | string, defaultPrice: number) {
    setRows((prev) => ({
      ...prev,
      [id]: {
        qty: prev[id]?.qty ?? 0,
        price: prev[id]?.price ?? defaultPrice,
        reason: prev[id]?.reason ?? "damaged",
        [field]: value,
      },
    }));
  }

  const activeItems = products
    .filter((p) => (rows[p.id]?.qty ?? 0) > 0)
    .map((p) => ({
      product_id: p.id,
      product_name: p.name,
      return_qty: rows[p.id].qty,
      unit_price: rows[p.id].price ?? p.price,
      item_reason: rows[p.id].reason ?? "damaged",
    }));

  const total = activeItems.reduce((sum, i) => sum + i.return_qty * i.unit_price, 0);
  const visible = products.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()));

  if (warehouseMissing) {
    return <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">Is shop ka godown (warehouse) system mein set nahi hai. Admin se kehein ke pehle warehouse banayein.</p>;
  }

  if (products.length === 0) {
    return <p className="rounded-lg bg-surface-50 px-3 py-2 text-sm text-surface-600">Aapke godown mein abhi koi stock nahi hai, is liye return nahi ban sakta.</p>;
  }

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="items_json" value={JSON.stringify(activeItems)} />
      <input type="hidden" name="reason" value={reason} />

      {state.error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}
      {state.success && <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">Return ban gaya. HQ ko itla bhej di gayi hai.</p>}

      <div className="rounded-card border border-surface-200 bg-white p-5 shadow-card dark:border-surface-800 dark:bg-surface-900">
        <h2 className="mb-3 font-display text-base font-semibold text-surface-900 dark:text-white">Return Ki Wajah</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {REASONS.map(({ value, title, Icon }) => {
            const selected = reason === value;
            return (
              <button
                key={value}
                type="button"
                onClick={() => setReason(value)}
                aria-pressed={selected}
                className={`flex items-center gap-2 rounded-lg border p-3 text-left transition ${
                  selected ? "border-brand-600 bg-brand-50 ring-1 ring-brand-600 dark:bg-brand-950/30" : "border-surface-200 hover:border-surface-300 dark:border-surface-700"
                }`}
              >
                <Icon className={`h-4 w-4 ${selected ? "text-brand-600" : "text-surface-400"}`} />
                <span className="text-sm font-medium text-surface-900 dark:text-white">{title}</span>
              </button>
            );
          })}
        </div>

        <div className="mt-3">
          <label className="text-xs font-medium text-surface-600">Kis order ka maal hai? (marzi ki baat)</label>
          <select name="order_id" className="mt-1 w-full rounded-lg border border-surface-200 p-2 text-sm">
            <option value="">- Kisi order se nahi jorna -</option>
            {orders.map((o) => (
              <option key={o.id} value={o.id}>{o.order_number}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="rounded-card border border-surface-200 bg-white p-5 shadow-card dark:border-surface-800 dark:bg-surface-900">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="font-display text-base font-semibold text-surface-900 dark:text-white">Maal Chunein</h2>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Product dhoondein..."
            className="w-48 rounded-lg border border-surface-200 p-2 text-sm"
          />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-200 text-left dark:border-surface-800">
                <th className="px-2 py-2 font-medium text-surface-500">Product</th>
                <th className="px-2 py-2 text-right font-medium text-surface-500">Mera Stock</th>
                <th className="px-2 py-2 text-right font-medium text-surface-500">Wapas Qty</th>
                <th className="px-2 py-2 text-right font-medium text-surface-500">Rate</th>
                <th className="px-2 py-2 font-medium text-surface-500">Wajah</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((p) => {
                const row = rows[p.id];
                const tooMuch = (row?.qty ?? 0) > p.stock;
                return (
                  <tr key={p.id} className="border-b border-surface-100 last:border-0 dark:border-surface-800">
                    <td className="px-2 py-2 text-surface-700 dark:text-surface-300">
                      {p.name} {p.pack_size ? <span className="text-xs text-surface-400">({p.pack_size})</span> : null}
                    </td>
                    <td className="px-2 py-2 text-right text-surface-500">{p.stock}</td>
                    <td className="px-2 py-2 text-right">
                      <input
                        type="number"
                        min={0}
                        max={p.stock}
                        value={row?.qty ?? 0}
                        onChange={(e) => updateRow(p.id, "qty", Number(e.target.value), p.price)}
                        className={`w-20 rounded-lg border p-1.5 text-right text-sm ${tooMuch ? "border-red-500" : "border-surface-200"}`}
                      />
                    </td>
                    <td className="px-2 py-2 text-right">
                      <input
                        type="number"
                        min={0}
                        value={row?.price ?? p.price}
                        onChange={(e) => updateRow(p.id, "price", Number(e.target.value), p.price)}
                        className="w-24 rounded-lg border border-surface-200 p-1.5 text-right text-sm"
                      />
                    </td>
                    <td className="px-2 py-2">
                      <select
                        value={row?.reason ?? "damaged"}
                        onChange={(e) => updateRow(p.id, "reason", e.target.value, p.price)}
                        className="rounded-lg border border-surface-200 p-1.5 text-sm"
                      >
                        <option value="damaged">Kharab</option>
                        <option value="unsold">Bika nahi</option>
                      </select>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-card border border-surface-200 bg-white p-5 shadow-card dark:border-surface-800 dark:bg-surface-900">
        <div className="flex items-center justify-between text-sm">
          <span className="text-surface-500">Kul Items</span>
          <span className="font-medium text-surface-900 dark:text-white">{activeItems.length}</span>
        </div>
        <div className="mt-1 flex items-center justify-between border-t border-surface-100 pt-2 text-base font-semibold dark:border-surface-800">
          <span className="text-surface-900 dark:text-white">Return Ki Value</span>
          <span className="text-brand-600">Rs {total.toLocaleString()}</span>
        </div>
        <p className="mt-2 text-xs text-surface-500">HQ maal receive karega to itni raqam aapke khate se kam ho jayegi.</p>
      </div>

      <textarea name="notes" rows={2} placeholder="Notes (agar koi ho)" className="w-full rounded-lg border border-surface-200 p-2 text-sm" />

      <SubmitButton disabled={activeItems.length === 0} />
    </form>
  );
}

function SubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending || disabled}
      className="w-full rounded-lg bg-brand-600 py-3 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
    >
      {pending ? "Return Ban Raha Hai..." : "Return Submit Karein"}
    </button>
  );
}
