import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { canDo } from "@/lib/access/guard";
import { UNRESTRICTED_ROLES } from "@/lib/access/permissions";

const ROLES = new Set(["owner", "super_admin", "admin", "manager", "finance"]);

export async function requireIntelligence(feature: string) {
  const { data: { user } } = await createClient().auth.getUser();
  if (!user) redirect("/login");
  const { data: me } = await (createServiceClient() as any).from("profiles").select("id,role,organization_id,is_active").eq("id", user.id).maybeSingle();
  if (!me?.is_active) redirect("/login");
  const ok = UNRESTRICTED_ROLES.includes(me.role) || (ROLES.has(String(me.role)) && (await canDo(feature, "view")));
  return ok ? me : null;
}
