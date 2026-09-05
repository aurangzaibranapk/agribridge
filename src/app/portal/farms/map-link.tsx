"use client";
import { MapPin } from "lucide-react";
import { t } from "@/lib/i18n/translations";
import { useLang } from "@/lib/i18n/lang-context";

export function MapLink({ latitude, longitude }: { latitude: number | null; longitude: number | null }) {
  const lang = useLang();
  if (!latitude || !longitude) return null;

  function openMap() {
    window.open(`https://www.google.com/maps?q=${latitude},${longitude}`, "_blank");
  }

  return (
    <button
      type="button"
      onClick={openMap}
      className="mt-1 flex items-center gap-1 text-xs text-brand-600 hover:underline"
    >
      <MapPin className="h-3 w-3" />{t("pm_see_on_map", lang)}</button>
  );
}