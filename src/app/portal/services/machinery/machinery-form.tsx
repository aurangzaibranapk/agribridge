"use client";
import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { submitMachineryRequest, type ServiceRequestState } from "@/actions/service-requests";
import { Tractor, Loader2, MapPin } from "lucide-react";
import { useLanguage } from "@/hooks/useLanguage";
import { t, type Lang } from "@/lib/i18n/translations";

const initialState: ServiceRequestState = {};

interface MachineryRequest {
  id: string;
  machine_type: string;
  acres: number;
  expected_date: string;
  status: string;
  estimated_cost: number | null;
}

const CROP_OPTIONS = [
  { value: "wheat", en: "Wheat", ur: "گندم" },
  { value: "rice", en: "Rice", ur: "چاول" },
  { value: "maize", en: "Maize", ur: "مکئی" },
  { value: "cotton", en: "Cotton", ur: "کپاس" },
  { value: "sugarcane", en: "Sugarcane", ur: "گنا" },
  { value: "vegetables", en: "Vegetables", ur: "سبزیاں" },
  { value: "other", en: "Other", ur: "دیگر" },
];

export function MachineryForm({
  initialMachineType,
  initialAcres,
  requests = [],
}: {
  initialMachineType?: string;
  initialAcres?: string;
  requests?: MachineryRequest[];
}) {
  const { language: lang } = useLanguage();
  const [state, formAction] = useFormState(submitMachineryRequest, initialState);
  const [machineType, setMachineType] = useState(initialMachineType ?? "rotavator");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  const MACHINE_LABELS: Record<string, string> = {
    rotavator: t("machine_rotavator", lang),
    thresher: t("machine_thresher", lang),
    harvester: t("machine_harvester", lang),
    tractor: t("machine_tractor", lang),
    other: lang === "ur" ? "دیگر" : "Other",
  };

  function handleUseMyLocation() {
    if (!navigator.geolocation) {
      setLocationError(lang === "ur" ? "لوکیشن دستیاب نہیں ہے۔" : "Location isn't available on this device.");
      return;
    }
    setLocating(true);
    setLocationError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocating(false);
      },
      () => {
        setLocationError(lang === "ur" ? "لوکیشن حاصل نہیں ہو سکی۔" : "Couldn't get your location.");
        setLocating(false);
      }
    );
  }

  return (
    <div className="mt-4 rounded-card border border-surface-200 bg-white p-4 shadow-card">
      <h2 className="flex items-center gap-2 font-display text-sm font-semibold text-surface-900">
        <Tractor className="h-4 w-4 text-brand-600" /> {t("new_machinery_request", lang)}
      </h2>
      {state.error && <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{state.error}</p>}
      {state.success && <p className="mt-2 rounded-lg bg-brand-50 px-3 py-2 text-xs text-brand-700">{t("request_sent_success", lang)}</p>}
      <form action={formAction} className="mt-3 space-y-3">
        <div>
          <label className="text-xs font-medium text-surface-600">{t("machine_type_label", lang)}</label>
          <select name="machine_type" value={machineType} onChange={(e) => setMachineType(e.target.value)} className="mt-1 w-full rounded-lg border border-surface-200 p-2 text-sm">
            <option value="rotavator">{t("machine_rotavator", lang)}</option>
            <option value="thresher">{t("machine_thresher", lang)}</option>
            <option value="harvester">{t("machine_harvester", lang)}</option>
            <option value="tractor">{t("machine_tractor", lang)}</option>
            <option value="other">{lang === "ur" ? "دیگر" : "Other"}</option>
          </select>
        </div>

        {machineType === "other" && (
          <div>
            <label className="text-xs font-medium text-surface-600">{lang === "ur" ? "کون سی مشین چاہیے؟" : "Which machine do you need?"}</label>
            <input
              type="text"
              name="machine_type_other"
              className="mt-1 w-full rounded-lg border border-surface-200 p-2 text-sm"
              placeholder={t("eg_laser_leveller", lang)}
            />
          </div>
        )}

        <div>
          <label className="text-xs font-medium text-surface-600">{t("how_many_acres", lang)}</label>
          <input type="number" step="0.1" min="0.1" name="acres" defaultValue={initialAcres} required placeholder={t("eg_area", lang)} className="mt-1 w-full rounded-lg border border-surface-200 p-2 text-sm" />
        </div>

        <div>
          <label className="text-xs font-medium text-surface-600">{lang === "ur" ? "فصل" : "Crop"}</label>
          <select name="crop_type" className="mt-1 w-full rounded-lg border border-surface-200 p-2 text-sm">
            <option value="">{lang === "ur" ? "منتخب کریں" : "- select -"}</option>
            {CROP_OPTIONS.map((c) => (
              <option key={c.value} value={c.value}>{lang === "ur" ? c.ur : c.en}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-xs font-medium text-surface-600">{t("when_needed", lang)}</label>
          <input type="date" name="expected_date" min={new Date().toISOString().split("T")[0]} required className="mt-1 w-full rounded-lg border border-surface-200 p-2 text-sm" />
        </div>

        <div>
          <label className="text-xs font-medium text-surface-600">{t("location_label", lang)}</label>
          <button
            type="button"
            onClick={handleUseMyLocation}
            disabled={locating}
            className="mt-1 flex w-full items-center justify-center gap-2 rounded-lg border border-brand-200 bg-brand-50 px-3 py-2 text-sm font-medium text-brand-700 hover:bg-brand-100 disabled:opacity-60"
          >
            {locating ? <Loader2 className="h-4 w-4 animate-spin" /> : <MapPin className="h-4 w-4" />}
            {coords ? `${t("location_captured_check", lang)} \u2713` : locating ? t("loc_getting", lang) : t("loc_use_current", lang)}
          </button>
          {locationError && <p className="mt-1 text-xs text-red-600">{locationError}</p>}
          <input type="hidden" name="location_lat" value={coords?.lat ?? ""} />
          <input type="hidden" name="location_lng" value={coords?.lng ?? ""} />
          <input
            type="text"
            name="location_address"
            className="mt-2 w-full rounded-lg border border-surface-200 p-2 text-sm"
            placeholder={t("village_area_placeholder", lang)}
          />
        </div>

        <div>
          <label className="text-xs font-medium text-surface-600">{t("additional_notes_optional", lang)}</label>
          <textarea
            name="notes"
            rows={3}
            className="mt-1 w-full rounded-lg border border-surface-200 p-2 text-sm"
            placeholder={t("anything_else_placeholder", lang)}
          />
        </div>

        <SubmitButton lang={lang} />
      </form>

      {requests.length > 0 && (
        <div className="mt-6">
          <h3 className="mb-2 font-display text-sm font-semibold text-surface-900">{t("past_requests", lang)}</h3>
          <div className="space-y-2">
            {requests.map((r) => (
              <div key={r.id} className="rounded-lg border border-surface-100 p-2 text-xs">
                <p className="font-medium text-surface-800">
                  {MACHINE_LABELS[r.machine_type] ?? r.machine_type} - {r.acres} {t("acres_unit", lang)}
                </p>
                <p className="text-surface-400">{r.expected_date} - {r.status}</p>
                {r.estimated_cost !== null ? (
                  <p className="text-surface-600">{t("ai_estimated_cost_label", lang)}: Rs {r.estimated_cost.toLocaleString()}</p>
                ) : (
                  <p className="text-surface-400">{t("ai_estimate_pending", lang)}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
      {requests.length === 0 && <p className="mt-4 text-xs text-surface-400">{t("no_requests_yet", lang)}</p>}
    </div>
  );
}

function SubmitButton({ lang }: { lang: Lang }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
    >
      {pending && <Loader2 className="h-4 w-4 animate-spin" />}
      {pending ? t("submitting_label", lang) : t("submit_request_btn", lang)}
    </button>
  );
}