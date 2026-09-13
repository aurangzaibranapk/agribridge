"use client";

import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { renameDuplicateProduct, hideDuplicateProduct, type ActionState } from "@/actions/product-duplicates";
import { EyeOff, Pencil } from "lucide-react";

const initialState: ActionState = {};

interface ProductItem {
  id: string;
  name: string;
  pack_size: string | null;
  category_name: string | null;
  purchase_price: number;
  selling_price: number;
  stock: { warehouseName: string; qty: number }[];
}

interface Group {
  norm: string;
  items: ProductItem[];
}

function SubmitBtn({ label, className }: { label: string; className: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={className}>
      {pending ? "..." : label}
    </button>
  );
}

function ProductRow({ item }: { item: ProductItem }) {
  const [editing, setEditing] = useState(false);
  const [renameState, renameAction] = useFormState(renameDuplicateProduct, initialState);
  const [hideState, hideAction] = useFormState(hideDuplicateProduct, initialState);
  const totalStock = item.stock.reduce((s, w) => s + w.qty, 0);

  if (hideState.success) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-surface-100 py-3 first:border-t-0 dark:border-surface-800">
      <div className="min-w-0 flex-1">
        {editing ? (
          <form action={renameAction} className="flex flex-wrap items-center gap-2">
            <input type="hidden" name="id" value={item.id} />
            <input
              name="name"
              defaultValue={item.name}
              required
              className="w-56 rounded-lg border border-surface-200 p-1.5 text-sm dark:border-surface-700 dark:bg-surface-800"
            />
            <SubmitBtn label="Save" className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-60" />
            <button type="button" onClick={() => setEditing(false)} className="text-xs text-surface-400 hover:text-surface-600">
              Cancel
            </button>
            {renameState.error && <p className="w-full text-xs text-red-600">{renameState.error}</p>}
          </form>
        ) : (
          <p className="font-medium text-surface-900 dark:text-white">
            {item.name}
            {item.pack_size ? <span className="ml-1 text-xs text-surface-400">({item.pack_size})</span> : null}
          </p>
        )}
        <p className="mt-0.5 text-xs text-surface-500">
          {item.category_name ?? "Bina qism"} · Trade Rs {item.purchase_price.toLocaleString()} · Sale Rs {item.selling_price.toLocaleString()}
        </p>
        <p className="mt-0.5 text-xs">
          {totalStock > 0 ? (
            <span className="text-surface-600 dark:text-surface-300">
              Stock: {item.stock.map((w) => `${w.warehouseName} (${w.qty})`).join(", ")}
            </span>
          ) : (
            <span className="text-amber-600 dark:text-amber-400">Koi stock nahi — is duplicate ko hata dena mehfooz hai</span>
          )}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        {!editing && (
          <button onClick={() => setEditing(true)} title="Naam badlein" className="rounded-lg p-1.5 text-surface-500 hover:bg-surface-100 dark:hover:bg-surface-800">
            <Pencil className="h-3.5 w-3.5" />
          </button>
        )}
        <form action={hideAction}>
          <input type="hidden" name="id" value={item.id} />
          <button type="submit" title="Hata dein (list se gayab, record mehfooz)" className="rounded-lg p-1.5 text-surface-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30">
            <EyeOff className="h-3.5 w-3.5" />
          </button>
        </form>
      </div>
      {hideState.error && <p className="w-full text-xs text-red-600">{hideState.error}</p>}
    </div>
  );
}

export function DuplicatesClient({ groups }: { groups: Group[] }) {
  if (groups.length === 0) {
    return <p className="rounded-card border border-dashed border-surface-200 bg-white p-10 text-center text-surface-400">Koi duplicate naam nahi mila.</p>;
  }

  return (
    <div className="space-y-4">
      {groups.map((g) => (
        <div key={g.norm} className="rounded-card border border-surface-200 bg-white p-4 shadow-card dark:border-surface-800 dark:bg-surface-900">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-surface-400">{g.items.length} products isi naam ke</p>
          {g.items.map((item) => (
            <ProductRow key={item.id} item={item} />
          ))}
        </div>
      ))}
    </div>
  );
}
