"use client";
import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { issueFarmerCredit, type ActionState } from "@/actions/farmer-credit";
import { Button, Input, Label, Select, Textarea } from "@/components/ui/form";
import { Plus, X } from "lucide-react";
import { t } from "@/lib/i18n/translations";
import { useLang } from "@/lib/i18n/lang-context";

const initialState: ActionState = {};

interface Farmer {
  id: string;
  full_name: string;
  farmer_code: string;
}

export function IssueCreditButton({ farmers }: { farmers: Farmer[] }) {
  const lang = useLang();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700"
      >
        <Plus className="h-4 w-4" />{t("fc_issue_credit", lang)}</button>
      {open && <CreditModal farmers={farmers} onClose={() => setOpen(false)} />}
    </>
  );
}

function CreditModal({ farmers, onClose }: { farmers: Farmer[]; onClose: () => void }) {
  const lang = useLang();
  const [state, formAction] = useFormState(issueFarmerCredit, initialState);

  if (state.success) {
    setTimeout(onClose, 800);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-sm rounded-card bg-white p-5 shadow-xl dark:bg-surface-900">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display text-base font-semibold text-surface-900 dark:text-white">{t("fc_issue_credit", lang)}</h3>
          <button onClick={onClose} className="text-surface-400 hover:text-surface-700 dark:hover:text-surface-200">
            <X className="h-5 w-5" />
          </button>
        </div>
        {state.error && <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-300">{state.error}</p>}
        {state.success && <p className="mb-3 rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-700 dark:bg-brand-900/30 dark:text-brand-300">{t("fc_credit_issued", lang)}</p>}
        <form action={formAction} className="space-y-3">
          <div>
            <Label>{t("at_farmer_req", lang)}</Label>
            <Select name="farmer_id" required>
              <option value="">- select -</option>
              {farmers.map((f) => (
                <option key={f.id} value={f.id}>{f.full_name} ({f.farmer_code})</option>
              ))}
            </Select>
          </div>
          <div>
            <Label>{t("at_credit_type_req", lang)}</Label>
            <Select name="source_type" required>
              <option value="seed">{t("c_seed", lang)}</option>
              <option value="fertilizer">{t("c_fertilizer", lang)}</option>
              <option value="pesticide">{t("c_pesticide", lang)}</option>
              <option value="machinery">{t("c_machinery", lang)}</option>
              <option value="other">{t("c_other", lang)}</option>
            </Select>
          </div>
          <div>
            <Label>{t("at_amount_rs_req", lang)}</Label>
            <Input name="amount" type="number" step="0.01" required />
          </div>
          <div>
            <Label>{t("c_notes", lang)}</Label>
            <Textarea name="notes" rows={2} placeholder={t("fc_notes_example", lang)} />
          </div>
          <SubmitButton />
        </form>
      </div>
    </div>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return <Button type="submit" disabled={pending} className="w-full">{pending ? "Saving..." : "Issue Credit"}</Button>;
}