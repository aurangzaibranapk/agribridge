"use client";
import { useState } from "react";
import { useFormState } from "react-dom";
import { MapPin, Loader2 } from "lucide-react";
import { setBookingLocation } from "@/actions/machinery-lifecycle";
import { t } from "@/lib/i18n/translations";
import { useLang } from "@/lib/i18n/lang-context";

/**
 * Fehrist se jagah pin karna.
 *
 * Do qadam jaan boojh kar: pehle GPS liya jata hai, phir banda khud
 * "mehfooz karein" dabata hai. Ek hi click par mehfooz kar dene se wo
 * adad bhi chup chaap darj ho jata jo phone ne ghalti se diya ho -- aur
 * baad mein wo asal khet ki jagah samjha jata.
 *
 * Jitne meter ki durusti phone batata hai wo saamne likhi jati hai. 8
 * meter aur 200 meter dono "jagah mil gayi" hote hain, magar dono ka
 * matlab ek nahi -- aur ye faisla dekhne wale ka hai, is safhe ka nahi.
 */
export function PinLocation({ bookingId }: { bookingId: string }) {
  const lang = useLang();
  const [state, formAction] = useFormState(setBookingLocation, {} as { error?: string; success?: boolean });
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  if (state.success) {
    return <span className="text-xs text-green-700 dark:text-green-400">{t("ml_pin_saved", lang)}</span>;
  }

  function capture() {
    if (!navigator.geolocation) {
      setFailed(true);
      return;
    }
    setBusy(true);
    setFailed(false);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setAccuracy(pos.coords.accuracy ?? null);
        setBusy(false);
      },
      () => {
        setFailed(true);
        setBusy(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  if (!coords) {
    return (
      <div>
        <button
          type="button"
          onClick={capture}
          disabled={busy}
          className="flex items-center gap-1 text-xs text-brand-700 underline hover:text-brand-800 disabled:opacity-50 dark:text-brand-300"
        >
          {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <MapPin className="h-3 w-3" />}
          {t("ml_pin_location", lang)}
        </button>
        {failed && <p className="text-xs text-amber-700 dark:text-amber-400">{t("ml_pin_failed", lang)}</p>}
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-1">
      <input type="hidden" name="booking_id" value={bookingId} />
      <input type="hidden" name="latitude" value={coords.lat} />
      <input type="hidden" name="longitude" value={coords.lng} />
      <p className="text-xs text-surface-500">
        {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
        {accuracy != null && ` · ±${Math.round(accuracy)}m`}
      </p>
      {state.error && <p className="text-xs text-red-600 dark:text-red-400">{state.error}</p>}
      <div className="flex gap-2">
        <button type="submit" className="rounded bg-brand-700 px-2 py-0.5 text-xs font-medium text-white">
          {t("ml_pin_save", lang)}
        </button>
        <button
          type="button"
          onClick={capture}
          className="text-xs text-surface-500 underline hover:text-surface-700 dark:hover:text-surface-300"
        >
          {t("ml_pin_again", lang)}
        </button>
      </div>
    </form>
  );
}
