"use client";
import { useState } from "react";
import { Pencil, X } from "lucide-react";
import { CROP_NAMES } from "@/lib/utils/crop-duration";
import { updateCropAction } from "./actions";
import { t } from "@/lib/i18n/translations";
import { useLang } from "@/lib/i18n/lang-context";

const OTHER_CROP = "__other__";

interface Crop {
  id: string;
  crop_name: string;
  sowing_date: string;
  area_sown_acres: number | null;
}

/**
 * Kul acre ko wapas Acre/Kanal/Marla mein torna -- Edit khulte waqt
 * khane khali dikhte the, aur `updateCropAction` teenon khanon ka jorh
 * hi mehfooz karta hai. Yani sirf tareekh badalne ke liye Save dabana
 * bhi maujooda raqba ko khali (0) kar deta -- jo raqba pehle darj tha
 * wo ghayab ho jata. Ab wahi teen khane bhare hue khulte hain, taake
 * chhuye baghair Save karna asal raqba barqarar rakhe.
 */
function decomposeAcres(totalAcres: number | null): { acre: number; kanal: number; marla: number } {
  if (!totalAcres || totalAcres <= 0) return { acre: 0, kanal: 0, marla: 0 };
  const acre = Math.floor(totalAcres);
  const kanalFloat = (totalAcres - acre) * 8;
  let kanal = Math.floor(kanalFloat);
  let marla = Math.round((kanalFloat - kanal) * 20);
  if (marla >= 20) {
    marla = 0;
    kanal += 1;
  }
  return kanal >= 8 ? { acre: acre + 1, kanal: 0, marla } : { acre, kanal, marla };
}

export function EditCropButton({ crop }: { crop: Crop }) {
  const lang = useLang();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)} className="flex items-center gap-1 text-xs text-brand-600 hover:underline">
        <Pencil className="h-3 w-3" />{t("c_edit", lang)}</button>
      {open && <EditModal crop={crop} onClose={() => setOpen(false)} />}
    </>
  );
}

function EditModal({ crop, onClose }: { crop: Crop; onClose: () => void }) {
  const lang = useLang();
  const knownCrop = CROP_NAMES.includes(crop.crop_name);
  const [selectedCrop, setSelectedCrop] = useState(knownCrop ? crop.crop_name : OTHER_CROP);
  const [customCrop, setCustomCrop] = useState(knownCrop ? "" : crop.crop_name);
  const isOther = selectedCrop === OTHER_CROP;
  const finalCropName = isOther ? customCrop.trim() : selectedCrop;
  const area = decomposeAcres(crop.area_sown_acres);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-sm rounded-card bg-white p-5 shadow-xl">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display text-base font-semibold text-surface-900">{t("pm_edit_crop", lang)}</h3>
          <button onClick={onClose} className="text-surface-400 hover:text-surface-700">
            <X className="h-5 w-5" />
          </button>
        </div>
        <form action={updateCropAction} className="space-y-3">
          <input type="hidden" name="crop_id" value={crop.id} />
          <div>
            <label className="text-xs font-medium text-surface-600">{t("c_crop", lang)}</label>
            <select
              value={selectedCrop}
              onChange={(e) => setSelectedCrop(e.target.value)}
              className="mt-1 w-full rounded-lg border border-surface-200 p-2 text-sm"
            >
              {CROP_NAMES.map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
              <option value={OTHER_CROP}>{t("other_crop", lang)}</option>
            </select>
            {isOther && (
              <input
                type="text"
                value={customCrop}
                onChange={(e) => setCustomCrop(e.target.value)}
                placeholder={t("other_crop_placeholder", lang)}
                required
                className="mt-2 w-full rounded-lg border border-surface-200 p-2 text-sm"
              />
            )}
            <input type="hidden" name="crop_name" value={finalCropName} />
          </div>
          <div>
            <label className="text-xs font-medium text-surface-600">{t("pm_sowing_date", lang)}</label>
            <input type="date" name="sowing_date" defaultValue={crop.sowing_date} required className="mt-1 w-full rounded-lg border border-surface-200 p-2 text-sm" />
          </div>
          <div>
            <label className="text-xs font-medium text-surface-600">{t("pm_area_optional", lang)}</label>
            <div className="mt-1 grid grid-cols-3 gap-2">
              <input type="number" step="1" min="0" name="area_acre" defaultValue={area.acre || ""} placeholder={t("unit_acre", lang)} className="w-full rounded-lg border border-surface-200 p-2 text-sm" />
              <input type="number" step="1" min="0" max="7" name="area_kanal" defaultValue={area.kanal || ""} placeholder={t("unit_kanal", lang)} className="w-full rounded-lg border border-surface-200 p-2 text-sm" />
              <input type="number" step="1" min="0" max="19" name="area_marla" defaultValue={area.marla || ""} placeholder={t("unit_marla", lang)} className="w-full rounded-lg border border-surface-200 p-2 text-sm" />
            </div>
          </div>
          <button type="submit" className="w-full rounded-lg bg-brand-600 py-2 text-sm font-medium text-white hover:bg-brand-700">{t("pm_save_changes", lang)}</button>
        </form>
      </div>
    </div>
  );
}