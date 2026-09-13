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
  "machinery",
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

/**
 * Sirf USI branch ka manager -- `notifyBranch` poori branch ke sab
 * staff ko khabar deta hai, `notifyRole("manager", ...)` sab branches
 * ke managers ko. Malik ka usool (8 September, POS Collection spec):
 * "Mahabali Branch ki activity -> Mahabali Branch Manager. Doosri
 * branch managers -> NAHI." Ek profile ka sirf ek `branch_id` hota hai
 * (koi multi-branch manager table maujood nahi) -- is liye ye sirf
 * usi ek branch tak mehdood rehta hai.
 */
export async function notifyBranchManagers(branchId: string | null, title: string, message: string, linkUrl?: string) {
  if (!branchId) return;
  const supabase = createClient();
  const { data: recipients } = await supabase
    .from("profiles")
    .select("id")
    .eq("role", "manager")
    .eq("branch_id", branchId)
    .eq("is_active", true);
  await insertForUsers((recipients ?? []).map((r) => r.id), title, message, linkUrl);
}

/**
 * Ohde (position) se khabar -- role se nahi. "CEO" `profiles.role`
 * mein kahin nahi hai; wo `staff_details.position_key` ka ek ohda hai,
 * jo role se jaan boojh kar alag rakha gaya (334: "banda CEO ho sakta
 * hai role owner ke sath; koi Assistant Admin ho sakta hai role manager
 * ke sath"). Koi is ohde par na ho to khamoshi se khali fehrist --
 * ghalti nahi.
 */
export async function notifyPositionHolders(positionKey: string, title: string, message: string, linkUrl?: string) {
  const supabase = createClient();
  const { data: recipients } = await supabase
    .from("staff_details")
    .select("profile_id, profiles!inner(is_active)")
    .eq("position_key", positionKey)
    .eq("profiles.is_active", true);
  await insertForUsers((recipients ?? []).map((r) => r.profile_id), title, message, linkUrl);
}