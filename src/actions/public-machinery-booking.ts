"use server";
import { createServiceClient } from "@/lib/supabase/service";

export interface PublicBookingState {
  error?: string;
  success?: boolean;
  farmerName?: string;
}

export async function getFarmerByBookingToken(token: string): Promise<{ id: string; full_name: string } | null> {
  const serviceClient = createServiceClient();
  const { data } = await serviceClient.from("farmers").select("id, full_name").eq("booking_link_token", token).maybeSingle();
  return data ?? null;
}

export async function submitPublicMachineryRequest(_prev: PublicBookingState, formData: FormData): Promise<PublicBookingState> {
  const serviceClient = createServiceClient();
  const token = String(formData.get("token") ?? "");
  if (!token) return { error: "Ye link theek nahi hai." };

  const { data: farmer } = await serviceClient.from("farmers").select("id, full_name").eq("booking_link_token", token).maybeSingle();
  if (!farmer) return { error: "Ye link ab kaam nahi kar raha." };

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

  const { error } = await serviceClient.from("machinery_requests").insert({
    farmer_id: farmer.id,
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

  return { success: true, farmerName: farmer.full_name };
}