"use client";
import { useRef } from "react";
import { useFormState, useFormStatus } from "react-dom";
import type { ActionState } from "@/actions/suppliers";
import { saveSupplier, updateSupplier } from "@/actions/suppliers";
import { Button, Input, Label, Textarea } from "@/components/ui/form";
import { VoiceDictationButton } from "@/components/admin/voice-dictation-button";

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
        <p className="mb-3 rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-700">Save ho gaya.</p>
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
          <Label htmlFor="company_name">Company Name (Legal/Business Naam)</Label>
          <Input id="company_name" name="company_name" defaultValue={editSupplier?.company_name ?? ""} />
        </div>
        <div>
          <Label htmlFor="contact_person">Contact Person</Label>
          <div className="flex gap-2">
            <Input ref={contactRef} id="contact_person" name="contact_person" defaultValue={editSupplier?.contact_person ?? ""} className="flex-1" />
            <VoiceDictationButton onResult={(text) => { if (contactRef.current) contactRef.current.value = text; }} />
          </div>
        </div>
        <div>
          <Label htmlFor="phone_number">Phone Number</Label>
          <div className="flex gap-2">
            <Input ref={phoneRef} id="phone_number" name="phone_number" defaultValue={editSupplier?.phone_number ?? ""} className="flex-1" />
            <VoiceDictationButton onResult={(text) => { if (phoneRef.current) phoneRef.current.value = text; }} />
          </div>
        </div>
        <div>
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" defaultValue={editSupplier?.email ?? ""} />
        </div>
        <div>
          <Label htmlFor="address">Address</Label>
          <Textarea id="address" name="address" rows={2} defaultValue={editSupplier?.address ?? ""} />
        </div>
        <div>
          <Label htmlFor="credit_limit">Credit Limit (Rs.) - Supplier hamein kitna udhaar deta hai</Label>
          <Input id="credit_limit" name="credit_limit" type="number" step="0.01" placeholder="0" defaultValue={editSupplier?.credit_limit ?? ""} />
        </div>

        <div className="border-t border-surface-100 pt-3 dark:border-surface-800">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-surface-400">Bank Details (Payment ke liye)</p>
          <div className="space-y-2">
            <div>
              <Label htmlFor="bank_name">Bank Name</Label>
              <Input id="bank_name" name="bank_name" defaultValue={editSupplier?.bank_name ?? ""} />
            </div>
            <div>
              <Label htmlFor="bank_account_title">Account Title</Label>
              <Input id="bank_account_title" name="bank_account_title" defaultValue={editSupplier?.bank_account_title ?? ""} />
            </div>
            <div>
              <Label htmlFor="bank_account_number">Account Number</Label>
              <Input id="bank_account_number" name="bank_account_number" defaultValue={editSupplier?.bank_account_number ?? ""} />
            </div>
            <div>
              <Label htmlFor="bank_iban">IBAN</Label>
              <Input id="bank_iban" name="bank_iban" defaultValue={editSupplier?.bank_iban ?? ""} />
            </div>
          </div>
        </div>

        <div className="border-t border-surface-100 pt-3 dark:border-surface-800">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-surface-400">Legal Documents</p>
          <div className="space-y-2">
            <div>
              <Label htmlFor="cnic_number">CNIC Number</Label>
              <Input id="cnic_number" name="cnic_number" placeholder="XXXXX-XXXXXXX-X" defaultValue={editSupplier?.cnic_number ?? ""} />
            </div>
            <div>
              <Label htmlFor="cnic_document">CNIC Copy Upload</Label>
              <input type="file" id="cnic_document" name="cnic_document" accept="image/*,application/pdf" className="mt-1 w-full text-xs" />
            </div>
            <div>
              <Label htmlFor="ntn_number">NTN Number</Label>
              <Input id="ntn_number" name="ntn_number" defaultValue={editSupplier?.ntn_number ?? ""} />
            </div>
            <div>
              <Label htmlFor="ntn_document">NTN Certificate Upload</Label>
              <input type="file" id="ntn_document" name="ntn_document" accept="image/*,application/pdf" className="mt-1 w-full text-xs" />
            </div>
            <div>
              <Label htmlFor="tax_status">Tax Status</Label>
              <select id="tax_status" name="tax_status" defaultValue={editSupplier?.tax_status ?? "non_filer"} className="mt-1 w-full rounded-lg border border-surface-200 p-2 text-sm">
                <option value="filer">Filer (Tax pay kar raha hai)</option>
                <option value="non_filer">Non-Filer</option>
              </select>
            </div>
          </div>
        </div>

        <SubmitButton isEdit={!!editSupplier} />
        {editSupplier && onDoneEditing && (
          <button type="button" onClick={onDoneEditing} className="w-full rounded-lg border border-surface-200 py-2 text-sm text-surface-600 hover:bg-surface-50">Cancel</button>
        )}
      </form>
    </div>
  );
}

function SubmitButton({ isEdit }: { isEdit: boolean }) {
  const { pending } = useFormStatus();
  return <Button type="submit" disabled={pending} className="w-full">{pending ? "Saving..." : isEdit ? "Update Supplier" : "Add Supplier"}</Button>;
}