"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export interface ActionState {
  error?: string;
  success?: boolean;
}

export async function createDriver(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const fullName = String(formData.get("full_name") ?? "").trim();
  const mobileNumber = (formData.get("mobile_number") as string) || null;
  const cnicNumber = (formData.get("cnic_number") as string) || null;
  const licenseNumber = (formData.get("license_number") as string) || null;
  const vehicleNumber = (formData.get("vehicle_number") as string) || null;
  const vehicleType = (formData.get("vehicle_type") as string) || null;

  if (!fullName) return { error: "Driver naam zaroori hai." };

  const { data: driver, error } = await supabase
    .from("drivers")
    .insert({ full_name: fullName, mobile_number: mobileNumber, cnic_number: cnicNumber, license_number: licenseNumber })
    .select("id")
    .single();
  if (error) return { error: error.message };

  if (vehicleNumber) {
    const { error: vehicleError } = await supabase.from("dispatch_vehicles").insert({
      vehicle_number: vehicleNumber,
      vehicle_type: vehicleType,
      driver_id: driver.id,
    });
    if (vehicleError) return { error: vehicleError.message };
  }

  revalidatePath("/admin/drivers");
  return { success: true };
}

export async function updateDriverStatus(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const driverId = String(formData.get("driver_id") ?? "");
  const isActive = formData.get("is_active") === "true";
  if (!driverId) return { error: "Missing driver id." };

  const { error } = await supabase.from("drivers").update({ is_active: isActive }).eq("id", driverId);
  if (error) return { error: error.message };

  revalidatePath("/admin/drivers");
  return { success: true };
}