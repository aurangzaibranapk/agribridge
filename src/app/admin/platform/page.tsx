import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { PageHeader, EmptyState } from "@/components/ui/layout-primitives";
import { OnboardForm } from "@/app/admin/platform/onboard-form";
import { OrgActions } from "@/app/admin/platform/org-actions";
import { t } from "@/lib/i18n/translations";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";
import { createServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

export default async function PlatformPage() {
  const lang = getLanguageFromCookies("rm");
  const supabase = createClient();
  const serviceClient = createServiceClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("role, organization_id").eq("id", user.id).single();

  if (profile?.role !== "super_admin") {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <p className="text-surface-600">{t("at_super_admin_only", lang)}</p>
      </div>
    );
  }

  const { data: organizations } = await serviceClient
    .from("organizations")
    .select("id, name, slug, is_active, created_at, custom_domain, subscription_plan, subscription_status")
    .order("created_at", { ascending: false });

  return (
    <div>
      <PageHeader title={t("at_platform_clients", lang)} description="Manage client organizations using AgriBridge" />
      <div className="mb-5"><a href="/admin/platform/requests" className="inline-flex rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-bold text-emerald-800">Organization Requests</a></div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <h2 className="mb-3 font-display text-base font-semibold text-surface-900 dark:text-surface-100">{t("at_organizations", lang)}</h2>
          {!organizations || organizations.length === 0 ? (
            <EmptyState title={t("at_no_orgs", lang)} />
          ) : (
            <div className="space-y-2">
              {organizations.map((o) => (
                <div
                  key={o.id}
                  className="flex items-center justify-between rounded-card border border-surface-200 bg-white p-4 shadow-card dark:border-surface-800 dark:bg-surface-900"
                >
                  <div>
                    <p className="font-medium text-surface-900 dark:text-white">{o.name}</p>
                    <p className="text-xs text-surface-400">{o.slug}{o.custom_domain ? ` · ${o.custom_domain}` : ""} · {o.subscription_plan}</p>
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
