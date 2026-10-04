import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/layout-primitives";
import { FuelClient } from "./fuel-client";
import { t } from "@/lib/i18n/translations";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";

export const dynamic = "force-dynamic";

export default async function FuelTrackerPage() {
  const lang = getLanguageFromCookies("rm");
  const supabase = createClient();
  const { data: branches } = await supabase.from("branches").select("id, name").order("is_main_branch", { ascending: false }).order("name");
  const { data: vehicles } = await supabase
    .from("vehicles")
    .select("id, vehicle_name, registration_no, assigned_rider, expected_km_per_liter, branches(name)")
    .eq("is_active", true)
    .order("vehicle_name");
  const { data: rawLogs } = await supabase
    .from("fuel_logs")
    .select("id, log_date, opening_km, closing_km, km_travelled, fuel_liters_purchased, fuel_cost, petrol_rate_per_liter, expected_fuel_liters, fuel_variance_liters, km_per_liter, fuel_cost_per_liter_milk, is_anomaly, approval_status, approval_comment, meter_photo_url, opening_meter_photo_url, closing_meter_photo_url, vehicles(vehicle_name, registration_no, assigned_rider)")
    .order("log_date", { ascending: false })
    .limit(500);
  const { data: rateSettings } = await supabase
    .from("fuel_rate_settings")
    .select("petrol_rate, diesel_rate, margin, generator_expected_hours_per_liter")
    .limit(1)
    .single();

  const logs = (rawLogs ?? []).map((l: any) => ({
    id: l.id,
    log_date: l.log_date,
    opening_km: Number(l.opening_km),
    closing_km: Number(l.closing_km),
    km_travelled: Number(l.km_travelled),
    fuel_liters_purchased: l.fuel_liters_purchased ? Number(l.fuel_liters_purchased) : null,
    fuel_cost: l.fuel_cost ? Number(l.fuel_cost) : null,
    petrol_rate_per_liter: l.petrol_rate_per_liter ? Number(l.petrol_rate_per_liter) : null,
    expected_fuel_liters: l.expected_fuel_liters ? Number(l.expected_fuel_liters) : null,
    fuel_variance_liters: l.fuel_variance_liters ? Number(l.fuel_variance_liters) : null,
    approval_status: l.approval_status ?? "approved",
    approval_comment: l.approval_comment,
    km_per_liter: l.km_per_liter ? Number(l.km_per_liter) : null,
    fuel_cost_per_liter_milk: l.fuel_cost_per_liter_milk ? Number(l.fuel_cost_per_liter_milk) : null,
    is_anomaly: l.is_anomaly,
    meter_photo_url: l.meter_photo_url,
    opening_meter_photo_url: l.opening_meter_photo_url,
    closing_meter_photo_url: l.closing_meter_photo_url,
    vehicle_name: Array.isArray(l.vehicles) ? l.vehicles[0]?.vehicle_name : l.vehicles?.vehicle_name,
  }));

  const start = (days: number) => new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
  const today = new Date().toISOString().slice(0, 10);
  const summary = {
    todayKm: logs.filter((l) => l.log_date === today).reduce((s, l) => s + l.km_travelled, 0),
    todayCost: logs.filter((l) => l.log_date === today).reduce((s, l) => s + (l.fuel_cost ?? 0), 0),
    weekLiters: logs.filter((l) => l.log_date >= start(7)).reduce((s, l) => s + (l.fuel_liters_purchased ?? 0), 0),
    weekCost: logs.filter((l) => l.log_date >= start(7)).reduce((s, l) => s + (l.fuel_cost ?? 0), 0),
    fifteenLiters: logs.filter((l) => l.log_date >= start(15)).reduce((s, l) => s + (l.fuel_liters_purchased ?? 0), 0),
    fifteenCost: logs.filter((l) => l.log_date >= start(15)).reduce((s, l) => s + (l.fuel_cost ?? 0), 0),
    monthLiters: logs.filter((l) => l.log_date >= start(30)).reduce((s, l) => s + (l.fuel_liters_purchased ?? 0), 0),
    pending: logs.filter((l) => l.approval_status === "pending").length,
    anomalies: logs.filter((l) => l.is_anomaly || Math.abs(l.fuel_variance_liters ?? 0) > 0.5).length,
  };

  const vehiclesTyped = (vehicles ?? []).map((v: any) => ({
    id: v.id,
    vehicle_name: v.vehicle_name,
    registration_no: v.registration_no,
    assigned_rider: v.assigned_rider,
    expected_km_per_liter: Number(v.expected_km_per_liter),
    branch_name: Array.isArray(v.branches) ? v.branches[0]?.name : v.branches?.name,
  }));

  return (
    <div>
      <PageHeader title={t("mc_fuel_title", lang)} description="Motorcycle mileage, fuel cost per litre of milk collected" />
      <FuelClient
        vehicles={vehiclesTyped}
        logs={logs}
        branches={branches ?? []}
        rateSettings={
          rateSettings
            ? {
                petrol_rate: Number(rateSettings.petrol_rate),
                diesel_rate: Number(rateSettings.diesel_rate),
                margin: Number(rateSettings.margin),
                generator_expected_hours_per_liter: Number(rateSettings.generator_expected_hours_per_liter),
              }
            : { petrol_rate: 280, diesel_rate: 290, margin: 5, generator_expected_hours_per_liter: 2.17 }
        }
        summary={summary}
      />
    </div>
  );
}
