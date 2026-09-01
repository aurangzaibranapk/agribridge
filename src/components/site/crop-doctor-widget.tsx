"use client";
import { useState } from "react";
import { Camera, Loader2, Sprout, AlertTriangle, CheckCircle2 } from "lucide-react";
import { t } from "@/lib/i18n/translations";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";

type CropDiagnosis = {
  cropGuess?: string;
  diseaseName: string;
  confidence: "low" | "medium" | "high";
  description: string;
  treatment: string;
  sprayScheduleAdvice: string;
};

export function CropDoctorWidget({ mode }: { mode?: string }) {
  const lang = getLanguageFromCookies("rm");
  const [preview, setPreview] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [diagnosis, setDiagnosis] = useState<CropDiagnosis | null>(null);
  const [notConfigured, setNotConfigured] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0];
    if (selected) {
      const url = URL.createObjectURL(selected);
      setPreview(url);
      setFile(selected);
      setDiagnosis(null);
      setNotConfigured(false);
      setError(null);
    }
  }

  async function handleDiagnose() {
    if (!file) return;
    setLoading(true);
    setError(null);
    setDiagnosis(null);
    setNotConfigured(false);

    try {
      const formData = new FormData();
      formData.append("image", file);

      const res = await fetch("/api/crop-doctor", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (data.notConfigured) {
        setNotConfigured(true);
      } else if (data.diagnosis) {
        setDiagnosis(data.diagnosis);
      } else {
        setError("Diagnosis nahi mil saka, dobara koshish karein.");
      }
    } catch {
      setError("Kuch masla ho gaya, dobara koshish karein.");
    } finally {
      setLoading(false);
    }
  }

  const confidenceColor =
    diagnosis?.confidence === "high"
      ? "text-green-700 bg-green-50"
      : diagnosis?.confidence === "medium"
      ? "text-amber-700 bg-amber-50"
      : "text-surface-600 bg-surface-100";

  return (
    <div>
      <div className="rounded-card border-2 border-dashed border-surface-300 bg-surface-50 p-10 text-center">
        <label htmlFor="crop-photo-upload" className="cursor-pointer">
          {preview ? (
            <img src={preview} alt={t("sp_uploaded_crop", lang)} className="mx-auto max-h-64 rounded-lg" />
          ) : (
            <>
              <Camera className="mx-auto mb-3 h-10 w-10 text-surface-400" />
              <p className="text-surface-500">{t("sp_tap_upload", lang)}</p>
              <p className="mt-1 text-xs text-surface-400">{t("sp_photo_hint", lang)}</p>
            </>
          )}
        </label>
        <input
          id="crop-photo-upload"
          type="file"
          accept="image/jpeg,image/png"
          className="hidden"
          onChange={handleFileChange}
        />
      </div>

      {preview && (
        <button
          onClick={handleDiagnose}
          disabled={loading}
          className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />{t("sp_diagnosing", lang)}</>
          ) : (
            <>
              <Sprout className="h-4 w-4" />{t("sp_diagnose", lang)}</>
          )}
        </button>
      )}

      {loading && (
        <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-brand-100">
          <div className="h-full w-1/3 animate-[loading-bar_1.1s_ease-in-out_infinite] rounded-full bg-brand-500" />
        </div>
      )}

      {notConfigured && (
        <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">{t("sp_doctor_offline", lang)}</p>
      )}

      {error && (
        <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      {diagnosis && (
        <div className="mt-4 rounded-card border border-surface-200 bg-white p-5 shadow-card">
          <div className="flex items-start justify-between gap-3">
            <div>
              {diagnosis.cropGuess && (
                <p className="text-xs uppercase tracking-wide text-surface-400">{diagnosis.cropGuess}</p>
              )}
              <h3 className="mt-0.5 font-display text-lg font-semibold text-surface-900">
                {diagnosis.diseaseName}
              </h3>
            </div>
            <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${confidenceColor}`}>
              {diagnosis.confidence === "high" ? "Yaqeeni" : diagnosis.confidence === "medium" ? "Mumkin" : "Kam Yaqeen"}
            </span>
          </div>

          <p className="mt-3 text-sm text-surface-700">{diagnosis.description}</p>

          <div className="mt-4 rounded-lg bg-green-50 p-3">
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-green-700">
              <CheckCircle2 className="h-3.5 w-3.5" />{t("sp_treatment", lang)}</p>
            <p className="mt-1 text-sm text-green-800">{diagnosis.treatment}</p>
          </div>

          <div className="mt-3 rounded-lg bg-blue-50 p-3">
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-blue-700">
              <AlertTriangle className="h-3.5 w-3.5" />{t("sp_spray_schedule", lang)}</p>
            <p className="mt-1 text-sm text-blue-800">{diagnosis.sprayScheduleAdvice}</p>
          </div>
        </div>
      )}
    </div>
  );
}