"use client";
import { useFormState, useFormStatus } from "react-dom";
import { updateDealer, type ActionState } from "@/actions/dealers";
import { Button, Input, Label } from "@/components/ui/form";
import { t } from "@/lib/i18n/translations";
import { useLang } from "@/lib/i18n/lang-context";

const initialState: ActionState = {};

interface Dealer {
  id: string;
  business_name: string;
  phone_number: string | null;
  district: string | null;
  tehsil: string | null;
  bank_name: string | null;
  bank_account_title: string | null;
  bank_account_number: string | null;
  bank_iban: string | null;
}

export function DealerEditForm({ dealer }: { dealer: Dealer }) {
  const [state, formAction] = useFormState(updateDealer, initialState);
  const lang = useLang();

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="id" value={dealer.id} />
      {state.error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}
      {state.success && <p className="rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-700">{t("c_saved", lang)}</p>}

      <div>
        <Label htmlFor="business_name">Business Name *</Label>
        <Input id="business_name" name="business_name" required defaultValue={dealer.business_name} />
      </div>
      <div>
        <Label htmlFor="phone_number">{t("c_phone_number", lang)}</Label>
        <Input id="phone_number" name="phone_number" defaultValue={dealer.phone_number ?? ""} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="district">{t("c_district", lang)}</Label>
          <Input id="district" name="district" defaultValue={dealer.district ?? ""} />
        </div>
        <div>
          <Label htmlFor="tehsil">{t("c_tehsil", lang)}</Label>
          <Input id="tehsil" name="tehsil" defaultValue={dealer.tehsil ?? ""} />
        </div>
      </div>

      <div className="border-t border-surface-100 pt-3 dark:border-surface-800">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-surface-400">{t("c_bank_details", lang)}</p>
        <div className="space-y-2">
          <div>
            <Label htmlFor="bank_name">{t("c_bank_name", lang)}</Label>
            <Input id="bank_name" name="bank_name" defaultValue={dealer.bank_name ?? ""} />
          </div>
          <div>
            <Label htmlFor="bank_account_title">{t("c_account_title", lang)}</Label>
            <Input id="bank_account_title" name="bank_account_title" defaultValue={dealer.bank_account_title ?? ""} />
          </div>
          <div>
            <Label htmlFor="bank_account_number">{t("c_account_number", lang)}</Label>
            <Input id="bank_account_number" name="bank_account_number" defaultValue={dealer.bank_account_number ?? ""} />
          </div>
          <div>
            <Label htmlFor="bank_iban">IBAN</Label>
            <Input id="bank_iban" name="bank_iban" defaultValue={dealer.bank_iban ?? ""} />
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