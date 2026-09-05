import { createClient } from "@/lib/supabase/server";
import { PageHeader, EmptyState } from "@/components/ui/layout-primitives";
import { AddFarmerButton } from "@/app/admin/farmers/add-farmer-modal";
import { FarmersListClient } from "@/app/admin/farmers/farmers-list-client";
import { t } from "@/lib/i18n/translations";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";

export const dynamic = "force-dynamic";

export default async function AdminFarmersPage() {
  const lang = getLanguageFromCookies("rm");
  const supabase = createClient();
  const { data: farmers } = await supabase.from("farmers").select("*").eq("is_deleted", false).order("created_at", { ascending: false });

  return (
    <div>
      <PageHeader title={t("fp_farmers", lang)} description="Registrations from the public Farmer Registration form" actions={<AddFarmerButton />} />
      {!farmers || farmers.length === 0 ? (
        <EmptyState title={t("fp_none_registered", lang)} />
      ) : (
        <FarmersListClient farmers={farmers} />
      )}
    </div>
  );
}