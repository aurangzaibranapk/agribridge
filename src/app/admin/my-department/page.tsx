import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { PageHeader, Card } from "@/components/ui/layout-primitives";
import { loadRegistry } from "@/lib/access/registry";
import { loadHeadPower, grantableActions, grantableScope } from "@/lib/access/delegation";
import { TeamClient, HeadLimitNotice, type TeamMember, type GrantableFeature, type ExistingGrant } from "./team-client";
import { t } from "@/lib/i18n/translations";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";

export const dynamic = "force-dynamic";

export default async function MyDepartmentPage() {
  const lang = getLanguageFromCookies("rm");
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return <div className="p-8 text-center text-surface-400">{t("at_login_required", lang)}</div>;

  const power = await loadHeadPower(user.id);
  if (!power) {
    return (
      <div className="p-8 text-center text-sm text-surface-400">
        Aap kisi department ke head nahi hain. Head banane ka ikhtiyar Owner/Admin ke paas hai
        (Department aur Ijazat wale safhe par).
      </div>
    );
  }

  const service = createServiceClient();
  const registry = await loadRegistry();

  // Sirf wo feature jin par head kuch de bhi sakta hai. Zyada dikha kar
  // phir mana kar dena us se bura hota hai.
  const features: GrantableFeature[] = [];
  for (const key of power.featureKeys) {
    const feature = registry.features.get(key);
    const actions = grantableActions(power, key);
    if (!feature || actions.length === 0) continue;
    features.push({ key, label: feature.label, actions, maxScope: grantableScope(power, key) });
  }
  features.sort((a, b) => a.label.localeCompare(b.label));

  const [{ data: staff }, { data: existing }] = await Promise.all([
    service
      .from("profiles")
      .select("id, full_name, role")
      .eq("is_active", true)
      .neq("role", "farmer")
      .neq("id", user.id)
      .order("full_name"),
    service
      .from("user_feature_permissions")
      .select("profile_id, feature_key, actions, data_scope, expires_at")
      .eq("granted_by", user.id),
  ]);

  const members: TeamMember[] = (staff ?? []).map((s) => ({
    id: s.id,
    name: s.full_name ?? "—",
    role: s.role,
  }));

  const grants: ExistingGrant[] = (existing ?? []).map((g) => ({
    profileId: g.profile_id,
    featureKey: g.feature_key,
    actions: (g.actions as string[]) ?? [],
    scope: g.data_scope,
    expiresAt: g.expires_at,
  }));

  return (
    <div className="space-y-4">
      <PageHeader
        title={`${power.departmentLabel} — Meri Team`}
        description="Apni team ko kaam ki ijazat dein. Jo aap ke paas khud nahi, wo aap kisi ko nahi de sakte."
      />

      <HeadLimitNotice actions={power.maxActions} scope={power.maxScope} />

      {features.length === 0 ? (
        <Card className="p-8 text-center text-sm text-surface-400">
          Abhi aap ke paas koi aisi ijazat nahi jo aap aage de saken. Admin se kehein ke aap ki hadd
          barha de.
        </Card>
      ) : (
        <TeamClient members={members} features={features} grants={grants} />
      )}
    </div>
  );
}
