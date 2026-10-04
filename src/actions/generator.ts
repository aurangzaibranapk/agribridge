"use server";
import { revalidatePath } from "next/cache";
import { aajKaKhana } from "@/lib/utils/format";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireAction } from "@/lib/access/guard";
import { COMMENT_MIN, COMMENT_MAX } from "@/lib/whatsapp-submissions";

export interface ActionState {
  error?: string;
  success?: boolean;
}

export async function logGeneratorEntry(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const serviceClient = createServiceClient();
  const logDate = String(formData.get("log_date") ?? aajKaKhana());
  const branchId = (formData.get("branch_id") as string) || null;
  const openingHours = Number(formData.get("opening_hours") ?? 0);
  const closingHours = Number(formData.get("closing_hours") ?? 0);
  const dieselLiters = Number(formData.get("diesel_liters_purchased") ?? 0);
  const submittedRate = Number(formData.get("diesel_rate_per_liter") ?? 0);
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
  const rate = submittedRate > 0 ? submittedRate : Number(settings?.diesel_rate ?? 290) + Number(settings?.margin ?? 5);
  const expectedHoursPerLiter = Number(settings?.generator_expected_hours_per_liter ?? 2.17);

  const hoursRun = closingHours - openingHours;
  const litersPerHour = dieselLiters > 0 && hoursRun > 0 ? dieselLiters / hoursRun : null;
  const actualHoursPerLiter = dieselLiters > 0 ? hoursRun / dieselLiters : null;
  const dieselCost = dieselLiters > 0 ? dieselLiters * rate : null;
  const expectedDieselLiters = expectedHoursPerLiter > 0 ? hoursRun / expectedHoursPerLiter : null;
  const dieselVarianceLiters = expectedDieselLiters != null && dieselLiters > 0 ? dieselLiters - expectedDieselLiters : null;

  const isAnomaly =
    actualHoursPerLiter !== null && Math.abs(actualHoursPerLiter - expectedHoursPerLiter) / expectedHoursPerLiter > 0.25;

  async function uploadMeterPhoto(field: string): Promise<string | null> {
    const photo = formData.get(field);
    if (!(photo instanceof File) || photo.size === 0) return null;
    const path = `generator/${Date.now()}-${field}-${photo.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
    const { error: uploadError } = await serviceClient.storage.from("meter-readings").upload(path, photo);
    if (uploadError) return null;
    return serviceClient.storage.from("meter-readings").getPublicUrl(path).data.publicUrl;
  }
  const openingMeterPhotoUrl = await uploadMeterPhoto("opening_meter_photo");
  const closingMeterPhotoUrl = await uploadMeterPhoto("closing_meter_photo");

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
    diesel_rate_per_liter: rate,
    expected_diesel_liters: expectedDieselLiters,
    diesel_variance_liters: dieselVarianceLiters,
    liters_per_hour: litersPerHour,
    electricity_units: electricityUnits,
    milk_volume_chilled: milkVolume,
    is_anomaly: isAnomaly,
    meter_photo_url: closingMeterPhotoUrl,
    opening_meter_photo_url: openingMeterPhotoUrl,
    closing_meter_photo_url: closingMeterPhotoUrl,
    notes,
    created_by: user?.id ?? null,
    approval_status: "pending",
  });
  if (error) return { error: error.message };

  revalidatePath("/admin/milk-collection/generator");
  return { success: true };
}

export async function approveGeneratorEntry(formData: FormData): Promise<void> {
  const supabase = createClient();
  const logId = String(formData.get("log_id") ?? "");
  const comment = String(formData.get("approval_comment") ?? "").trim();
  if (!logId || comment.length < COMMENT_MIN || comment.length > COMMENT_MAX) return;
  const gate = await requireAction("generator", "approve");
  if ("error" in gate) return;
  const { error } = await supabase.from("generator_logs").update({
    approval_status: "approved",
    approval_comment: comment,
    approved_by: gate.caller.userId,
    approved_at: new Date().toISOString(),
  }).eq("id", logId).eq("approval_status", "pending");
  if (!error) revalidatePath("/admin/milk-collection/generator");
}
