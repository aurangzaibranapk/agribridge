import { createClient } from "@/lib/supabase/server";
import { t } from "@/lib/i18n/translations";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";
import { PageHeader } from "@/components/ui/layout-primitives";
import { RoutesClient } from "./routes-client";
export const dynamic = "force-dynamic";
export default async function MilkRoutesPage() {
  const supabase = createClient();
  const lang = getLanguageFromCookies("rm");
  const { data: branches } = await supabase.from("branches").select("id, name").order("is_main_branch", { ascending: false }).order("name");
  const { data: rawEntries } = await supabase
    .from("milk_route_collections")
    .select("*, branches(name)")
    .order("collection_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(50);

  const entries = (rawEntries ?? []).map((e: any) => ({
    ...e,
    branch_name: Array.isArray(e.branches) ? e.branches[0]?.name : e.branches?.name,
  }));

  return (
    <div>
      <PageHeader title={t("mk_routes_title", lang)} description={t("mk_routes_subtitle", lang)} />
      <RoutesClient entries={entries} branches={branches ?? []} />
    </div>
  );
}