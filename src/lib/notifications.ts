import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

const STAFF_ROLES = [
  "owner",
  "super_admin",
  "admin",
  "manager",
  "sales_staff",
  "finance",
  "warehouse",
  "admin_assistant",
  "hr",
  "procurement",
  "milk_collection",
];

async function insertForUsers(userIds: string[], title: string, message: string, linkUrl?: string) {
  if (userIds.length === 0) return;
  const serviceClient = createServiceClient();
  const rows = userIds.map((id) => ({
    recipient_user_id: id,
    title,
    message,
    link_url: linkUrl ?? null,
  }));
  await serviceClient.from("notifications").insert(rows);
}

/**
 * Ek hi shakhs ko khabar.
 *
 * Role wale raaste se alag zaroorat hai: vendor kisi role mein nahi
 * aata, wo apne login se juda hua hota hai. Machine us ki taraf rawana
 * ho to khabar usay milni chahiye, poore daftar ko nahi.
 */
export async function notifyUser(userId: string | null | undefined, title: string, message: string, linkUrl?: string) {
  if (!userId) return;
  await insertForUsers([userId], title, message, linkUrl);
}

/** Notify everyone with a specific role (e.g. "finance", "warehouse"). */
export async function notifyRole(role: string, title: string, message: string, linkUrl?: string) {
  const supabase = createClient();
  const { data: recipients } = await supabase.from("profiles").select("id").eq("role", role).eq("is_active", true);
  await insertForUsers((recipients ?? []).map((r) => r.id), title, message, linkUrl);
}

/** Notify everyone matching any of several roles (e.g. HQ approvers). */
export async function notifyRoles(roles: string[], title: string, message: string, linkUrl?: string) {
  const supabase = createClient();
  const { data: recipients } = await supabase.from("profiles").select("id").in("role", roles).eq("is_active", true);
  await insertForUsers((recipients ?? []).map((r) => r.id), title, message, linkUrl);
}

/** Notify every staff member linked to a specific branch (e.g. the ordering shop itself). */
export async function notifyBranch(branchId: string, title: string, message: string, linkUrl?: string) {
  const supabase = createClient();
  const { data: recipients } = await supabase.from("profiles").select("id").eq("branch_id", branchId).eq("is_active", true);
  await insertForUsers((recipients ?? []).map((r) => r.id), title, message, linkUrl);
}

/** Broadcast to every staff member across the whole company (all department roles). */
export async function notifyAllStaff(title: string, message: string, linkUrl?: string) {
  const supabase = createClient();
  const { data: recipients } = await supabase.from("profiles").select("id").in("role", STAFF_ROLES).eq("is_active", true);
  await insertForUsers((recipients ?? []).map((r) => r.id), title, message, linkUrl);
}

/** Broadcast to every branch/shop's staff (anyone with a branch_id set). */
export async function notifyAllBranches(title: string, message: string, linkUrl?: string) {
  const supabase = createClient();
  const { data: recipients } = await supabase.from("profiles").select("id").not("branch_id", "is", null).eq("is_active", true);
  await insertForUsers((recipients ?? []).map((r) => r.id), title, message, linkUrl);
}