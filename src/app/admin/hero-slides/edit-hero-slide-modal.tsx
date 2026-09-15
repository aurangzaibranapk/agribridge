"use client";
import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { updateHeroSlide, type ActionState } from "@/actions/cms";
import { Button, Input, Label } from "@/components/ui/form";
import { X, Pencil } from "lucide-react";
import { t } from "@/lib/i18n/translations";
import { useLang } from "@/lib/i18n/lang-context";

const initialState: ActionState = {};

interface Slide {
  id: string;
  image_url: string;
  mobile_image_url: string | null;
  headline: string;
  subheadline: string | null;
  cta_label: string | null;
  cta_url: string | null;
  display_order: number;
}

export function EditHeroSlideButton({ slide }: { slide: Slide }) {
  const lang = useLang();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)} className="flex items-center gap-1 rounded-lg border border-surface-200 px-2.5 py-1.5 text-xs font-medium text-surface-600 hover:bg-surface-50 dark:border-surface-700 dark:text-surface-300">
        <Pencil className="h-3.5 w-3.5" />{t("at_edit", lang)}</button>
      {open && <EditModal slide={slide} onClose={() => setOpen(false)} />}
    </>
  );
}

function EditModal({ slide, onClose }: { slide: Slide; onClose: () => void }) {
  const [state, formAction] = useFormState(updateHeroSlide, initialState);
  const lang = useLang();
  if (state.success) setTimeout(onClose, 700);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-card bg-white p-5 shadow-xl dark:bg-surface-900">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display text-base font-semibold text-surface-900 dark:text-white">{t("hs_edit_slide", lang)}</h3>
          <button onClick={onClose} className="text-surface-400 hover:text-surface-700"><X className="h-5 w-5" /></button>
        </div>
        {state.error && <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}
        {state.success && <p className="mb-3 rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-700">{t("c_updated", lang)}</p>}
        <form action={formAction} className="space-y-3">
          <input type="hidden" name="id" value={slide.id} />
          <div><Label htmlFor="edit_image_url">{t("at_desktop_image_url", lang)}</Label><Input id="edit_image_url" name="image_url" defaultValue={slide.image_url} required /></div>
          <div><Label htmlFor="edit_mobile_image_url">{t("hs_mobile_url_optional", lang)}</Label><Input id="edit_mobile_image_url" name="mobile_image_url" defaultValue={slide.mobile_image_url ?? ""} /></div>
          <div><Label htmlFor="edit_headline">{t("at_headline_req", lang)}</Label><Input id="edit_headline" name="headline" defaultValue={slide.headline} required /></div>
          <div><Label htmlFor="edit_subheadline">{t("hs_subheadline", lang)}</Label><Input id="edit_subheadline" name="subheadline" defaultValue={slide.subheadline ?? ""} /></div>
          <div><Label htmlFor="edit_cta_label">{t("c_button_text", lang)}</Label><Input id="edit_cta_label" name="cta_label" defaultValue={slide.cta_label ?? ""} /></div>
          <div><Label htmlFor="edit_cta_url">{t("c_button_link", lang)}</Label><Input id="edit_cta_url" name="cta_url" defaultValue={slide.cta_url ?? ""} /></div>
          <div><Label htmlFor="edit_display_order">{t("hs_order", lang)}</Label><Input id="edit_display_order" name="display_order" type="number" defaultValue={slide.display_order} /></div>
          <SubmitButton />
        </form>
      </div>
    </div>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return <Button type="submit" disabled={pending} className="w-full">{pending ? "Saving..." : "Update Karein"}</Button>;
}