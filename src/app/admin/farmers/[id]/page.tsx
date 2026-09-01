import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/layout-primitives";
import { AdminFarmerForm } from "@/app/admin/farmers/[id]/admin-farmer-form";
import { FarmVerifyActions } from "@/app/admin/farmers/[id]/farm-verify-actions";
import { ExpenseStatement } from "@/components/portal/expense-statement";
import { FarmerChangeHistory } from "@/app/admin/farmers/[id]/change-history";
import { FarmerMachineryHistory } from "@/app/admin/farmers/[id]/machinery-history";
import { BackButton } from "@/components/ui/back-button";
import { t } from "@/lib/i18n/translations";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";

export const dynamic = "force-dynamic";

export default async function AdminFarmerDetailPage({ params }: { params: { id: string } }) {
  const lang = getLanguageFromCookies("rm");
  const supabase = createClient();
  const { data: farmer } = await supabase.from("farmers").select("*").eq("id", params.id).single();

  if (!farmer) notFound();

  const { data: farms } = await supabase
    .from("farms")
    .select("id, name, area_acres, village, district, is_verified")
    .eq("farmer_id", farmer.id)
    .order("created_at", { ascending: false });

  const farmIds = (farms ?? []).map((f) => f.id);

  const { data: crops } = farmIds.length
    ? await supabase.from("crop_history").select("id").in("farm_id", farmIds)
    : { data: [] };
  const cropIds = (crops ?? []).map((c) => c.id);

  const { data: allExpenses } = cropIds.length
    ? await supabase.from("crop_expenses").select("expense_category, amount").in("crop_history_id", cropIds)
    : { data: [] };

  const { data: harvests } = farmIds.length
    ? await supabase.from("harvest_records").select("quantity_harvested, sale_rate").in("farm_id", farmIds)
    : { data: [] };

  const categoryTotalsMap: Record<string, number> = {};
  (allExpenses ?? []).forEach((e) => {
    categoryTotalsMap[e.expense_category] = (categoryTotalsMap[e.expense_category] ?? 0) + Number(e.amount);
  });
  const categoryTotals = Object.entries(categoryTotalsMap).map(([category, amount]) => ({ category, amount }));
  const totalExpense = Object.values(categoryTotalsMap).reduce((sum, v) => sum + v, 0);
  const totalRevenue = (harvests ?? []).reduce((sum, h) => (h.sale_rate !== null ? sum + h.quantity_harvested * h.sale_rate : sum), 0);

  return (
    <div>
      <BackButton fallback="/admin/farmers" label={t("fp_back", lang)} />
      <PageHeader title={`Farmer: ${farmer.full_name}`} description={farmer.farmer_code} />

      <div className="mb-6">
        <ExpenseStatement categoryTotals={categoryTotals} totalExpense={totalExpense} totalRevenue={totalRevenue} />
      </div>

      <div className="mb-6 rounded-card border border-surface-200 bg-white p-5 shadow-card dark:border-surface-800 dark:bg-surface-900">
        <h2 className="mb-3 font-display text-base font-semibold text-surface-900 dark:text-white">{t("c_farms", lang)}</h2>
        {!farms || farms.length === 0 ? (
          <p className="text-sm text-surface-400">{t("fp_no_farm", lang)}</p>
        ) : (
          <div className="space-y-2">
            {farms.map((f) => (
              <div key={f.id} className="flex items-center justify-between rounded-lg border border-surface-100 p-3 dark:border-surface-800">
                <div>
                  <p className="text-sm font-medium text-surface-800 dark:text-surface-200">{f.name}</p>
                  <p className="text-xs text-surface-400">
                    {f.area_acres} acres {f.village ? `- ${f.village}` : ""} {f.district ? `, ${f.district}` : ""}
                  </p>
                </div>
                <FarmVerifyActions farmId={f.id} isVerified={f.is_verified} />
              </div>
            ))}
          </div>
        )}
      </div>

      <FarmerMachineryHistory farmerId={farmer.id} />

      <AdminFarmerForm farmer={farmer} />

      {/* Edit ka haq hai, magar us ke sath uska record bhi. Ijazat
          bina nishaan ke dena wo cheez hai jis ka jawab baad mein koi
          nahi de pata. */}
      <div className="mt-6">
        <FarmerChangeHistory farmerId={farmer.id} />
      </div>
    </div>
  );
}