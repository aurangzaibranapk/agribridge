import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, Card } from "@/components/ui/layout-primitives";
import { BuyerEditForm } from "./buyer-edit-form";
import { t } from "@/lib/i18n/translations";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";
export const dynamic = "force-dynamic";
export default async function EditBuyerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const lang = getLanguageFromCookies("rm");
  const supabase = createClient();
  const { data: buyer } = await supabase.from("buyers").select("*").eq("id", id).single();
  if (!buyer) notFound();
  return (
    <div className="mx-auto max-w-xl">
      <PageHeader title={t("by_edit", lang)} description={buyer.business_name} />
      <Card>
        <BuyerEditForm buyer={buyer} />
      </Card>
    </div>
  );
}