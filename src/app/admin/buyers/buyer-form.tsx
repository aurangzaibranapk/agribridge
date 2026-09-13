"use client";
import { useFormState, useFormStatus } from "react-dom";
import { createBuyer, type ActionState } from "@/actions/buyers";
import { Button, Input, Label, Textarea } from "@/components/ui/form";
import { t } from "@/lib/i18n/translations";
import { useLang } from "@/lib/i18n/lang-context";
const initialState: ActionState = {};
export function BuyerForm() {
  const [state, formAction] = useFormState(createBuyer, initialState);
  const lang = useLang();
  return (
    <div className="rounded-card border border-surface-200 bg-white p-5 shadow-card dark:border-surface-800 dark:bg-surface-900">
      <h2 className="mb-3 font-display text-base font-semibold text-surface-900 dark:text-white">{t("by_new", lang)}</h2>
      {state.error && (
        <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-300">
          {state.error}
        </p>
      )}
      {state.success && (
        <p className="mb-3 rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-700 dark:bg-brand-900/30 dark:text-brand-300">{t("at_buyer_created", lang)}</p>
      )}
      <form action={formAction} className="space-y-3">
        <div>
          <Label>{t("at_business_name_req", lang)}</Label>
          <Input name="business_name" required placeholder={t("by_business_eg", lang)} />
        </div>
        <div>
          <Label>{t("c_contact_person", lang)}</Label>
          <Input name="contact_person" />
        </div>
        <div>
          <Label>{t("at_email_invite", lang)}</Label>
          <Input name="email" type="email" required />
        </div>
        <div>
          <Label>{t("at_phone_req", lang)}</Label>
          <Input name="phone_number" required />
        </div>
        <div>
          <Label>{t("c_address", lang)}</Label>
          <Textarea name="address" rows={2} />
        </div>

        <div className="border-t border-surface-100 pt-3 dark:border-surface-800">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-surface-400">{t("c_bank_details", lang)}</p>
          <div className="space-y-2">
            <div>
              <Label>{t("c_bank_name", lang)}</Label>
              <Input name="bank_name" />
            </div>
            <div>
              <Label>{t("c_account_title", lang)}</Label>
              <Input name="bank_account_title" />
            </div>
            <div>
              <Label>{t("c_account_number", lang)}</Label>
              <Input name="bank_account_number" />
            </div>
            <div>
              <Label>IBAN</Label>
              <Input name="bank_iban" />
            </div>
          </div>
        </div>

        <SubmitButton />
      </form>
    </div>
  );
}
function SubmitButton() {
  const { pending } = useFormStatus();
  return <Button type="submit" disabled={pending} className="w-full">{pending ? "Creating..." : "Create Buyer & Send Invite"}</Button>;
}