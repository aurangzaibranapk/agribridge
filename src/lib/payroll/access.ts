import { createClient } from "@/lib/supabase/server";

export const PAY_WRITER_ROLES = ["hr", "finance", "admin", "owner", "super_admin"];
export const PAY_APPROVER_ROLES = ["admin", "owner", "super_admin"];
export const QIST_MAKER_ROLES = ["hr", "finance", "manager", "admin", "owner", "super_admin"];

export async function payrollViewer() {
  const sb = createClient() as any;
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;
  const { data: p } = await sb.from("profiles").select("id, role, is_active, full_name").eq("id", user.id).maybeSingle();
  if (!p?.is_active) return null;
  const role = String(p.role);
  return {
    sb, id: user.id as string, name: p.full_name as string | null, role,
    writer: PAY_WRITER_ROLES.includes(role), approver: PAY_APPROVER_ROLES.includes(role), qistMaker: QIST_MAKER_ROLES.includes(role),
  };
}
