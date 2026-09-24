import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/layout-primitives";
import { ShopsListClient } from "./shops-list-client";
import { t } from "@/lib/i18n/translations";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";

export const dynamic = "force-dynamic";

export default async function ShopsPage() {
  const lang = getLanguageFromCookies("rm");
  const supabase = createClient();

  const { data: rawShops } = await supabase
    .from("shops")
    .select("id, name, code, business_type, is_active, branches(name)")
    .order("created_at", { ascending: false });

  const { data: branches } = await supabase.from("branches").select("id, name").eq("is_active", true).order("name");

  const shops = (rawShops ?? []).map((s: any) => ({
    id: s.id,
    name: s.name,
    code: s.code,
    business_type: s.business_type,
    is_active: s.is_active,
    branch_name: Array.isArray(s.branches) ? s.branches[0]?.name : s.branches?.name,
  }));

  return (
    <div>
      <PageHeader title={t("at_shops", lang)} description="Har Branch ke andar business-type ke hisab se Shops manage karein (Karyana, Agri Inputs, Dairy, wagera)" />
      <ShopsListClient shops={shops} branches={branches ?? []} />
    </div>
  );
}