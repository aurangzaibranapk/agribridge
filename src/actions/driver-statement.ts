"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export interface ActionState {
  error?: string;
  success?: boolean;
}

export async function addDriverPayment(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const driverId = String(formData.get("driver_id") ?? "");
  const amount = Number(formData.get("amount") ?? 0);
  const paymentType = String(formData.get("payment_type") ?? "Salary");
  const paymentDate = String(formData.get("payment_date") ?? new Date().toISOString().slice(0, 10));
  const notes = (formData.get("notes") as string) || null;

  if (!driverId) return { error: "Missing driver id." };
  if (!amount || amount <= 0) return { error: "Amount zaroori hai." };

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from("driver_payments").insert({
    driver_id: driverId,
    amount,
    payment_type: paymentType,
    payment_date: paymentDate,
    notes,
    created_by: user?.id ?? null,
  });
  if (error) return { error: error.message };

  revalidatePath(`/admin/drivers/${driverId}/statement`);
  return { success: true };
}

export async function addMaintenanceRecord(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const vehicleId = String(formData.get("vehicle_id") ?? "");
  const driverId = String(formData.get("driver_id") ?? "");
  const maintenanceType = String(formData.get("maintenance_type") ?? "").trim();
  const amount = Number(formData.get("amount") ?? 0);
  const odometerKm = formData.get("odometer_km") ? Number(formData.get("odometer_km")) : null;
  const maintenanceDate = String(formData.get("maintenance_date") ?? new Date().toISOString().slice(0, 10));
  const notes = (formData.get("notes") as string) || null;

  if (!vehicleId) return { error: "Vehicle nahi mila is driver ke liye." };
  if (!maintenanceType) return { error: "Maintenance Type zaroori hai." };

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from("vehicle_maintenance_records").insert({
    vehicle_id: vehicleId,
    maintenance_type: maintenanceType,
    amount: amount || 0,
    odometer_km: odometerKm,
    maintenance_date: maintenanceDate,
    notes,
    created_by: user?.id ?? null,
  });
  if (error) return { error: error.message };

  revalidatePath(`/admin/drivers/${driverId}/statement`);
  return { success: true };
}