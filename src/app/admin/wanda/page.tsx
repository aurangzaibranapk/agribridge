import { CategoryDashboard } from "@/app/admin/category-dashboard";
import { t } from "@/lib/i18n/translations";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";

export const dynamic = "force-dynamic";

export default async function WandaPage() {
  const lang = getLanguageFromCookies("rm");
  return <CategoryDashboard categoryName="Animal Feed (Wanda)" title={t("at_feed", lang)} />;
}