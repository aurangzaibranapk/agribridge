"use client";
import { useState, useMemo } from "react";
import { LandPlot, TrendingUp, Info } from "lucide-react";
import { addCropAction } from "./actions";
import { CROP_NAMES } from "@/lib/utils/crop-duration";
import { useLanguage } from "@/hooks/useLanguage";
import { t } from "@/lib/i18n/translations";

interface FarmLand {
  id: string;
  name: string;
  total: number;
  used: number;
  available: number;
}

interface Benchmark {
  costPerAcre: number;
  yieldPerAcre: number;
  rate: number;
  sampleCount: number;
}

export function AddCropForm({ farmLand, benchmarks }: { farmLand: FarmLand[]; benchmarks: Record<string, Benchmark> }) {
  const { language: lang } = useLanguage();
  const [selectedFarmId, setSelectedFarmId] = useState("");
  const [selectedCrop, setSelectedCrop] = useState(CROP_NAMES[0] ?? "");
  const [areaAcre, setAreaAcre] = useState("");
  const [areaKanal, setAreaKanal] = useState("");
  const [areaMarla, setAreaMarla] = useState("");

  const selectedFarm = farmLand.find((f) => f.id === selectedFarmId);

  const totalAreaAcres = useMemo(() => {
    const acre = parseFloat(areaAcre) || 0;
    const kanal = parseFloat(areaKanal) || 0;
    const marla = parseFloat(areaMarla) || 0;
    return acre + kanal / 8 + marla / 160;
  }, [areaAcre, areaKanal, areaMarla]);

  const benchmark = benchmarks[selectedCrop];
  const prediction = useMemo(() => {
    if (!benchmark || totalAreaAcres <= 0 || benchmark.sampleCount < 1) return null;
    const expectedCost = benchmark.costPerAcre * totalAreaAcres;
    const expectedYield = benchmark.yieldPerAcre * totalAreaAcres;
    const expectedRevenue = expectedYield * benchmark.rate;
    const expectedProfit = expectedRevenue - expectedCost;
    return { expectedCost, expectedYield, expectedRevenue, expectedProfit };
  }, [benchmark, totalAreaAcres]);

  return (
    <form action={addCropAction} className="mt-6 space-y-3 rounded-card border border-surface-200 bg-white p-4 shadow-card">
      <h2 className="font-display text-sm font-semibold text-surface-900">{t("add_new_crop", lang)}</h2>

      <div>
        <label className="text-xs font-medium text-surface-600">{t("farm_label", lang)}</label>
        <select
          name="farm_id"
          required
          value={selectedFarmId}
          onChange={(e) => setSelectedFarmId(e.target.value)}
          className="mt-1 w-full rounded-lg border border-surface-200 p-2 text-sm"
        >
          <option value="" disabled>{t("select_farm", lang)}</option>
          {farmLand.map((f) => (
            <option key={f.id} value={f.id}>{f.name}</option>
          ))}
        </select>
        {selectedFarm && (
          <div className="mt-2 flex items-center gap-2 rounded-lg bg-brand-50 px-3 py-2 text-xs text-brand-800">
            <LandPlot className="h-3.5 w-3.5 shrink-0" />
            <span>
              {t("land_total_label", lang)} <strong>{selectedFarm.total}</strong> {t("unit_acre", lang)} - {t("land_used_label", lang)} <strong>{selectedFarm.used.toFixed(1)}</strong> {t("unit_acre", lang)} - {t("land_available_label", lang)} <strong>{selectedFarm.available.toFixed(1)}</strong> {t("unit_acre", lang)}
            </span>
          </div>
        )}
      </div>

      <div>
        <label className="text-xs font-medium text-surface-600">{t("crop", lang)}</label>
        <select
          name="crop_name"
          required
          value={selectedCrop}
          onChange={(e) => setSelectedCrop(e.target.value)}
          className="mt-1 w-full rounded-lg border border-surface-200 p-2 text-sm"
        >
          {CROP_NAMES.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="text-xs font-medium text-surface-600">{t("sowing_date", lang)}</label>
        <input type="date" name="sowing_date" required className="mt-1 w-full rounded-lg border border-surface-200 p-2 text-sm" />
      </div>

      <div>
        <label className="text-xs font-medium text-surface-600">{t("area_optional", lang)}</label>
        <div className="mt-1 grid grid-cols-3 gap-2">
          <input type="number" step="1" min="0" name="area_acre" value={areaAcre} onChange={(e) => setAreaAcre(e.target.value)} placeholder={t("unit_acre", lang)} className="w-full rounded-lg border border-surface-200 p-2 text-sm" />
          <input type="number" step="1" min="0" max="7" name="area_kanal" value={areaKanal} onChange={(e) => setAreaKanal(e.target.value)} placeholder={t("unit_kanal", lang)} className="w-full rounded-lg border border-surface-200 p-2 text-sm" />
          <input type="number" step="1" min="0" max="19" name="area_marla" value={areaMarla} onChange={(e) => setAreaMarla(e.target.value)} placeholder={t("unit_marla", lang)} className="w-full rounded-lg border border-surface-200 p-2 text-sm" />
        </div>
        {selectedFarm && (
          <p className="mt-1 text-xs text-surface-400">
            {t("only_available_prefix", lang)} {selectedFarm.available.toFixed(1)} {t("unit_acre", lang)} {t("only_available_suffix", lang)}
          </p>
        )}
      </div>

      {totalAreaAcres > 0 && (
        <div className="rounded-card border border-green-200 bg-green-50 p-3">
          <h3 className="flex items-center gap-1.5 text-xs font-semibold text-green-800">
            <TrendingUp className="h-3.5 w-3.5" /> {t("profit_prediction", lang)} ({selectedCrop}, {totalAreaAcres.toFixed(1)} {t("unit_acre", lang)})
          </h3>
          {prediction ? (
            <>
              <div className="mt-2 grid grid-cols-3 gap-2 text-center">
                <div>
                  <p className="text-[10px] text-green-600">{t("andazan_kharcha", lang)}</p>
                  <p className="text-sm font-semibold text-red-600">Rs {Math.round(prediction.expectedCost).toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-[10px] text-green-600">{t("andazan_kamai", lang)}</p>
                  <p className="text-sm font-semibold text-blue-600">Rs {Math.round(prediction.expectedRevenue).toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-[10px] text-green-600">{t("andazan_munafa", lang)}</p>
                  <p className={`text-sm font-semibold ${prediction.expectedProfit >= 0 ? "text-green-700" : "text-red-700"}`}>
                    Rs {Math.round(prediction.expectedProfit).toLocaleString()}
                  </p>
                </div>
              </div>
              <p className="mt-2 flex items-center gap-1 text-[10px] text-green-600">
                <Info className="h-3 w-3" /> {t("prediction_disclaimer_prefix", lang)} {benchmark!.sampleCount} {t("prediction_disclaimer_suffix", lang)}
              </p>
            </>
          ) : (
            <p className="mt-1 text-xs text-green-600">{t("not_enough_data", lang)}</p>
          )}
        </div>
      )}

      <button type="submit" className="w-full rounded-lg bg-brand-600 py-2 text-sm font-medium text-white hover:bg-brand-700">
        {t("add_crop_btn", lang)}
      </button>
    </form>
  );
}