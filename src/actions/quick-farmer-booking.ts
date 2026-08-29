"use server";
import { createServiceClient } from "@/lib/supabase/service";

export interface QuickBookingState {
  error?: string;
  success?: boolean;
}

function normalizePhone(raw: string): string {
  return raw.replace(/[^0-9]/g, "");
}

export async function quickFarmerMachineryBooking(_prev: QuickBookingState, formData: FormData): Promise<QuickBookingState> {
  const serviceClient = createServiceClient();

  const fullName = String(formData.get("full_name") ?? "").trim();
  const phoneNumber = normalizePhone(String(formData.get("phone_number") ?? ""));
  if (!fullName) return { error: "Apna naam likhein." };
  if (phoneNumber.length < 10) return { error: "Sahi mobile number likhein." };

  const machineType = String(formData.get("machine_type") ?? "");
  const machineTypeOther = String(formData.get("machine_type_other") ?? "").trim();
  const acres = formData.get("acres") ? Number(formData.get("acres")) : null;
  const expectedDate = String(formData.get("expected_date") ?? "");
  const cropType = String(formData.get("crop_type") ?? "").trim();
  const locationLat = formData.get("location_lat") ? Number(formData.get("location_lat")) : null;
  const locationLng = formData.get("location_lng") ? Number(formData.get("location_lng")) : null;
  const locationAddress = String(formData.get("location_address") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();
  const willSellToUs = formData.get("will_sell_to_us") === "yes";
  const wantsReminder = formData.get("wants_next_season_reminder") === "yes";

  if (!machineType) return { error: "Machine select karein." };
  if (machineType === "other" && !machineTypeOther) return { error: "Machine ka naam likhein." };
  if (!expectedDate) return { error: "Tareekh select karein." };

  const { data: existingFarmer } = await serviceClient.from("farmers").select("id").eq("phone_number", phoneNumber).maybeSingle();

  let farmerId = existingFarmer?.id as string | undefined;
  if (!farmerId) {
    // farmer_code database khud bharta hai (migration 121).
    const { data: newFarmer, error: farmerError } = await serviceClient
      .from("farmers")
      .insert({
        full_name: fullName,
        phone_number: phoneNumber,
      })
      .select("id")
      .single();
    if (farmerError) return { error: farmerError.message };
    farmerId = newFarmer.id;
  }

  const { error } = await serviceClient.from("machinery_requests").insert({
    farmer_id: farmerId,
    machine_type: machineType,
    machine_type_other: machineType === "other" ? machineTypeOther : null,
    acres,
    expected_date: expectedDate,
    crop_type: cropType || null,
    location_lat: locationLat,
    location_lng: locationLng,
    location_address: locationAddress || null,
    will_sell_to_us: willSellToUs,
    wants_next_season_reminder: wantsReminder,
    notes: notes || null,
  });
  if (error) return { error: error.message };

  return { success: true };
}