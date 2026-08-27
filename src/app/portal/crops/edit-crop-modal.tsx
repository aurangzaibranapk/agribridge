"use client";
import { useState } from "react";
import { Pencil, X } from "lucide-react";
import { CROP_NAMES } from "@/lib/utils/crop-duration";
import { updateCropAction } from "./actions";

interface Crop {
  id: string;
  crop_name: string;
  sowing_date: string;
}

export function EditCropButton({ crop }: { crop: Crop }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)} className="flex items-center gap-1 text-xs text-brand-600 hover:underline">
        <Pencil className="h-3 w-3" /> Edit
      </button>
      {open && <EditModal crop={crop} onClose={() => setOpen(false)} />}
    </>
  );
}

function EditModal({ crop, onClose }: { crop: Crop; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-sm rounded-card bg-white p-5 shadow-xl">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display text-base font-semibold text-surface-900">Fasal Edit Karein</h3>
          <button onClick={onClose} className="text-surface-400 hover:text-surface-700">
            <X className="h-5 w-5" />
          </button>
        </div>
        <form action={updateCropAction} className="space-y-3">
          <input type="hidden" name="crop_id" value={crop.id} />
          <div>
            <label className="text-xs font-medium text-surface-600">Crop</label>
            <select name="crop_name" defaultValue={crop.crop_name} required className="mt-1 w-full rounded-lg border border-surface-200 p-2 text-sm">
              {CROP_NAMES.map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-surface-600">Sowing Date</label>
            <input type="date" name="sowing_date" defaultValue={crop.sowing_date} required className="mt-1 w-full rounded-lg border border-surface-200 p-2 text-sm" />
          </div>
          <div>
            <label className="text-xs font-medium text-surface-600">Area - Optional (Acre / Kanal / Marla)</label>
            <div className="mt-1 grid grid-cols-3 gap-2">
              <input type="number" step="1" min="0" name="area_acre" placeholder="Acre" className="w-full rounded-lg border border-surface-200 p-2 text-sm" />
              <input type="number" step="1" min="0" max="7" name="area_kanal" placeholder="Kanal" className="w-full rounded-lg border border-surface-200 p-2 text-sm" />
              <input type="number" step="1" min="0" max="19" name="area_marla" placeholder="Marla" className="w-full rounded-lg border border-surface-200 p-2 text-sm" />
            </div>
          </div>
          <button type="submit" className="w-full rounded-lg bg-brand-600 py-2 text-sm font-medium text-white hover:bg-brand-700">
            Save Changes
          </button>
        </form>
      </div>
    </div>
  );
}