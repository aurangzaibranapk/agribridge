import { createClient } from "@/lib/supabase/server";

/**
 * API routes ke liye login/role ki rok.
 *
 * Middleware sirf /admin aur /portal ko bachata hai — /api ko nahi. Is
 * liye jo bhi route paisa, email ya settings ko haath lagata hai usay
 * apni rok khud lagani parti hai.
 */
const STAFF_ROLES = [
  "owner", "super_admin", "admin", "admin_assistant", "manager",
  "sales_staff", "finance", "warehouse", "hr", "procurement", "milk_collection",
];

const ADMIN_ROLES = ["owner", "super_admin", "admin"];

export interface ApiCaller {
  userId: string;
  role: string;
}

/** Login hai aur staff hai? Warna wajah wapas aati hai. */
export async function requireStaff(): Promise<{ caller: ApiCaller } | { error: string; status: number }> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Login zaroori hai.", status: 401 };

  const { data: profile } = await supabase.from("profiles").select("role, is_active").eq("id", user.id).maybeSingle();
  if (!profile || !profile.is_active) return { error: "Ye account fa'aal nahi hai.", status: 403 };
  if (!STAFF_ROLES.includes(profile.role)) return { error: "Aapko is kaam ki ijazat nahi hai.", status: 403 };

  return { caller: { userId: user.id, role: profile.role } };
}

/** Sirf admin darje ke log. */
export async function requireAdmin(): Promise<{ caller: ApiCaller } | { error: string; status: number }> {
  const result = await requireStaff();
  if ("error" in result) return result;
  if (!ADMIN_ROLES.includes(result.caller.role)) return { error: "Sirf admin ye kaam kar sakta hai.", status: 403 };
  return result;
}
