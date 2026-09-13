"use client";
import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { Pencil, Warehouse as WarehouseIcon } from "lucide-react";
import { saveWarehouse, type ActionState } from "@/actions/inventory";
import { Button, Input, Label, Textarea, Select } from "@/components/ui/form";
import { t } from "@/lib/i18n/translations";
import { useLang } from "@/lib/i18n/lang-context";

const initialState: ActionState = {};

interface Branch {
  id: string;
  name: string;
}
interface Shop {
  id: string;
  name: string;
  branch_id: string;
}
export interface WarehouseRow {
  id: string;
  name: string;
  code: string | null;
  address: string | null;
  is_active: boolean;
  branch_id: string | null;
  shop_id: string | null;
  branch_name: string | null;
  shop_name: string | null;
}

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full">
      {pending ? "…" : label}
    </Button>
  );
}

function WarehouseFields({ branches, shops, editing }: { branches: Branch[]; shops: Shop[]; editing?: WarehouseRow }) {
  const lang = useLang();
  const [branchId, setBranchId] = useState(editing?.branch_id ?? "");
  const shopsForBranch = shops.filter((s) => s.branch_id === branchId);

  return (
    <>
      <div>
        <Label htmlFor="wh-name">{t("wh_name", lang)}</Label>
        <Input id="wh-name" name="name" required defaultValue={editing?.name ?? ""} placeholder={t("wh_name_eg", lang)} />
      </div>
      <div>
        <Label htmlFor="wh-code">{t("wh_code", lang)}</Label>
        <Input id="wh-code" name="code" required defaultValue={editing?.code ?? ""} placeholder={t("wh_code_eg", lang)} />
      </div>
      <div>
        <Label htmlFor="wh-branch">{t("wh_branch", lang)}</Label>
        <Select id="wh-branch" name="branch_id" required value={branchId} onChange={(e) => setBranchId(e.target.value)}>
          <option value="">{t("wh_pick_branch", lang)}</option>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </Select>
      </div>
      <div>
        <Label htmlFor="wh-shop">{t("wh_shop", lang)}</Label>
        <Select id="wh-shop" name="shop_id" defaultValue={editing?.shop_id ?? ""} disabled={!branchId}>
          <option value="">{t("wh_no_shop", lang)}</option>
          {shopsForBranch.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </Select>
        <p className="mt-1 text-[11px] text-surface-500">{t("wh_shop_hint", lang)}</p>
      </div>
      <div>
        <Label htmlFor="wh-address">{t("c_address", lang)}</Label>
        <Textarea id="wh-address" name="address" rows={2} defaultValue={editing?.address ?? ""} />
      </div>
    </>
  );
}

function AddWarehouseForm({ branches, shops }: { branches: Branch[]; shops: Shop[] }) {
  const [state, formAction] = useFormState(saveWarehouse, initialState);
  const lang = useLang();

  return (
    <div className="rounded-card border border-surface-200 bg-white p-5 shadow-card dark:border-surface-800 dark:bg-surface-900">
      <h2 className="mb-3 font-display text-base font-semibold text-surface-900 dark:text-white">{t("wh_new", lang)}</h2>
      {state.error && <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-300">{state.error}</p>}
      {state.success && <p className="mb-3 rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-700 dark:bg-brand-900/30 dark:text-brand-300">{t("wh_added", lang)}</p>}
      <form key={state.success ? Math.random() : "add"} action={formAction} className="space-y-3">
        <WarehouseFields branches={branches} shops={shops} />
        <SubmitButton label={t("wh_add_btn", lang)} />
      </form>
    </div>
  );
}

function EditWarehouseForm({ warehouse, branches, shops, onDone }: { warehouse: WarehouseRow; branches: Branch[]; shops: Shop[]; onDone: () => void }) {
  const [state, formAction] = useFormState(saveWarehouse, initialState);
  const lang = useLang();
  if (state.success) setTimeout(onDone, 800);

  return (
    <div className="rounded-card border border-amber-200 bg-amber-50/40 p-5 shadow-card dark:border-amber-900/50 dark:bg-amber-950/10">
      <h2 className="mb-3 font-display text-base font-semibold text-surface-900 dark:text-white">{t("wh_edit", lang)}</h2>
      {state.error && <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-300">{state.error}</p>}
      <form key={warehouse.id} action={formAction} className="space-y-3">
        <input type="hidden" name="id" value={warehouse.id} />
        <WarehouseFields branches={branches} shops={shops} editing={warehouse} />
        <div className="flex gap-2">
          <SubmitButton label={t("wh_save", lang)} />
          <button type="button" onClick={onDone} className="rounded-lg border border-surface-200 px-3 py-2 text-sm text-surface-600 dark:border-surface-700 dark:text-surface-300">
            {t("wh_cancel", lang)}
          </button>
        </div>
      </form>
    </div>
  );
}

export function WarehousesListClient({ warehouses, branches, shops }: { warehouses: WarehouseRow[]; branches: Branch[]; shops: Shop[] }) {
  const lang = useLang();
  const [editingId, setEditingId] = useState<string | null>(null);
  const editing = warehouses.find((w) => w.id === editingId) ?? null;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div className="lg:col-span-2">
        {warehouses.length === 0 ? (
          <p className="text-sm text-surface-500">{t("at_no_warehouses", lang)}</p>
        ) : (
          <div className="space-y-2">
            {warehouses.map((w) => (
              <div key={w.id} className="flex items-center justify-between rounded-card border border-surface-200 bg-white p-4 shadow-card dark:border-surface-800 dark:bg-surface-900">
                <div>
                  <p className="flex items-center gap-1.5 font-medium text-surface-900 dark:text-white">
                    <WarehouseIcon className="h-4 w-4 text-surface-400" /> {w.name} <span className="text-xs text-surface-400">({w.code})</span>
                  </p>
                  <p className="mt-0.5 text-xs text-surface-500">
                    {w.branch_name ?? "—"} {w.shop_name ? `· ${w.shop_name}` : `· ${t("wh_branch_only", lang)}`}
                  </p>
                  {w.address && <p className="mt-0.5 text-xs text-surface-500">{w.address}</p>}
                </div>
                <div className="flex items-center gap-2">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${w.is_active ? "bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300" : "bg-surface-100 text-surface-500 dark:bg-surface-800 dark:text-surface-400"}`}>
                    {w.is_active ? "Active" : "Inactive"}
                  </span>
                  <button type="button" onClick={() => setEditingId(w.id)} className="rounded-lg border border-surface-200 p-1.5 text-surface-500 hover:bg-surface-50 dark:border-surface-700 dark:hover:bg-surface-800">
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      {editing ? (
        <EditWarehouseForm warehouse={editing} branches={branches} shops={shops} onDone={() => setEditingId(null)} />
      ) : (
        <AddWarehouseForm branches={branches} shops={shops} />
      )}
    </div>
  );
}
