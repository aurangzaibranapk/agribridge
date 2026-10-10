import { createClient } from "@/lib/supabase/server";
import { UNRESTRICTED_ROLES } from "@/lib/access/permissions";

/**
 * Paisa hilane wale kaam ki rok — sirf Owner, Super Admin ya Admin.
 *
 * Finance review (9 October 2026): Cash Book, opening balance, transfer,
 * bank qatar, grain kharcha aur billing settings par koi role rok nahi
 * thi. Malik ka faisla: manzoori aur posting sirf Admin/Super Admin/Owner.
 */
export type MoneyGate = { ok: true; userId: string; role: string } | { ok: false; error: string };

export async function requireMoneyAdmin(kaam: string): Promise<MoneyGate> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Login karein." };
  const { data: me } = await supabase.from("profiles").select("role, is_active").eq("id", user.id).maybeSingle();
  if (!me?.is_active) return { ok: false, error: "Ye account fa'aal nahi hai." };
  if (!UNRESTRICTED_ROLES.includes(me.role as string)) {
    return { ok: false, error: `${kaam} sirf Owner, Super Admin ya Admin kar sakte hain. Admin se karwayein.` };
  }
  return { ok: true, userId: user.id, role: me.role as string };
}
