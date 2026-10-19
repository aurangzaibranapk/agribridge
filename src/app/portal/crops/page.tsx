import { redirect } from "next/navigation";
import { getCropProgress } from "@/lib/utils/crop-duration";
import { createClient } from "@/lib/supabase/server";
import CropsChart from "./CropsChart";
import { CropsTable } from "./crops-table";
import { AddCropForm } from "./add-crop-form";
import { checkProfileComplete } from "@/lib/utils/profile-gate";
import { ProfileGateMessage } from "@/components/portal/profile-gate-message";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";
import { t } from "@/lib/i18n/translations";
import { Hero, HeroBtn, Kpi } from "@/components/portal/dairy/dairy-parts";

export default async function CropsPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
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

  const { data: farms } = await supabase.from("farms").select("id, name, area_acres").eq("farmer_id", farmer.id);
  const farmIds = (farms ?? []).map((f) => f.id);
  const farmNameMap = new Map((farms ?? []).map((f) => [f.id, f.name]));

  const { data: crops } = farmIds.length
    ? await supabase
        .from("crop_history")
        .select("id, crop_name, farm_id, sowing_date, expected_harvest_date, area_sown_acres, harvest_booked_at")
        .in("farm_id", farmIds)
        .order("sowing_date", { ascending: false })
    : { data: [] };

  const cropIds = (crops ?? []).map((c) => c.id);

  const { data: allExpenses } = cropIds.length
    ? await supabase
        .from("crop_expenses")
        .select("id, crop_history_id, expense_category, source, description, amount")
        .in("crop_history_id", cropIds)
    : { data: [] };

  const [{ data: landPrepRates }, { data: laborRates }, { data: fertilizerProducts }, { data: pesticideProducts }, { data: seedProducts }] = await Promise.all([
    supabase.from("land_prep_rates").select("id, activity_name, rate_per_acre").eq("is_active", true).order("activity_name"),
    supabase.from("labor_rates").select("id, labor_type, rate").eq("is_active", true).order("labor_type"),
    supabase.from("products").select("id, name, mrp_price, selling_price, categories(name)").eq("is_available", true).eq("is_deleted", false),
    supabase.from("products").select("id, name, mrp_price, selling_price, categories(name)").eq("is_available", true).eq("is_deleted", false),
    supabase.from("products").select("id, name, mrp_price, selling_price, categories(name)").eq("is_available", true).eq("is_deleted", false),
  ]);

  function filterByCategory(products: any[] | null, categoryName: string) {
    return (products ?? []).filter((p: any) => {
      const cat = Array.isArray(p.categories) ? p.categories[0]?.name : p.categories?.name;
      return cat === categoryName;
    }).map((p: any) => ({ id: p.id, name: p.name, rate: Number(p.mrp_price ?? p.selling_price) }));
  }

  const expenseOptions = {
    landPrep: (landPrepRates ?? []).map((r) => ({ id: r.id, name: r.activity_name, rate: Number(r.rate_per_acre) })),
    labor: (laborRates ?? []).map((r) => ({ id: r.id, name: r.labor_type, rate: Number(r.rate) })),
    fertilizer: filterByCategory(fertilizerProducts, "Fertilizer"),
    pesticide: filterByCategory(pesticideProducts, "Pesticide"),
    seed: filterByCategory(seedProducts, "Seeds"),
  };

  const { data: harvestedCropIds } = cropIds.length
    ? await supabase.from("harvest_records").select("crop_history_id").in("crop_history_id", cropIds)
    : { data: [] };
  const harvestedSet = new Set((harvestedCropIds ?? []).map((h) => h.crop_history_id));

  const { data: benchmarks } = await supabase.rpc("fn_crop_profit_benchmarks");
  const benchmarkMap: Record<string, { costPerAcre: number; yieldPerAcre: number; rate: number; sampleCount: number }> = {};
  (benchmarks ?? []).forEach((b: any) => {
    benchmarkMap[b.crop_name] = {
      costPerAcre: Number(b.avg_cost_per_acre ?? 0),
      yieldPerAcre: Number(b.avg_yield_per_acre ?? 0),
      rate: Number(b.avg_sale_rate ?? 0),
      sampleCount: Number(b.sample_count ?? 0),
    };
  });

  const farmLand = (farms ?? []).map((f) => {
    const used = (crops ?? [])
      .filter((c) => c.farm_id === f.id && c.area_sown_acres !== null && !harvestedSet.has(c.id))
      .reduce((sum, c) => sum + Number(c.area_sown_acres), 0);
    const total = Number(f.area_acres);
    return { id: f.id, name: f.name, total, used, available: Math.max(0, total - used) };
  });

  const cropRows = (crops ?? []).map((c) => {
    const progress = getCropProgress(c.sowing_date ?? "", c.expected_harvest_date ?? "");
    const cropExpenses = (allExpenses ?? []).filter((e) => e.crop_history_id === c.id).map((e) => ({ ...e, amount: Number(e.amount) }));
    return {
      id: c.id,
      cropName: c.crop_name ?? "",
      farmName: farmNameMap.get(c.farm_id) ?? "-",
      sowingDate: c.sowing_date ?? "",
      harvestDate: c.expected_harvest_date ?? "",
      percent: progress.percent,
      daysRemaining: progress.daysRemaining,
      daysElapsed: progress.daysElapsed,
      totalDays: progress.totalDays,
      areaSownAcres: c.area_sown_acres,
      isBooked: !!c.harvest_booked_at,
      expenses: cropExpenses,
    };
  });

  const chartData = (crops ?? []).map((c) => {
    const p = getCropProgress(c.sowing_date ?? "", c.expected_harvest_date ?? "");
    return { crop_name: c.crop_name ?? "", percent: p.percent, daysRemaining: p.daysRemaining };
  });
  const active = cropRows.filter((c) => !harvestedSet.has(c.id));
  const sown = active.reduce((a, c) => a + Number(c.areaSownAcres ?? 0), 0);
  const ready = active.filter((c) => c.daysRemaining <= 14).length;
  const spent = (allExpenses ?? []).reduce((a, e) => a + Number(e.amount ?? 0), 0);
  const land = farmLand.reduce((a, f) => a + f.total, 0);

  return (
    <div className="pf-fit mx-auto w-full max-w-[1760px] space-y-5 px-4 py-6 sm:px-6 fit:gap-2.5 fit:space-y-0 fit:py-3">
      <Hero title={<>🌱 {t("my_crops_title", lang)}</>} sub={t("my_crops_subtitle", lang)}>
        <HeroBtn href="#add-crop" primary>➕ {t("add_new_crop", lang)}</HeroBtn>
        <HeroBtn href="/portal/farms">🌾 {t("my_farms_title", lang)}</HeroBtn>
        <HeroBtn href="/portal/harvest">📊 {t("nav_farm_management", lang)}</HeroBtn>
      </Hero>
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4 fit:grid-cols-4 fit:gap-2.5">
        <Kpi tone="green" label={t("active_crops", lang)} value={String(active.length)} sub={`${cropRows.length} ${t("os2_crops_total", lang)}`} />
        <Kpi tone="sky" label={t("os2_sown", lang)} value={`${Math.round(sown * 10) / 10} / ${Math.round(land * 10) / 10}`} sub={t("acres_unit", lang)} />
        <Kpi tone="amber" label={t("os2_ready_soon", lang)} value={String(ready)} sub={t("os2_ready_sub", lang)} />
        <Kpi tone="rose" label={t("os2_spent", lang)} value={`Rs ${Math.round(spent).toLocaleString("en-IN")}`} sub={`${(allExpenses ?? []).length} ${t("os2_entries", lang)}`} />
      </div>
      {params.error && (
        <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-200">
          Error: {params.error}
        </p>
      )}

      <div className="pf-grow pf-grid grid gap-4 lg:grid-cols-[1fr_1.6fr] fit:grid-cols-[1fr_2fr] fit:gap-2.5">
        <div id="add-crop" className="pf-scroll"><AddCropForm className="" farmLand={farmLand} benchmarks={benchmarkMap} /></div>
        <div className="flex min-h-0 flex-col gap-4 fit:gap-2.5">
          <CropsChart className="shrink-0" maxHeight={170} data={chartData} />
          <section className="flex min-h-0 flex-1 flex-col">
            <h2 className="mb-2 font-display text-[15px] font-semibold text-surface-900 dark:text-white">{t("active_crops", lang)}</h2>
            <CropsTable className="pf-scroll pf-sticky min-h-0 flex-1" crops={cropRows} expenseOptions={expenseOptions} />
          </section>
        </div>
      </div>
    </div>
  );
}
