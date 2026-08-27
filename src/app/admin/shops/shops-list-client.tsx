"use client";
import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { createShop, updateShopStatus, deleteShop, type ActionState } from "@/actions/shops";
import { DeleteButton } from "@/components/admin/delete-button";
import { EmptyState } from "@/components/ui/layout-primitives";
import { Store, Plus } from "lucide-react";

const initialState: ActionState = {};

const BUSINESS_TYPE_LABELS: Record<string, string> = {
  karyana: "Karyana",
  agri_inputs: "Agri Inputs",
  grain_procurement: "Grain Procurement",
  dairy: "Dairy",
  machinery_fleet: "Machinery & Fleet",
};

interface Shop {
  id: string;
  name: string;
  code: string | null;
  business_type: string;
  is_active: boolean;
  branch_name?: string;
}

interface Branch {
  id: string;
  name: string;
}

export function ShopsListClient({ shops, branches }: { shops: Shop[]; branches: Branch[] }) {
  const [showAdd, setShowAdd] = useState(false);

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div className="lg:col-span-2">
        <div className="mb-3 flex justify-end">
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700"
          >
            <Plus className="h-4 w-4" /> Nayi Shop Add Karein
          </button>
        </div>

        {shops.length === 0 ? (
          <EmptyState title="Koi shop nahi hai" description="Upar 'Nayi Shop Add Karein' se pehli shop banayein." />
        ) : (
          <div className="space-y-2">
            {shops.map((s) => (
              <div key={s.id} className="rounded-card border border-surface-200 bg-white p-4 shadow-card dark:border-surface-800 dark:bg-surface-900">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-50 text-brand-600 dark:bg-brand-900/30">
                      <Store className="h-4 w-4" />
                    </span>
                    <div>
                      <p className="font-medium text-surface-900 dark:text-white">{s.name}</p>
                      <p className="text-xs text-surface-500">
                        {s.branch_name} · {BUSINESS_TYPE_LABELS[s.business_type] ?? s.business_type} {s.code ? `· ${s.code}` : ""}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusToggle shopId={s.id} isActive={s.is_active} />
                    <DeleteButton id={s.id} action={deleteShop} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showAdd && <AddShopForm branches={branches} onDone={() => setShowAdd(false)} />}
      {!showAdd && (
        <div className="rounded-card border border-dashed border-surface-200 bg-white p-6 text-center text-sm text-surface-400">
          "Nayi Shop Add Karein" dabayein taake form khule.
        </div>
      )}
    </div>
  );
}

function StatusToggle({ shopId, isActive }: { shopId: string; isActive: boolean }) {
  const [, formAction] = useFormState(updateShopStatus, initialState);
  return (
    <form action={formAction}>
      <input type="hidden" name="id" value={shopId} />
      <input type="hidden" name="is_active" value={String(!isActive)} />
      <button
        type="submit"
        className={`rounded-full px-2.5 py-1 text-xs font-medium ${isActive ? "bg-green-50 text-green-700" : "bg-surface-100 text-surface-500"}`}
      >
        {isActive ? "Active" : "Inactive"}
      </button>
    </form>
  );
}

function AddShopForm({ branches, onDone }: { branches: Branch[]; onDone: () => void }) {
  const [state, formAction] = useFormState(createShop, initialState);
  if (state.success) setTimeout(onDone, 800);

  return (
    <div className="rounded-card border border-surface-200 bg-white p-4 shadow-card dark:border-surface-800 dark:bg-surface-900">
      <h3 className="mb-3 font-display text-sm font-semibold text-surface-900 dark:text-white">Nayi Shop</h3>
      {state.error && <p className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{state.error}</p>}
      <form action={formAction} className="space-y-2">
        <input name="name" required placeholder="Shop ka naam (e.g. Karyana Shop)" className="w-full rounded-lg border border-surface-200 p-2 text-sm" />
        <select name="branch_id" required className="w-full rounded-lg border border-surface-200 p-2 text-sm">
          <option value="">- Branch Select Karein -</option>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>
        <select name="business_type" required className="w-full rounded-lg border border-surface-200 p-2 text-sm">
          <option value="karyana">Karyana</option>
          <option value="agri_inputs">Agri Inputs (Fertilizer/Pesticide/Wanda)</option>
          <option value="grain_procurement">Grain Procurement</option>
          <option value="dairy">Dairy</option>
          <option value="machinery_fleet">Machinery & Fleet</option>
        </select>
        <input name="code" placeholder="Code (optional, e.g. MB-KAR)" className="w-full rounded-lg border border-surface-200 p-2 text-sm" />
        <SubmitButton />
      </form>
    </div>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={pending} className="w-full rounded-lg bg-brand-600 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60">{pending ? "..." : "Shop Banayein"}</button>;
}