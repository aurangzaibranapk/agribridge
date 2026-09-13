import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { t } from "@/lib/i18n/translations";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";
import { CapacityPlanner } from "./capacity-planner";

export const dynamic = "force-dynamic";

/**
 * 30 din ka capacity planner (180).
 *
 * Booking lete waqt sab se aam sawal yehi hota hai: "is din jagah hai
 * ya nahi?" Us ka jawab pehle sirf us waqt milta tha jab booking
 * mehfooz karte waqt guard rok deta -- yani form bhar chuke hone ke
 * baad.
 *
 * Yahan koi naya HISAAB nahi. Hadd ka ek hi malik hai
 * (fn_machine_daily_capacity), aur ye safha wohi view parhta hai jo
 * guard ke sath ek hi function par khara hai. Do jagah do adad ka
 * khatra hai hi nahi.
 */
export default async function CapacityCalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ machine?: string; day?: string }>;
}) {
  const lang = getLanguageFromCookies("rm");
  const params = await searchParams;
  const supabase = createClient();

  const [{ data: days }, { data: locations }, { data: machines }] = await Promise.all([
    supabase.from("v_machinery_capacity_day").select("*").order("tareekh"),
    supabase.from("v_machinery_location_workload").select("*").order("kul_acre", { ascending: false }),
    supabase.from("v_machinery_machines").select("machine_id, machine_code, machine_type, model, status").order("machine_code"),
  ]);

  // Us din ki asal qatarein -- sirf tab layi jati hain jab kisi din par
  // ungli rakhi gayi ho. Poore mahine ki bookings pehle se lana bekaar
  // bojh hai.
  const { data: dayRows } = params.day
    ? await supabase.from("v_machinery_day_bookings").select("*").eq("tareekh", params.day).order("preferred_time")
    : { data: [] };

  const n = (v: unknown) => Number(v ?? 0);

  return (
    <div className="min-h-screen">
      <div className="mb-4">
        <Link href="/admin/machinery-rental" className="text-sm text-surface-500 hover:text-brand-700">
          ← {t("mc_back", lang)}
        </Link>
        <h1 className="mt-1 font-display text-xl font-semibold text-surface-900 dark:text-white">
          {t("mcal_title", lang)}
        </h1>
        <p className="text-sm text-surface-500">{t("mcal_subtitle", lang)}</p>
      </div>

      <CapacityPlanner
        days={(days ?? []).map((d) => ({
          machineId: d.machine_id as string,
          machineCode: (d.machine_code as string | null) ?? "-",
          machineType: (d.machine_type as string | null) ?? "-",
          machineStatus: (d.machine_status as string | null) ?? "available",
          vendorName: (d.vendor_name as string | null) ?? null,
          date: d.tareekh as string,
          capacity: n(d.hadd),
          booked: n(d.bandha_hua),
          free: n(d.bacha_hua),
          bookings: n(d.kitni_bookings),
          farmers: n(d.kitne_kisan),
          pct: n(d.fisad),
          state: (d.halat as string) ?? "khali",
        }))}
        machines={(machines ?? []).map((m) => ({
          id: m.machine_id as string,
          code: (m.machine_code as string | null) ?? "-",
          type: (m.machine_type as string | null) ?? "-",
          model: (m.model as string | null) ?? null,
          status: (m.status as string | null) ?? "available",
        }))}
        locations={(locations ?? []).map((l) => ({
          jagah: (l.jagah as string) ?? "-",
          acres: n(l.kul_acre),
          farmers: n(l.kitne_kisan),
          bookings: n(l.kitni_bookings),
        }))}
        selectedMachine={params.machine ?? "all"}
        selectedDay={params.day ?? null}
        dayRows={(dayRows ?? []).map((r) => ({
          bookingId: r.booking_id as string,
          bookingNumber: (r.booking_number as string) ?? "-",
          farmerName: (r.farmer_name as string | null) ?? "-",
          farmerCode: (r.farmer_code as string | null) ?? null,
          farmerPhone: (r.farmer_phone as string | null) ?? null,
          machineId: (r.machine_id as string | null) ?? null,
          machineCode: (r.machine_code as string | null) ?? null,
          machineType: (r.machine_type as string | null) ?? null,
          crop: (r.crop_type as string | null) ?? null,
          acres: n(r.acre),
          harvestType: (r.harvest_type as string | null) ?? null,
          sabit: r.sabit_area === null ? null : Number(r.sabit_area),
          kutra: r.kutra_area === null ? null : Number(r.kutra_area),
          jagah: (r.jagah as string) ?? "-",
          lat: r.location_lat === null ? null : Number(r.location_lat),
          lng: r.location_lng === null ? null : Number(r.location_lng),
          status: (r.status as string) ?? "-",
          overrideReason: (r.capacity_override_reason as string | null) ?? null,
        }))}
      />
    </div>
  );
}
