import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/layout-primitives";
import { MaintenanceClient } from "./maintenance-client";

export const dynamic = "force-dynamic";

export default async function MaintenancePage() {
  const supabase = createClient();

  const { data: rawVehicles } = await supabase
    .from("vehicles")
    .select("id, vehicle_name, last_service_km, service_interval_km")
    .eq("is_active", true)
    .order("vehicle_name");

  // Current KM = latest closing_km from fuel_logs for each vehicle.
  const { data: latestKm } = await supabase
    .from("fuel_logs")
    .select("vehicle_id, closing_km, log_date")
    .order("log_date", { ascending: false });

  const currentKmMap = new Map<string, number>();
  (latestKm ?? []).forEach((l) => {
    if (!currentKmMap.has(l.vehicle_id)) currentKmMap.set(l.vehicle_id, Number(l.closing_km));
  });

  const vehicles = (rawVehicles ?? []).map((v) => ({
    id: v.id,
    vehicle_name: v.vehicle_name,
    last_service_km: Number(v.last_service_km),
    service_interval_km: Number(v.service_interval_km),
    current_km: currentKmMap.get(v.id) ?? Number(v.last_service_km),
  }));

  const { data: rawLogs } = await supabase
    .from("maintenance_logs")
    .select("id, service_date, description, cost, km_at_service, vehicles(vehicle_name)")
    .order("service_date", { ascending: false })
    .limit(50);

  const logs = (rawLogs ?? []).map((l: any) => ({
    id: l.id,
    service_date: l.service_date,
    description: l.description,
    cost: Number(l.cost),
    km_at_service: Number(l.km_at_service),
    vehicle_name: Array.isArray(l.vehicles) ? l.vehicles[0]?.vehicle_name : l.vehicles?.vehicle_name,
  }));

  const { data: fundSettings } = await supabase.from("replacement_fund_settings").select("monthly_contribution, fund_start_date").limit(1).single();
  const monthlyContribution = Number(fundSettings?.monthly_contribution ?? 25000);
  const startDate = fundSettings?.fund_start_date ? new Date(fundSettings.fund_start_date) : new Date();
  const now = new Date();
  const monthsElapsed = Math.max(0, (now.getFullYear() - startDate.getFullYear()) * 12 + (now.getMonth() - startDate.getMonth()));
  const totalContributed = monthsElapsed * monthlyContribution;

  const { data: withdrawals } = await supabase.from("replacement_fund_withdrawals").select("amount");
  const totalWithdrawn = (withdrawals ?? []).reduce((sum, w) => sum + Number(w.amount), 0);
  const fundBalance = totalContributed - totalWithdrawn;

  return (
    <div>
      <PageHeader title="Fleet & Maintenance" description="Service reminders, maintenance costs, and motorcycle replacement fund" />
      <MaintenanceClient vehicles={vehicles} logs={logs} fundBalance={fundBalance} monthlyContribution={monthlyContribution} />
    </div>
  );
}