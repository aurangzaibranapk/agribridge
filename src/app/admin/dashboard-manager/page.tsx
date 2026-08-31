import { createClient } from "@/lib/supabase/server";
import { PageHeader, Card } from "@/components/ui/layout-primitives";
import { loadRegistry } from "@/lib/access/registry";
import { ManagerClient, type DashboardInfo, type FeatureInfo, type RolePerm, type DeptInfo } from "./manager-client";
import { t } from "@/lib/i18n/translations";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";

export const dynamic = "force-dynamic";

const MASTER_ROLES = ["owner", "super_admin", "admin"];

export default async function DashboardManagerPage() {
  const lang = getLanguageFromCookies("rm");
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: me } = user
    ? await supabase.from("profiles").select("role, is_active").eq("id", user.id).maybeSingle()
    : { data: null };

  if (!me?.is_active || !MASTER_ROLES.includes(me.role)) {
    return <div className="p-8 text-center text-surface-400">{t("c_only_owner_admin", lang)}</div>;
  }

  const registry = await loadRegistry();

  const [{ data: perms }, { data: depts }] = await Promise.all([
    supabase.from("role_feature_permissions").select("role, feature_key, actions, data_scope"),
    supabase.from("departments").select("role, label").eq("is_active", true).order("sort_order"),
  ]);

  const dashboards: DashboardInfo[] = registry.dashboards.map((d) => ({
    key: d.key,
    label: d.label,
    summary: d.summary,
    featureKeys: registry.byDashboard.get(d.key) ?? [],
  }));

  const features: FeatureInfo[] = [...registry.features.values()]
    .map((f) => ({
      key: f.key,
      label: f.label,
      route: f.route,
      isSensitive: f.isSensitive,
      dashboardKeys: registry.dashboardsOf.get(f.key) ?? [],
    }))
    .sort((a, b) => a.label.localeCompare(b.label));

  const rolePerms: RolePerm[] = (perms ?? []).map((p) => ({
    role: p.role,
    featureKey: p.feature_key,
    actions: (p.actions as string[]) ?? [],
    scope: p.data_scope,
  }));

  const departments: DeptInfo[] = (depts ?? []).map((d) => ({ role: d.role, label: d.label }));

  // Ek se zyada dashboard par lage hue feature -- yahi wo cheez hai jise
  // pehle chaar jagah alag alag likha jata tha.
  const shared = features.filter((f) => f.dashboardKeys.length > 1).length;
  const orphan = features.filter((f) => f.dashboardKeys.length === 0).length;

  return (
    <div className="space-y-4">
      <PageHeader
        title={t("dm_title", lang)}
        description="Kaun sa kaam kis dashboard par nazar aaye — aur us par kaun kya kar sakta hai."
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card className="p-4">
          <p className="text-xs text-surface-500">{t("dm_dashboard", lang)}</p>
          <p className="mt-1 text-2xl font-semibold text-surface-900 dark:text-white">{dashboards.length}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-surface-500">{t("dm_feature", lang)}</p>
          <p className="mt-1 text-2xl font-semibold text-surface-900 dark:text-white">{features.length}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-surface-500">{t("dm_multi_place", lang)}</p>
          <p className="mt-1 text-2xl font-semibold text-brand-700 dark:text-brand-400">{shared}</p>
          <p className="text-xs text-surface-400">{t("dm_one_thing", lang)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-surface-500">{t("dm_on_no_dashboard", lang)}</p>
          <p className={`mt-1 text-2xl font-semibold ${orphan ? "text-amber-600" : "text-surface-900 dark:text-white"}`}>
            {orphan}
          </p>
        </Card>
      </div>

      <ManagerClient
        dashboards={dashboards}
        features={features}
        rolePerms={rolePerms}
        departments={departments}
      />
    </div>
  );
}
