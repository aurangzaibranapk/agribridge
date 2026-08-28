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
    await sendWhatsAppMessage(
      staff.whatsapp_number,
      `Yaad dihani: aaj ka shaam wala meter abhi nahi aaya.\n\n` +
        `Gaari: ${vehicle?.vehicle_name ?? "aap ki gaari"}\n` +
        `Subah ka meter: ${Number(log.opening_km).toLocaleString()} km\n\n` +
        `Kaam khatam hone par meter ki photo bhej dein — warna aaj ka hisaab adhoora reh jayega.`
    );
    staffReminders += 1;
  }

  // ---- 2) Manager ko: jo cheezein der se pari hain ----
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
    managerNotices,
    pendingAlertHours: PENDING_ALERT_HOURS,
  });
}
