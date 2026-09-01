"use client";

import { useRef } from "react";
import { useFormState, useFormStatus } from "react-dom";
import type { ActionState } from "@/actions/taxonomy";
import { Button, Input, Label } from "@/components/ui/form";
import { VoiceDictationButton } from "@/components/admin/voice-dictation-button";
import { ImageUploadField } from "@/components/admin/image-upload-field";
import { t } from "@/lib/i18n/translations";
import { useLang } from "@/lib/i18n/lang-context";

const initialState: ActionState = {};

export function NewTaxonomyItemForm({ table, label, action }: { table: string; label: string; action: any }) {
  const lang = useLang();
  const [state, formAction] = useFormState(action, initialState);
  const nameRef = useRef<HTMLInputElement>(null);

  return (
    <div className="rounded-card border border-surface-200 bg-white p-5 shadow-card dark:border-surface-800 dark:bg-surface-900">
      <h2 className="mb-3 font-display text-base font-semibold text-surface-900 dark:text-white">New {label}</h2>
      {state.error && <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-300">{state.error}</p>}
      <form action={formAction} className="space-y-3">
        {table === "brands" && <ImageUploadField bucket="website-media" fieldName="logo_url" label={t("at_logo", lang)} />}
        <div>
          <Label htmlFor={`${table}-name`}>{label} Name *</Label>
          <div className="flex gap-2">
            <Input ref={nameRef} id={`${table}-name`} name="name" required className="flex-1" />
            <VoiceDictationButton onResult={(text) => { if (nameRef.current) nameRef.current.value = text; }} />
          </div>
        </div>
        <SubmitButton label={label} />
      </form>
    </div>
  );
}

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return <Button type="submit" disabled={pending} className="w-full">{pending ? "Adding..." : `Add ${label}`}</Button>;
}
