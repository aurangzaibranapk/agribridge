import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { PageHeader, Card } from "@/components/ui/layout-primitives";
import { vehicleForStaff, todaysLog } from "@/lib/vehicle-daily-log";
import { MyVehicleClient } from "./my-vehicle-client";
import { t } from "@/lib/i18n/translations";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";

export const dynamic = "force-dynamic";

/**
 * Meri Gaari -- staff ka apna safha (178).
 *
 * Rozana hisaab ka nizaam pehle se bana hua tha, magar us tak pahunchne
 * ka raasta sirf WhatsApp tha. Jis din WhatsApp ki chaabi na lagi ho,
 * us din staff ke paas meter darj karne ka koi tareeqa hi nahi hota
 * tha -- aur poora nizaam khali para rehta.
 *
 * Ab yahan se bhi ho jata hai. Hisaab wohi ek hai: dono raaste
 * src/lib/vehicle-daily-log.ts ko bulate hain.
 */
export default async function MyVehiclePage() {
  const lang = getLanguageFromCookies("rm");
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: me } = user
    ? await supabase.from("profiles").select("id, full_name").eq("id", user.id).maybeSingle()
    : { data: null };

  const vehicle = me ? await vehicleForStaff(me.id) : null;
  const log = vehicle ? await todaysLog(vehicle.id) : null;

  // Aaj ke petrol ke bill -- ek din mein kai baar ho sakta hai.
  const service = createServiceClient();
  const { data: fuelRows } = log
    ? await service
        .from("vehicle_fuel_entries")
        .select("id, liters, rate_per_liter, amount, amount_mismatch, entered_at")
        .eq("daily_log_id", log.id)
        .order("entered_at")
    : { data: [] };

  return (
    <div>
      <PageHeader
        title={t("mv_title", lang)}
        description="Subah ka meter, petrol ka bill, shaam ka meter — teenon yahin se."
      />

      {!vehicle ? (
        <Card>
          <p className="py-6 text-center text-sm text-surface-500">{t("at_no_vehicle", lang)}</p>
        </Card>
      ) : (
        <MyVehicleClient
          vehicleName={vehicle.vehicleName}
          registrationNo={vehicle.registrationNo}
          expectedKmPerLiter={vehicle.expectedKmPerLiter}
          log={
            log
              ? {
                  logNumber: log.log_number as string,
                  openingKm: log.opening_km === null ? null : Number(log.opening_km),
                  closingKm: log.closing_km === null ? null : Number(log.closing_km),
                  kmTravelled: log.km_travelled === null ? null : Number(log.km_travelled),
                  kmPerLiter: log.km_per_liter === null ? null : Number(log.km_per_liter),
                  costPerKm: log.cost_per_km === null ? null : Number(log.cost_per_km),
                  expectedLiters: log.expected_liters === null ? null : Number(log.expected_liters),
                  litersDifference: log.liters_difference === null ? null : Number(log.liters_difference),
                  status: log.status as string,
                  flags: ((log.flags as string[] | null) ?? []),
                }
              : null
          }
          fuel={(fuelRows ?? []).map((f) => ({
            id: f.id as string,
            liters: f.liters === null ? null : Number(f.liters),
            ratePerLiter: f.rate_per_liter === null ? null : Number(f.rate_per_liter),
            amount: f.amount === null ? null : Number(f.amount),
            mismatch: Boolean(f.amount_mismatch),
          }))}
        />
      )}
    </div>
  );
}
