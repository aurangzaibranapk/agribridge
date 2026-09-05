"use client";
import { useFormState, useFormStatus } from "react-dom";
import Link from "next/link";
import { requestPasswordReset, type ActionState } from "@/actions/password-reset";
import { t } from "@/lib/i18n/translations";
import { useLang } from "@/lib/i18n/lang-context";

const initialState: ActionState = {};

export function ForgotPasswordForm() {
  const lang = useLang();
  const [state, formAction] = useFormState(requestPasswordReset, initialState);

  return (
    <div className="flex min-h-screen items-center justify-center bg-brand-900 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <Link href="/" className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-white text-lg font-bold text-brand-700">{t("au_ar", lang)}</Link>
          <h1 className="font-display text-xl font-semibold text-white">{t("au_reset_password", lang)}</h1>
        </div>

        <div className="rounded-card bg-white p-6 shadow-card">
          {state.success ? (
            <div className="text-center">
              <p className="mb-3 rounded-lg bg-brand-50 px-4 py-3 text-sm text-brand-700">{t("au_reset_sent", lang)}</p>
              <Link href="/login" className="text-sm font-medium text-brand-700 hover:underline">{t("au_back_to_login", lang)}</Link>
            </div>
          ) : (
            <form action={formAction} className="space-y-4">
              {state.error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}
              <div>
                <label className="text-sm font-medium text-surface-700">{t("c_email", lang)}</label>
                <input type="email" name="email" required placeholder={t("au_eg_email", lang)} className="mt-1 w-full rounded-lg border border-surface-200 p-2.5 text-sm" />
              </div>
              <SubmitButton />
              <p className="text-center text-sm text-surface-500">
                <Link href="/login" className="font-medium text-brand-700 hover:underline">{t("au_back_to_login", lang)}</Link>
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="w-full rounded-lg bg-brand-600 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60">
      {pending ? "Bheja ja raha hai..." : "Reset Link Bhejein"}
    </button>
  );
}