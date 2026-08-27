"use client";
import { useState } from "react";
import { MapPin, Loader2 } from "lucide-react";
import { t, type Lang } from "@/lib/i18n/translations";

export function LocationPicker({ lang }: { lang: Lang }) {
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  function captureLocation() {
    if (!navigator.geolocation) {
      setStatus("error");
      return;
    }
    setStatus("loading");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setStatus("done");
      },
      () => setStatus("error"),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }
  return (
    <div>
      <input type="hidden" name="latitude" value={coords?.lat ?? ""} />
      <input type="hidden" name="longitude" value={coords?.lng ?? ""} />
      <button
        type="button"
        onClick={captureLocation}
        disabled={status === "loading"}
        className="flex w-full items-center justify-center gap-2 rounded-lg border border-brand-200 bg-brand-50 py-2 text-sm font-medium text-brand-700 hover:bg-brand-100 disabled:opacity-60"
      >
        {status === "loading" ? <Loader2 className="h-4 w-4 animate-spin" /> : <MapPin className="h-4 w-4" />}
        {status === "loading" ? t("loc_getting", lang) : status === "done" ? t("loc_captured", lang) : t("loc_use_current", lang)}
      </button>
      {status === "error" && (
        <p className="mt-1 text-xs text-red-600">{t("loc_error", lang)}</p>
      )}
      {status === "done" && coords && (
        <p className="mt-1 text-xs text-surface-400">
          Lat: {coords.lat.toFixed(5)}, Lng: {coords.lng.toFixed(5)}
        </p>
      )}
    </div>
  );
}