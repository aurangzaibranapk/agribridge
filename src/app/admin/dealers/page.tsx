import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/layout-primitives";
import { DealersListClient } from "./dealers-list-client";
import { t } from "@/lib/i18n/translations";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";
export const dynamic = "force-dynamic";
export default async function AdminDealersPage() {
  const lang = getLanguageFromCookies("rm");
  const supabase = createClient();
  const { data: dealers } = await supabase
    .from("dealers")
    .select("*")
    .order("created_at", { ascending: false });

  const typedDealers = (dealers ?? []).map((d) => ({
    ...d,
    current_payable: d.current_payable ? Number(d.current_payable) : 0,
  }));

  return (
    <div>
      <PageHeader title={t("dl_dealers", lang)} description="Third-party dealer partners using AgriBridge's Bridge Order system" />
      <DealersListClient dealers={typedDealers} />
    </div>
  );
}