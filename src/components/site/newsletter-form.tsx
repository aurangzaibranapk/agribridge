"use client";

import { useEffect, useRef } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { subscribeNewsletter, type FormState } from "@/actions/public-forms";
import { Input, Button } from "@/components/ui/form";
import { t } from "@/lib/i18n/translations";
import { useLang } from "@/lib/i18n/lang-context";

const initialState: FormState = {};

export function NewsletterForm() {
  const lang = useLang();
  const [state, formAction] = useFormState(subscribeNewsletter, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.success) formRef.current?.reset();
  }, [state.success]);

  return (
    <div>
      <form ref={formRef} action={formAction} className="flex flex-col gap-2 sm:flex-row sm:justify-center">
        <Input name="email" type="email" placeholder={t("sp_eg_email", lang)} required className="sm:w-64" />
        <SubmitButton />
      </form>
      {state.error && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{state.error}</p>}
      {state.success && <p className="mt-2 text-sm text-brand-600 dark:text-brand-400">{t("sp_subscribed", lang)}</p>}
    </div>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return <Button type="submit" disabled={pending}>{pending ? "..." : "Subscribe"}</Button>;
}
