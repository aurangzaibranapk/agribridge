import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/layout-primitives";
import { ResetTestDataClient } from "./reset-test-data-client";

export const dynamic = "force-dynamic";

export default async function ResetTestDataPage() {
  const supabase = createClient();
  const { data: liveSetting } = await supabase.from("platform_settings").select("value").eq("key", "is_live").maybeSingle();
  const isLive = liveSetting?.value === true || liveSetting?.value === "true";

  return (
    <div>
      <PageHeader title="Reset Test Data" description="Testing ke dauran daala gaya data saaf karein - Products, Staff, Branches/Shops, Website Content aur Settings hamesha bache rahenge" />
      <ResetTestDataClient isLive={isLive} />
    </div>
  );
}