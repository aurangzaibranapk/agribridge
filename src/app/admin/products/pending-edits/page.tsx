import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/layout-primitives";
import { PendingEditsClient } from "./pending-edits-client";
import { t } from "@/lib/i18n/translations";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";
import { ProductSetupTabs } from "@/components/products/setup-tabs";
export const dynamic = "force-dynamic";

export default async function PendingEditsPage() {
  const lang = getLanguageFromCookies("rm");
  const supabase = createClient();
  const { data: rawRequests } = await supabase
    .from("product_edit_requests")
    .select("id, created_at, product_id, changes, products(name), profiles(full_name)")
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  const requests = (rawRequests ?? []).map((r: any) => {
    const product = Array.isArray(r.products) ? r.products[0] : r.products;
    const proposer = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles;
    return {
      id: r.id,
      created_at: r.created_at,
      product_name: product?.name ?? "Unknown Product",
      proposer_name: proposer?.full_name ?? "-",
      changes: r.changes as Record<string, unknown>,
    };
  });

  return (
    <div>
      <PageHeader title={t("pd_pending_edits", lang)} description="Staff ke proposed edits - verify kar ke live karein" />
      <ProductSetupTabs current="edits" lang={lang} />
      <PendingEditsClient requests={requests} />
    </div>
  );
}