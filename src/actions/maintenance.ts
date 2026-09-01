"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { logAudit } from "@/lib/audit";
import { notifyRoles } from "@/lib/notifications";
import { MAINT_COMMENT_MIN, MAINT_COMMENT_MAX, RESETS_OIL_COUNTER } from "@/lib/maintenance-rules";

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

  const maintenanceType = String(formData.get("maintenance_type") ?? "other");

  const { data: vehicle } = await supabase.from("vehicles").select("branch_id, vehicle_name").eq("id", vehicleId).maybeSingle();

  const { error } = await supabase.from("maintenance_logs").insert({
    vehicle_id: vehicleId,
    service_date: serviceDate,
    km_at_service: kmAtService,
    maintenance_type: maintenanceType,
    description,
    cost,
    branch_id: vehicle?.branch_id ?? null,
    status: "pending",
    created_by: user?.id ?? null,
  });
  if (error) return { error: error.message };

  // last_service_km yahan NAHI badalta. Oil ki yaad dihani tabhi
  // rukni chahiye jab kharcha waqai manzoor ho jaye -- warna sirf entry
  // daal dene se reminder band ho jata aur oil kabhi badla hi na jata.

  await notifyRoles(
    ["manager"],
    "Gaari ki maintenance verify karein",
    `${vehicle?.vehicle_name ?? "Gaari"} — Rs ${cost.toLocaleString()} (${kmAtService} km)`,
    "/admin/milk-collection/maintenance"
  );

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
const BRANCH_ROLES = ["owner", "super_admin", "admin", "manager"];
const MILK_ROLES = ["owner", "super_admin", "admin", "manager", "milk_collection"];

async function actor(allowed: string[]) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Login zaroori hai." };
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, is_active, branch_id")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile?.is_active) return { error: "Ye account fa'aal nahi hai." };
  if (!allowed.includes(profile.role)) return { error: "Aapko is kaam ki ijazat nahi hai." };
  return { userId: user.id, role: profile.role, branchId: profile.branch_id };
}

/**
 * Pehla qadam -- Branch Manager.
 *
 * Wo maidan mein tha: us ne dekha ke gaari waqai workshop gayi, kaam
 * waqai hua, aur bill usi kaam ka hai. Ye baat sirf wohi jaanta hai jo
 * mauqe par tha, is liye ye qadam chhora nahi ja sakta.
 */
export async function branchVerifyMaintenance(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const who = await actor(BRANCH_ROLES);
  if ("error" in who) return { error: who.error };

  const id = String(formData.get("maintenance_id") ?? "");
  const comment = String(formData.get("branch_comment") ?? "").trim();
  if (!id) return { error: "Entry nahi mili." };
  if (comment.length < MAINT_COMMENT_MIN) return { error: `Comment kam az kam ${MAINT_COMMENT_MIN} haroof ka likhein.` };
  if (comment.length > MAINT_COMMENT_MAX) return { error: `Comment zyada se zyada ${MAINT_COMMENT_MAX} haroof.` };

  const service = createServiceClient();
  const { data: log } = await service
    .from("maintenance_logs")
    .select("id, status, cost, branch_id, vehicles(vehicle_name)")
    .eq("id", id)
    .maybeSingle();
  if (!log) return { error: "Entry nahi mili." };
  if (log.status !== "pending") return { error: "Is par pehla faisla ho chuka hai." };

  const isAdmin = ["owner", "super_admin", "admin"].includes(who.role);
  if (!isAdmin && who.branchId && log.branch_id && who.branchId !== log.branch_id) {
    return { error: "Ye gaari aapki branch ki nahi hai." };
  }

  const { error } = await service
    .from("maintenance_logs")
    .update({
      status: "branch_verified",
      branch_verified_by: who.userId,
      branch_comment: comment,
      branch_verified_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("status", "pending");
  if (error) return { error: error.message };

  const vehicle = Array.isArray(log.vehicles) ? log.vehicles[0] : log.vehicles;
  await logAudit({
    actionType: "approve",
    module: "maintenance_logs",
    recordId: id,
    recordLabel: vehicle?.vehicle_name ?? "Gaari",
    description: `Branch manager ne verify kiya: ${comment}`,
  });

  await notifyRoles(
    ["milk_collection", "manager"],
    "Maintenance ki aakhri manzoori chahiye",
    `${vehicle?.vehicle_name ?? "Gaari"} — Rs ${Number(log.cost).toLocaleString()}`,
    "/admin/milk-collection/maintenance"
  );

  revalidatePath("/admin/milk-collection/maintenance");
  return { success: true };
}

/**
 * Aakhri qadam -- Milk Manager.
 *
 * Kharcha us ke khate mein girta hai, is liye aakhri faisla us ka.
 * Manzoori ke waqt hi gaari ka "aakhri service" ka nishan aage barhta
 * hai -- yani oil ki yaad dihani sirf manzoor shuda kaam par rukti hai.
 */
export async function approveMaintenance(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const who = await actor(MILK_ROLES);
  if ("error" in who) return { error: who.error };

  const id = String(formData.get("maintenance_id") ?? "");
  const comment = String(formData.get("approve_comment") ?? "").trim();
  if (!id) return { error: "Entry nahi mili." };
  if (comment.length < MAINT_COMMENT_MIN) return { error: `Comment kam az kam ${MAINT_COMMENT_MIN} haroof ka likhein.` };
  if (comment.length > MAINT_COMMENT_MAX) return { error: `Comment zyada se zyada ${MAINT_COMMENT_MAX} haroof.` };

  const service = createServiceClient();
  const { data: log } = await service
    .from("maintenance_logs")
    .select("id, status, cost, vehicle_id, km_at_service, maintenance_type, vehicles(vehicle_name, last_service_km)")
    .eq("id", id)
    .maybeSingle();
  if (!log) return { error: "Entry nahi mili." };
  if (log.status === "pending") {
    return { error: "Pehle branch manager ko verify karna hai — ye qadam chhora nahi ja sakta." };
  }
  if (log.status !== "branch_verified") return { error: "Is par faisla pehle hi ho chuka hai." };

  const { error } = await service
    .from("maintenance_logs")
    .update({
      status: "approved",
      approved_by: who.userId,
      approve_comment: comment,
      approved_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("status", "branch_verified");
  if (error) return { error: error.message };

  // Oil badla to hi reminder aage sarakta hai. Marammat ya tyre badalne
  // se oil ka hisaab nahi badalta.
  const vehicle = Array.isArray(log.vehicles) ? log.vehicles[0] : log.vehicles;
  if (RESETS_OIL_COUNTER.includes(log.maintenance_type ?? "")) {
    const previous = Number(vehicle?.last_service_km ?? 0);
    const now = Number(log.km_at_service);
    if (now > previous) {
      await service.from("vehicles").update({ last_service_km: now }).eq("id", log.vehicle_id);
    }
  }

  await logAudit({
    actionType: "approve",
    module: "maintenance_logs",
    recordId: id,
    recordLabel: vehicle?.vehicle_name ?? "Gaari",
    description: `Milk manager ne manzoor kiya — Rs ${Number(log.cost).toLocaleString()}: ${comment}`,
  });

  revalidatePath("/admin/milk-collection/maintenance");
  return { success: true };
}

export async function rejectMaintenance(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const who = await actor(MILK_ROLES);
  if ("error" in who) return { error: who.error };

  const id = String(formData.get("maintenance_id") ?? "");
  const reason = String(formData.get("rejection_reason") ?? "").trim();
  if (!id) return { error: "Entry nahi mili." };
  if (reason.length < MAINT_COMMENT_MIN) return { error: "Rad karne ki wajah likhein." };

  const service = createServiceClient();
  const { error } = await service
    .from("maintenance_logs")
    .update({
      status: "rejected",
      rejection_reason: reason,
      approved_by: who.userId,
      approved_at: new Date().toISOString(),
    })
    .eq("id", id)
    .in("status", ["pending", "branch_verified"]);
  if (error) return { error: error.message };

  await logAudit({
    actionType: "reject",
    module: "maintenance_logs",
    recordId: id,
    description: `Rad kiya: ${reason}`,
  });

  revalidatePath("/admin/milk-collection/maintenance");
  return { success: true };
}
