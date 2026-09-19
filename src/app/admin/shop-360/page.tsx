import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { UNRESTRICTED_ROLES } from "@/lib/access/permissions";

export const dynamic = "force-dynamic";

/**
 * Canonical Shop 360 entry point.
 *
 * Keep every destination UNDER /admin/shop-360 so the existing permission
 * route continues to protect the whole Shop 360 workspace. This avoids
 * creating new sidebar/permission keys just for internal drill-down pages.
 *
 * Staff -> own Shop Match
 * Branch Manager -> own Branch Reconciliation
 * Finance/Admin/Owner -> Organization Reconciliation
 */
export default async function Shop360Entry() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: me } = await supabase
    .from("profiles")
    .select("role, branch_id, shop_id")
    .eq("id", user.id)
    .maybeSingle();

  if (!me) redirect("/login");

  if (UNRESTRICTED_ROLES.includes(me.role) || me.role === "finance") {
    redirect("/admin/shop-360/org");
  }

  if (me.role === "manager") {
    redirect("/admin/shop-360/branch");
  }

  redirect("/admin/shop-360/match");
}
