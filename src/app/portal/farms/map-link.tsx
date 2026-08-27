"use client";
import { MapPin } from "lucide-react";

export function MapLink({ latitude, longitude }: { latitude: number | null; longitude: number | null }) {
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
      <MapPin className="h-3 w-3" /> Map par dekhein
    </button>
  );
}