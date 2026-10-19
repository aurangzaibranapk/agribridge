import Link from "next/link";
import { redirect } from "next/navigation";
import { CheckCircle2, Clock } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { addFarmAction } from "./actions";
import { DeleteFarmButton } from "./delete-farm-button";
import { LocationPicker } from "@/components/ui/location-picker";
import { MapLink } from "./map-link";
import { checkProfileComplete } from "@/lib/utils/profile-gate";
import { ProfileGateMessage } from "@/components/portal/profile-gate-message";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";
import { PinMap } from "@/components/maps/pin-map";
import { Hero, HeroBtn, Kpi } from "@/components/portal/dairy/dairy-parts";
import { t } from "@/lib/i18n/translations";

export default async function FarmsPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const params = await searchParams;
  const lang = getLanguageFromCookies();
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: farmer } = await supabase
    .from("farmers")
    .select("*")
    .eq("user_id", user.id)
    .single();
  if (!farmer) redirect("/login");

  if (!checkProfileComplete(farmer)) {
    return <ProfileGateMessage />;
  }

  const { data: farms } = await supabase
    .from("farms")
    .select("id, name, area_acres, village, district, latitude, longitude, is_verified, ownership_type, rent_per_acre")
    .eq("farmer_id", farmer.id)
    .order("created_at", { ascending: false });

  const totalLandAcres = (farms ?? []).reduce((sum, f) => sum + Number(f.area_acres), 0);
  const totalFarmsCount = farms?.length ?? 0;

  const farmIds = (farms ?? []).map((f) => f.id);

  const { data: allHarvests } = farmIds.length
    ? await supabase
        .from("harvest_records")
        .select("farm_id, crop_name, quantity_harvested, unit, sale_rate, total_expense")
        .in("farm_id", farmIds)
    : { data: [] };

  const farmStats = (farms ?? []).map((f) => {
    const records = (allHarvests ?? []).filter((h) => h.farm_id === f.id);
    let totalProfit = 0;
    let hasProfitData = false;
    const cropCounts: Record<string, number> = {};

    records.forEach((r) => {
      cropCounts[r.crop_name] = (cropCounts[r.crop_name] ?? 0) + 1;
      if (r.sale_rate !== null && r.total_expense !== null) {
        totalProfit += r.quantity_harvested * r.sale_rate - r.total_expense;
        hasProfitData = true;
      }
    });

    const cropLossCounts: Record<string, number> = {};
    records.forEach((r) => {
      if (r.sale_rate !== null && r.total_expense !== null) {
        const p = r.quantity_harvested * r.sale_rate - r.total_expense;
        if (p < 0) cropLossCounts[r.crop_name] = (cropLossCounts[r.crop_name] ?? 0) + 1;
      }
    });
    const lossCrops = Object.keys(cropLossCounts).filter((c) => cropLossCounts[c] >= 2);

    return {
      farm: f,
      recordCount: records.length,
      crops: Object.keys(cropCounts),
      totalProfit,
      hasProfitData,
      lossCrops,
    };
  });

  const pins = (farms ?? []).filter((f) => f.latitude != null && f.longitude != null).map((f) => ({ id: f.id, lat: Number(f.latitude), lng: Number(f.longitude), label: f.name, color: f.is_verified ? "#16a34a" : "#f59e0b" }));
  const verifiedCount = (farms ?? []).filter((f) => f.is_verified).length;
  const recordsTotal = farmStats.reduce((a, f) => a + f.recordCount, 0);
  const lbl = "text-xs font-medium text-surface-600 dark:text-slate-300";
  const inp = "mt-1 w-full rounded-lg border border-surface-200 bg-white p-2 text-sm text-surface-900 dark:border-surface-700 dark:bg-surface-800 dark:text-white dark:[color-scheme:dark]";
  const card = "rounded-2xl border border-surface-200 bg-white p-4 shadow-sm dark:border-surface-800 dark:bg-surface-900";

  return (
    <div className="pf-fit mx-auto w-full max-w-[1760px] space-y-5 px-4 py-6 sm:px-6 fit:gap-2.5 fit:space-y-0 fit:py-3">
      <Hero title={<>🌾 {t("my_farms_title", lang)}</>} sub={t("my_farms_subtitle", lang)}>
        <HeroBtn href="#add-farm" primary>➕ {t("add_new_farm_heading", lang)}</HeroBtn>
        <HeroBtn href="/portal/crops">🌱 {t("nav_crops", lang)}</HeroBtn>
        <HeroBtn href="/portal/harvest">📊 {t("nav_farm_management", lang)}</HeroBtn>
      </Hero>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4 fit:grid-cols-4 fit:gap-2.5">
        <Kpi tone="green" label={t("total_land_auto", lang)} value={`${totalLandAcres} ${t("acres_unit", lang)}`} sub={`${totalFarmsCount} ${t("total_farms_auto", lang)}`} />
        <Kpi tone="sky" label={t("total_farms_auto", lang)} value={String(totalFarmsCount)} sub={`${verifiedCount} ${t("verified", lang)} · ${totalFarmsCount - verifiedCount} ${t("unverified", lang)}`} />
        <Kpi tone="violet" label={t("os2_harvests", lang)} value={String(recordsTotal)} sub={t("crops_grown", lang)} />
        <Kpi tone="amber" label={t("os2_rented_farms", lang)} value={String((farms ?? []).filter((f) => f.ownership_type === "rented").length)} sub={t("owned_or_rented", lang)} />
      </div>

      {params.error && (
        <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-200">
          {t("error_prefix", lang)}: {params.error}
        </p>
      )}

      <div className="pf-grow pf-grid grid gap-4 lg:grid-cols-2 fit:grid-cols-[1fr_1.25fr_1.1fr] fit:gap-2.5">
      <form id="add-farm" action={addFarmAction} className={`pf-panel ${card} fit:p-3.5`}>
        <h2 className="mb-2 font-display text-[15px] font-semibold text-surface-900 dark:text-white">➕ {t("add_new_farm_heading", lang)}</h2>
        <div className="pf-body space-y-3">
        <div>
          <label className={lbl}>{t("farm_name", lang)}</label>
          <input type="text" name="name" required placeholder={t("eg_farm_name", lang)} className={inp} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className={lbl}>{t("area_acres", lang)}</label>
            <input type="number" step="0.1" name="area_acres" required placeholder={t("eg_area", lang)} className={inp} />
          </div>
          <div>
            <label className={lbl}>{t("owned_or_rented", lang)}</label>
            <select name="ownership_type" className={inp} defaultValue="owned">
              <option value="owned">{t("owned", lang)}</option>
              <option value="rented">{t("rented", lang)}</option>
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className={lbl}>{t("village_optional", lang)}</label>
            <input type="text" name="village" className={inp} />
          </div>
          <div>
            <label className={lbl}>{t("district_optional", lang)}</label>
            <input type="text" name="district" className={inp} />
          </div>
        </div>
        <div>
          <label className={lbl}>{t("rent_per_acre", lang)}</label>
          <input type="number" step="1" name="rent_per_acre" placeholder={t("eg_rent", lang)} className={inp} />
        </div>
        <div>
          <label className={`mb-1 block ${lbl}`}>{t("pin_location_optional", lang)}</label>
          <LocationPicker lang={lang} />
        </div>
        <button type="submit" className="w-full rounded-lg bg-brand-600 py-2 text-sm font-medium text-white hover:bg-brand-700">
          {t("add_farm_btn", lang)}
        </button>
        <p className="text-center text-xs text-surface-400">
          {t("unverified_hint", lang)}
        </p>
        </div>
      </form>

      <section className={`pf-panel ${card} fit:p-3.5`}>
      <h2 className="mb-2 font-display text-[15px] font-semibold text-surface-900 dark:text-white">{t("my_farms_list", lang)} <span className="text-xs font-normal text-surface-500">· {totalFarmsCount}</span></h2>
      <div className="pf-body space-y-3">
        {farmStats.length === 0 ? (
          <p className="rounded-xl border border-dashed border-surface-200 p-6 text-center text-sm text-surface-400 dark:border-surface-700">
            {t("no_farms_yet", lang)}
          </p>
        ) : (
          farmStats.map((fs) => (
            <div key={fs.farm.id} className="rounded-xl border border-surface-200 p-3.5 dark:border-surface-700">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold text-surface-900 dark:text-white">{fs.farm.name}</p>
                  {fs.farm.is_verified ? (
                    <span className="flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-[10px] font-medium text-green-700 dark:bg-green-500/15 dark:text-green-300">
                      <CheckCircle2 className="h-3 w-3" /> {t("verified", lang)}
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
                      <Clock className="h-3 w-3" /> {t("unverified", lang)}
                    </span>
                  )}
                  {fs.farm.ownership_type === "rented" && (
                    <span className="rounded-full bg-purple-50 px-2 py-0.5 text-[10px] font-medium text-purple-700 dark:bg-purple-500/15 dark:text-purple-300">
                      {t("rented", lang)} - Rs {fs.farm.rent_per_acre}/acre
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <p className="text-xs text-surface-500 dark:text-slate-400">
                    {fs.farm.area_acres} {t("acres_unit", lang)} {fs.farm.village ? `- ${fs.farm.village}` : ""} {fs.farm.district ? `, ${fs.farm.district}` : ""}
                  </p>
                  <DeleteFarmButton farmId={fs.farm.id} />
                </div>
              </div>

              <MapLink latitude={fs.farm.latitude} longitude={fs.farm.longitude} />

              <div className="mt-2.5 grid grid-cols-3 gap-2 border-t border-surface-100 pt-2.5 text-sm dark:border-surface-800">
                <div>
                  <p className="text-xs text-surface-500 dark:text-slate-400">{t("harvest_records", lang)}</p>
                  <p className="font-medium text-surface-900 dark:text-white">{fs.recordCount}</p>
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-surface-500 dark:text-slate-400">{t("crops_grown", lang)}</p>
                  <p className="truncate font-medium text-surface-900 dark:text-white" title={fs.crops.join(", ")}>{fs.crops.length ? fs.crops.join(", ") : "-"}</p>
                </div>
                <div className="text-end">
                  <p className="text-xs text-surface-500 dark:text-slate-400">{t("total_profit_loss", lang)}</p>
                  <p className={`font-medium ${!fs.hasProfitData ? "text-surface-400" : fs.totalProfit >= 0 ? "text-green-600" : "text-red-600"}`}>
                    {!fs.hasProfitData ? "-" : `${fs.totalProfit >= 0 ? "+" : ""}Rs. ${fs.totalProfit.toLocaleString()}`}
                  </p>
                </div>
              </div>

              <div className="mt-2.5 border-t border-surface-100 pt-2.5 text-xs dark:border-surface-800">
                {fs.recordCount < 2 ? (
                  <p className="text-surface-400">{t("not_enough_data", lang)}</p>
                ) : (
                  <>
                    {fs.hasProfitData && fs.totalProfit < 0 && (
                      <p className="text-red-600">{t("farm_overall_loss", lang)}</p>
                    )}
                    {fs.lossCrops.length > 0 && (
                      <p className="text-amber-600">{fs.lossCrops.join(", ")} {t("farm_recurring_loss", lang)}</p>
                    )}
                    {fs.hasProfitData && fs.totalProfit >= 0 && fs.lossCrops.length === 0 && (
                      <p className="text-green-600">{t("farm_overall_good", lang)}</p>
                    )}
                  </>
                )}
              </div>
            </div>
          ))
        )}
      </div>
      </section>

      <section className={`pf-panel ${card} lg:col-span-2 fit:col-span-1 fit:p-3.5`} data-testid="farms-map">
        <h2 className="mb-2 font-display text-[15px] font-semibold text-surface-900 dark:text-white">🗺️ {t("os2_farms_map", lang)} <span className="text-xs font-normal text-surface-500">· {pins.length}/{totalFarmsCount}</span></h2>
        <div className="pf-body h-72 overflow-hidden rounded-xl fit:h-auto">
          {pins.length ? <PinMap fill height={288} pins={pins} fitKey={`${pins.length}`} className="h-full" /> : <p className="grid h-full place-items-center p-6 text-center text-sm text-surface-400">{t("os2_no_pins", lang)}</p>}
        </div>
      </section>
      </div>
    </div>
  );
}
