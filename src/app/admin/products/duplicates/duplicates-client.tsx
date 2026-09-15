"use client";

import { useEffect, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { renameDuplicateProduct, hideDuplicateProduct, type ActionState } from "@/actions/product-duplicates";
import { mergeProductDirect, type ActionState as MergeActionState } from "@/actions/product-merge";
import { EyeOff, Pencil, Merge, X } from "lucide-react";

const initialState: ActionState = {};
const initialMergeState: MergeActionState = {};

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

/**
 * Stock wale duplicate ke liye -- bare "hide" khatarnak hai (stock kahin
 * jaye baghair hi product ghayab ho jata). Yahan naam type karke stock
 * pehle sahi naam par bheja jata hai, phir purana naam hataya jata hai --
 * ek hi click, request/approval ka intezar nahi (Admin khud kar raha hai).
 */
function MergeDeleteButton({ productId, otherNames, onMerged }: { productId: string; otherNames: string[]; onMerged: () => void }) {
  const [open, setOpen] = useState(false);
  const [targetName, setTargetName] = useState("");
  const [mergeState, mergeAction] = useFormState(mergeProductDirect, initialMergeState);
  const listId = `dup-merge-names-${productId}`;

  useEffect(() => {
    if (mergeState.success) {
      const timer = setTimeout(onMerged, 1200);
      return () => clearTimeout(timer);
    }
  }, [mergeState.success, onMerged]);

  if (mergeState.success) {
    return <span className="text-xs text-green-700 dark:text-green-400">{mergeState.message}</span>;
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        title="Merge kar ke hatayein (stock doosre naam par chala jayega)"
        className="rounded-lg p-1.5 text-surface-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30"
      >
        <Merge className="h-3.5 w-3.5" />
      </button>
    );
  }

  return (
    <form action={mergeAction} className="flex items-center gap-1">
      <input type="hidden" name="source_product_id" value={productId} />
      <input
        name="target_name"
        list={listId}
        value={targetName}
        onChange={(e) => setTargetName(e.target.value)}
        placeholder="Sahi naam likhein"
        autoFocus
        className="w-40 rounded-lg border border-surface-200 p-1.5 text-sm dark:border-surface-700 dark:bg-surface-800"
      />
      <datalist id={listId}>
        {otherNames.map((n) => (
          <option key={n} value={n} />
        ))}
      </datalist>
      <SubmitBtn label="Merge & Hatayein" className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-60" />
      <button type="button" onClick={() => setOpen(false)} className="text-surface-400">
        <X className="h-3.5 w-3.5" />
      </button>
      {mergeState.error && <p className="w-full text-xs text-red-600">{mergeState.error}</p>}
    </form>
  );
}

function ProductRow({ item, allProductNames }: { item: ProductItem; allProductNames: string[] }) {
  const [editing, setEditing] = useState(false);
  const [renameState, renameAction] = useFormState(renameDuplicateProduct, initialState);
  const [hideState, hideAction] = useFormState(hideDuplicateProduct, initialState);
  const [rowGone, setRowGone] = useState(false);
  const totalStock = item.stock.reduce((s, w) => s + w.qty, 0);

  if (hideState.success || rowGone) {
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
        {totalStock > 0 ? (
          <MergeDeleteButton
            productId={item.id}
            otherNames={allProductNames.filter((n) => n !== item.name)}
            onMerged={() => setRowGone(true)}
          />
        ) : (
          <form action={hideAction}>
            <input type="hidden" name="id" value={item.id} />
            <button type="submit" title="Hata dein (list se gayab, record mehfooz)" className="rounded-lg p-1.5 text-surface-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30">
              <EyeOff className="h-3.5 w-3.5" />
            </button>
          </form>
        )}
      </div>
      {hideState.error && <p className="w-full text-xs text-red-600">{hideState.error}</p>}
    </div>
  );
}

export function DuplicatesClient({ groups, allProductNames }: { groups: Group[]; allProductNames: string[] }) {
  if (groups.length === 0) {
    return <p className="rounded-card border border-dashed border-surface-200 bg-white p-10 text-center text-surface-400">Koi duplicate naam nahi mila.</p>;
  }

  return (
    <div className="space-y-4">
      {groups.map((g) => (
        <div key={g.norm} className="rounded-card border border-surface-200 bg-white p-4 shadow-card dark:border-surface-800 dark:bg-surface-900">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-surface-400">{g.items.length} products isi naam ke</p>
          {g.items.map((item) => (
            <ProductRow key={item.id} item={item} allProductNames={allProductNames} />
          ))}
        </div>
      ))}
    </div>
  );
}
