import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AddHarvestForm } from "./add-harvest-form";
import { checkProfileComplete } from "@/lib/utils/profile-gate";
import { ProfileGateMessage } from "@/components/portal/profile-gate-message";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";
import { t } from "@/lib/i18n/translations";
import { Hero, HeroBtn, Kpi } from "@/components/portal/dairy/dairy-parts";

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
  const hs = harvests ?? [];
  const profitOf = (h: (typeof hs)[number]) => (h.sale_rate && h.total_expense !== null ? h.quantity_harvested * h.sale_rate - h.total_expense : null);
  const totalProfit = hs.reduce((a, h) => a + (profitOf(h) ?? 0), 0);
  const withProfit = hs.filter((h) => profitOf(h) !== null).length;
  const thisYear = new Date().getFullYear();
  const card = "rounded-2xl border border-surface-200 bg-white shadow-sm dark:border-surface-800 dark:bg-surface-900";
  return (
    <div className="pf-fit mx-auto w-full max-w-[1760px] space-y-5 px-4 py-6 sm:px-6 fit:gap-2.5 fit:space-y-0 fit:py-3">
      <Hero title={<>📊 {t("farm_mgmt_title", lang)}</>} sub={t("farm_mgmt_subtitle", lang)}>
        <HeroBtn href="/portal/sell-produce" primary>🛍️ {t("sell_produce_title", lang)}</HeroBtn>
        <HeroBtn href="/portal/crops">🌱 {t("nav_crops", lang)}</HeroBtn>
        <HeroBtn href="/portal/farms">🌾 {t("my_farms_title", lang)}</HeroBtn>
      </Hero>
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4 fit:grid-cols-4 fit:gap-2.5">
        <Kpi tone="green" label={t("os2_harvests", lang)} value={String(hs.length)} sub={`${hs.filter((h) => new Date(h.harvest_date).getFullYear() === thisYear).length} · ${thisYear}`} />
        <Kpi tone="amber" label={t("os2_to_record", lang)} value={String(readyToRecord.length)} sub={readyToRecord.slice(0, 2).map((r) => r.cropName).join(", ") || "—"} />
        <Kpi tone={totalProfit >= 0 ? "violet" : "rose"} label={t("os2_profit", lang)} value={`${totalProfit < 0 ? "-" : ""}Rs ${Math.abs(Math.round(totalProfit)).toLocaleString("en-IN")}`} sub={`${withProfit} / ${hs.length}`} />
        <Kpi tone="sky" label={t("my_farms_title", lang)} value={String((farms ?? []).length)} sub={(farms ?? []).map((f) => f.name).slice(0, 2).join(", ") || "—"} />
      </div>
      {params.error && (
        <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-200">
          {t("error_prefix", lang)}: {params.error}
        </p>
      )}
      <div className="pf-grow pf-grid grid gap-4 lg:grid-cols-[1fr_1.5fr] fit:grid-cols-[1fr_1.7fr] fit:gap-2.5">
        <div className="pf-scroll"><AddHarvestForm farms={farms ?? []} readyToRecord={readyToRecord} /></div>
        <section className={`pf-panel ${card} p-4 fit:p-3.5`}>
          <h2 className="mb-2 font-display text-[15px] font-semibold text-surface-900 dark:text-white">{t("crop_history_title", lang)} <span className="text-xs font-normal text-surface-500 dark:text-slate-400">· {hs.length}</span></h2>
          <div className="pf-body overflow-x-auto">
<table className="w-full text-sm">
          <thead>
            <tr className="border-b border-surface-200 bg-surface-50 text-start text-xs font-medium text-surface-500 dark:text-slate-400 dark:border-surface-700 dark:bg-surface-800">
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
                  <tr key={h.id} className="border-b border-surface-100 last:border-0 dark:border-surface-800">
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
        </section>
      </div>
    </div>
  );

}