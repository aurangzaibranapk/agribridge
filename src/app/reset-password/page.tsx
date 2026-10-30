import { Suspense } from "react";
import Link from "next/link";
import { ResetPasswordForm } from "./reset-password-form";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";
import { LangProvider } from "@/lib/i18n/lang-context";
import { t } from "@/lib/i18n/translations";
import { BrandMark } from "@/components/brand/brand-mark";
import { BRAND_NAME } from "@/lib/brand";

export const dynamic = "force-dynamic";

/**
 * LangProvider yahan lagta hai, root layout par nahi. Root layout
 * poori website ka hai; wahan cookies() parhne se har safha dynamic ho
 * jata aur public website ka static rendering khatam ho jata. Login ke
 * safhe khud dynamic hain, is liye qeemat sirf yahin ada hoti hai.
 *
 * Is ke baghair andar wala form useLang() se hamesha default zaban leta
 * -- safha tarjuma shuda lagta, magar Urdu chunne wale bande ko phir
 * bhi Roman milta.
 */
export default function ResetPasswordPage() {
  const lang = getLanguageFromCookies("ur");
  return (
    <LangProvider lang={lang}>
    <div className="flex min-h-screen items-center justify-center bg-brand-900 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <Link href="/" aria-label={BRAND_NAME} className="mx-auto mb-3 flex h-12 w-12 items-center justify-center"><BrandMark className="h-12 w-12" /></Link>
          <p className="font-display text-lg font-semibold text-white">{BRAND_NAME}</p>
          <h1 className="font-display text-xl font-semibold text-white">{t("au_set_new_password", lang)}</h1>
        </div>
        <Suspense fallback={<div className="rounded-card bg-white p-6 text-center text-sm text-surface-500">{t("au_loading", lang)}</div>}>
          <ResetPasswordForm />
        </Suspense>
      </div>
    </div>
    </LangProvider>
  );
}
