"use client";
import { useState } from "react";
import { LandPlot, Tractor } from "lucide-react";
import { MachineryForm } from "./machinery-form";
import { useLanguage } from "@/hooks/useLanguage";
import { t } from "@/lib/i18n/translations";

interface CropAllocation {
  cropName: string;
  area: number;
  suggestedMachine: string;
  suggestedMachineLabel: string;
}

interface FarmData {
  id: string;
  name: string;
  totalArea: number;
  crops: CropAllocation[];
  khaliZameen: number;
  hasLocation: boolean;
}

export function MachineryPageClient({ farms }: { farms: FarmData[] }) {
  const { language: lang } = useLanguage();
  const [selectedFarmId, setSelectedFarmId] = useState<string>(farms[0]?.id ?? "");
  const [suggestion, setSuggestion] = useState<{ machineType: string; acres: string } | null>(null);
  const selectedFarm = farms.find((f) => f.id === selectedFarmId);

  return (
    <div>
      {farms.length > 0 && (
        <div className="mb-6 rounded-card border border-surface-200 bg-white p-4 shadow-card">
          <h2 className="flex items-center gap-2 font-display text-sm font-semibold text-surface-900">
            <LandPlot className="h-4 w-4 text-brand-600" /> {t("select_your_farm", lang)}
          </h2>
          <select
            value={selectedFarmId}
            onChange={(e) => setSelectedFarmId(e.target.value)}
            className="mt-2 w-full rounded-lg border border-surface-200 p-2 text-sm"
          >
            {farms.map((f) => (
              <option key={f.id} value={f.id}>{f.name} ({f.totalArea} {t("acres_unit", lang)})</option>
            ))}
          </select>
          {selectedFarm && (
            <div className="mt-3 space-y-1.5">
              {selectedFarm.crops.map((c, i) => (
                <div key={i} className="flex items-center justify-between rounded-lg bg-surface-50 px-3 py-2 text-sm">
                  <span className="text-surface-700">{c.cropName} - {c.area} {t("acres_unit", lang)}</span>
                  <button
                    onClick={() => setSuggestion({ machineType: c.suggestedMachine, acres: String(c.area) })}
                    className="flex items-center gap-1 rounded-lg bg-brand-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-brand-700"
                  >
                    <Tractor className="h-3 w-3" /> {c.suggestedMachineLabel} {t("needed_suffix", lang)}
                  </button>
                </div>
              ))}
              {selectedFarm.khaliZameen > 0 && (
                <div className="flex items-center justify-between rounded-lg bg-amber-50 px-3 py-2 text-sm">
                  <span className="text-amber-700">{t("empty_land_label", lang)} - {selectedFarm.khaliZameen.toFixed(1)} {t("acres_unit", lang)}</span>
                  <button
                    onClick={() => setSuggestion({ machineType: "rotavator", acres: String(selectedFarm.khaliZameen.toFixed(1)) })}
                    className="flex items-center gap-1 rounded-lg bg-amber-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-amber-700"
                  >
                    <Tractor className="h-3 w-3" /> {t("machine_rotavator", lang)} {t("needed_suffix", lang)}
                  </button>
                </div>
              )}
              {selectedFarm.crops.length === 0 && selectedFarm.khaliZameen === 0 && (
                <p className="text-xs text-surface-400">{t("no_land_data", lang)}</p>
              )}
            </div>
          )}
        </div>
      )}
      <MachineryForm
        initialMachineType={suggestion?.machineType}
        initialAcres={suggestion?.acres}
        farmId={selectedFarmId}
        farmHasLocation={selectedFarm?.hasLocation ?? false}
      />
    </div>
  );
}