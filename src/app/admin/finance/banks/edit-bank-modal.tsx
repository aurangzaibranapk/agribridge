"use client";
import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { updateBankAccount, type ActionState } from "@/actions/bank-management";
import { X, Upload } from "lucide-react";
import { t } from "@/lib/i18n/translations";
import { useLang } from "@/lib/i18n/lang-context";

const initialState: ActionState = {};

interface Bank {
  id: string;
  name: string;
  account_number: string | null;
  logo_url: string | null;
  opening_balance: number;
  current_balance: number;
}

interface EditBankModalProps {
  bank: Bank;
  onClose: () => void;
}

export default function EditBankModal({ bank, onClose }: EditBankModalProps) {
  const [state, formAction] = useFormState(updateBankAccount, initialState);
  const lang = useLang();
  const [logoPreview, setLogoPreview] = useState<string | null>(bank.logo_url);

  if (state.success) {
    setTimeout(onClose, 800);
  }

  function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) setLogoPreview(URL.createObjectURL(file));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-sm rounded-card bg-white p-5 shadow-xl dark:bg-surface-900">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display text-base font-semibold text-surface-900 dark:text-white">{t("fb_edit_bank", lang)}</h3>
          <button onClick={onClose} className="text-surface-400 hover:text-surface-700"><X className="h-5 w-5" /></button>
        </div>
        {state.error && <p className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{state.error}</p>}
        {state.success && <p className="mb-2 rounded-lg bg-brand-50 px-3 py-2 text-xs text-brand-700">{t("fb_bank_updated", lang)}</p>}
        <form action={formAction} encType="multipart/form-data" className="space-y-3">
          <input type="hidden" name="bank_id" value={bank.id} />
          <div>
            <label className="text-xs font-medium text-surface-600">{t("c_bank_logo", lang)}</label>
            <div className="mt-1 flex items-center gap-3">
              {logoPreview ? (
                <img src={logoPreview} alt="Preview" className="h-14 w-14 rounded-lg border border-surface-200 object-contain" />
              ) : (
                <div className="flex h-14 w-14 items-center justify-center rounded-lg border-2 border-dashed border-surface-200 text-surface-400">
                  <Upload className="h-5 w-5" />
                </div>
              )}
              <input type="file" name="logo" accept="image/*" onChange={handleLogoChange} className="flex-1 text-xs" />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-surface-600">Bank Naam *</label>
            <input name="name" defaultValue={bank.name} required className="mt-1 w-full rounded-lg border border-surface-200 p-2 text-sm" />
          </div>
          <div>
            <label className="text-xs font-medium text-surface-600">{t("c_account_number_optional", lang)}</label>
            <input name="account_number" defaultValue={bank.account_number ?? ""} className="mt-1 w-full rounded-lg border border-surface-200 p-2 text-sm" />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="rounded-lg border border-surface-200 px-3 py-2 text-sm text-surface-600 hover:bg-surface-50">{t("c_cancel", lang)}</button>
            <SubmitButton />
          </div>
        </form>
      </div>
    </div>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={pending} className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60">{pending ? "Saving..." : "Save Changes"}</button>;
}