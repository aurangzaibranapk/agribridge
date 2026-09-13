"use client";

import { useFormState, useFormStatus } from "react-dom";
import { updateWebsiteSetting, type ActionState } from "@/actions/cms";
import { Input, Label, Button } from "@/components/ui/form";
import { t } from "@/lib/i18n/translations";
import { useLang } from "@/lib/i18n/lang-context";

const initialState: ActionState = {};

export function SettingRow({ settingKey, label, value }: { settingKey: string; label: string; value: string }) {
  const lang = useLang();
  const [state, formAction] = useFormState(updateWebsiteSetting, initialState);
  return (
    <form action={formAction} className="rounded-card border border-surface-200 bg-white p-4 shadow-card dark:border-surface-800 dark:bg-surface-900">
      <input type="hidden" name="key" value={settingKey} />
      <Label htmlFor={settingKey}>{label}</Label>
      <div className="flex gap-2">
        <Input id={settingKey} name="value" defaultValue={value} />
        <SubmitButton />
      </div>
      {state.success && <p className="mt-1 text-xs text-brand-600 dark:text-brand-400">{t("at_saved", lang)}</p>}
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return <Button type="submit" disabled={pending} size="sm" variant="secondary">{pending ? "..." : "Save"}</Button>;
}
