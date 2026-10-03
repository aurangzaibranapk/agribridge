import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/layout-primitives";
import { TenantSettingsForm } from "@/app/admin/platform/tenant-settings/tenant-settings-form";

export const dynamic = "force-dynamic";

export default async function TenantSettingsPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("organization_id, role, is_active").eq("id", user.id).single();
  if (!profile?.is_active || profile.role !== "super_admin" || !profile.organization_id) redirect("/admin/command-center");

  const { data: organization } = await supabase
    .from("organizations")
    .select("brand_name, logo_url, primary_color, custom_domain, name")
    .eq("id", profile.organization_id)
    .single();
  if (!organization) redirect("/admin/command-center");

  return (
    <div>
      <PageHeader title="Tenant Brand Settings" description="Apni organization ka naam, logo, color aur custom domain manage karein." />
      <TenantSettingsForm organization={organization} />
    </div>
  );
}
