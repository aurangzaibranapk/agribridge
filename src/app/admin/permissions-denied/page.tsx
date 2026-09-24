import { ShieldAlert } from "lucide-react";
import { t } from "@/lib/i18n/translations";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";

export const dynamic = "force-dynamic";

export default function PermissionsDeniedPage() {
  const lang = getLanguageFromCookies("rm");
  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-4 py-24 text-center">
      <ShieldAlert className="h-12 w-12 text-amber-500" />
      <h1 className="mt-4 font-display text-xl font-semibold text-surface-900">{t("at_no_access_yet", lang)}</h1>
      <p className="mt-2 text-sm text-surface-500">{t("at_no_pages_yet", lang)}</p>
    </div>
  );
}