import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/layout-primitives";
import { GrantVerifierForm } from "./grant-verifier-form";
import { RevokeVerifierButton } from "./revoke-verifier-button";
import { t } from "@/lib/i18n/translations";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";

export const dynamic = "force-dynamic";

export default async function LossVerifiersPage() {
  const lang = getLanguageFromCookies("rm");
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user?.id ?? "").maybeSingle();
  const isHQ = ["super_admin", "admin", "owner"].includes(profile?.role ?? "");

  if (!isHQ) {
    return <div className="p-8 text-center text-surface-400">{t("rv_admin_only", lang)}</div>;
  }

  const [{ data: staff }, { data: shops }, { data: rawGrants }] = await Promise.all([
    supabase.from("profiles").select("id, full_name, role").eq("is_active", true).order("full_name"),
    supabase.from("shops").select("id, name").eq("is_active", true).order("name"),
    supabase.from("loss_verifiers").select("id, profile_id, shop_id, created_at, profiles(full_name), shops(name)").order("created_at", { ascending: false }),
  ]);

  const grants = (rawGrants ?? []).map((g: any) => {
    const staffProfile = Array.isArray(g.profiles) ? g.profiles[0] : g.profiles;
    const shop = Array.isArray(g.shops) ? g.shops[0] : g.shops;
    return {
      id: g.id,
      staff_name: staffProfile?.full_name ?? "Unknown",
      shop_name: shop?.name ?? "Sab Shops",
      created_at: g.created_at,
    };
  });

  return (
    <div>
      <PageHeader title={t("rv_title", lang)} description="Kisi bhi staff member ko chahe uska koi bhi role ho - Loss verify karne ki ijazat dein" />

      <div className="mb-6">
        <GrantVerifierForm
          staff={(staff ?? []).map((s) => ({ id: s.id, name: s.full_name ?? "User", role: s.role }))}
          shops={(shops ?? []).map((s) => ({ id: s.id, name: s.name }))}
        />
      </div>

      <div className="overflow-hidden rounded-card border border-surface-200 bg-white shadow-card dark:border-surface-800 dark:bg-surface-900">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-surface-200 bg-surface-50 text-left dark:border-surface-800 dark:bg-surface-800">
              <th className="px-4 py-3 font-medium text-surface-500">{t("rv_staff_member", lang)}</th>
              <th className="px-4 py-3 font-medium text-surface-500">Shop (khaali = Sab Shops)</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {grants.map((g) => (
              <tr key={g.id} className="border-b border-surface-100 last:border-0 dark:border-surface-800">
                <td className="px-4 py-3 font-medium text-surface-800 dark:text-surface-200">{g.staff_name}</td>
                <td className="px-4 py-3 text-surface-600 dark:text-surface-400">{g.shop_name}</td>
                <td className="px-4 py-3"><RevokeVerifierButton grantId={g.id} /></td>
              </tr>
            ))}
            {grants.length === 0 && (
              <tr><td colSpan={3} className="px-4 py-8 text-center text-surface-400">{t("rv_none_yet", lang)}</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}