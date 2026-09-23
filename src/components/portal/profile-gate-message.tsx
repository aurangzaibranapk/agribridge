import Link from "next/link";
import { UserCircle } from "lucide-react";
import { t } from "@/lib/i18n/translations";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";

export function ProfileGateMessage() {
  const lang = getLanguageFromCookies("ur");
  return (
    <div className="mx-auto max-w-lg px-4 py-16 text-center">
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-amber-50 text-amber-600">
        <UserCircle className="h-7 w-7" />
      </div>
      <h1 className="font-display text-xl font-semibold text-surface-900">{t("pm_profile_gate_title", lang)}</h1>
      <p className="mt-3 text-sm text-surface-600">{t("pm_profile_gate_msg", lang)}</p>
      <Link
        href="/portal/profile"
        className="mt-6 inline-block rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-700"
      >{t("pm_profile_complete_btn", lang)}</Link>
    </div>
  );
}