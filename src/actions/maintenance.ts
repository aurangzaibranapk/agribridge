"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export interface ActionState {
  error?: string;
  success?: boolean;
}

// Records a service and moves the vehicle's "last serviced at" marker
// forward, so the due-for-service reminder resets from this point.
export async function logMaintenance(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const vehicleId = String(formData.get("vehicle_id") ?? "");
  const serviceDate = String(formData.get("service_date") ?? new Date().toISOString().slice(0, 10));
  const kmAtService = Number(formData.get("km_at_service") ?? 0);
  const description = String(formData.get("description") ?? "").trim();
  const cost = Number(formData.get("cost") ?? 0);

  if (!vehicleId) return { error: "Vehicle select karein." };
  if (!description) return { error: "Service ka detail likhein." };
  if (!kmAtService || kmAtService <= 0) return { error: "KM zaroori hai." };

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from("maintenance_logs").insert({
    vehicle_id: vehicleId,
    service_date: serviceDate,
    km_at_service: kmAtService,
    description,
    cost,
    created_by: user?.id ?? null,
  });
  if (error) return { error: error.message };

  await supabase.from("vehicles").update({ last_service_km: kmAtService }).eq("id", vehicleId);

  revalidatePath("/admin/milk-collection/maintenance");
  return { success: true };
}

export async function saveServiceInterval(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const vehicleId = String(formData.get("vehicle_id") ?? "");
  const intervalKm = Number(formData.get("service_interval_km") ?? 1000);
  if (!vehicleId) return { error: "Missing vehicle." };

  const { error } = await supabase.from("vehicles").update({ service_interval_km: intervalKm }).eq("id", vehicleId);
  if (error) return { error: error.message };

  revalidatePath("/admin/milk-collection/maintenance");
  return { success: true };
}

export async function recordFundWithdrawal(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const amount = Number(formData.get("amount") ?? 0);
  const reason = String(formData.get("reason") ?? "").trim();
  const withdrawalDate = String(formData.get("withdrawal_date") ?? new Date().toISOString().slice(0, 10));
  if (!amount || amount <= 0) return { error: "Amount zaroori hai." };
  if (!reason) return { error: "Wajah likhein." };

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from("replacement_fund_withdrawals").insert({
    withdrawal_date: withdrawalDate,
    amount,
    reason,
    created_by: user?.id ?? null,
  });
  if (error) return { error: error.message };

  revalidatePath("/admin/milk-collection/maintenance");
  return { success: true };
}