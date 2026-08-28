"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { logAudit } from "@/lib/audit";
import { COMMENT_MAX, COMMENT_MIN } from "@/lib/whatsapp-submissions";

export interface ActionState {
  error?: string;
  success?: boolean;
}

const MANAGER_ROLES = ["owner", "super_admin", "admin", "manager"];
const ADMIN_ROLES = ["owner", "super_admin", "admin"];

/** Gaari kis staff ke naam par hai. Iske baghair WhatsApp par aaya meter kis gaari ka hai, ye pata hi nahi chalta. */
export async function assignVehicleToStaff(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const vehicleId = String(formData.get("vehicle_id") ?? "");
  const profileId = (formData.get("assigned_profile_id") as string) || null;
  if (!vehicleId) return { error: "Missing vehicle id." };

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Login zaroori hai." };
  const { data: me } = await supabase.from("profiles").select("role, is_active").eq("id", user.id).maybeSingle();
  if (!me?.is_active || !ADMIN_ROLES.includes(me.role)) return { error: "Sirf admin gaari assign kar sakta hai." };

  const { error } = await supabase.from("vehicles").update({ assigned_profile_id: profileId }).eq("id", vehicleId);
  if (error) return { error: error.message };

  revalidatePath("/admin/vehicles");
  return { success: true };
}

/**
 * Manager rozana log verify kar ke accounts mein bhejta hai.
 *
 * Post hone par entry maujooda fuel_logs mein jati hai — wahi purani
 * table jise reports pehle se parhti hain. Nayi reporting banane ki
 * zaroorat nahi pari.
 *
 * Comment yahan bhi lazmi hai: ye paise ka faisla hai, aur poore module
 * ka usool yahi hai.
 */
export async function postVehicleDailyLog(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const service = createServiceClient();

  const logId = String(formData.get("log_id") ?? "");
  const comment = String(formData.get("manager_comment") ?? "").trim();
  if (!logId) return { error: "Missing log id." };

  if (!comment) return { error: "Comment likhna zaroori hai." };
  if (comment.length < COMMENT_MIN) return { error: `Comment kam az kam ${COMMENT_MIN} haroof ka hona chahiye.` };
  if (comment.length > COMMENT_MAX) return { error: `Comment zyada se zyada ${COMMENT_MAX} haroof ka ho sakta hai.` };

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Login zaroori hai." };
  const { data: me } = await supabase.from("profiles").select("role, is_active, branch_id").eq("id", user.id).maybeSingle();
  if (!me?.is_active || !MANAGER_ROLES.includes(me.role)) return { error: "Sirf Manager ya Admin ye kar sakta hai." };

  const { data: log } = await service
    .from("vehicle_daily_logs")
    .select("id, log_number, vehicle_id, branch_id, log_date, opening_km, closing_km, km_travelled, fuel_liters, fuel_amount, km_per_liter, status, flags")
    .eq("id", logId)
    .maybeSingle();
  if (!log) return { error: "Log nahi mila." };
  if (log.status !== "complete") {
    return { error: log.status === "posted" ? "Ye log pehle hi post ho chuka hai." : "Ye din abhi mukammal nahi hua — shaam ka meter abhi nahi aaya." };
  }

  const isAdminLevel = ADMIN_ROLES.includes(me.role);
  if (!isAdminLevel && me.branch_id && log.branch_id && me.branch_id !== log.branch_id) {
    return { error: "Ye log aapki branch ka nahi hai." };
  }

  // Nishan lage hue log ka comment thoda tafseeli hona chahiye — manager
  // ne kya dekh kar ise theek mana, ye baad mein saaf hona zaroori hai.
  const flags = Array.isArray(log.flags) ? (log.flags as string[]) : [];
  if (flags.length > 0 && comment.length < 15) {
    return { error: "Is log par nishan lage hue hain — comment mein wajah thodi tafseel se likhein (kam az kam 15 haroof)." };
  }

  // fuel_logs mein opening_km khali nahi ho sakti. Amalan status
  // 'complete' tabhi banta hai jab dono meter aa chuke hon, magar ye
  // check yahan bhi rakha hai — warna kisi din data ulta-seedha hua to
  // insert beech mein phenk deta.
  if (log.opening_km == null || log.closing_km == null) {
    return { error: "Is log mein subah ya shaam ka meter maujood nahi — accounts mein nahi bheja ja sakta." };
  }
  const openingKm = Number(log.opening_km);

  const { data: fuelLog, error: fuelError } = await service
    .from("fuel_logs")
    .insert({
      vehicle_id: log.vehicle_id,
      log_date: log.log_date,
      opening_km: openingKm,
      closing_km: log.closing_km,
      km_travelled: log.km_travelled,
      fuel_liters_purchased: log.fuel_liters,
      fuel_cost: log.fuel_amount,
      km_per_liter: log.km_per_liter,
      is_anomaly: flags.length > 0,
      notes: `${log.log_number} — WhatsApp se. Manager: ${comment}`,
      created_by: user.id,
    })
    .select("id")
    .single();
  if (fuelError) return { error: fuelError.message };

  const { error } = await service
    .from("vehicle_daily_logs")
    .update({ status: "posted", posted_fuel_log_id: fuelLog.id, posted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", logId)
    // Do manager ek sath post na kar dein, warna fuel_logs mein do entry ban jayen.
    .eq("status", "complete");
  if (error) return { error: error.message };

  await logAudit({
    actionType: "approve",
    module: "vehicle_daily_logs",
    recordId: logId,
    recordLabel: log.log_number,
    description: `Rozana log accounts mein post hua: ${Math.round(Number(log.km_travelled ?? 0))} km, Rs ${Number(log.fuel_amount ?? 0).toLocaleString()}. Manager: ${comment}`,
  });

  revalidatePath("/admin/vehicles");
  return { success: true };
}
