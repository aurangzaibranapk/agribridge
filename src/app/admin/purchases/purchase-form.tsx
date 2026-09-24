"use client";
import { useMemo, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { createPurchase, type ActionState } from "@/actions/purchases";
import { Button, Input, Label, Select, Textarea } from "@/components/ui/form";
import { Plus, Trash2 } from "lucide-react";
import { t } from "@/lib/i18n/translations";
import { useLang } from "@/lib/i18n/lang-context";
const initialState: ActionState = {};
interface Supplier {
  id: string;
  name: string;
}
interface Product {
  id: string;
  name: string;
  pack_size: string | null;
  purchase_price: number;
}
interface Line {
  product_id: string;
  quantity: string;
  unit_cost: string;
  batch_number: string;
  manufacture_date: string;
  expiry_date: string;
}
const emptyLine: Line = { product_id: "", quantity: "", unit_cost: "", batch_number: "", manufacture_date: "", expiry_date: "" };

export function PurchaseForm({
  suppliers,
  products,
  isAdminLevel,
  branches,
  staffBranchName,
}: {
  suppliers: Supplier[];
  products: Product[];
  isAdminLevel: boolean;
  branches: { id: string; name: string }[];
  staffBranchName: string | null;
}) {
  const lang = useLang();
  const [state, formAction] = useFormState(createPurchase, initialState);
  const [supplierId, setSupplierId] = useState("");
  const [branchId, setBranchId] = useState("");
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<Line[]>([{ ...emptyLine }]);
  function addLine() {
    setLines((prev) => [...prev, { ...emptyLine }]);
  }
  function removeLine(idx: number) {
    setLines((prev) => prev.filter((_, i) => i !== idx));
  }
  function updateLine(idx: number, field: keyof Line, value: string) {
    setLines((prev) =>
      prev.map((line, i) => {
        if (i !== idx) return line;
        const updated = { ...line, [field]: value };
        if (field === "product_id") {
          const product = products.find((p) => p.id === value);
          if (product && !updated.unit_cost) {
            updated.unit_cost = String(product.purchase_price);
          }
        }
        return updated;
      })
    );
  }
  const total = useMemo(
    () =>
      lines.reduce((sum, l) => sum + (parseFloat(l.quantity) || 0) * (parseFloat(l.unit_cost) || 0), 0),
    [lines]
  );
  const itemsJson = useMemo(() => {
    return JSON.stringify(
      lines
        .filter((l) => l.product_id && l.quantity && l.unit_cost)
        .map((l) => ({
          product_id: l.product_id,
          quantity: parseFloat(l.quantity),
          unit_cost: parseFloat(l.unit_cost),
          batch_number: l.batch_number || undefined,
          manufacture_date: l.manufacture_date || undefined,
          expiry_date: l.expiry_date || undefined,
        }))
    );
  }, [lines]);
  return (
    <div className="rounded-card border border-surface-200 bg-white p-5 shadow-card dark:border-surface-800 dark:bg-surface-900">
      <h2 className="mb-4 font-display text-base font-semibold text-surface-900 dark:text-white">{t("pu_new_order", lang)}</h2>

      {state.error && (
        <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-300">
          {state.error}
        </p>
      )}
      {state.success && (
        <p className="mb-3 rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-700 dark:bg-brand-900/30 dark:text-brand-300">
          {t("pu_created", lang)}
        </p>
      )}

      <form action={formAction} className="space-y-4">
        <input type="hidden" name="supplier_id" value={supplierId} />
        <input type="hidden" name="purchase_date" value={purchaseDate} />
        <input type="hidden" name="notes" value={notes} />
        <input type="hidden" name="items_json" value={itemsJson} />

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>{t("pu_supplier_req", lang)}</Label>
            <Select value={supplierId} onChange={(e) => setSupplierId(e.target.value)} required>
              <option value="">{t("pu_select", lang)}</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </Select>
          </div>
          <div>
            <Label>{t("pu_purchase_date", lang)}</Label>
            <Input type="date" value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)} />
          </div>
        </div>

        {isAdminLevel ? (
          <div>
            <Label>{t("pu_branch_req", lang)}</Label>
            <Select value={branchId} onChange={(e) => setBranchId(e.target.value)} required>
              <option value="">{t("pu_select", lang)}</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </Select>
            <input type="hidden" name="branch_id" value={branchId} />
          </div>
        ) : (
          staffBranchName && (
            <p className="text-xs text-surface-500">{t("pu_branch", lang)}: {staffBranchName}</p>
          )
        )}

        <div>
          <Label>{t("pu_notes", lang)}</Label>
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <Label>{t("pu_products", lang)}</Label>
            <button type="button" onClick={addLine} className="flex items-center gap-1 text-xs font-medium text-brand-600 hover:underline">
              <Plus className="h-3.5 w-3.5" /> {t("pu_add_product", lang)}
            </button>
          </div>

          <div className="space-y-3">
            {lines.map((line, idx) => (
              <div key={idx} className="rounded-lg border border-surface-200 p-3 dark:border-surface-800">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-medium text-surface-500">{t("pu_line", lang)} {idx + 1}</span>
                  {lines.length > 1 && (
                    <button type="button" onClick={() => removeLine(idx)} className="text-surface-400 hover:text-red-600">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="col-span-2">
                    <Select
                      value={line.product_id}
                      onChange={(e) => updateLine(idx, "product_id", e.target.value)}
                    >
                      <option value="">{t("pu_select_product", lang)}</option>
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}{p.pack_size ? ` (${p.pack_size})` : ""}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <Input
                    type="number"
                    placeholder={t("pu_quantity", lang)}
                    value={line.quantity}
                    onChange={(e) => updateLine(idx, "quantity", e.target.value)}
                  />
                  <Input
                    type="number"
                    step="0.01"
                    placeholder={t("pu_unit_cost", lang)}
                    value={line.unit_cost}
                    onChange={(e) => updateLine(idx, "unit_cost", e.target.value)}
                  />
                  <Input
                    placeholder={t("pu_batch_optional", lang)}
                    value={line.batch_number}
                    onChange={(e) => updateLine(idx, "batch_number", e.target.value)}
                  />
                  <Input
                    type="date"
                    placeholder={t("pu_expiry", lang)}
                    value={line.expiry_date}
                    onChange={(e) => updateLine(idx, "expiry_date", e.target.value)}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-surface-100 pt-3 dark:border-surface-800">
          <span className="text-sm font-medium text-surface-700 dark:text-surface-300">{t("pu_total", lang)}</span>
          <span className="font-display text-lg font-bold text-brand-700 dark:text-brand-300">
            Rs {total.toLocaleString()}
          </span>
        </div>

        <SubmitButton />
      </form>
    </div>
  );
}

function SubmitButton() {
  const lang = useLang();
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? t("pu_creating", lang) : t("pu_create", lang)}
    </Button>
  );
}