import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/layout-primitives";
import { TenantSettingsForm } from "@/app/admin/platform/tenant-settings/tenant-settings-form";
import { limitLabel, TENANT_PLAN_LIMITS, tenantPlan } from "@/lib/tenant/plan-limits";

export const dynamic = "force-dynamic";

export default async function TenantSettingsPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("organization_id, role, is_active").eq("id", user.id).single();
  if (!profile?.is_active || profile.role !== "super_admin" || !profile.organization_id) redirect("/admin/command-center");

  const { data: organization } = await supabase
    .from("organizations")
    .select("brand_name, logo_url, primary_color, custom_domain, name, subscription_plan, subscription_status")
    .eq("id", profile.organization_id)
    .single();
  if (!organization) redirect("/admin/command-center");

  const [staff, branches, products] = await Promise.all([
    supabase.from("profiles").select("id", { count: "exact", head: true }).eq("organization_id", profile.organization_id).eq("is_active", true),
    supabase.from("branches").select("id", { count: "exact", head: true }).eq("organization_id", profile.organization_id).eq("is_active", true),
    supabase.from("products").select("id", { count: "exact", head: true }).eq("organization_id", profile.organization_id),
  ]);
  const plan = tenantPlan(organization.subscription_plan);
  const limits = TENANT_PLAN_LIMITS[plan];

  return (
    <div>
      <PageHeader title="Tenant Brand Settings" description="Apni organization ka naam, logo, color aur custom domain manage karein." />
      <TenantSettingsForm organization={organization} />
      <section className="mt-6 max-w-2xl rounded-2xl border border-surface-200 bg-white p-6 shadow-sm dark:border-surface-800 dark:bg-surface-900">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><h2 className="font-display text-lg font-bold">Plan & usage</h2><p className="text-sm text-surface-500">Current plan: <span className="font-bold capitalize">{plan}</span> · Status: <span className="font-bold capitalize">{organization.subscription_status}</span></p></div>
          <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold capitalize text-emerald-700">{plan} plan</span>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <Usage label="Active staff" used={staff.count ?? 0} limit={limits.staff} />
          <Usage label="Active branches" used={branches.count ?? 0} limit={limits.branches} />
          <Usage label="Products" used={products.count ?? 0} limit={limits.products} />
        </div>
      </section>
    </div>
  );
}

function Usage({ label, used, limit }: { label: string; used: number; limit: number | null }) {
  const over = limit !== null && used > limit;
  return <div className={`rounded-xl border p-3 ${over ? "border-red-200 bg-red-50" : "border-surface-200 bg-surface-50 dark:border-surface-700 dark:bg-surface-950"}`}><p className="text-xs text-surface-500">{label}</p><p className={`mt-1 text-xl font-bold ${over ? "text-red-700" : "text-surface-900 dark:text-white"}`}>{used} <span className="text-xs font-medium text-surface-500">/ {limitLabel(limit)}</span></p></div>;
}
