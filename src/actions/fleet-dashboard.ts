"use server";

import { revalidatePath } from "next/cache";
import { aajKaKhana } from "@/lib/utils/format";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

export interface FleetActionState { error?: string; success?: boolean; id?: string }

async function uploadImage(file: FormDataEntryValue | null, folder: string) {
  if (!(file instanceof File) || file.size === 0) return null;
  const service = createServiceClient();
  const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
  const path = `${folder}/${Date.now()}-${safeName}`;
  const { error } = await service.storage.from("meter-readings").upload(path, file, { upsert: false });
  if (error) return null;
  return service.storage.from("meter-readings").getPublicUrl(path).data.publicUrl;
}

export async function startMotorcycleRoute(_prev: FleetActionState, formData: FormData): Promise<FleetActionState> {
  const supabase = createClient();
  const fuelLogs = supabase.from("fuel_logs" as any);
  const vehicleId = String(formData.get("vehicle_id") ?? "");
  const openingKm = Number(formData.get("opening_km") ?? 0);
  const routeName = String(formData.get("route_name") ?? "").trim() || null;
  const logDate = String(formData.get("log_date") ?? aajKaKhana());
  const openingPhoto = await uploadImage(formData.get("opening_meter_photo"), `fuel/${vehicleId}/opening`);
  if (!vehicleId) return { error: "Motorcycle select karein." };
  if (openingKm < 0) return { error: "Start meter reading likhein." };
  const { data: user } = await supabase.auth.getUser();
  const { data, error } = await fuelLogs.insert({
    vehicle_id: vehicleId, log_date: logDate, opening_km: openingKm,
    route_name: routeName, route_status: "open", opening_meter_photo_url: openingPhoto,
    opening_reading_source: openingPhoto ? "photo_manual_confirmed" : "manual",
    created_by: user.user?.id ?? null,
  }).select("id").single();
  if (error) return { error: error.message };
  revalidatePath("/admin/milk-collection/fleet");
  return { success: true, id: data.id };
}

export async function addRouteFuel(_prev: FleetActionState, formData: FormData): Promise<FleetActionState> {
  const supabase = createClient();
  const fuelLogs = supabase.from("fuel_logs" as any);
  const routeId = String(formData.get("route_id") ?? "");
  const liters = Number(formData.get("fuel_liters") ?? 0);
  const rate = Number(formData.get("petrol_rate") ?? 0);
  const receipt = await uploadImage(formData.get("fuel_receipt"), "fuel/receipts");
  if (!routeId || liters <= 0 || rate <= 0) return { error: "Petrol litres aur rate zaroori hain." };
  const { error } = await fuelLogs.update({
    fuel_liters_purchased: liters, petrol_rate: rate, fuel_cost: liters * rate,
    fuel_receipt_url: receipt,
  }).eq("id", routeId).eq("route_status", "open");
  if (error) return { error: error.message };
  revalidatePath("/admin/milk-collection/fleet");
  return { success: true };
}

export async function closeMotorcycleRoute(_prev: FleetActionState, formData: FormData): Promise<FleetActionState> {
  const supabase = createClient();
  const fuelLogs = supabase.from("fuel_logs" as any);
  const routeId = String(formData.get("route_id") ?? "");
  const closingKm = Number(formData.get("closing_km") ?? 0);
  const milkVolume = Number(formData.get("milk_volume") ?? 0) || null;
  const workDescription = String(formData.get("work_description") ?? "").trim() || null;
  const voiceNote = String(formData.get("voice_note") ?? "").trim() || null;
  const closingPhoto = await uploadImage(formData.get("closing_meter_photo"), "fuel/closing");
  if (!routeId || closingKm < 0) return { error: "End meter reading likhein." };
  const { data: route } = await fuelLogs.select("opening_km, fuel_liters_purchased, petrol_rate, milk_volume_collected").eq("id", routeId).single();
  if (!route) return { error: "Open route nahi mila." };
  if (closingKm < Number(route.opening_km)) return { error: "End reading start reading se kam nahi ho sakti." };
  const travelled = closingKm - Number(route.opening_km);
  const fuel = route.fuel_liters_purchased ? Number(route.fuel_liters_purchased) : null;
  const milk = milkVolume ?? (route.milk_volume_collected ? Number(route.milk_volume_collected) : null);
  const { data: vehicle } = await fuelLogs.select("vehicles(expected_km_per_liter)").eq("id", routeId).single();
  const expected = Number((Array.isArray(vehicle?.vehicles) ? vehicle?.vehicles[0] : vehicle?.vehicles)?.expected_km_per_liter ?? 45);
  const kmPerLiter = fuel ? travelled / fuel : null;
  const { error } = await fuelLogs.update({
    closing_km: closingKm, km_travelled: travelled, km_per_liter: kmPerLiter,
    fuel_cost_per_liter_milk: milk && fuel && route.petrol_rate ? (fuel * Number(route.petrol_rate)) / milk : null,
    milk_volume_collected: milk, closing_meter_photo_url: closingPhoto,
    closing_reading_source: closingPhoto ? "photo_manual_confirmed" : "manual",
    work_description: workDescription, voice_note: voiceNote, route_status: "closed",
    closed_at: new Date().toISOString(), is_anomaly: kmPerLiter !== null && Math.abs(kmPerLiter - expected) / expected > 0.25,
  }).eq("id", routeId).eq("route_status", "open");
  if (error) return { error: error.message };
  revalidatePath("/admin/milk-collection/fleet");
  revalidatePath("/admin/milk-collection/fuel");
  return { success: true };
}
