import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/layout-primitives";
import { ResetTestDataClient } from "./reset-test-data-client";
import { t } from "@/lib/i18n/translations";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";

export const dynamic = "force-dynamic";

export default async function ResetTestDataPage() {
  const lang = getLanguageFromCookies("rm");
  const supabase = createClient();
  const { data: liveSetting } = await supabase.from("platform_settings").select("value").eq("key", "is_live").maybeSingle();
  const isLive = liveSetting?.value === true || liveSetting?.value === "true";

  return (
    <div>
      <PageHeader title={t("at_reset_test_data", lang)} description="Testing ke dauran daala gaya data saaf karein - Products, Staff, Branches/Shops, Website Content aur Settings hamesha bache rahenge" />
      <ResetTestDataClient isLive={isLive} />
    </div>
  );
}