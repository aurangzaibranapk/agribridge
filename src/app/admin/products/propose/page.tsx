import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/layout-primitives";
import { ProposeForm } from "./propose-form";
import { t } from "@/lib/i18n/translations";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";
import { ProductSetupTabs } from "@/components/products/setup-tabs";

export const dynamic = "force-dynamic";

export default async function ProposeProductPage() {
  const lang = getLanguageFromCookies("rm");
  const supabase = createClient();
  const { data: categories } = await supabase.from("categories").select("id, name").order("name");

  return (
    <div>
      <PageHeader title={t("pd_propose_new", lang)} description="Main Warehouse Catalog ke liye - admin verify karega ke baad live hoga" />
      <ProductSetupTabs current="propose" lang={lang} />
      <ProposeForm categories={categories ?? []} />
    </div>
  );
}