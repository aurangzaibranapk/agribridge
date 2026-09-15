import { Lock, MessageCircle } from "lucide-react";
import { t } from "@/lib/i18n/translations";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";

export function SubscriptionLockedScreen({ minimumAmount }: { minimumAmount: number }) {
  const lang = getLanguageFromCookies("ur");
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center px-4 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 text-amber-600">
        <Lock className="h-8 w-8" />
      </div>
      <h2 className="mt-4 font-display text-xl font-bold text-surface-900">{t("pm_subscription_needed", lang)}</h2>
      <p className="mx-auto mt-2 max-w-sm text-sm text-surface-500">{t("pm_subscription_msg", lang)}<span className="font-semibold text-brand-700">Rs {minimumAmount.toLocaleString()}</span>
      </p>
      <a href="https://wa.me/923331116727" target="_blank" rel="noreferrer" className="mt-6 flex items-center gap-2 rounded-lg bg-green-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-green-700">
        <MessageCircle className="h-4 w-4" />{t("pm_contact_whatsapp", lang)}</a>
    </div>
  );
}