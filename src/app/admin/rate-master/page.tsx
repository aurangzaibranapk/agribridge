import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/layout-primitives";
import { RateMasterClient } from "@/app/admin/rate-master/rate-master-client";
import { t } from "@/lib/i18n/translations";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";

export const dynamic = "force-dynamic";

export default async function RateMasterPage() {
  const lang = getLanguageFromCookies("rm");
  const supabase = createClient();

  const [{ data: landPrep }, { data: labor }] = await Promise.all([
    supabase.from("land_prep_rates").select("id, activity_name, rate_per_acre").eq("is_active", true).order("activity_name"),
    supabase.from("labor_rates").select("id, labor_type, rate").eq("is_active", true).order("labor_type"),
  ]);

  return (
    <div>
      <PageHeader title={t("at_rate_master", lang)} description="Land Preparation aur Labor rates set karein - farmer expense form mein khud aa jayenge" />
      <RateMasterClient
        landPrepRates={(landPrep ?? []).map((r) => ({ id: r.id, name: r.activity_name, rate: Number(r.rate_per_acre) }))}
        laborRates={(labor ?? []).map((r) => ({ id: r.id, name: r.labor_type, rate: Number(r.rate) }))}
      />
    </div>
  );
}