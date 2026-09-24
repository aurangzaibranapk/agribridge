"use client";

import { useFormState, useFormStatus } from "react-dom";
import { updateStaticPage, type ActionState } from "@/actions/cms";
import { Button, Input, Label, Textarea } from "@/components/ui/form";
import { t } from "@/lib/i18n/translations";
import { useLang } from "@/lib/i18n/lang-context";

const initialState: ActionState = {};

export function StaticPageForm({ page }: { page: any }) {
  const lang = useLang();
  const [state, formAction] = useFormState(updateStaticPage, initialState);
  return (
    <form action={formAction} className="max-w-2xl space-y-4 rounded-card border border-surface-200 bg-white p-6 shadow-card dark:border-surface-800 dark:bg-surface-900">
      <input type="hidden" name="slug" value={page.slug} />
      {state.error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-300">{state.error}</p>}
      {state.success && <p className="rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-700 dark:bg-brand-900/30 dark:text-brand-300">{t("at_saved", lang)}</p>}
      <div><Label htmlFor="title">{t("at_title", lang)}</Label><Input id="title" name="title" defaultValue={page.title} /></div>
      <div><Label htmlFor="content">{t("at_content", lang)}</Label><Textarea id="content" name="content" rows={16} defaultValue={page.content} /></div>
      <SubmitButton />
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return <Button type="submit" disabled={pending}>{pending ? "Saving..." : "Save Page"}</Button>;
}
