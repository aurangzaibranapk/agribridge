"use client";
import { useState, useRef } from "react";
import { Wheat, Sparkles } from "lucide-react";
import { addHarvestAction } from "../crops/harvest-actions";
import { VoiceDictationButton } from "@/components/admin/voice-dictation-button";
import { useLanguage } from "@/hooks/useLanguage";
import { t } from "@/lib/i18n/translations";

interface Farm {
  id: string;
  name: string;
}

interface ReadyToRecord {
  id: string;
  farmId: string;
  cropName: string;
  farmName: string;
  expectedHarvestDate: string;
  totalExpense: number;
  suggestedRate: number | null;
}

export function AddHarvestForm({ farms, readyToRecord }: { farms: Farm[]; readyToRecord: ReadyToRecord[] }) {
  const { language: lang } = useLanguage();
  const [selectedCrop, setSelectedCrop] = useState<ReadyToRecord | null>(null);
  const [quantity, setQuantity] = useState("");
  const [saleRate, setSaleRate] = useState("");
  const quantityRef = useRef<HTMLInputElement>(null);
  const saleRateRef = useRef<HTMLInputElement>(null);

  function handleCropSelect(cropId: string) {
    const crop = readyToRecord.find((c) => c.id === cropId) ?? null;
    setSelectedCrop(crop);
    if (crop?.suggestedRate) setSaleRate(String(crop.suggestedRate));
  }

  return (
    <div>
      {readyToRecord.length > 0 && (
        <div className="mb-4 rounded-card border border-brand-200 bg-brand-50 p-4">
          <h2 className="flex items-center gap-2 font-display text-sm font-semibold text-brand-800">
            <Wheat className="h-4 w-4" /> {t("select_your_crop_heading", lang)}
          </h2>
          <p className="mt-1 text-xs text-brand-600">{t("select_crop_hint", lang)}</p>
        </div>
      )}
      <form action={addHarvestAction} className="space-y-3 rounded-card border border-surface-200 bg-white p-4 shadow-card">
        <h2 className="font-display text-sm font-semibold text-surface-900">{t("add_harvest_record_heading", lang)}</h2>
        {readyToRecord.length > 0 && (
          <div>
            <label className="text-xs font-medium text-surface-600">{t("select_crop_autofill", lang)}</label>
            <select
              name="h_crop_history_id"
              onChange={(e) => handleCropSelect(e.target.value)}
              className="mt-1 w-full rounded-lg border border-surface-200 p-2 text-sm"
            >
              <option value="">{t("manual_entry_option", lang)}</option>
              {readyToRecord.map((c) => (
                <option key={c.id} value={c.id}>{c.cropName} ({c.farmName})</option>
              ))}
            </select>
          </div>
        )}
        {selectedCrop && (
          <div className="rounded-lg bg-surface-50 p-3 text-xs text-surface-600">
            <p><strong>{t("farm_label", lang)}:</strong> {selectedCrop.farmName}</p>
            <p><strong>{t("crop", lang)}:</strong> {selectedCrop.cropName}</p>
            <p><strong>{t("expected_harvest_date_label", lang)}:</strong> {new Date(selectedCrop.expectedHarvestDate).toLocaleDateString()}</p>
            <p><strong>{t("expense_so_far_label", lang)}:</strong> Rs {selectedCrop.totalExpense.toLocaleString()}</p>
          </div>
        )}

        <input type="hidden" name="h_farm_id" value={selectedCrop?.farmId ?? ""} />
        <input type="hidden" name="h_crop_name" value={selectedCrop?.cropName ?? ""} />
        {!selectedCrop && (
          <>
            <div>
              <label className="text-xs font-medium text-surface-600">{t("farm_label", lang)}</label>
              <select name="h_farm_id_manual" onChange={(e) => {
                const hidden = document.querySelector('input[name="h_farm_id"]') as HTMLInputElement;
                if (hidden) hidden.value = e.target.value;
              }} required className="mt-1 w-full rounded-lg border border-surface-200 p-2 text-sm">
                <option value="">{t("select_farm", lang)}</option>
                {farms.map((f) => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-surface-600">{t("crop", lang)}</label>
              <input
                type="text"
                onChange={(e) => {
                  const hidden = document.querySelector('input[name="h_crop_name"]') as HTMLInputElement;
                  if (hidden) hidden.value = e.target.value;
                }}
                required
                placeholder={t("eg_wheat", lang)}
                className="mt-1 w-full rounded-lg border border-surface-200 p-2 text-sm"
              />
            </div>
          </>
        )}
        <div>
          <label className="text-xs font-medium text-surface-600">{t("harvest_date_label", lang)}</label>
          <input
            type="date"
            name="h_harvest_date"
            required
            defaultValue={selectedCrop?.expectedHarvestDate?.slice(0, 10)}
            className="mt-1 w-full rounded-lg border border-surface-200 p-2 text-sm"
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs font-medium text-surface-600">{t("quantity_maund_kg_label", lang)}</label>
            <div className="mt-1 flex gap-2">
              <input
                ref={quantityRef}
                type="number"
                step="0.1"
                name="h_quantity"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                required
                placeholder={t("eg_40", lang)}
                className="w-full rounded-lg border border-surface-200 p-2 text-sm"
              />
              <VoiceDictationButton onResult={(text) => setQuantity(text.replace(/[^0-9.]/g, ""))} />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-surface-600">{t("unit_label", lang)}</label>
            <select name="h_unit" className="mt-1 w-full rounded-lg border border-surface-200 p-2 text-sm">
              <option value="maund">{t("unit_maund", lang)}</option>
              <option value="kg">{t("unit_kg", lang)}</option>
              <option value="bags">{t("unit_bags", lang)}</option>
            </select>
          </div>
        </div>
        <div>
          <label className="text-xs font-medium text-surface-600">{t("quality_grade_optional", lang)}</label>
          <input type="text" name="h_quality_grade" placeholder={t("eg_grade_a", lang)} className="mt-1 w-full rounded-lg border border-surface-200 p-2 text-sm" />
        </div>
        <div>
          <label className="text-xs font-medium text-surface-600">
            {t("sale_rate_label", lang)} {selectedCrop?.suggestedRate ? `- ${t("suggested_rate_prefix", lang)}: Rs ${selectedCrop.suggestedRate}` : ""}
          </label>
          <div className="mt-1 flex gap-2">
            <input
              ref={saleRateRef}
              type="number"
              step="1"
              name="h_sale_rate"
              value={saleRate}
              onChange={(e) => setSaleRate(e.target.value)}
              placeholder={t("eg_3000", lang)}
              className="w-full rounded-lg border border-surface-200 p-2 text-sm"
            />
            <VoiceDictationButton onResult={(text) => setSaleRate(text.replace(/[^0-9.]/g, ""))} />
          </div>
          {selectedCrop?.suggestedRate && (
            <p className="mt-1 flex items-center gap-1 text-xs text-brand-600">
              <Sparkles className="h-3 w-3" /> {t("market_rate_suggestion_note", lang)}
            </p>
          )}
        </div>
        <input type="hidden" name="h_total_expense" value="" />
        <button type="submit" className="w-full rounded-lg bg-brand-600 py-2 text-sm font-medium text-white hover:bg-brand-700">
          {t("add_harvest_record_heading", lang)}
        </button>
      </form>
    </div>
  );
}