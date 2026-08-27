import Link from "next/link";
import { redirect } from "next/navigation";
import { ShoppingBag } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { AddHarvestForm } from "./add-harvest-form";
import { checkProfileComplete } from "@/lib/utils/profile-gate";
import { ProfileGateMessage } from "@/components/portal/profile-gate-message";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";
import { t } from "@/lib/i18n/translations";

export default async function HarvestPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const params = await searchParams;
  const supabase = createClient();
  const lang = getLanguageFromCookies();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: farmer } = await supabase.from("farmers").select("*").eq("user_id", user.id).single();
  if (!farmer) redirect("/login");
  if (!checkProfileComplete(farmer)) {
    return <ProfileGateMessage />;
  }
  const { data: farms } = await supabase.from("farms").select("id, name").eq("farmer_id", farmer.id);
  const farmIds = (farms ?? []).map((f) => f.id);
  const { data: bookedCrops } = farmIds.length
    ? await supabase
        .from("crop_history")
        .select("id, crop_name, farm_id, expected_harvest_date, farms(name)")
        .in("farm_id", farmIds)
    : { data: [] };
  const { data: recordedCropIds } = farmIds.length
    ? await supabase.from("harvest_records").select("crop_history_id").in("farm_id", farmIds).not("crop_history_id", "is", null)
    : { data: [] };
  const recordedIds = new Set((recordedCropIds ?? []).map((r) => r.crop_history_id));
  const unrecordedBooked = (bookedCrops ?? []).filter((c) => !recordedIds.has(c.id));
  const cropHistoryIds = unrecordedBooked.map((c) => c.id);
  const { data: allExpenses } = cropHistoryIds.length
    ? await supabase.from("crop_expenses").select("crop_history_id, amount").in("crop_history_id", cropHistoryIds)
    : { data: [] };
  const { data: recentGrainRates } = await supabase
    .from("grain_procurement_entries")
    .select("grain_type, rate_per_kg, entry_date")
    .order("entry_date", { ascending: false })
    .limit(20);
  function suggestedRateFor(cropName: string): number | null {
    const match = (recentGrainRates ?? []).find((g) => g.grain_type.toLowerCase() === cropName.toLowerCase());
    return match ? Number(match.rate_per_kg) : null;
  }
  const readyToRecord = unrecordedBooked.map((c: any) => {
    const expenses = (allExpenses ?? []).filter((e) => e.crop_history_id === c.id);
    const totalExpense = expenses.reduce((sum, e) => sum + Number(e.amount), 0);
    return {
      id: c.id,
      farmId: c.farm_id,
      cropName: c.crop_name,
      farmName: Array.isArray(c.farms) ? c.farms[0]?.name : c.farms?.name,
      expectedHarvestDate: c.expected_harvest_date,
      totalExpense,
      suggestedRate: suggestedRateFor(c.crop_name),
    };
  });

  const { data: harvests } = farmIds.length
    ? await supabase
        .from("harvest_records")
        .select("id, crop_name, harvest_date, quantity_harvested, unit, quality_grade, sale_rate, total_expense")
        .in("farm_id", farmIds)
        .order("harvest_date", { ascending: false })
    : { data: [] };
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <Link href="/portal/dashboard" className="mb-4 inline-block text-sm text-surface-500 hover:text-brand-700">
        {t("back_to_dashboard", lang)}
      </Link>
      <h1 className="font-display text-2xl font-semibold text-surface-900">{t("farm_mgmt_title", lang)}</h1>
      <p className="mt-1 text-surface-500">{t("farm_mgmt_subtitle", lang)}</p>
      {params.error && (
        <p className="mt-4 rounded-card border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {t("error_prefix", lang)}: {params.error}
        </p>
      )}
      <div className="mt-6">
        <AddHarvestForm farms={farms ?? []} readyToRecord={readyToRecord} />
      </div>
      <div className="mt-4 text-center">
        <Link href="/portal/sell-produce" className="inline-flex items-center gap-1 text-sm font-medium text-green-700 hover:underline">
          <ShoppingBag className="h-4 w-4" /> {t("sell_produce_title", lang)}
        </Link>
      </div>
      <h2 className="mt-8 font-display text-lg font-semibold text-surface-900">{t("crop_history_title", lang)}</h2>
      <div className="mt-3 overflow-x-auto rounded-card border border-surface-200 bg-white shadow-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-surface-200 bg-surface-50 text-left text-xs font-medium text-surface-500">
              <th className="px-4 py-2">{t("table_year_header", lang)}</th>
              <th className="px-4 py-2">{t("crop", lang)}</th>
              <th className="px-4 py-2">{t("table_production_header", lang)}</th>
              <th className="px-4 py-2">{t("table_rate_header", lang)}</th>
              <th className="px-4 py-2">{t("table_expense_header", lang)}</th>
              <th className="px-4 py-2">{t("table_profit_loss_header", lang)}</th>
              <th className="px-4 py-2">{t("table_quality_header", lang)}</th>
            </tr>
          </thead>
          <tbody>
            {!harvests || harvests.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-surface-400">
                  {t("no_harvest_records", lang)}
                </td>
              </tr>
            ) : (
              harvests.map((h) => {
                const revenue = h.sale_rate ? h.quantity_harvested * h.sale_rate : null;
                const profit = revenue !== null && h.total_expense !== null ? revenue - h.total_expense : null;
                return (
                  <tr key={h.id} className="border-b border-surface-100 last:border-0">
                    <td className="px-4 py-2">{new Date(h.harvest_date).getFullYear()}</td>
                    <td className="px-4 py-2">{h.crop_name}</td>
                    <td className="px-4 py-2">{h.quantity_harvested} {h.unit}</td>
                    <td className="px-4 py-2">{h.sale_rate ? `Rs. ${h.sale_rate}` : "-"}</td>
                    <td className="px-4 py-2">{h.total_expense ? `Rs. ${h.total_expense}` : "-"}</td>
                    <td className={`px-4 py-2 font-medium ${profit === null ? "text-surface-400" : profit >= 0 ? "text-green-600" : "text-red-600"}`}>
                      {profit === null ? "-" : `${profit >= 0 ? "+" : ""}Rs. ${profit.toLocaleString()}`}
                    </td>
                    <td className="px-4 py-2">{h.quality_grade || "-"}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}