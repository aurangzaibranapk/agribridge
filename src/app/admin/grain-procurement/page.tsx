import { createClient } from "@/lib/supabase/server";
import { t } from "@/lib/i18n/translations";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";
import { PageHeader, Card } from "@/components/ui/layout-primitives";
import { GrainClient } from "@/app/admin/grain-procurement/grain-client";

export const dynamic = "force-dynamic";

export default async function AdminGrainProcurementPage() {
  const supabase = createClient();
  const lang = getLanguageFromCookies("rm");
  const [
    { data: farmers },
    { data: parties },
    { data: warehouses },
    { data: cutPresets },
    { data: financeAccounts },
    { data: rawEntries },
    { data: rawPayments },
  ] = await Promise.all([
    supabase.from("farmers").select("id, full_name, farmer_code").eq("is_deleted", false).order("full_name"),
    supabase.from("grain_parties").select("id, party_name, contact_person, phone").eq("is_active", true).order("party_name"),
    supabase.from("warehouses").select("id, name").eq("is_active", true).order("name"),
    supabase.from("grain_cut_presets").select("id, grain_type, label, cut_percentage").eq("is_active", true).order("grain_type"),
    supabase.from("finance_accounts").select("id, name, account_type").eq("is_active", true).order("account_type"),
    supabase
      .from("grain_procurement_entries")
      .select("id, entry_date, grain_type, gross_weight_kg, cut_percentage, cut_kg, weight_kg, moisture_percentage, quality_grade, rate_per_kg, total_amount, farmer_id, party_id, farmers(full_name), grain_parties(party_name)")
      .order("entry_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(200),
    supabase
      .from("grain_procurement_payments")
      .select("id, amount, payment_method, notes, created_at, farmer_id, party_id, farmers(full_name), grain_parties(party_name)")
      .order("created_at", { ascending: false })
      .limit(200),
  ]);

  const entries = (rawEntries ?? []).map((e: any) => {
    const farmer = Array.isArray(e.farmers) ? e.farmers[0] : e.farmers;
    const party = Array.isArray(e.grain_parties) ? e.grain_parties[0] : e.grain_parties;
    return {
      id: e.id,
      entry_date: e.entry_date,
      grain_type: e.grain_type,
      gross_weight_kg: Number(e.gross_weight_kg ?? e.weight_kg),
      cut_percentage: Number(e.cut_percentage ?? 0),
      cut_kg: Number(e.cut_kg ?? 0),
      weight_kg: Number(e.weight_kg),
      moisture_percentage: e.moisture_percentage,
      quality_grade: e.quality_grade,
      rate_per_kg: Number(e.rate_per_kg),
      total_amount: Number(e.total_amount),
      seller_id: e.farmer_id ?? e.party_id,
      seller_type: e.farmer_id ? "farmer" : "party",
      seller_name: farmer?.full_name ?? party?.party_name ?? "-",
    };
  });

  const payments = (rawPayments ?? []).map((p: any) => {
    const farmer = Array.isArray(p.farmers) ? p.farmers[0] : p.farmers;
    const party = Array.isArray(p.grain_parties) ? p.grain_parties[0] : p.grain_parties;
    return {
      id: p.id,
      amount: Number(p.amount),
      payment_method: p.payment_method,
      notes: p.notes,
      created_at: p.created_at,
      seller_id: p.farmer_id ?? p.party_id,
      seller_type: p.farmer_id ? "farmer" : "party",
      seller_name: farmer?.full_name ?? party?.party_name ?? "-",
    };
  });

  const balanceMap: Record<string, { seller_id: string; seller_type: string; seller_name: string; total_supplied: number; total_paid: number; entry_count: number }> = {};
  entries.forEach((e) => {
    const key = `${e.seller_type}-${e.seller_id}`;
    if (!balanceMap[key]) balanceMap[key] = { seller_id: e.seller_id, seller_type: e.seller_type, seller_name: e.seller_name, total_supplied: 0, total_paid: 0, entry_count: 0 };
    balanceMap[key].total_supplied += e.total_amount;
    balanceMap[key].entry_count += 1;
  });
  payments.forEach((p) => {
    const key = `${p.seller_type}-${p.seller_id}`;
    if (!balanceMap[key]) balanceMap[key] = { seller_id: p.seller_id, seller_type: p.seller_type, seller_name: p.seller_name, total_supplied: 0, total_paid: 0, entry_count: 0 };
    balanceMap[key].total_paid += p.amount;
  });
  const balances = Object.values(balanceMap)
    .map((b) => ({ ...b, balance_due: b.total_supplied - b.total_paid }))
    .sort((a, b) => b.balance_due - a.balance_due);

  const totalPurchasedKg = entries.reduce((s, e) => s + e.weight_kg, 0);
  const totalSpent = entries.reduce((s, e) => s + e.total_amount, 0);
  const totalPaidOut = payments.reduce((s, p) => s + p.amount, 0);
  const totalOutstanding = totalSpent - totalPaidOut;

  const byGrainType = ["wheat", "rice", "maize"].map((type) => {
    const typeEntries = entries.filter((e) => e.grain_type === type);
    return {
      grain_type: type,
      totalKg: typeEntries.reduce((s, e) => s + e.weight_kg, 0),
      totalValue: typeEntries.reduce((s, e) => s + e.total_amount, 0),
      entryCount: typeEntries.length,
    };
  });

  return (
    <div>
      <PageHeader title={t("gr_title", lang)} description={t("gr_subtitle", lang)} />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <p className="text-xs font-medium uppercase tracking-wide text-surface-500">{t("at_total_bought_kg", lang)}</p>
          <p className="mt-2 font-display text-xl font-semibold text-surface-900 dark:text-white">{totalPurchasedKg.toLocaleString()} kg</p>
        </Card>
        <Card>
          <p className="text-xs font-medium uppercase tracking-wide text-surface-500">{t("at_total_expense", lang)}</p>
          <p className="mt-2 font-display text-xl font-semibold text-surface-900 dark:text-white">Rs {totalSpent.toLocaleString()}</p>
        </Card>
        <Card className="border-green-200 bg-green-50 dark:border-green-900/40 dark:bg-green-950/30">
          <p className="text-xs font-medium uppercase tracking-wide text-green-600">{t("at_total_paid", lang)}</p>
          <p className="mt-2 font-display text-xl font-semibold text-green-700">Rs {totalPaidOut.toLocaleString()}</p>
        </Card>
        <Card className="border-amber-200 bg-amber-50 dark:border-amber-900/40 dark:bg-amber-950/30">
          <p className="text-xs font-medium uppercase tracking-wide text-amber-600">{t("at_payable", lang)}</p>
          <p className="mt-2 font-display text-xl font-semibold text-amber-700">Rs {totalOutstanding.toLocaleString()}</p>
        </Card>
      </div>

      <GrainClient
        farmers={farmers ?? []}
        parties={parties ?? []}
        warehouses={warehouses ?? []}
        cutPresets={cutPresets ?? []}
        financeAccounts={financeAccounts ?? []}
        entries={entries}
        payments={payments}
        balances={balances}
        byGrainType={byGrainType}
      />
    </div>
  );
}