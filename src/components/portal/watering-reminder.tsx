import Link from "next/link";
import { Droplets } from "lucide-react";
import { getCropProgress } from "@/lib/utils/crop-duration";

interface Crop {
  crop_name: string;
  sowing_date: string;
  expected_harvest_date: string;
  farms: { name: string } | { name: string }[] | null;
}

interface WateringReminder {
  crop_name: string;
  farm_name: string;
  daysUntilNext: number;
}

// Simple crop-specific watering interval (days) - a reasonable default
// per crop type since we don't track actual irrigation events yet.
// Admin/farmer can't adjust this per-crop for now; it's a rule of
// thumb reminder, not a precise agronomy schedule.
const WATERING_INTERVAL_DAYS: Record<string, number> = {
  Wheat: 12,
  Rice: 5,
  Maize: 8,
  Cotton: 10,
  Sugarcane: 7,
};
const DEFAULT_INTERVAL = 10;

export function getWateringReminders(crops: Crop[]): WateringReminder[] {
  return crops
    .map((c) => {
      const progress = getCropProgress(c.sowing_date, c.expected_harvest_date);
      // Only relevant for crops still growing (not past their harvest window).
      if (progress.daysRemaining <= 0) return null;

      const interval = WATERING_INTERVAL_DAYS[c.crop_name] ?? DEFAULT_INTERVAL;
      const daysIntoCycle = progress.daysElapsed % interval;
      const daysUntilNext = daysIntoCycle === 0 ? 0 : interval - daysIntoCycle;

      // Only surface it when it's due today or due tomorrow - otherwise
      // this would clutter the dashboard every single day.
      if (daysUntilNext > 1) return null;

      const farmName = Array.isArray(c.farms) ? c.farms[0]?.name : c.farms?.name;
      return { crop_name: c.crop_name, farm_name: farmName ?? "Farm", daysUntilNext };
    })
    .filter((r): r is WateringReminder => r !== null);
}

export function WateringReminderBanner({ reminders }: { reminders: WateringReminder[] }) {
  if (reminders.length === 0) return null;

  return (
    <div className="mb-4 rounded-card border border-sky-200 bg-sky-50 p-4">
      <div className="flex items-start gap-3">
        <Droplets className="mt-0.5 h-5 w-5 shrink-0 text-sky-600" />
        <div>
          <p className="text-sm font-medium text-sky-800">Pani Dene Ka Waqt</p>
          <div className="mt-2 space-y-1">
            {reminders.map((r, i) => (
              <p key={i} className="text-sm text-sky-700">
                {r.crop_name} ({r.farm_name}) - {r.daysUntilNext === 0 ? "Aaj pani dein" : "Kal pani dena hai"}
              </p>
            ))}
          </div>
          <Link
            href="/portal/crops"
            className="mt-2 inline-block text-xs font-medium text-sky-700 hover:underline"
          >
            My Crops Dekhein
          </Link>
        </div>
      </div>
    </div>
  );
}