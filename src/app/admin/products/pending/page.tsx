import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/layout-primitives";
import { PendingClient } from "./pending-client";
import { t } from "@/lib/i18n/translations";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";
export const dynamic = "force-dynamic";
export default async function PendingProductsPage() {
  const lang = getLanguageFromCookies("rm");
  const supabase = createClient();
  const { data: rawProducts } = await supabase
    .from("products")
    .select("id, name, pack_size, purchase_price, categories(name), profiles(full_name)")
    .eq("is_verified", false)
    .eq("is_deleted", false)
    .order("created_at", { ascending: false });
  const products = (rawProducts ?? []).map((p: any) => ({
    id: p.id,
    name: p.name,
    pack_size: p.pack_size,
    purchase_price: Number(p.purchase_price),
    category_name: Array.isArray(p.categories) ? p.categories[0]?.name : p.categories?.name,
    proposer_name: Array.isArray(p.profiles) ? p.profiles[0]?.full_name : p.profiles?.full_name,
  }));
  return (
    <div>
      <PageHeader title={t("pd_pending_products", lang)} description="Staff ke proposed products - verify kar ke live karein (Admin ya jinke paas Can Approve permission hai)" />
      <PendingClient products={products} />
    </div>
  );
}