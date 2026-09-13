import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, Card } from "@/components/ui/layout-primitives";
import { DealerEditForm } from "./dealer-edit-form";
import { t } from "@/lib/i18n/translations";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";
export const dynamic = "force-dynamic";
export default async function EditDealerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const lang = getLanguageFromCookies("rm");
  const supabase = createClient();
  const { data: dealer } = await supabase.from("dealers").select("*").eq("id", id).single();
  if (!dealer) notFound();
  return (
    <div className="mx-auto max-w-xl">
      <PageHeader title={t("dl_edit", lang)} description={dealer.business_name} />
      <Card>
        <DealerEditForm dealer={dealer} />
      </Card>
    </div>
  );
}