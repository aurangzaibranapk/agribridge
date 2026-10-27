import { createClient as createAuthClient, type SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

/**
 * API routes ke liye login/role ki rok.
 *
 * Middleware sirf /admin aur /portal ko bachata hai — /api ko nahi. Is
 * liye jo bhi route paisa, email ya settings ko haath lagata hai usay
 * apni rok khud lagani parti hai.
 *
 * Mobile app cookie nahi bhejti. Authorization: Bearer wahi user JWT hai
 * jo portal ka password login deta hai. Cookie wala raasta pehle jaisa hai.
 */
const STAFF_ROLES = [
  "owner", "super_admin", "admin", "admin_assistant", "manager",
  "sales_staff", "finance", "warehouse", "hr", "procurement", "milk_collection",
  "machinery",
];

const ADMIN_ROLES = ["owner", "super_admin", "admin"];

export interface ApiCaller {
  userId: string;
  role: string;
}

function bearer(request?: Request): string | null {
  const header = request?.headers.get("authorization") ?? "";
  const match = /^Bearer\s+(\S+)/i.exec(header);
  return match?.[1]?.trim() || null;
}

/** Cookie session, ya mobile ka Bearer token. Dono se wahi user. */
export async function requestUser(request?: Request): Promise<{ userId: string; supabase: SupabaseClient } | null> {
  const token = bearer(request);
  if (token) {
    const supabase = createAuthClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false, autoRefreshToken: false } }
    );
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data.user) return null;
    return { userId: data.user.id, supabase };
  }
  const supabase = createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return null;
  return { userId: data.user.id, supabase: supabase as unknown as SupabaseClient };
}

/** Login hai aur staff hai? Warna wajah wapas aati hai. */
export async function requireStaff(request?: Request): Promise<{ caller: ApiCaller } | { error: string; status: number }> {
  const auth = await requestUser(request);
  if (!auth) return { error: "Login zaroori hai.", status: 401 };

  const { data: profile } = await auth.supabase.from("profiles").select("role, is_active").eq("id", auth.userId).maybeSingle();
  if (!profile || !profile.is_active) return { error: "Ye account fa'aal nahi hai.", status: 403 };
  if (!STAFF_ROLES.includes(profile.role)) return { error: "Aapko is kaam ki ijazat nahi hai.", status: 403 };

  return { caller: { userId: auth.userId, role: profile.role } };
}

/** Sirf admin darje ke log. */
export async function requireAdmin(request?: Request): Promise<{ caller: ApiCaller } | { error: string; status: number }> {
  const result = await requireStaff(request);
  if ("error" in result) return result;
  if (!ADMIN_ROLES.includes(result.caller.role)) return { error: "Sirf admin ye kaam kar sakta hai.", status: 403 };
  return result;
}
