import { createServiceClient } from "@/lib/supabase/service";

/**
 * Maidan ki nigrani — ek hi jagah par sab adhoori aur mashkook cheezein.
 *
 * Flags pehle se lagte the, magar wo apni apni jagah pare rehte the: koi
 * submission par, koi gaari ke log par, koi hazri par. Manager ko teen
 * alag safhe khol kar dekhna parta — aur jo cheez dekhne ke liye mehnat
 * karni pare, wo dekhi nahi jati.
 *
 * Yahan koi naya flag paida nahi hota. Jo pehle se darj hai wohi ikhatta
 * kar ke ek fehrist bana di jati hai, sab se purani baat sab se upar —
 * kyunke jo cheez jitni der pari rahe, utni hi ziyada mushkil hoti hai.
 */

export type WatchKind =
  | "pending_review"
  | "flagged_submission"
  | "missing_closing"
  | "location_mismatch"
  | "fuel_gap"
  | "unposted_log";

export type WatchSeverity = "alert" | "warning";

export interface WatchItem {
  id: string;
  kind: WatchKind;
  severity: WatchSeverity;
  title: string;
  detail: string;
  staffName: string;
  branchId: string | null;
  /** Kis din ki baat hai (YYYY-MM-DD). */
  date: string;
  /** Kitne din se pari hai. */
  ageDays: number;
  link: string;
}

export const WATCH_KIND_LABEL: Record<WatchKind, string> = {
  pending_review: "Manager ke intezar mein",
  flagged_submission: "Nishan lagi hui entry",
  missing_closing: "Shaam ka meter nahi aaya",
  location_mismatch: "Hazri branch se door lagi",
  fuel_gap: "Petrol ka hisaab pura nahi",
  unposted_log: "Hisaab accounts mein nahi gaya",
};

/** Kitne ghante baad pending entry ko dair samjha jaye. */
export const PENDING_ALERT_HOURS = 24;
/** Kitne din baad band shuda log ka accounts mein na jana khatkne lage. */
export const UNPOSTED_ALERT_DAYS = 2;

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function daysSince(iso: string): number {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return 0;
  return Math.max(0, Math.floor((Date.now() - then) / 86_400_000));
}

function flagList(flags: unknown): string[] {
  if (!Array.isArray(flags)) return [];
  return flags.filter((f): f is string => typeof f === "string");
}

interface Options {
  /** Sirf ek branch ki cheezein chahiye to us ki id. */
  branchId?: string | null;
  /** Kitne din peeche tak dekhna hai. */
  days?: number;
}

/**
 * Sab nigrani wali cheezein ikhatti karta hai.
 *
 * Har hissa alag try/catch mein nahi hai — agar koi ek query nakaam ho
 * jaye to poori fehrist khali dena behtar hai bajaye adhoori fehrist
 * dene ke, jise dekh kar manager samjhe ke sab theek hai.
 */
export async function collectWatchItems(options: Options = {}): Promise<WatchItem[]> {
  const service = createServiceClient();
  const days = options.days ?? 14;
  const since = new Date(Date.now() - days * 86_400_000).toISOString();
  const sinceDate = since.slice(0, 10);
  const branchId = options.branchId ?? null;

  const items: WatchItem[] = [];

  // Naam ek hi baar nikal lete hain — har qatar par alag query karna
  // safhe ko dhima kar deta hai.
  const names = new Map<string, string>();
  const { data: profiles } = await service.from("profiles").select("id, full_name");
  for (const p of profiles ?? []) names.set(p.id, p.full_name ?? "Staff");

  // ---- 1 & 2: Submissions — pending aur nishan lagi hui ----
  let subQuery = service
    .from("whatsapp_submissions")
    .select("id, submission_number, kind, status, flags, branch_id, staff_profile_id, created_at, original_amount")
    .eq("status", "pending")
    .gte("created_at", since);
  if (branchId) subQuery = subQuery.eq("branch_id", branchId);
  const { data: submissions } = await subQuery;

  for (const s of submissions ?? []) {
    const flags = flagList(s.flags);
    const age = daysSince(s.created_at);
    const hours = (Date.now() - new Date(s.created_at).getTime()) / 3_600_000;
    const staffName = names.get(s.staff_profile_id) ?? "Staff";
    const amount = s.original_amount == null ? null : Number(s.original_amount);

    if (flags.length) {
      items.push({
        id: `flag-${s.id}`,
        kind: "flagged_submission",
        severity: "alert",
        title: `${s.submission_number} par nishan laga hai`,
        detail: flags.join(" | "),
        staffName,
        branchId: s.branch_id,
        date: s.created_at.slice(0, 10),
        ageDays: age,
        link: `/admin/submissions/${s.id}`,
      });
    } else if (hours >= PENDING_ALERT_HOURS) {
      items.push({
        id: `pending-${s.id}`,
        kind: "pending_review",
        severity: age >= 3 ? "alert" : "warning",
        title: `${s.submission_number} ${age} din se faisle ka muntazir`,
        detail: amount == null ? "Raqam abhi darj nahi hui." : `Raqam: Rs ${amount.toLocaleString()}`,
        staffName,
        branchId: s.branch_id,
        date: s.created_at.slice(0, 10),
        ageDays: age,
        link: `/admin/submissions/${s.id}`,
      });
    }
  }

  // ---- 3, 5 & 6: Gaari ke rozana log ----
  let logQuery = service
    .from("vehicle_daily_logs")
    .select("id, log_number, log_date, opening_km, closing_km, closing_at, liters_difference, flags, status, posted_at, branch_id, staff_profile_id")
    .gte("log_date", sinceDate);
  if (branchId) logQuery = logQuery.eq("branch_id", branchId);
  const { data: logs } = await logQuery;

  const todayStr = today();
  for (const log of logs ?? []) {
    const staffName = names.get(log.staff_profile_id) ?? "Staff";
    const age = daysSince(log.log_date);

    // Aaj ka din abhi chal raha hai — shaam ka meter na hona aaj ghalti
    // nahi. Sirf guzray hue din par sawal banta hai.
    if (log.opening_km != null && log.closing_km == null && log.log_date !== todayStr) {
      items.push({
        id: `noclose-${log.id}`,
        kind: "missing_closing",
        severity: "alert",
        title: `${log.log_date} ka shaam wala meter nahi aaya`,
        detail: `Subah ka meter ${Number(log.opening_km).toLocaleString()} km par darj hua tha, shaam ka kabhi nahi aaya.`,
        staffName,
        branchId: log.branch_id,
        date: log.log_date,
        ageDays: age,
        link: "/admin/vehicles",
      });
    }

    const logFlags = flagList(log.flags);
    if (logFlags.length && !log.posted_at) {
      items.push({
        id: `fuelgap-${log.id}`,
        kind: "fuel_gap",
        severity: "warning",
        title: `${log.log_number} par nishan laga hai`,
        detail: logFlags.join(" | "),
        staffName,
        branchId: log.branch_id,
        date: log.log_date,
        ageDays: age,
        link: "/admin/vehicles",
      });
    }

    if (log.closing_km != null && !log.posted_at && age >= UNPOSTED_ALERT_DAYS) {
      items.push({
        id: `unposted-${log.id}`,
        kind: "unposted_log",
        severity: "warning",
        title: `${log.log_number} ${age} din se accounts mein nahi gaya`,
        detail: "Hisaab mukammal hai magar manager ne abhi post nahi kiya.",
        staffName,
        branchId: log.branch_id,
        date: log.log_date,
        ageDays: age,
        link: "/admin/vehicles",
      });
    }
  }

  // ---- 4: Hazri branch se door ----
  // Hazri kabhi roki nahi jati — door se lag jati hai, magar record par
  // reh jati hai. Yahan wohi record saamne aata hai.
  const { data: attendance } = await service
    .from("attendance_records")
    .select("id, profile_id, attendance_date, check_in_distance_meters, check_in_location_ok, check_out_location_ok, check_out_distance_meters")
    .gte("attendance_date", sinceDate)
    .or("check_in_location_ok.is.false,check_out_location_ok.is.false");

  for (const a of attendance ?? []) {
    const inFar = a.check_in_location_ok === false;
    const outFar = a.check_out_location_ok === false;
    const distance = inFar ? a.check_in_distance_meters : a.check_out_distance_meters;
    items.push({
      id: `loc-${a.id}`,
      kind: "location_mismatch",
      severity: "warning",
      title: `${a.attendance_date} ki hazri branch se door lagi`,
      detail:
        distance == null
          ? `${inFar ? "Aane" : "Jane"} ke waqt location branch se mail nahi khai.`
          : `${inFar ? "Aane" : "Jane"} ke waqt branch se ${Math.round(Number(distance)).toLocaleString()} meter door tha.`,
      staffName: names.get(a.profile_id) ?? "Staff",
      branchId: null,
      date: a.attendance_date,
      ageDays: daysSince(a.attendance_date),
      link: "/admin/hr/attendance-log",
    });

    if (inFar && outFar) {
      // Dono waqt door — ye ek hi qatar mein reh jata hai, magar detail
      // mein dono ka zikr aa jata hai.
      items[items.length - 1].detail += " Jate waqt bhi door tha.";
      items[items.length - 1].severity = "alert";
    }
  }

  // Sab se purani baat sab se upar. Jo jitni der pari rahe, utni hi
  // ziyada mushkil hoti hai.
  return items.sort((a, b) => {
    if (a.severity !== b.severity) return a.severity === "alert" ? -1 : 1;
    return b.ageDays - a.ageDays;
  });
}

export function countBySeverity(items: WatchItem[]): { alerts: number; warnings: number } {
  return {
    alerts: items.filter((i) => i.severity === "alert").length,
    warnings: items.filter((i) => i.severity === "warning").length,
  };
}
