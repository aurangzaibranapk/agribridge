"use client";
import { useState } from "react";
import { MapPin, Loader2, Pencil } from "lucide-react";
import { t, type Lang } from "@/lib/i18n/translations";

/**
 * Khet ki jagah lene ka aala.
 *
 * Do raaste jaan boojh kar: GPS aur haath se pin.
 *
 * GPS wo hai jab kisan khet par khara ho. Us ke sath "accuracy" bhi
 * mehfooz hoti hai -- phone khud batata hai ke wo kitne meter tak theek
 * hai. Ye adad chhupana ghalat hoga: 5 meter ki durusti aur 80 meter ki
 * ghalti dono ek jaise nazar aate hain, aur machine 80 meter door wale
 * khet mein chali jati hai.
 *
 * Haath se pin us waqt ke liye hai jab GPS idhar udhar ho jaye, ya
 * kisan ghar baithe apna khet daal raha ho. Aisi pin ki accuracy likhna
 * jhoot hoga -- wo GPS ka adad hai, insaan ke ishare ka nahi -- is liye
 * us soorat mein accuracy khali jati hai (aur DB bhi 144 mein yehi
 * karta hai).
 */
export function LocationPicker({
  lang,
  defaultLat,
  defaultLng,
}: {
  lang: Lang;
  defaultLat?: number | null;
  defaultLng?: number | null;
}) {
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">(
    defaultLat != null ? "done" : "idle"
  );
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(
    defaultLat != null && defaultLng != null ? { lat: defaultLat, lng: defaultLng } : null
  );
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [source, setSource] = useState<"gps" | "manual_pin" | "">(defaultLat != null ? "manual_pin" : "");
  const [manual, setManual] = useState(false);

  function captureLocation() {
    if (!navigator.geolocation) {
      setStatus("error");
      return;
    }
    setStatus("loading");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setAccuracy(pos.coords.accuracy ?? null);
        setSource("gps");
        setManual(false);
        setStatus("done");
      },
      () => setStatus("error"),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  function setManualCoord(which: "lat" | "lng", raw: string) {
    const v = raw === "" ? null : Number(raw);
    setCoords((c) => ({
      lat: which === "lat" ? (v ?? 0) : c?.lat ?? 0,
      lng: which === "lng" ? (v ?? 0) : c?.lng ?? 0,
    }));
    setAccuracy(null);
    setSource("manual_pin");
    setStatus("done");
  }

  return (
    <div>
      <input type="hidden" name="latitude" value={coords?.lat ?? ""} />
      <input type="hidden" name="longitude" value={coords?.lng ?? ""} />
      <input type="hidden" name="location_accuracy_m" value={accuracy ?? ""} />
      <input type="hidden" name="location_source" value={source} />

      <button
        type="button"
        onClick={captureLocation}
        disabled={status === "loading"}
        className="flex w-full items-center justify-center gap-2 rounded-lg border border-brand-200 bg-brand-50 py-2 text-sm font-medium text-brand-700 hover:bg-brand-100 disabled:opacity-60"
      >
        {status === "loading" ? <Loader2 className="h-4 w-4 animate-spin" /> : <MapPin className="h-4 w-4" />}
        {status === "loading"
          ? t("loc_getting", lang)
          : status === "done" && source === "gps"
          ? t("loc_captured", lang)
          : t("loc_use_current", lang)}
      </button>

      {status === "error" && <p className="mt-1 text-xs text-red-600">{t("loc_error", lang)}</p>}

      {status === "done" && coords && (
        <p className="mt-1 text-xs text-surface-500">
          {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
          {source === "gps" && accuracy != null && (
            <>
              {" · "}
              <span className={accuracy > 50 ? "text-amber-700" : "text-surface-500"}>
                {t("loc_accuracy", lang)}: ±{Math.round(accuracy)}m
              </span>
            </>
          )}
          {source === "manual_pin" && ` · ${t("loc_manual", lang)}`}
        </p>
      )}

      {status === "done" && source === "gps" && accuracy != null && accuracy > 50 && (
        <p className="mt-1 text-xs text-amber-700">{t("loc_weak_signal", lang)}</p>
      )}

      <button
        type="button"
        onClick={() => setManual((m) => !m)}
        className="mt-2 flex items-center gap-1.5 text-xs text-surface-500 hover:text-brand-700"
      >
        <Pencil className="h-3 w-3" /> {t("loc_fix_manually", lang)}
      </button>

      {manual && (
        <div className="mt-2 grid grid-cols-2 gap-2">
          <input
            type="number"
            step="0.000001"
            placeholder="Latitude"
            value={coords?.lat ?? ""}
            onChange={(e) => setManualCoord("lat", e.target.value)}
            className="rounded-lg border border-surface-200 p-2 text-sm"
          />
          <input
            type="number"
            step="0.000001"
            placeholder="Longitude"
            value={coords?.lng ?? ""}
            onChange={(e) => setManualCoord("lng", e.target.value)}
            className="rounded-lg border border-surface-200 p-2 text-sm"
          />
          <p className="col-span-2 text-xs text-surface-500">{t("loc_manual_hint", lang)}</p>
        </div>
      )}
    </div>
  );
}
