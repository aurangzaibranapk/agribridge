import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { sendWhatsAppMessage } from "@/lib/whatsapp-client";
import { notifyRoles } from "@/lib/notifications";
import { collectWatchItems, PENDING_ALERT_HOURS } from "@/lib/field-watch";

export const dynamic = "force-dynamic";

// cPanel Cron Job ise din mein ek baar (shaam 7 baje ke qareeb) chalata hai:
// curl "https://alranatraders.pk/api/cron/field-reminders?token=YOUR_SECRET"
//
// Yaad dihani ka usool: sirf us shakhs ko jise asal mein kuch karna hai,
// aur din mein ek hi baar. Baar baar aane wala paighaam parha jana band
// ho jata hai, aur phir asal zaroori paighaam bhi us ke sath doob jata
// hai.

const MANAGER_ROLES = ["owner", "super_admin", "admin", "manager"];

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  if (searchParams.get("token") !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const service = createServiceClient();
  const today = new Date().toISOString().slice(0, 10);

  // ---- 1) Staff ko: aaj subah ka meter aaya, shaam ka nahi ----
  const { data: openLogs } = await service
    .from("vehicle_daily_logs")
    .select("id, staff_profile_id, opening_km, vehicles(vehicle_name)")
    .eq("log_date", today)
    .not("opening_km", "is", null)
    .is("closing_km", null);

  const failures: string[] = [];
  let staffReminders = 0;
  for (const log of openLogs ?? []) {
    const { data: staff } = await service
      .from("staff_details")
      .select("whatsapp_number, whatsapp_verified_at")
      .eq("profile_id", log.staff_profile_id)
      .maybeSingle();

    // Number tasdeeq shuda na ho to paighaam nahi bhejte — ghair tasdeeq
    // shuda number par kaam ki baat bhejna us se bhi bura hai ke na
    // bhejein.
    if (!staff?.whatsapp_number || !staff.whatsapp_verified_at) continue;

    const vehicle = Array.isArray(log.vehicles) ? log.vehicles[0] : log.vehicles;
    // Har paighaam apni jagah. Ek number kharab ho to poori fehrist
    // rukni nahi chahiye -- baqi sab ko yaad dihani milti rehni chahiye.
    // Ginti bhi tabhi barhti hai jab paighaam waqai chala gaya ho.
    try {
      await sendWhatsAppMessage(
        staff.whatsapp_number,
        `Yaad dihani: aaj ka shaam wala meter abhi nahi aaya.\n\n` +
          `Gaari: ${vehicle?.vehicle_name ?? "aap ki gaari"}\n` +
          `Subah ka meter: ${Number(log.opening_km).toLocaleString()} km\n\n` +
          `Kaam khatam hone par meter ki photo bhej dein — warna aaj ka hisaab adhoora reh jayega.`
      );
      staffReminders += 1;
    } catch (e) {
      failures.push(`meter (${vehicle?.vehicle_name ?? "gaari"}): ${e instanceof Error ? e.message : "wajah maloom nahi"}`);
    }
  }

  // ---- 2) Oil badalne ki yaad dihani ----
  // Ye rider ko seedha jati hai, manager ko nahi: gaari us ke paas hai
  // aur workshop bhi wohi le kar jata hai. Manager ko sirf tab pata
  // chalna chahiye jab kaam ho jaye ya hadd se guzar jaye.
  const { data: vehicles } = await service
    .from("vehicles")
    .select("id, vehicle_name, last_service_km, service_interval_km, assigned_profile_id")
    .eq("is_active", true)
    .not("assigned_profile_id", "is", null);

  let oilReminders = 0;
  for (const vehicle of vehicles ?? []) {
    const { data: lastLog } = await service
      .from("vehicle_daily_logs")
      .select("closing_km")
      .eq("vehicle_id", vehicle.id)
      .not("closing_km", "is", null)
      .order("log_date", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (lastLog?.closing_km == null) continue;

    const since = Number(lastLog.closing_km) - Number(vehicle.last_service_km ?? 0);
    const interval = Number(vehicle.service_interval_km ?? 1000);
    if (since < interval) continue;

    const { data: staff } = await service
      .from("staff_details")
      .select("whatsapp_number, whatsapp_verified_at")
      .eq("profile_id", vehicle.assigned_profile_id!)
      .maybeSingle();
    if (!staff?.whatsapp_number || !staff.whatsapp_verified_at) continue;

    try {
      await sendWhatsAppMessage(
        staff.whatsapp_number,
        `Yaad dihani: ${vehicle.vehicle_name} ka oil badalne ka waqt ho gaya.\n\n` +
          `Aakhri service: ${Math.round(Number(vehicle.last_service_km ?? 0)).toLocaleString()} km\n` +
          `Ab tak chali: ${Math.round(since).toLocaleString()} km (hadd ${interval.toLocaleString()} km)\n\n` +
          `Oil badalwa kar bill ki tafseel manager ko de dein.`
      );
    } catch (e) {
      failures.push(`oil (${vehicle.vehicle_name}): ${e instanceof Error ? e.message : "wajah maloom nahi"}`);
      continue;
    }
    oilReminders += 1;
  }

  // ---- 3) Manager ko: jo cheezein der se pari hain ----
  const items = await collectWatchItems({ days: 14 });
  const urgent = items.filter((i) => i.severity === "alert");

  let managerNotices = 0;
  if (urgent.length > 0) {
    const oldest = urgent[0];
    await notifyRoles(
      MANAGER_ROLES,
      `Maidan ki nigrani: ${urgent.length} cheezein tawajjah mangti hain`,
      `Sab se purani: ${oldest.title} (${oldest.staffName}, ${oldest.ageDays} din).`,
      "/admin/field-watch"
    );
    managerNotices = urgent.length;
  }

  return NextResponse.json({
    success: true,
    date: today,
    staffReminders,
    oilReminders,
    managerNotices,
    pendingAlertHours: PENDING_ALERT_HOURS,
    // Jo paighaam nahi ja sake wo yahan likhe jate hain. Pehle ye jawab
    // hamesha "success: true" hi hota tha chahe ek bhi paighaam na gaya
    // ho -- cron ka record dekh kar ye faisla karna namumkin tha ke kaam
    // hua ya nahi.
    failures,
  });
}
