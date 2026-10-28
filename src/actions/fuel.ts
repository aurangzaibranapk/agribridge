"use server";
import { revalidatePath } from "next/cache";
import { aajKaKhana } from "@/lib/utils/format";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireAction } from "@/lib/access/guard";
import { requireMoneyAdmin } from "@/lib/access/money-gate";
import { COMMENT_MIN, COMMENT_MAX } from "@/lib/whatsapp-submissions";
import { lockedFuelRate, openingReadingError, selfApprovalError } from "@/lib/dairy/rules";

export interface ActionState {
  error?: string;
  success?: boolean;
}

export async function addVehicle(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const gate = await requireAction("milk-collection.fuel", "create");
  if ("error" in gate) return { error: gate.error };
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
  const money = await requireMoneyAdmin("Tel ka rate badalna");
  if (!money.ok) return { error: money.error };
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
  const gate = await requireAction("milk-collection.fuel", "create");
  if ("error" in gate) return { error: gate.error };
  const supabase = createClient();
  const serviceClient = createServiceClient();
  const vehicleId = String(formData.get("vehicle_id") ?? "");
  const logDate = String(formData.get("log_date") ?? aajKaKhana());
  const openingKm = Number(formData.get("opening_km") ?? 0);
  const closingKm = Number(formData.get("closing_km") ?? 0);
  const fuelLiters = Number(formData.get("fuel_liters_purchased") ?? 0);
  const submittedRate = Number(formData.get("petrol_rate_per_liter") ?? 0);
  const routeName = (formData.get("route_name") as string) || null;
  const milkVolume = formData.get("milk_volume_collected") ? Number(formData.get("milk_volume_collected")) : null;
  const notes = (formData.get("notes") as string) || null;

  if (!vehicleId) return { error: "Vehicle select karein." };
  const openingError = openingReadingError(formData.get("opening_km"), "Opening KM");
  if (openingError) return { error: openingError };
  if (!closingKm || closingKm <= openingKm) return { error: "Closing KM, Opening se zyada honi chahiye." };

  const { data: vehicle } = await supabase.from("vehicles").select("expected_km_per_liter").eq("id", vehicleId).single();
  const expectedKmPerLiter = Number(vehicle?.expected_km_per_liter ?? 45);

  const { data: settings } = await supabase.from("fuel_rate_settings").select("petrol_rate, margin").limit(1).maybeSingle();
  const locked = lockedFuelRate(settings?.petrol_rate, settings?.margin, submittedRate);
  if ("error" in locked) return { error: locked.error };
  const rate = locked.rate;

  const kmTravelled = closingKm - openingKm;
  const kmPerLiter = fuelLiters > 0 ? kmTravelled / fuelLiters : null;
  const fuelCost = fuelLiters > 0 ? fuelLiters * rate : null;
  const fuelCostPerLiterMilk = milkVolume && milkVolume > 0 && fuelCost ? fuelCost / milkVolume : null;
  const expectedFuelLiters = expectedKmPerLiter > 0 ? kmTravelled / expectedKmPerLiter : null;
  const fuelVarianceLiters = expectedFuelLiters != null && fuelLiters > 0 ? fuelLiters - expectedFuelLiters : null;

  const isAnomaly = kmPerLiter !== null && Math.abs(kmPerLiter - expectedKmPerLiter) / expectedKmPerLiter > 0.25;

  async function uploadMeterPhoto(field: string): Promise<string | null> {
    const photo = formData.get(field);
    if (!(photo instanceof File) || photo.size === 0) return null;
    const path = `fuel/${vehicleId}/${Date.now()}-${field}-${photo.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
    const { error: uploadError } = await serviceClient.storage.from("meter-readings").upload(path, photo);
    if (uploadError) return null;
    return path;
  }
  const openingMeterPhotoUrl = await uploadMeterPhoto("opening_meter_photo");
  const closingMeterPhotoUrl = await uploadMeterPhoto("closing_meter_photo");

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
    petrol_rate_per_liter: rate,
    expected_fuel_liters: expectedFuelLiters,
    fuel_variance_liters: fuelVarianceLiters,
    km_per_liter: kmPerLiter,
    route_name: routeName,
    milk_volume_collected: milkVolume,
    fuel_cost_per_liter_milk: fuelCostPerLiterMilk,
    is_anomaly: isAnomaly,
    meter_photo_url: closingMeterPhotoUrl,
    opening_meter_photo_url: openingMeterPhotoUrl,
    closing_meter_photo_url: closingMeterPhotoUrl,
    notes,
    created_by: user?.id ?? null,
    approval_status: "pending",
  });
  if (error) return { error: error.message };

  revalidatePath("/admin/milk-collection/fuel");
  revalidatePath("/admin/finance/ops");
  return { success: true };
}

export async function approveFuelEntry(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const logId = String(formData.get("log_id") ?? "");
  const comment = String(formData.get("approval_comment") ?? "").trim();
  if (!logId) return { error: "Entry nahi mili." };
  if (comment.length < COMMENT_MIN || comment.length > COMMENT_MAX) return { error: `Comment ${COMMENT_MIN} se ${COMMENT_MAX} haroof ka ho.` };
  const gate = await requireAction("fuel", "approve");
  if ("error" in gate) return { error: gate.error };
  const { data: row } = await supabase.from("fuel_logs").select("created_by, approval_status").eq("id", logId).maybeSingle();
  if (!row || row.approval_status !== "pending") return { error: "Ye entry manzoori ke liye nahi hai." };
  const sod = selfApprovalError(gate.caller.userId, row.created_by, null, gate.caller.role);
  if (sod) return { error: sod };
  const { error } = await supabase.from("fuel_logs").update({
    approval_status: "approved",
    approval_comment: comment,
    approved_by: gate.caller.userId,
    approved_at: new Date().toISOString(),
  }).eq("id", logId).eq("approval_status", "pending");
  if (error) return { error: error.message };
  revalidatePath("/admin/milk-collection/fuel");
  revalidatePath("/admin/finance/ops");
  return { success: true };
}
