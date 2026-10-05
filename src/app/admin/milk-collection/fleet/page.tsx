import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/layout-primitives";
import { FleetDashboard } from "./fleet-dashboard";

export const dynamic = "force-dynamic";

export default async function FleetDashboardPage() {
  const supabase = createClient();
  const [{ data: vehicles }, { data: routes }, { data: generators }, { data: maintenance }] = await Promise.all([
    supabase.from("vehicles").select("id, vehicle_name, registration_no, assigned_rider, expected_km_per_liter").eq("is_active", true).order("vehicle_name"),
    supabase.from("fuel_logs").select("id, vehicle_id, log_date, route_name, route_status, opening_km, closing_km, km_travelled, fuel_liters_purchased, petrol_rate, fuel_cost, milk_volume_collected, opening_meter_photo_url, closing_meter_photo_url, fuel_receipt_url, work_description, voice_note, vehicles(vehicle_name)").order("log_date", { ascending: false }).limit(100),
    supabase.from("generator_logs").select("id, log_date, hours_run, diesel_liters_purchased, diesel_cost, electricity_units, branches(name)").order("log_date", { ascending: false }).limit(50),
    supabase.from("maintenance_logs").select("id, service_date, description, cost, km_at_service, vehicles(vehicle_name)").order("service_date", { ascending: false }).limit(50),
  ]);
  const mapRelation = (value: any) => Array.isArray(value) ? value[0] : value;
  return <div><PageHeader title="Fleet & Route Operations" description="Motorcycle route, petrol, milk collection, generator aur maintenance ka unified record" /><FleetDashboard vehicles={vehicles ?? []} routes={(routes ?? []).map((r: any) => ({ ...r, vehicle_name: mapRelation(r.vehicles)?.vehicle_name }))} generators={(generators ?? []).map((g: any) => ({ ...g, branch_name: mapRelation(g.branches)?.name }))} maintenance={(maintenance ?? []).map((m: any) => ({ ...m, vehicle_name: mapRelation(m.vehicles)?.vehicle_name }))} /></div>;
}
