import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { UNRESTRICTED_ROLES } from "@/lib/access/permissions";

export const dynamic = "force-dynamic";

/**
 * Canonical Shop 360 entry point.
 *
 * The old report-heavy screen has been retired from this route because it
 * could show FIFO as the main stock figure and could look "all clear" while
 * shop-level receivable/bank verification was incomplete. The new hierarchy
 * keeps one control model:
 *
 * Staff -> own Shop Match
 * Branch Manager -> own Branch Reconciliation
 * Finance/Admin/Owner -> Organization Reconciliation
 *
 * Existing source modules (cash control, POS outstanding, investment,
 * expenses, deposits, etc.) remain reused by the destination pages.
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
    redirect("/admin/shop-360-org");
  }

  if (me.role === "manager") {
    redirect("/admin/shop-360-branch");
  }

  redirect("/admin/shop-360-match");
}
