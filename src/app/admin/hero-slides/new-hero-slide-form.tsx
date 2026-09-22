"use client";
import { useFormState, useFormStatus } from "react-dom";
import { saveHeroSlide, type ActionState } from "@/actions/cms";
import { Button, Input, Label } from "@/components/ui/form";
import { t } from "@/lib/i18n/translations";
import { useLang } from "@/lib/i18n/lang-context";

const initialState: ActionState = {};

export function NewHeroSlideForm() {
  const [state, formAction] = useFormState(saveHeroSlide, initialState);
  const lang = useLang();
  return (
    <div className="rounded-card border border-surface-200 bg-white p-5 shadow-card dark:border-surface-800 dark:bg-surface-900">
      <h2 className="mb-3 font-display text-base font-semibold text-surface-900 dark:text-white">{t("hs_new_slide", lang)}</h2>
      {state.error && <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-300">{state.error}</p>}
      <form action={formAction} className="space-y-3">
        <div><Label htmlFor="image_url">{t("at_desktop_image_url", lang)}</Label><Input id="image_url" name="image_url" required placeholder="https://..." /></div>
        <div><Label htmlFor="mobile_image_url">{t("hs_mobile_url_note", lang)}</Label><Input id="mobile_image_url" name="mobile_image_url" placeholder="https://..." /></div>
        <div><Label htmlFor="headline">{t("at_headline_req", lang)}</Label><Input id="headline" name="headline" required /></div>
        <div><Label htmlFor="subheadline">{t("hs_subheadline", lang)}</Label><Input id="subheadline" name="subheadline" /></div>
        <div><Label htmlFor="cta_label">{t("c_button_text", lang)}</Label><Input id="cta_label" name="cta_label" placeholder={t("sh_browse_products", lang)} /></div>
        <div><Label htmlFor="cta_url">{t("c_button_link", lang)}</Label><Input id="cta_url" name="cta_url" placeholder="/products" /></div>
        <div><Label htmlFor="display_order">{t("hs_order", lang)}</Label><Input id="display_order" name="display_order" type="number" defaultValue={0} /></div>
        <SubmitButton />
      </form>
    </div>
  );
}
function SubmitButton() {
  const { pending } = useFormStatus();
  return <Button type="submit" disabled={pending} className="w-full">{pending ? "Adding..." : "Add Slide"}</Button>;
}