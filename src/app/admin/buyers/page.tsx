import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/layout-primitives";
import { BuyerForm } from "@/app/admin/buyers/buyer-form";
import { BuyersListClient } from "./buyers-list-client";
import { t } from "@/lib/i18n/translations";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";
export const dynamic = "force-dynamic";
export default async function AdminBuyersPage() {
  const lang = getLanguageFromCookies("rm");
  const supabase = createClient();
  const { data: buyers } = await supabase.from("buyers").select("*").order("created_at", { ascending: false });
  return (
    <div>
      <PageHeader title={t("by_buyers", lang)} description="Companies/traders who purchase produce from farmers via the Marketplace" />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <BuyersListClient buyers={buyers ?? []} />
        </div>
        <BuyerForm />
      </div>
    </div>
  );
}