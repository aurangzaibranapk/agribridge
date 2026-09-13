"use client";

import { useFormState, useFormStatus } from "react-dom";
import { saveGalleryItem, type ActionState } from "@/actions/cms";
import { Button, Input, Label, Select } from "@/components/ui/form";
import { t } from "@/lib/i18n/translations";
import { useLang } from "@/lib/i18n/lang-context";

const initialState: ActionState = {};

export function NewGalleryItemForm() {
  const [state, formAction] = useFormState(saveGalleryItem, initialState);
  const lang = useLang();
  return (
    <div className="rounded-card border border-surface-200 bg-white p-5 shadow-card dark:border-surface-800 dark:bg-surface-900">
      <h2 className="mb-3 font-display text-base font-semibold text-surface-900 dark:text-white">{t("gl_add_item", lang)}</h2>
      <p className="mb-3 text-xs text-surface-400 dark:text-surface-500">{t("gl_upload_first", lang)}</p>
      {state.error && <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-300">{state.error}</p>}
      <form action={formAction} className="space-y-3">
        <div>
          <Label htmlFor="type">{t("c_type", lang)}</Label>
          <Select id="type" name="type" defaultValue="photo">
            <option value="photo">{t("c_photo", lang)}</option>
            <option value="video">{t("gl_video", lang)}</option>
          </Select>
        </div>
        <div><Label htmlFor="url">{t("gl_file_url", lang)}</Label><Input id="url" name="url" required placeholder="https://..." /></div>
        <div><Label htmlFor="caption">{t("gl_caption", lang)}</Label><Input id="caption" name="caption" /></div>
        <div>
          <Label htmlFor="category">{t("c_category", lang)}</Label>
          <Select id="category" name="category" defaultValue="Farms">
            <option value="Events">{t("gl_events", lang)}</option>
            <option value="Farms">{t("c_farms", lang)}</option>
            <option value="Products">{t("c_products", lang)}</option>
            <option value="Team">{t("c_team", lang)}</option>
          </Select>
        </div>
        <SubmitButton />
      </form>
    </div>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return <Button type="submit" disabled={pending} className="w-full">{pending ? "Adding..." : "Add to Gallery"}</Button>;
}
