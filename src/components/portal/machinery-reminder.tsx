import Link from "next/link";
import { Tractor, AlertCircle } from "lucide-react";
import { getCropProgress } from "@/lib/utils/crop-duration";
import { t } from "@/lib/i18n/translations";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";

interface CropReminder {
  crop_name: string;
  farm_name: string;
  daysRemaining: number;
}

interface Crop {
  crop_name: string;
  sowing_date: string;
  expected_harvest_date: string;
  farms: { name: string } | { name: string }[] | null;
}

// Crops within 35 days of their expected harvest - farmer should be
// prompted about booking machinery (harvester etc) in time.
export function getMachineryReminders(crops: Crop[]): CropReminder[] {
  return crops
    .map((c) => {
      const progress = getCropProgress(c.sowing_date, c.expected_harvest_date);
      const farmName = Array.isArray(c.farms) ? c.farms[0]?.name : c.farms?.name;
      return { crop_name: c.crop_name, farm_name: farmName ?? "Farm", daysRemaining: progress.daysRemaining };
    })
    .filter((c) => c.daysRemaining >= 0 && c.daysRemaining <= 35);
}

export function MachineryReminderBanner({ reminders }: { reminders: CropReminder[] }) {
  const lang = getLanguageFromCookies("ur");
  if (reminders.length === 0) return null;

  return (
    <div className="mb-4 rounded-card border border-amber-200 bg-amber-50 p-4">
      <div className="flex items-start gap-3">
        <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
        <div>
          <p className="text-sm font-medium text-amber-800">{t("pm_machinery_time", lang)}</p>
          <div className="mt-2 space-y-1">
            {reminders.map((r, i) => (
              <p key={i} className="text-sm text-amber-700">
                {r.crop_name} ({r.farm_name}) - <strong>{r.daysRemaining} din</strong>{t("pm_harvest_ready_in", lang)}</p>
            ))}
          </div>
          <Link
            href="/portal/services/machinery"
            className="mt-2 inline-flex items-center gap-1 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-700"
          >
            <Tractor className="h-3.5 w-3.5" />{t("pm_book_machinery", lang)}</Link>
        </div>
      </div>
    </div>
  );
}