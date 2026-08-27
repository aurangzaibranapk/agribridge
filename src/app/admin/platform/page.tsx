import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { PageHeader, EmptyState } from "@/components/ui/layout-primitives";
import { OnboardForm } from "@/app/admin/platform/onboard-form";
import { OrgActions } from "@/app/admin/platform/org-actions";

export const dynamic = "force-dynamic";

export default async function PlatformPage() {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("role, organization_id").eq("id", user.id).single();

  if (profile?.role !== "super_admin") {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <p className="text-surface-600">Only a Super Admin can access this page.</p>
      </div>
    );
  }

  const { data: organizations } = await supabase
    .from("organizations")
    .select("id, name, slug, is_active, created_at")
    .order("created_at", { ascending: false });

  return (
    <div>
      <PageHeader title="Platform / Clients" description="Manage client organizations using AgriBridge" />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <h2 className="mb-3 font-display text-base font-semibold text-surface-900 dark:text-surface-100">
            Organizations
          </h2>
          {!organizations || organizations.length === 0 ? (
            <EmptyState title="No organizations found" />
          ) : (
            <div className="space-y-2">
              {organizations.map((o) => (
                <div
                  key={o.id}
                  className="flex items-center justify-between rounded-card border border-surface-200 bg-white p-4 shadow-card dark:border-surface-800 dark:bg-surface-900"
                >
                  <div>
                    <p className="font-medium text-surface-900 dark:text-white">{o.name}</p>
                    <p className="text-xs text-surface-400">{o.slug}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        o.is_active
                          ? "bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300"
                          : "bg-surface-100 text-surface-500 dark:bg-surface-800 dark:text-surface-400"
                      }`}
                    >
                      {o.is_active ? "Active" : "Inactive"}
                    </span>
                    <OrgActions orgId={o.id} orgSlug={o.slug} isActive={o.is_active} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <OnboardForm />
      </div>
    </div>
  );
}