"use client";
import { useFormState, useFormStatus } from "react-dom";
import { onboardNewOrganization, type ActionState } from "@/actions/platform";
import { Button, Input, Label } from "@/components/ui/form";
import { t } from "@/lib/i18n/translations";
import { useLang } from "@/lib/i18n/lang-context";

const initialState: ActionState = {};

export function OnboardForm() {
  const [state, formAction] = useFormState(onboardNewOrganization, initialState);
  const lang = useLang();

  return (
    <div className="max-w-md rounded-card border border-surface-200 bg-white p-6 shadow-card dark:border-surface-800 dark:bg-surface-900">
      <h2 className="mb-4 font-display text-base font-semibold text-surface-900 dark:text-white">{t("pl_onboard", lang)}</h2>
      {state.error && (
        <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-300">
          {state.error}
        </p>
      )}
      {state.success && (
        <p className="mb-3 rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-700 dark:bg-brand-900/30 dark:text-brand-300">{t("pl_created", lang)}</p>
      )}
      <form action={formAction} className="space-y-3">
        <div>
          <Label htmlFor="org_name">{t("pl_company_name", lang)}</Label>
          <Input id="org_name" name="org_name" required placeholder={t("pl_company_eg", lang)} />
        </div>
        <div>
          <Label htmlFor="admin_name">{t("pl_admin_name", lang)}</Label>
          <Input id="admin_name" name="admin_name" required />
        </div>
        <div>
          <Label htmlFor="admin_email">{t("pl_admin_email", lang)}</Label>
          <Input id="admin_email" name="admin_email" type="email" required />
        </div>
        <div>
          <Label htmlFor="admin_phone">{t("pl_admin_phone", lang)}</Label>
          <Input id="admin_phone" name="admin_phone" />
        </div>
        <SubmitButton />
      </form>
      <p className="mt-3 text-xs text-surface-400">{t("pl_isolated_note", lang)}</p>
    </div>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return <Button type="submit" disabled={pending} className="w-full">{pending ? "Creating..." : "Create Organization & Invite Admin"}</Button>;
}