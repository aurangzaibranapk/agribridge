import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/layout-primitives";
import { PermissionsClient } from "./permissions-client";

export const dynamic = "force-dynamic";

export default async function AdminPermissionsPage() {
  const supabase = createClient();
  const { data: staff } = await supabase
    .from("profiles")
    .select("id, full_name, role, allowed_pages")
    .eq("is_active", true)
    .in("role", ["manager", "sales_staff", "finance", "warehouse", "hr", "admin_assistant", "procurement", "milk_collection"])
    .order("role")
    .order("full_name");
  return (
    <div>
      <PageHeader title="Staff Permissions" description="Har staff member ke liye khud tay karein wo kya kya dekh sake" />
      <PermissionsClient staff={(staff ?? []).map((s) => ({ ...s, allowed_pages: s.allowed_pages as string[] | null }))} />
    </div>
  );
}