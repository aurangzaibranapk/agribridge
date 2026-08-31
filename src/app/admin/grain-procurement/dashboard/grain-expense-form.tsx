"use client";
import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { createGrainExpense, type ActionState } from "@/actions/grain-expenses";
import { Button, Input, Label, Select, Textarea } from "@/components/ui/form";
import { Fuel } from "lucide-react";
import { t } from "@/lib/i18n/translations";
import { useLang } from "@/lib/i18n/lang-context";

const initialState: ActionState = {};

interface FinanceAccount { id: string; name: string; account_type: string; }
interface Entry {
  id: string;
  entry_date: string;
  seller_name: string;
  grain_type: string;
  weight_kg: number;
}

const CATEGORIES = [
  { value: "diesel_fuel", label: "Diesel / Fuel (Tractor/Trolley)" },
  { value: "labor_mazdoori", label: "Labor / Mazdoori" },
  { value: "bardana", label: "Bardana" },
  { value: "tractor_trolley_rent", label: "Tractor / Trolley Rent" },
  { value: "other", label: "Other" },
];

const GRAIN_LABELS: Record<string, string> = { wheat: "Wheat", rice: "Rice", maize: "Maize" };

export function GrainExpenseForm({ financeAccounts, entries }: { financeAccounts: FinanceAccount[]; entries: Entry[] }) {
  const [state, formAction] = useFormState(createGrainExpense, initialState);
  const lang = useLang();
  const [linkToEntry, setLinkToEntry] = useState(false);

  if (state.success) setTimeout(() => window.location.reload(), 900);

  return (
    <div className="rounded-card border border-surface-200 bg-white p-4 shadow-card dark:border-surface-800 dark:bg-surface-900">
      <h3 className="mb-3 flex items-center gap-1.5 font-display text-base font-semibold text-surface-900 dark:text-white">
        <Fuel className="h-4 w-4" /> Grain Operation Expense Add Karein
      </h3>
      {state.error && <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-300">{state.error}</p>}
      {state.success && <p className="mb-3 rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-700 dark:bg-brand-900/30 dark:text-brand-300">{t("ge_recorded", lang)}</p>}
      <form action={formAction} className="space-y-3">
        <div>
          <Label>Category *</Label>
          <Select name="category" required>
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </Select>
        </div>
        <div>
          <Label>Description *</Label>
          <Input name="description" required placeholder={t("ge_example", lang)} />
        </div>

        <div className="rounded-lg border border-surface-200 p-3 dark:border-surface-700">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={linkToEntry} onChange={(e) => setLinkToEntry(e.target.checked)} className="h-4 w-4" />
            <span className="text-surface-700 dark:text-surface-300">{t("ge_link_entry", lang)}</span>
          </label>
          {linkToEntry ? (
            <select name="entry_id" required className="mt-2 w-full rounded-lg border border-surface-200 p-2 text-sm">
              <option value="">- Entry Select Karein -</option>
              {entries.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.entry_date} - {e.seller_name} - {GRAIN_LABELS[e.grain_type]} ({e.weight_kg} kg)
                </option>
              ))}
            </select>
          ) : (
            <p className="mt-2 text-[11px] text-surface-400">Link nahi karenge to ye General/Overall expense ban jayega (kisi ek Farmer se attach nahi hoga).</p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Amount (Rs.) *</Label>
            <Input type="number" step="0.01" name="amount" required />
          </div>
          <div>
            <Label>{t("c_date", lang)}</Label>
            <Input type="date" name="expense_date" defaultValue={new Date().toISOString().slice(0, 10)} />
          </div>
        </div>
        <div>
          <Label>Konsa Account (jahan se paisa gaya) *</Label>
          <Select name="account_id" required>
            <option value="">- select -</option>
            {financeAccounts.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </Select>
        </div>
        <div>
          <Label>{t("c_notes_optional", lang)}</Label>
          <Textarea name="notes" rows={2} />
        </div>
        <SubmitButton />
      </form>
    </div>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return <Button type="submit" disabled={pending} className="w-full">{pending ? "Saving..." : "Expense Record Karein"}</Button>;
}