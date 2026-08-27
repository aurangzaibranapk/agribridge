"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

export interface ActionState {
  error?: string;
  success?: boolean;
}

export async function logGeneratorEntry(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const serviceClient = createServiceClient();
  const logDate = String(formData.get("log_date") ?? new Date().toISOString().slice(0, 10));
  const branchId = (formData.get("branch_id") as string) || null;
  const openingHours = Number(formData.get("opening_hours") ?? 0);
  const closingHours = Number(formData.get("closing_hours") ?? 0);
  const dieselLiters = Number(formData.get("diesel_liters_purchased") ?? 0);
  const electricityUnits = formData.get("electricity_units") ? Number(formData.get("electricity_units")) : null;
  const milkVolume = formData.get("milk_volume_chilled") ? Number(formData.get("milk_volume_chilled")) : null;
  const notes = (formData.get("notes") as string) || null;

  if (!openingHours || openingHours < 0) return { error: "Opening Hours zaroori hai." };
  if (!closingHours || closingHours <= openingHours) return { error: "Closing Hours, Opening se zyada honi chahiye." };

  const { data: settings } = await supabase
    .from("fuel_rate_settings")
    .select("diesel_rate, margin, generator_expected_hours_per_liter")
    .limit(1)
    .single();
  const rate = Number(settings?.diesel_rate ?? 290) + Number(settings?.margin ?? 5);
  const expectedHoursPerLiter = Number(settings?.generator_expected_hours_per_liter ?? 2.17);

  const hoursRun = closingHours - openingHours;
  const litersPerHour = dieselLiters > 0 && hoursRun > 0 ? dieselLiters / hoursRun : null;
  const actualHoursPerLiter = dieselLiters > 0 ? hoursRun / dieselLiters : null;
  const dieselCost = dieselLiters > 0 ? dieselLiters * rate : null;

  const isAnomaly =
    actualHoursPerLiter !== null && Math.abs(actualHoursPerLiter - expectedHoursPerLiter) / expectedHoursPerLiter > 0.25;

  let meterPhotoUrl: string | null = null;
  const photo = formData.get("meter_photo");
  if (photo instanceof File && photo.size > 0) {
    const path = `generator/${Date.now()}-${photo.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
    const { error: uploadError } = await serviceClient.storage.from("meter-readings").upload(path, photo);
    if (!uploadError) {
      const { data } = serviceClient.storage.from("meter-readings").getPublicUrl(path);
      meterPhotoUrl = data.publicUrl;
    }
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from("generator_logs").insert({
    log_date: logDate,
    branch_id: branchId,
    opening_hours: openingHours,
    closing_hours: closingHours,
    hours_run: hoursRun,
    diesel_liters_purchased: dieselLiters || null,
    diesel_cost: dieselCost,
    liters_per_hour: litersPerHour,
    electricity_units: electricityUnits,
    milk_volume_chilled: milkVolume,
    is_anomaly: isAnomaly,
    meter_photo_url: meterPhotoUrl,
    notes,
    created_by: user?.id ?? null,
  });
  if (error) return { error: error.message };

  revalidatePath("/admin/milk-collection/generator");
  return { success: true };
}