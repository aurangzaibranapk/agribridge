import { createClient } from "@/lib/supabase/server";
import { t } from "@/lib/i18n/translations";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";
import { PageHeader } from "@/components/ui/layout-primitives";
import { SuppliersListClient } from "./suppliers-list-client";

export const dynamic = "force-dynamic";

export default async function AdminSuppliersPage() {
  const supabase = createClient();
  const lang = getLanguageFromCookies("rm");
  const { data: suppliers } = await supabase.from("suppliers").select("*").order("name");

  const typedSuppliers = (suppliers ?? []).map((s) => ({
    ...s,
    credit_limit: s.credit_limit ? Number(s.credit_limit) : 0,
    current_payable: s.current_payable ? Number(s.current_payable) : 0,
  }));

  return (
    <div>
      <PageHeader title={t("su_title", lang)} description={t("su_subtitle", lang)} />
      <SuppliersListClient suppliers={typedSuppliers} />
    </div>
  );
}