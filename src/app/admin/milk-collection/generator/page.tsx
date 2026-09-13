import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/layout-primitives";
import { GeneratorClient } from "./generator-client";
import { t } from "@/lib/i18n/translations";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";

export const dynamic = "force-dynamic";

export default async function GeneratorTrackerPage() {
  const lang = getLanguageFromCookies("rm");
  const supabase = createClient();
  const { data: branches } = await supabase.from("branches").select("id, name").order("is_main_branch", { ascending: false }).order("name");
  const { data: rawLogs } = await supabase
    .from("generator_logs")
    .select("id, log_date, hours_run, diesel_liters_purchased, diesel_cost, liters_per_hour, electricity_units, is_anomaly, meter_photo_url, branches(name)")
    .order("log_date", { ascending: false })
    .limit(50);

  const logs = (rawLogs ?? []).map((l: any) => ({
    id: l.id,
    log_date: l.log_date,
    hours_run: Number(l.hours_run),
    diesel_liters_purchased: l.diesel_liters_purchased ? Number(l.diesel_liters_purchased) : null,
    diesel_cost: l.diesel_cost ? Number(l.diesel_cost) : null,
    liters_per_hour: l.liters_per_hour ? Number(l.liters_per_hour) : null,
    electricity_units: l.electricity_units ? Number(l.electricity_units) : null,
    is_anomaly: l.is_anomaly,
    meter_photo_url: l.meter_photo_url,
    branch_name: Array.isArray(l.branches) ? l.branches[0]?.name : l.branches?.name,
  }));

  return (
    <div>
      <PageHeader title={t("mc_generator_title", lang)} description="Runtime hours vs diesel consumption, cost per hour" />
      <GeneratorClient logs={logs} branches={branches ?? []} />
    </div>
  );
}