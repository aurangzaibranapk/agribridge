import { createClient } from "@/lib/supabase/server";
import { t } from "@/lib/i18n/translations";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";
import { PageHeader } from "@/components/ui/layout-primitives";
import { MilkClient } from "@/app/admin/milk-collection/milk-client";
import { FarmerSettingsPanel } from "@/app/admin/milk-collection/farmer-settings-panel";
export const dynamic = "force-dynamic";
export default async function AdminMilkCollectionPage() {
  const supabase = createClient();
  const lang = getLanguageFromCookies("rm");
  const [{ data: farmers }, { data: rawEntries }, { data: balances }, { data: rateSettings }, { data: rawMigrations }, { data: branches }] = await Promise.all([
    supabase.from("farmers").select("id, full_name, farmer_code, milk_collection_type").eq("is_deleted", false).order("full_name"),
    supabase
      .from("milk_entries")
      .select("id, entry_date, shift, quantity_liters, fat_percentage, snf_percentage, rate_per_liter, total_amount, farmers(full_name), branches(name)")
      .order("entry_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(50),
    supabase.from("milk_farmer_balances").select("*").order("balance_due", { ascending: false }),
    supabase.from("milk_rate_settings").select("standard_rate, self_dropoff_incentive, snf_constant, reference_ts").limit(1).single(),
    supabase.from("milk_type_migrations").select("id, old_type, new_type, changed_at, farmers(full_name)").order("changed_at", { ascending: false }).limit(30),
    supabase.from("branches").select("id, name").order("is_main_branch", { ascending: false }).order("name"),
  ]);
  const entries = (rawEntries ?? []).map((e: any) => ({
    id: e.id,
    entry_date: e.entry_date,
    shift: e.shift,
    quantity_liters: Number(e.quantity_liters),
    fat_percentage: e.fat_percentage,
    snf_percentage: e.snf_percentage,
    rate_per_liter: Number(e.rate_per_liter),
    total_amount: Number(e.total_amount),
    farmer_name: Array.isArray(e.farmers) ? e.farmers[0]?.full_name : e.farmers?.full_name,
    branch_name: Array.isArray(e.branches) ? e.branches[0]?.name : e.branches?.name,
  }));
  const normalizedBalances = (balances ?? []).map((b: any) => ({
    farmer_id: b.farmer_id,
    full_name: b.full_name,
    farmer_code: b.farmer_code,
    total_supplied: Number(b.total_supplied),
    total_paid: Number(b.total_paid),
    balance_due: Number(b.balance_due),
  }));
  const migrations = (rawMigrations ?? []).map((m: any) => ({
    id: m.id,
    old_type: m.old_type,
    new_type: m.new_type,
    changed_at: m.changed_at,
    farmer_name: Array.isArray(m.farmers) ? m.farmers[0]?.full_name : m.farmers?.full_name,
  }));
  return (
    <div>
      <PageHeader title={t("mk_title", lang)} description={t("mk_subtitle", lang)} />
      <MilkClient farmers={farmers ?? []} entries={entries} balances={normalizedBalances} branches={branches ?? []} />
      <FarmerSettingsPanel
        farmers={(farmers ?? []) as any}
        rateSettings={rateSettings ?? { standard_rate: 145, self_dropoff_incentive: 10, snf_constant: 0.805, reference_ts: 13 }}
        migrations={migrations}
      />
    </div>
  );
}