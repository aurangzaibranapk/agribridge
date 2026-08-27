import Link from "next/link";
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
    const progress = getCropProgress(c.sowing_date, c.expected_harvest_date);
    const cropExpenses = (allExpenses ?? []).filter((e) => e.crop_history_id === c.id).map((e) => ({ ...e, amount: Number(e.amount) }));
    return {
      id: c.id,
      cropName: c.crop_name,
      farmName: farmNameMap.get(c.farm_id) ?? "-",
      sowingDate: c.sowing_date,
      harvestDate: c.expected_harvest_date,
      percent: progress.percent,
      daysRemaining: progress.daysRemaining,
      daysElapsed: progress.daysElapsed,
      totalDays: progress.totalDays,
      areaSownAcres: c.area_sown_acres,
      isBooked: !!c.harvest_booked_at,
      expenses: cropExpenses,
    };
  });

  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <Link href="/portal/dashboard" className="mb-4 inline-block text-sm text-surface-500 hover:text-brand-700">
        {t("back_to_dashboard", lang)}
      </Link>
      <h1 className="font-display text-2xl font-semibold text-surface-900">{t("my_crops_title", lang)}</h1>
      <p className="mt-1 text-surface-500">{t("my_crops_subtitle", lang)}</p>
      {params.error && (
        <p className="mt-4 rounded-card border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          Error: {params.error}
        </p>
      )}

      <AddCropForm farmLand={farmLand} benchmarks={benchmarkMap} />

      <CropsChart
        data={(crops ?? []).map((c) => {
          const p = getCropProgress(c.sowing_date, c.expected_harvest_date);
          return { crop_name: c.crop_name, percent: p.percent, daysRemaining: p.daysRemaining };
        })}
      />

      <h2 className="mt-8 font-display text-lg font-semibold text-surface-900">{t("active_crops", lang)}</h2>
      <div className="mt-3">
        <CropsTable crops={cropRows} expenseOptions={expenseOptions} />
      </div>
    </div>
  );
}