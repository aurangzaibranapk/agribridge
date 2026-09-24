import { createClient } from "@/lib/supabase/server";
import { t } from "@/lib/i18n/translations";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";
import { PageHeader, Card } from "@/components/ui/layout-primitives";
import { VerifyClient, type PricedEntry } from "./verify-client";
import { canDo } from "@/lib/access/guard";

export const dynamic = "force-dynamic";

const VERIFY_ROLES = ["owner", "super_admin", "admin", "manager"];

export default async function MilkVerifyPage() {
  const supabase = createClient();
  const lang = getLanguageFromCookies("rm");
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: me } = user
    ? await supabase.from("profiles").select("role, is_active").eq("id", user.id).maybeSingle()
    : { data: null };

  if (!me?.is_active || !VERIFY_ROLES.includes(me.role)) {
    return <div className="p-8 text-center text-surface-400">{t("at_manager_admin_only", lang)}</div>;
  }

  const mayVerify = await canDo("milk-collection.verify", "verify");

  const { data: rows } = await supabase
    .from("milk_entries")
    .select("id, collection_number, quantity_liters, fat_percentage, ts_value, total_amount, route_name, entry_channel, collection_source, flags, possible_duplicate_of, entry_date, shift, farmers(full_name, farmer_code)")
    .eq("status", "priced")
    .order("entry_date", { ascending: false })
    .order("created_at")
    .limit(200);

  const entries: PricedEntry[] = (rows ?? []).map((row) => {
    const farmer = Array.isArray(row.farmers) ? row.farmers[0] : row.farmers;
    return {
      id: row.id,
      collection_number: row.collection_number ?? "—",
      farmer_label: `${farmer?.farmer_code ?? "—"} — ${farmer?.full_name ?? "—"}`,
      route: `${row.route_name ?? t("mk_no_route", lang)} • ${row.entry_date} ${t(row.shift === "morning" ? "mk_morning" : "mk_evening", lang)}`,
      liters: Number(row.quantity_liters),
      fat: row.fat_percentage == null ? null : Number(row.fat_percentage),
      ts: row.ts_value == null ? null : Number(row.ts_value),
      amount: row.total_amount == null ? 0 : Number(row.total_amount),
      channel: row.entry_channel,
      collectionSource: row.collection_source,
      flags: Array.isArray(row.flags) ? (row.flags as string[]) : [],
      duplicate: row.possible_duplicate_of != null,
    };
  });

  const total = entries.reduce((sum, e) => sum + e.amount, 0);

  return (
    <div className="space-y-4">
      <PageHeader
        title={t("mk_verify_title", lang)}
        description={t("mk_verify_subtitle", lang)}
      />

      <div className="grid grid-cols-2 gap-3">
        <Card className="p-4">
          <p className="text-xs text-surface-500">{t("at_waiting", lang)}</p>
          <p className="mt-1 text-2xl font-semibold text-surface-900 dark:text-white">{entries.length}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-surface-500">{t("at_total_amount", lang)}</p>
          <p className="mt-1 text-2xl font-semibold text-surface-900 dark:text-white">
            Rs {Math.round(total).toLocaleString()}
          </p>
        </Card>
      </div>

      {mayVerify ? (
        <VerifyClient entries={entries} />
      ) : (
        <Card className="p-6 text-center text-sm text-surface-500">{t("at_view_only", lang)}</Card>
      )}
    </div>
  );
}
