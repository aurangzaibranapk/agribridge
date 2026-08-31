"use client";
import { useRef } from "react";
import { useFormState, useFormStatus } from "react-dom";
import type { ActionState } from "@/actions/suppliers";
import { saveSupplier, updateSupplier } from "@/actions/suppliers";
import { Button, Input, Label, Textarea } from "@/components/ui/form";
import { VoiceDictationButton } from "@/components/admin/voice-dictation-button";
import { t } from "@/lib/i18n/translations";
import { useLang } from "@/lib/i18n/lang-context";

const initialState: ActionState = {};

interface Supplier {
  id: string;
  name: string;
  company_name: string | null;
  contact_person: string | null;
  phone_number: string | null;
  email: string | null;
  address: string | null;
  credit_limit: number | null;
  cnic_number: string | null;
  ntn_number: string | null;
  tax_status: string | null;
  bank_name: string | null;
  bank_account_title: string | null;
  bank_account_number: string | null;
  bank_iban: string | null;
}

export function SupplierForm({ editSupplier, onDoneEditing }: { editSupplier?: Supplier | null; onDoneEditing?: () => void }) {
  const action = editSupplier ? updateSupplier : saveSupplier;
  const [state, formAction] = useFormState(action, initialState);
  const lang = useLang();
  const nameRef = useRef<HTMLInputElement>(null);
  const contactRef = useRef<HTMLInputElement>(null);
  const phoneRef = useRef<HTMLInputElement>(null);

  if (state.success && editSupplier && onDoneEditing) {
    setTimeout(onDoneEditing, 800);
  }

  return (
    <div className="rounded-card border border-surface-200 bg-white p-5 shadow-card dark:border-surface-800 dark:bg-surface-900">
      <h2 className="mb-3 font-display text-base font-semibold text-surface-900 dark:text-white">{editSupplier ? "Edit Supplier" : "New Supplier"}</h2>
      {state.error && (
        <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-300">
          {state.error}
        </p>
      )}
      {state.success && (
        <p className="mb-3 rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-700">{t("c_saved", lang)}</p>
      )}
      <form action={formAction} encType="multipart/form-data" className="space-y-3">
        {editSupplier && <input type="hidden" name="id" value={editSupplier.id} />}
        <div>
          <Label htmlFor="supplier-name">Supplier Name *</Label>
          <div className="flex gap-2">
            <Input ref={nameRef} id="supplier-name" name="name" required defaultValue={editSupplier?.name} className="flex-1" />
            <VoiceDictationButton onResult={(text) => { if (nameRef.current) nameRef.current.value = text; }} />
          </div>
        </div>
        <div>
          <Label htmlFor="company_name">{t("su_company_name", lang)}</Label>
          <Input id="company_name" name="company_name" defaultValue={editSupplier?.company_name ?? ""} />
        </div>
        <div>
          <Label htmlFor="contact_person">{t("c_contact_person", lang)}</Label>
          <div className="flex gap-2">
            <Input ref={contactRef} id="contact_person" name="contact_person" defaultValue={editSupplier?.contact_person ?? ""} className="flex-1" />
            <VoiceDictationButton onResult={(text) => { if (contactRef.current) contactRef.current.value = text; }} />
          </div>
        </div>
        <div>
          <Label htmlFor="phone_number">{t("c_phone_number", lang)}</Label>
          <div className="flex gap-2">
            <Input ref={phoneRef} id="phone_number" name="phone_number" defaultValue={editSupplier?.phone_number ?? ""} className="flex-1" />
            <VoiceDictationButton onResult={(text) => { if (phoneRef.current) phoneRef.current.value = text; }} />
          </div>
        </div>
        <div>
          <Label htmlFor="email">{t("c_email", lang)}</Label>
          <Input id="email" name="email" type="email" defaultValue={editSupplier?.email ?? ""} />
        </div>
        <div>
          <Label htmlFor="address">{t("c_address", lang)}</Label>
          <Textarea id="address" name="address" rows={2} defaultValue={editSupplier?.address ?? ""} />
        </div>
        <div>
          <Label htmlFor="credit_limit">{t("su_credit_limit", lang)}</Label>
          <Input id="credit_limit" name="credit_limit" type="number" step="0.01" placeholder="0" defaultValue={editSupplier?.credit_limit ?? ""} />
        </div>

        <div className="border-t border-surface-100 pt-3 dark:border-surface-800">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-surface-400">{t("c_bank_details", lang)}</p>
          <div className="space-y-2">
            <div>
              <Label htmlFor="bank_name">{t("c_bank_name", lang)}</Label>
              <Input id="bank_name" name="bank_name" defaultValue={editSupplier?.bank_name ?? ""} />
            </div>
            <div>
              <Label htmlFor="bank_account_title">{t("c_account_title", lang)}</Label>
              <Input id="bank_account_title" name="bank_account_title" defaultValue={editSupplier?.bank_account_title ?? ""} />
            </div>
            <div>
              <Label htmlFor="bank_account_number">{t("c_account_number", lang)}</Label>
              <Input id="bank_account_number" name="bank_account_number" defaultValue={editSupplier?.bank_account_number ?? ""} />
            </div>
            <div>
              <Label htmlFor="bank_iban">IBAN</Label>
              <Input id="bank_iban" name="bank_iban" defaultValue={editSupplier?.bank_iban ?? ""} />
            </div>
          </div>
        </div>

        <div className="border-t border-surface-100 pt-3 dark:border-surface-800">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-surface-400">{t("su_legal_documents", lang)}</p>
          <div className="space-y-2">
            <div>
              <Label htmlFor="cnic_number">{t("su_cnic_number", lang)}</Label>
              <Input id="cnic_number" name="cnic_number" placeholder="XXXXX-XXXXXXX-X" defaultValue={editSupplier?.cnic_number ?? ""} />
            </div>
            <div>
              <Label htmlFor="cnic_document">{t("su_cnic_copy", lang)}</Label>
              <input type="file" id="cnic_document" name="cnic_document" accept="image/*,application/pdf" className="mt-1 w-full text-xs" />
            </div>
            <div>
              <Label htmlFor="ntn_number">{t("su_ntn_number", lang)}</Label>
              <Input id="ntn_number" name="ntn_number" defaultValue={editSupplier?.ntn_number ?? ""} />
            </div>
            <div>
              <Label htmlFor="ntn_document">{t("su_ntn_certificate", lang)}</Label>
              <input type="file" id="ntn_document" name="ntn_document" accept="image/*,application/pdf" className="mt-1 w-full text-xs" />
            </div>
            <div>
              <Label htmlFor="tax_status">{t("su_tax_status", lang)}</Label>
              <select id="tax_status" name="tax_status" defaultValue={editSupplier?.tax_status ?? "non_filer"} className="mt-1 w-full rounded-lg border border-surface-200 p-2 text-sm">
                <option value="filer">{t("su_filer", lang)}</option>
                <option value="non_filer">{t("su_non_filer", lang)}</option>
              </select>
            </div>
          </div>
        </div>

        <SubmitButton isEdit={!!editSupplier} />
        {editSupplier && onDoneEditing && (
          <button type="button" onClick={onDoneEditing} className="w-full rounded-lg border border-surface-200 py-2 text-sm text-surface-600 hover:bg-surface-50">{t("c_cancel", lang)}</button>
        )}
      </form>
    </div>
  );
}

function SubmitButton({ isEdit }: { isEdit: boolean }) {
  const { pending } = useFormStatus();
  return <Button type="submit" disabled={pending} className="w-full">{pending ? "Saving..." : isEdit ? "Update Supplier" : "Add Supplier"}</Button>;
}