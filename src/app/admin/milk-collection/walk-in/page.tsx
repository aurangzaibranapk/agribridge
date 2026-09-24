import { createClient } from "@/lib/supabase/server";
import { t } from "@/lib/i18n/translations";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";
import { PageHeader, Card } from "@/components/ui/layout-primitives";
import { WalkInClient } from "./walk-in-client";

export const dynamic = "force-dynamic";

const MCO_ROLES = ["owner", "super_admin", "admin", "manager", "milk_collection"];

export default async function WalkInPage() {
  const supabase = createClient();
  const lang = getLanguageFromCookies("rm");
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: me } = user
    ? await supabase.from("profiles").select("role, is_active").eq("id", user.id).maybeSingle()
    : { data: null };

  if (!me?.is_active || !MCO_ROLES.includes(me.role)) {
    return <div className="p-8 text-center text-surface-400">{t("at_chiller_only", lang)}</div>;
  }

  const today = new Date().toISOString().slice(0, 10);

  const [{ data: staff }, { data: mine }] = await Promise.all([
    supabase.from("staff_details").select("milk_chiller_name").eq("profile_id", user!.id).maybeSingle(),
    supabase
      .from("milk_entries")
      .select("id, collection_number, quantity_liters, total_amount, farmers(full_name, farmer_code)")
      .eq("collection_source", "self_delivery")
      .eq("entry_date", today)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  const liters = (mine ?? []).reduce((sum, e) => sum + Number(e.quantity_liters), 0);
  const amount = (mine ?? []).reduce((sum, e) => sum + Number(e.total_amount ?? 0), 0);

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <PageHeader
        title={t("mk_walkin_page_title", lang)}
        description={t("mk_walkin_page_sub", lang)}
      />

      <div className="grid grid-cols-3 gap-3">
        <Card className="p-4">
          <p className="text-xs text-surface-500">{t("mk_today", lang)}</p>
          <p className="mt-1 text-2xl font-semibold text-surface-900 dark:text-white">{mine?.length ?? 0}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-surface-500">{t("at_milk", lang)}</p>
          <p className="mt-1 text-2xl font-semibold text-surface-900 dark:text-white">
            {Math.round(liters * 10) / 10} L
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-surface-500">{t("at_amount", lang)}</p>
          <p className="mt-1 text-2xl font-semibold text-surface-900 dark:text-white">
            {Math.round(amount).toLocaleString()}
          </p>
        </Card>
      </div>

      <WalkInClient chiller={staff?.milk_chiller_name ?? "Chiller"} />

      <Card className="overflow-hidden">
        <div className="border-b border-surface-200 px-4 py-3 dark:border-surface-800">
          <h3 className="text-sm font-semibold text-surface-900 dark:text-white">{t("at_walkin_today", lang)}</h3>
        </div>
        {(mine ?? []).length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-surface-400">{t("at_no_walkin_today", lang)}</p>
        ) : (
          <ul className="divide-y divide-surface-100 dark:divide-surface-800">
            {(mine ?? []).map((e) => {
              const farmer = Array.isArray(e.farmers) ? e.farmers[0] : e.farmers;
              return (
                <li key={e.id} className="flex items-start justify-between gap-2 px-4 py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-surface-900 dark:text-white">
                      {farmer?.farmer_code} — {farmer?.full_name ?? "—"}
                    </p>
                    <p className="text-xs text-surface-400">
                      {Number(e.quantity_liters)} L • {e.collection_number}
                    </p>
                  </div>
                  <span className="shrink-0 text-sm font-semibold text-surface-900 dark:text-white">
                    Rs {Math.round(Number(e.total_amount ?? 0)).toLocaleString()}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
