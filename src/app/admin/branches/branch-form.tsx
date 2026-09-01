"use client";
import { useFormState, useFormStatus } from "react-dom";
import { saveBranch, type ActionState } from "@/actions/branches";
import { Button, Input, Label, Textarea } from "@/components/ui/form";
import { t } from "@/lib/i18n/translations";
import { useLang } from "@/lib/i18n/lang-context";

const initialState: ActionState = {};

export function BranchForm() {
  const [state, formAction] = useFormState(saveBranch, initialState);
  const lang = useLang();

  return (
    <div className="rounded-card border border-surface-200 bg-white p-5 shadow-card dark:border-surface-800 dark:bg-surface-900">
      <h2 className="mb-3 font-display text-base font-semibold text-surface-900 dark:text-white">{t("br_new_shop", lang)}</h2>
      {state.error && (
        <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-300">
          {state.error}
        </p>
      )}
      {state.success && (
        <p className="mb-3 rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-700 dark:bg-brand-900/30 dark:text-brand-300">{t("at_shop_added", lang)}</p>
      )}
      <form action={formAction} className="space-y-3">
        <div>
          <Label htmlFor="branch-name">{t("at_shop_name_req", lang)}</Label>
          <Input id="branch-name" name="name" required placeholder={t("br_name_eg", lang)} />
        </div>
        <div>
          <Label htmlFor="district">{t("c_district", lang)}</Label>
          <Input id="district" name="district" />
        </div>
        <div>
          <Label htmlFor="tehsil">{t("c_tehsil", lang)}</Label>
          <Input id="tehsil" name="tehsil" />
        </div>
        <div>
          <Label htmlFor="address">{t("c_address", lang)}</Label>
          <Textarea id="address" name="address" rows={2} />
        </div>
        <SubmitButton />
      </form>
    </div>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return <Button type="submit" disabled={pending} className="w-full">{pending ? "Adding..." : "Add Shop"}</Button>;
}