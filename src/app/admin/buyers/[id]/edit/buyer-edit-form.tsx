"use client";
import { useFormState, useFormStatus } from "react-dom";
import { updateBuyer, type ActionState } from "@/actions/buyers";
import { Button, Input, Label, Textarea } from "@/components/ui/form";
import { t } from "@/lib/i18n/translations";
import { useLang } from "@/lib/i18n/lang-context";

const initialState: ActionState = {};

interface Buyer {
  id: string;
  business_name: string;
  contact_person: string | null;
  phone_number: string | null;
  address: string | null;
  bank_name: string | null;
  bank_account_title: string | null;
  bank_account_number: string | null;
  bank_iban: string | null;
}

export function BuyerEditForm({ buyer }: { buyer: Buyer }) {
  const [state, formAction] = useFormState(updateBuyer, initialState);
  const lang = useLang();

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="id" value={buyer.id} />
      {state.error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}
      {state.success && <p className="rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-700">{t("c_saved", lang)}</p>}

      <div>
        <Label htmlFor="business_name">{t("at_business_name_req", lang)}</Label>
        <Input id="business_name" name="business_name" required defaultValue={buyer.business_name} />
      </div>
      <div>
        <Label htmlFor="contact_person">{t("c_contact_person", lang)}</Label>
        <Input id="contact_person" name="contact_person" defaultValue={buyer.contact_person ?? ""} />
      </div>
      <div>
        <Label htmlFor="phone_number">{t("c_phone_number", lang)}</Label>
        <Input id="phone_number" name="phone_number" defaultValue={buyer.phone_number ?? ""} />
      </div>
      <div>
        <Label htmlFor="address">{t("c_address", lang)}</Label>
        <Textarea id="address" name="address" rows={2} defaultValue={buyer.address ?? ""} />
      </div>

      <div className="border-t border-surface-100 pt-3 dark:border-surface-800">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-surface-400">{t("c_bank_details", lang)}</p>
        <div className="space-y-2">
          <div>
            <Label htmlFor="bank_name">{t("c_bank_name", lang)}</Label>
            <Input id="bank_name" name="bank_name" defaultValue={buyer.bank_name ?? ""} />
          </div>
          <div>
            <Label htmlFor="bank_account_title">{t("c_account_title", lang)}</Label>
            <Input id="bank_account_title" name="bank_account_title" defaultValue={buyer.bank_account_title ?? ""} />
          </div>
          <div>
            <Label htmlFor="bank_account_number">{t("c_account_number", lang)}</Label>
            <Input id="bank_account_number" name="bank_account_number" defaultValue={buyer.bank_account_number ?? ""} />
          </div>
          <div>
            <Label htmlFor="bank_iban">IBAN</Label>
            <Input id="bank_iban" name="bank_iban" defaultValue={buyer.bank_iban ?? ""} />
          </div>
        </div>
      </div>

      <SubmitButton />
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return <Button type="submit" disabled={pending} className="w-full">{pending ? "Saving..." : "Save Changes"}</Button>;
}