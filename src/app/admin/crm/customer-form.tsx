"use client";
import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { saveCustomer, updateCustomer, type ActionState } from "@/actions/customers";
import { Button, Input, Label, Textarea } from "@/components/ui/form";
import { Plus, X } from "lucide-react";
import { t } from "@/lib/i18n/translations";
import { useLang } from "@/lib/i18n/lang-context";

const initialState: ActionState = {};

interface ExistingCustomer {
  id: string;
  name: string;
  contact_person: string | null;
  phone_number: string;
  email: string | null;
  address: string | null;
  credit_limit: number;
  payment_due_days: number;
}

export function AddCustomerButton() {
  const lang = useLang();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700"
      >
        <Plus className="h-4 w-4" />{t("at_add_customer", lang)}</button>
      {open && <CustomerModal onClose={() => setOpen(false)} />}
    </>
  );
}

export function EditCustomerButton({ customer }: { customer: ExistingCustomer }) {
  const lang = useLang();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="text-xs font-medium text-brand-600 hover:underline"
      >{t("at_edit", lang)}</button>
      {open && <CustomerModal customer={customer} onClose={() => setOpen(false)} />}
    </>
  );
}

function CustomerModal({ customer, onClose }: { customer?: ExistingCustomer; onClose: () => void }) {
  const isEditMode = !!customer;
  const lang = useLang();
  const [state, formAction] = useFormState(isEditMode ? updateCustomer : saveCustomer, initialState);

  if (state.success) {
    setTimeout(onClose, 800);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-card bg-white p-5 shadow-xl dark:bg-surface-900">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display text-base font-semibold text-surface-900 dark:text-white">
            {isEditMode ? "Edit Customer" : "New Customer"}
          </h3>
          <button onClick={onClose} className="text-surface-400 hover:text-surface-700 dark:hover:text-surface-200">
            <X className="h-5 w-5" />
          </button>
        </div>
        {state.error && (
          <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-300">
            {state.error}
          </p>
        )}
        {state.success && (
          <p className="mb-3 rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-700 dark:bg-brand-900/30 dark:text-brand-300">{t("at_saved", lang)}</p>
        )}
        <form action={formAction} className="space-y-3">
          {isEditMode && <input type="hidden" name="id" value={customer.id} />}
          <div>
            <Label>{t("at_customer_name_req", lang)}</Label>
            <Input name="name" defaultValue={customer?.name} required />
          </div>
          <div>
            <Label>{t("c_contact_person", lang)}</Label>
            <Input name="contact_person" defaultValue={customer?.contact_person ?? ""} />
          </div>
          <div>
            <Label>{t("at_phone_number_req", lang)}</Label>
            <Input name="phone_number" defaultValue={customer?.phone_number} required />
          </div>
          <div>
            <Label>{t("c_email", lang)}</Label>
            <Input name="email" type="email" defaultValue={customer?.email ?? ""} />
          </div>
          <div>
            <Label>{t("c_address", lang)}</Label>
            <Textarea name="address" rows={2} defaultValue={customer?.address ?? ""} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>{t("cr_credit_limit_dot", lang)}</Label>
              <Input name="credit_limit" type="number" step="0.01" defaultValue={customer?.credit_limit} />
            </div>
            <div>
              <Label>{t("cr_payment_due_days", lang)}</Label>
              <Input name="payment_due_days" type="number" defaultValue={customer?.payment_due_days} />
            </div>
          </div>
          <SubmitButton isEditMode={isEditMode} />
        </form>
      </div>
    </div>
  );
}

function SubmitButton({ isEditMode }: { isEditMode: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full">
      {pending ? "Saving..." : isEditMode ? "Save Changes" : "Add Customer"}
    </Button>
  );
}