"use client";

import { useFormState, useFormStatus } from "react-dom";
import { saveTestimonial, type ActionState } from "@/actions/cms";
import { Button, Input, Label, Textarea } from "@/components/ui/form";
import { t } from "@/lib/i18n/translations";
import { useLang } from "@/lib/i18n/lang-context";

const initialState: ActionState = {};

export function NewTestimonialForm() {
  const [state, formAction] = useFormState(saveTestimonial, initialState);
  const lang = useLang();
  return (
    <div className="rounded-card border border-surface-200 bg-white p-5 shadow-card dark:border-surface-800 dark:bg-surface-900">
      <h2 className="mb-3 font-display text-base font-semibold text-surface-900 dark:text-white">{t("ts_new", lang)}</h2>
      {state.error && <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-300">{state.error}</p>}
      <form action={formAction} className="space-y-3">
        <div><Label htmlFor="customer_name">{t("ts_name_req", lang)}</Label><Input id="customer_name" name="customer_name" required /></div>
        <div><Label htmlFor="location">{t("c_location", lang)}</Label><Input id="location" name="location" placeholder={t("ts_location_eg", lang)} /></div>
        <div><Label htmlFor="quote">{t("ts_quote_req", lang)}</Label><Textarea id="quote" name="quote" rows={3} required /></div>
        <div><Label htmlFor="rating">{t("ts_rating", lang)}</Label><Input id="rating" name="rating" type="number" min={1} max={5} defaultValue={5} /></div>
        <div><Label htmlFor="image_url">{t("ts_photo_url", lang)}</Label><Input id="image_url" name="image_url" placeholder="https://..." /></div>
        <label className="flex items-center gap-2 text-sm text-surface-700 dark:text-surface-300">
          <input type="checkbox" name="is_published" defaultChecked />{t("c_published", lang)}</label>
        <SubmitButton />
      </form>
    </div>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return <Button type="submit" disabled={pending} className="w-full">{pending ? "Adding..." : "Add Testimonial"}</Button>;
}
