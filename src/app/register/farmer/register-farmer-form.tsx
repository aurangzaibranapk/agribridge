"use client";
import { useEffect } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { registerFarmer, type RegisterState } from "@/actions/registration";
import { Button, Input, Label } from "@/components/ui/form";
import { PasswordInput } from "@/components/ui/password-input";
import { createClient } from "@/lib/supabase/client";
import { t } from "@/lib/i18n/translations";
import { useLang } from "@/lib/i18n/lang-context";
const initialState: RegisterState = {};
export function RegisterFarmerForm() {
  const lang = useLang();
  const router = useRouter();
  const [state, formAction] = useFormState(registerFarmer, initialState);
  useEffect(() => {
    if (state.success) {
      router.push("/portal/dashboard");
      router.refresh();
    }
  }, [state.success, router]);
  async function handleOAuth(provider: "google" | "facebook") {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  }
  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <Link href="/" className="mb-4 inline-block text-sm text-surface-500 hover:text-brand-700">← Back to Website</Link>
      <h1 className="font-display text-2xl font-semibold text-surface-900">{t("au_register_farmer", lang)}</h1>
      <p className="mt-1 text-surface-500">{t("au_five_details", lang)}</p>
      <div className="mt-6 space-y-2">
        <button
          type="button"
          onClick={() => handleOAuth("google")}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-surface-200 bg-white px-4 py-2.5 text-sm font-medium text-surface-700 hover:bg-surface-50"
        >{t("au_with_google", lang)}</button>
        <button
          type="button"
          onClick={() => handleOAuth("facebook")}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#1877F2] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#166FE5]"
        >{t("au_with_facebook", lang)}</button>
      </div>
      <div className="my-6 flex items-center gap-3">
        <div className="h-px flex-1 bg-surface-200" />
        <span className="text-xs text-surface-400">{t("au_or_fill_form", lang)}</span>
        <div className="h-px flex-1 bg-surface-200" />
      </div>
      <form action={formAction} className="space-y-4 rounded-card border border-surface-200 bg-white p-6 shadow-card">
        {state.error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}
        <div>
          <Label htmlFor="full_name">{t("au_name_req", lang)}</Label>
          <Input id="full_name" name="full_name" required />
        </div>
        <div>
          <Label htmlFor="phone_number">{t("au_mobile_req", lang)}</Label>
          <Input id="phone_number" name="phone_number" required inputMode="tel" placeholder="03001234567" />
        </div>
        <div>
          <Label htmlFor="email">{t("au_email_req", lang)}</Label>
          <Input id="email" name="email" type="email" required placeholder={t("au_eg_email", lang)} />
        </div>
        <div>
          <Label htmlFor="password">{t("au_password_req", lang)}</Label>
          <PasswordInput id="password" name="password" required minLength={6} />
          <p className="mt-1 text-xs text-surface-400">{t("au_min_six", lang)}</p>
        </div>
        <div>
          <Label htmlFor="district">{t("au_district_req", lang)}</Label>
          <Input id="district" name="district" required placeholder={t("au_eg_district", lang)} />
        </div>
        <SubmitButton />
        <p className="text-center text-sm text-surface-500">{t("au_already_have", lang)}<Link href="/login" className="text-brand-700 hover:underline">{t("au_sign_in", lang)}</Link>
        </p>
      </form>
    </div>
  );
}
function SubmitButton() {
  const { pending } = useFormStatus();
  return <Button type="submit" disabled={pending} className="w-full">{pending ? "Creating account..." : "Register"}</Button>;
}