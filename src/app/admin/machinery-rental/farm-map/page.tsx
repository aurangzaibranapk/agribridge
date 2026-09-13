import Link from "next/link";
import { MapPin, AlertTriangle } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";
import { t } from "@/lib/i18n/translations";

export const dynamic = "force-dynamic";

/**
 * Khaiton ka naqsha.
 *
 * Ye fehrist kisi ke bharne se nahi banti -- wo khud un jagahon se
 * banti hai jo kisan ne apne khet par khare ho kar li thin. Isi liye ye
 * kaam ki hai: haath se bani fehrist wo khet bhool jati hai jise koi
 * likhna bhool gaya.
 *
 * Naqsha yahan tasveer ke tor par nahi banaya gaya. Wajah ye ke naqshe
 * ki tasveer bahar se aati hai (tiles), aur ye safha bahar ki kisi
 * cheez par nirbhar nahi hona chahiye -- ilaqe mein internet aksar
 * kamzor hota hai. Har khet ke saamne us ka apna naqsha link hai, jo
 * phone ke apne naqshe mein khulta hai aur wahin se raasta bhi.
 *
 * Tarteeb gaon ke hisaab se hai: machine ka raasta banane wala aadmi
 * "ek hi ilaqe ke kitne khet" dekhna chahta hai, "kis kisan ke" nahi.
 */
export default async function FarmMapPage() {
  const lang = getLanguageFromCookies("rm");
  const supabase = createClient();

  const { data: rows } = await supabase
    .from("v_farm_map")
    .select("*")
    .order("district")
    .order("village")
    .order("farm_name");

  const farms = rows ?? [];
  const withLocation = farms.filter((f) => f.latitude !== null);
  const withoutLocation = farms.filter((f) => f.latitude === null);
  const totalAcres = farms.reduce((sum, f) => sum + Number(f.area_acres ?? 0), 0);
  const openWork = farms.filter((f) => f.open_booking_number);

  // Gaon ke hisaab se -- raasta banane ki bunyadi ikai yehi hai.
  const byArea = new Map<string, typeof farms>();
  for (const f of withLocation) {
    const key = [f.village, f.district].filter(Boolean).join(", ") || t("fm_area_unknown", lang);
    byArea.set(key, [...(byArea.get(key) ?? []), f]);
  }

  return (
    <div className="space-y-4">
      <div>
        <Link href="/admin/machinery-rental" className="text-sm text-surface-500 hover:text-brand-700">
          ← {t("fm_back", lang)}
        </Link>
        <h1 className="mt-1 font-display text-xl font-semibold text-surface-900 dark:text-white">
          {t("fm_title", lang)}
        </h1>
        <p className="text-sm text-surface-500">{t("fm_subtitle", lang)}</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label={t("fm_total_farms", lang)} value={String(farms.length)} />
        <Stat label={t("fm_total_acres", lang)} value={totalAcres.toLocaleString()} />
        <Stat label={t("fm_with_location", lang)} value={String(withLocation.length)} />
        <Stat label={t("fm_open_work", lang)} value={String(openWork.length)} />
      </div>

      {withoutLocation.length > 0 && (
        <div className="rounded-card border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300">
          <p className="flex items-center gap-2 font-medium">
            <AlertTriangle className="h-4 w-4" />
            {withoutLocation.length} {t("fm_missing_location", lang)}
          </p>
          <p className="mt-1 text-xs">{t("fm_missing_location_hint", lang)}</p>
        </div>
      )}

      {[...byArea.entries()].map(([area, list]) => (
        <div key={area} className="overflow-hidden rounded-card border border-surface-200 bg-white shadow-card dark:border-surface-800 dark:bg-surface-900">
          <div className="flex items-center justify-between border-b border-surface-200 bg-surface-50 px-3 py-2 dark:border-surface-800 dark:bg-surface-800">
            <span className="font-medium text-surface-800 dark:text-surface-200">{area}</span>
            <span className="text-xs text-surface-500">
              {list.length} {t("fm_farms", lang)} ·{" "}
              {list.reduce((s, f) => s + Number(f.area_acres ?? 0), 0).toLocaleString()} acre
            </span>
          </div>
          <table className="w-full text-sm">
            <tbody>
              {list.map((f) => (
                <tr key={f.farm_id} className="border-b border-surface-100 last:border-0 dark:border-surface-800">
                  <td className="px-3 py-2">
                    <p className="font-medium text-surface-900 dark:text-surface-100">{f.farm_name}</p>
                    <p className="text-xs text-surface-500">
                      {f.farmer_name} · {f.farmer_code}
                    </p>
                  </td>
                  <td className="px-3 py-2 text-right text-surface-600 dark:text-surface-400">
                    {Number(f.area_acres ?? 0)} acre
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {f.open_booking_number ? (
                      <span className="text-brand-700 dark:text-brand-300">
                        {f.open_booking_crop ?? "-"}
                        {f.open_booking_date ? ` · ${f.open_booking_date}` : ""}
                        <span className="block text-surface-500">{f.open_booking_number}</span>
                      </span>
                    ) : (
                      <span className="text-surface-400">{t("fm_no_open_work", lang)}</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${f.latitude},${f.longitude}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:underline"
                    >
                      <MapPin className="h-3 w-3" /> {t("fm_open_map", lang)}
                    </a>
                    {f.location_source === "manual_pin" ? (
                      <span className="block text-[11px] text-surface-400">{t("fm_hand_pinned", lang)}</span>
                    ) : f.location_accuracy_m !== null && Number(f.location_accuracy_m) > 50 ? (
                      <span className="block text-[11px] text-amber-700">
                        ±{Math.round(Number(f.location_accuracy_m))}m
                      </span>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}

      {farms.length === 0 && (
        <p className="rounded-card border border-surface-200 bg-white px-3 py-8 text-center text-surface-400 dark:border-surface-800 dark:bg-surface-900">
          {t("fm_empty", lang)}
        </p>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-card border border-surface-200 bg-white p-3 shadow-card dark:border-surface-800 dark:bg-surface-900">
      <p className="text-xs text-surface-500">{label}</p>
      <p className="mt-1 font-display text-lg font-semibold text-surface-900 dark:text-white">{value}</p>
    </div>
  );
}
