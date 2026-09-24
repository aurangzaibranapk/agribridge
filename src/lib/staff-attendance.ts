import { createServiceClient } from "@/lib/supabase/service";

/**
 * WhatsApp se hazri, aur us ki jagah ki tasdeeq.
 *
 * Usool: hazri kabhi ROKI nahi jati. Agar banda daire se bahar se
 * lagata hai to hazri lag to jati hai, magar faasla sath likh diya
 * jata hai aur nishan lag jata hai — faisla manager karta hai, system
 * nahi. Rok dene se log kaam chhoR kar admin ke peeche bhagte hain;
 * sach saamne rakh dene se manager ko poora ikhtiyar milta hai.
 */

/**
 * Do jagahon ke darmiyan faasla (meter mein). Haversine formula —
 * zameen gol hai, is liye seedhi lakeer wala hisaab ghalat aata hai.
 */
export function distanceInMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000; // zameen ka nisf qutar, meter mein
  const toRad = (d: number) => (d * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;

  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export interface LocationCheck {
  /** Branch ki jagah darj hai ya nahi. Na ho to tasdeeq mumkin hi nahi. */
  canCheck: boolean;
  distanceMeters: number | null;
  withinRadius: boolean | null;
  radiusMeters: number | null;
  branchName: string | null;
}

/** Staff ki bheji hui jagah ko us ki branch se milata hai. */
export async function checkLocationAgainstBranch(
  branchId: string | null,
  lat: number | null,
  lng: number | null
): Promise<LocationCheck> {
  const empty: LocationCheck = {
    canCheck: false,
    distanceMeters: null,
    withinRadius: null,
    radiusMeters: null,
    branchName: null,
  };
  if (!branchId || lat == null || lng == null) return empty;

  const service = createServiceClient();
  const { data: branch } = await service
    .from("branches")
    .select("name, latitude, longitude, attendance_radius_meters")
    .eq("id", branchId)
    .maybeSingle();

  if (!branch?.latitude || !branch?.longitude) {
    // Branch ki jagah abhi darj nahi hui — hazri phir bhi lagegi, bas
    // tasdeeq ke baghair.
    return { ...empty, branchName: branch?.name ?? null };
  }

  const radius = Number(branch.attendance_radius_meters ?? 200);
  const distance = distanceInMeters(lat, lng, Number(branch.latitude), Number(branch.longitude));

  return {
    canCheck: true,
    distanceMeters: Math.round(distance * 10) / 10,
    withinRadius: distance <= radius,
    radiusMeters: radius,
    branchName: branch.name,
  };
}

/** Faasla insaan ke parhne layaq shakl mein. */
function readableDistance(meters: number): string {
  return meters >= 1000 ? `${(meters / 1000).toFixed(1)} km` : `${Math.round(meters)} meter`;
}

export interface AttendanceResult {
  message: string;
}

export async function whatsappCheckIn(
  profileId: string,
  branchId: string | null,
  lat: number | null,
  lng: number | null
): Promise<AttendanceResult> {
  const service = createServiceClient();
  const today = new Date().toISOString().split("T")[0];
  const now = new Date().toISOString();

  const loc = await checkLocationAgainstBranch(branchId, lat, lng);

  const { error } = await service.from("attendance_records").upsert(
    {
      profile_id: profileId,
      attendance_date: today,
      status: "present",
      check_in_at: now,
      check_in_lat: lat,
      check_in_lng: lng,
      check_in_distance_meters: loc.distanceMeters,
      check_in_location_ok: loc.withinRadius,
      source: "whatsapp",
    },
    { onConflict: "profile_id,attendance_date" }
  );
  if (error) return { message: `Hazri darj nahi ho saki: ${error.message}` };

  const waqt = new Date().toLocaleTimeString("en-PK", { hour: "2-digit", minute: "2-digit", hour12: true });

  if (lat == null || lng == null) {
    return {
      message:
        `Hazri lag gayi — ${waqt}.\n\n` +
        `Location nahi mili. Agli baar WhatsApp mein 📎 → *Location* → *Send your current location* bhej dein, ` +
        `warna manager ko tasdeeq nahi ho pati.`,
    };
  }
  if (!loc.canCheck) {
    return { message: `Hazri lag gayi — ${waqt}.\n\nAapki branch ki jagah abhi system mein darj nahi, is liye faasla nahi naapa ja saka.` };
  }
  if (loc.withinRadius) {
    return { message: `Hazri lag gayi — ${waqt}.\n\n✅ Aap ${loc.branchName} par maujood hain.` };
  }
  return {
    message:
      `Hazri lag gayi — ${waqt}.\n\n` +
      `⚠️ Aap ${loc.branchName} se ${readableDistance(loc.distanceMeters!)} door hain. ` +
      `Manager ko ye faasla nazar aayega.`,
  };
}

export async function whatsappCheckOut(
  profileId: string,
  branchId: string | null,
  lat: number | null,
  lng: number | null
): Promise<AttendanceResult> {
  const service = createServiceClient();
  const today = new Date().toISOString().split("T")[0];

  const { data: existing } = await service
    .from("attendance_records")
    .select("id, check_in_at")
    .eq("profile_id", profileId)
    .eq("attendance_date", today)
    .maybeSingle();

  if (!existing?.check_in_at) {
    return { message: "Aaj ki hazri lagi hi nahi. Pehle *Hazir* likhein." };
  }

  const loc = await checkLocationAgainstBranch(branchId, lat, lng);
  const now = new Date().toISOString();

  const { error } = await service
    .from("attendance_records")
    .update({
      check_out_at: now,
      check_out_lat: lat,
      check_out_lng: lng,
      check_out_distance_meters: loc.distanceMeters,
      check_out_location_ok: loc.withinRadius,
    })
    .eq("id", existing.id);
  if (error) return { message: `Chhutti darj nahi ho saki: ${error.message}` };

  const inTime = new Date(existing.check_in_at);
  const hours = (Date.now() - inTime.getTime()) / (1000 * 60 * 60);
  const waqt = new Date().toLocaleTimeString("en-PK", { hour: "2-digit", minute: "2-digit", hour12: true });

  let msg = `Chhutti darj ho gayi — ${waqt}.\nAaj kaam: ${hours.toFixed(1)} ghante.`;
  if (loc.canCheck && loc.withinRadius === false) {
    msg += `\n\n⚠️ Aap ${loc.branchName} se ${readableDistance(loc.distanceMeters!)} door the.`;
  }
  return { message: msg };
}
