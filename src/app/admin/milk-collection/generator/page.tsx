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
    .select("id, log_date, hours_run, diesel_liters_purchased, diesel_cost, diesel_rate_per_liter, expected_diesel_liters, diesel_variance_liters, liters_per_hour, electricity_units, is_anomaly, approval_status, approval_comment, meter_photo_url, opening_meter_photo_url, closing_meter_photo_url, branches(name)")
    .order("log_date", { ascending: false })
    .limit(500);

  const logs = (rawLogs ?? []).map((l: any) => ({
    id: l.id,
    log_date: l.log_date,
    hours_run: Number(l.hours_run),
    diesel_liters_purchased: l.diesel_liters_purchased ? Number(l.diesel_liters_purchased) : null,
    diesel_cost: l.diesel_cost ? Number(l.diesel_cost) : null,
    diesel_rate_per_liter: l.diesel_rate_per_liter ? Number(l.diesel_rate_per_liter) : null,
    expected_diesel_liters: l.expected_diesel_liters ? Number(l.expected_diesel_liters) : null,
    diesel_variance_liters: l.diesel_variance_liters ? Number(l.diesel_variance_liters) : null,
    approval_status: l.approval_status ?? "approved",
    approval_comment: l.approval_comment,
    liters_per_hour: l.liters_per_hour ? Number(l.liters_per_hour) : null,
    electricity_units: l.electricity_units ? Number(l.electricity_units) : null,
    is_anomaly: l.is_anomaly,
    meter_photo_url: l.meter_photo_url,
    opening_meter_photo_url: l.opening_meter_photo_url,
    closing_meter_photo_url: l.closing_meter_photo_url,
    branch_name: Array.isArray(l.branches) ? l.branches[0]?.name : l.branches?.name,
  }));

  const start = (days: number) => new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
  const today = new Date().toISOString().slice(0, 10);
  const summary = {
    todayHours: logs.filter((l) => l.log_date === today).reduce((s, l) => s + l.hours_run, 0),
    todayCost: logs.filter((l) => l.log_date === today).reduce((s, l) => s + (l.diesel_cost ?? 0), 0),
    weekLiters: logs.filter((l) => l.log_date >= start(7)).reduce((s, l) => s + (l.diesel_liters_purchased ?? 0), 0),
    weekCost: logs.filter((l) => l.log_date >= start(7)).reduce((s, l) => s + (l.diesel_cost ?? 0), 0),
    fifteenLiters: logs.filter((l) => l.log_date >= start(15)).reduce((s, l) => s + (l.diesel_liters_purchased ?? 0), 0),
    fifteenCost: logs.filter((l) => l.log_date >= start(15)).reduce((s, l) => s + (l.diesel_cost ?? 0), 0),
    monthLiters: logs.filter((l) => l.log_date >= start(30)).reduce((s, l) => s + (l.diesel_liters_purchased ?? 0), 0),
    pending: logs.filter((l) => l.approval_status === "pending").length,
    anomalies: logs.filter((l) => l.is_anomaly || Math.abs(l.diesel_variance_liters ?? 0) > 0.5).length,
  };

  return (
    <div>
      <PageHeader title={t("mc_generator_title", lang)} description="Runtime hours vs diesel consumption, cost per hour" />
      <GeneratorClient logs={logs} branches={branches ?? []} summary={summary} />
    </div>
  );
}
