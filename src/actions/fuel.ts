"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

export interface ActionState {
  error?: string;
  success?: boolean;
}

export async function addVehicle(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const vehicleName = String(formData.get("vehicle_name") ?? "").trim();
  const registrationNo = (formData.get("registration_no") as string) || null;
  const assignedRider = (formData.get("assigned_rider") as string) || null;
  const expectedKmPerLiter = formData.get("expected_km_per_liter") ? Number(formData.get("expected_km_per_liter")) : 45;
  const branchId = (formData.get("branch_id") as string) || null;
  if (!vehicleName) return { error: "Vehicle naam zaroori hai." };

  const { error } = await supabase.from("vehicles").insert({
    vehicle_name: vehicleName,
    registration_no: registrationNo,
    assigned_rider: assignedRider,
    expected_km_per_liter: expectedKmPerLiter,
    branch_id: branchId,
  });
  if (error) return { error: error.message };

  revalidatePath("/admin/milk-collection/fuel");
  return { success: true };
}

export async function saveFuelRateSettings(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const petrolRate = Number(formData.get("petrol_rate") ?? 0);
  const dieselRate = Number(formData.get("diesel_rate") ?? 0);
  const margin = Number(formData.get("margin") ?? 5);
  const generatorExpected = Number(formData.get("generator_expected_hours_per_liter") ?? 2.17);
  if (!petrolRate || !dieselRate) return { error: "Petrol aur Diesel rate zaroori hain." };

  const { data: existing } = await supabase.from("fuel_rate_settings").select("id").limit(1).single();
  if (existing) {
    const { error } = await supabase
      .from("fuel_rate_settings")
      .update({
        petrol_rate: petrolRate,
        diesel_rate: dieselRate,
        margin,
        generator_expected_hours_per_liter: generatorExpected,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id);
    if (error) return { error: error.message };
  } else {
    const { error } = await supabase.from("fuel_rate_settings").insert({
      petrol_rate: petrolRate,
      diesel_rate: dieselRate,
      margin,
      generator_expected_hours_per_liter: generatorExpected,
    });
    if (error) return { error: error.message };
  }

  revalidatePath("/admin/milk-collection/fuel");
  revalidatePath("/admin/milk-collection/generator");
  return { success: true };
}

export async function logFuelEntry(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const serviceClient = createServiceClient();
  const vehicleId = String(formData.get("vehicle_id") ?? "");
  const logDate = String(formData.get("log_date") ?? new Date().toISOString().slice(0, 10));
  const openingKm = Number(formData.get("opening_km") ?? 0);
  const closingKm = Number(formData.get("closing_km") ?? 0);
  const fuelLiters = Number(formData.get("fuel_liters_purchased") ?? 0);
  const routeName = (formData.get("route_name") as string) || null;
  const milkVolume = formData.get("milk_volume_collected") ? Number(formData.get("milk_volume_collected")) : null;
  const notes = (formData.get("notes") as string) || null;

  if (!vehicleId) return { error: "Vehicle select karein." };
  if (!openingKm || openingKm < 0) return { error: "Opening KM zaroori hai." };
  if (!closingKm || closingKm <= openingKm) return { error: "Closing KM, Opening se zyada honi chahiye." };

  const { data: vehicle } = await supabase.from("vehicles").select("expected_km_per_liter").eq("id", vehicleId).single();
  const expectedKmPerLiter = Number(vehicle?.expected_km_per_liter ?? 45);

  const { data: settings } = await supabase.from("fuel_rate_settings").select("petrol_rate, margin").limit(1).single();
  const rate = Number(settings?.petrol_rate ?? 280) + Number(settings?.margin ?? 5);

  const kmTravelled = closingKm - openingKm;
  const kmPerLiter = fuelLiters > 0 ? kmTravelled / fuelLiters : null;
  const fuelCost = fuelLiters > 0 ? fuelLiters * rate : null;
  const fuelCostPerLiterMilk = milkVolume && milkVolume > 0 && fuelCost ? fuelCost / milkVolume : null;

  const isAnomaly = kmPerLiter !== null && Math.abs(kmPerLiter - expectedKmPerLiter) / expectedKmPerLiter > 0.25;

  let meterPhotoUrl: string | null = null;
  const photo = formData.get("meter_photo");
  if (photo instanceof File && photo.size > 0) {
    const path = `fuel/${vehicleId}/${Date.now()}-${photo.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
    const { error: uploadError } = await serviceClient.storage.from("meter-readings").upload(path, photo);
    if (!uploadError) {
      const { data } = serviceClient.storage.from("meter-readings").getPublicUrl(path);
      meterPhotoUrl = data.publicUrl;
    }
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from("fuel_logs").insert({
    vehicle_id: vehicleId,
    log_date: logDate,
    opening_km: openingKm,
    closing_km: closingKm,
    km_travelled: kmTravelled,
    fuel_liters_purchased: fuelLiters || null,
    fuel_cost: fuelCost,
    km_per_liter: kmPerLiter,
    route_name: routeName,
    milk_volume_collected: milkVolume,
    fuel_cost_per_liter_milk: fuelCostPerLiterMilk,
    is_anomaly: isAnomaly,
    meter_photo_url: meterPhotoUrl,
    notes,
    created_by: user?.id ?? null,
  });
  if (error) return { error: error.message };

  revalidatePath("/admin/milk-collection/fuel");
  return { success: true };
}