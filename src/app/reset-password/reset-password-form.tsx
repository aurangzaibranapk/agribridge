"use client";
import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { resetPasswordWithToken, type ActionState } from "@/actions/password-reset";
import { t } from "@/lib/i18n/translations";
import { useLang } from "@/lib/i18n/lang-context";

const initialState: ActionState = {};

export function ResetPasswordForm() {
  const lang = useLang();
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token") ?? "";
  const [state, formAction] = useFormState(resetPasswordWithToken, initialState);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const mismatch = confirmPassword.length > 0 && password !== confirmPassword;

  if (state.success) {
    setTimeout(() => router.push("/login"), 2000);
  }

  if (!token) {
    return (
      <div className="w-full max-w-sm rounded-card bg-white p-6 text-center shadow-card">
        <p className="text-sm text-red-700">{t("au_bad_link", lang)}</p>
        <Link href="/forgot-password" className="mt-3 inline-block text-sm font-medium text-brand-700 hover:underline">{t("au_forgot_password_page", lang)}</Link>
      </div>
    );
  }

  return (
    <div className="w-full max-w-sm rounded-card bg-white p-6 shadow-card">
      {state.success ? (
        <p className="rounded-lg bg-brand-50 px-4 py-3 text-center text-sm text-brand-700">{t("au_password_changed", lang)}</p>
      ) : (
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="token" value={token} />
          {state.error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}
          <div>
            <label className="text-sm font-medium text-surface-700">{t("au_new_password", lang)}</label>
            <input
              type="password"
              name="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t("au_min_six_chars", lang)}
              className="mt-1 w-full rounded-lg border border-surface-200 p-2.5 text-sm"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-surface-700">{t("au_confirm_password", lang)}</label>
            <input
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder={t("au_type_again", lang)}
              className="mt-1 w-full rounded-lg border border-surface-200 p-2.5 text-sm"
            />
            {mismatch && <p className="mt-1 text-xs text-red-600">{t("au_passwords_differ", lang)}</p>}
          </div>
          <SubmitButton disabled={mismatch} />
        </form>
      )}
    </div>
  );
}

function SubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending || disabled} className="w-full rounded-lg bg-brand-600 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60">
      {pending ? "Save ho raha hai..." : "Password Save Karein"}
    </button>
  );
}