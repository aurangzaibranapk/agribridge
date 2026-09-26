import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui/layout-primitives";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";
import { t } from "@/lib/i18n/translations";
import { createClient } from "@/lib/supabase/server";
import { CorrectionsClient } from "./corrections-client";

export const dynamic = "force-dynamic";

/**
 * Hazri theek karwayein — do hisse:
 * 1. Staff apni correction darkhwast bhejta hai (upar form).
 * 2. Manager/Admin/HR doosron ki darkhwastein manzoor ya radd karta hai.
 */
export default async function CorrectionsPage() {
  const supabase = createClient();
  const lang = getLanguageFromCookies("rm");

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Apni darkhwastein (saari, har halat mein)
  const { data: apniRows } = await supabase
    .from("attendance_corrections")
    .select("id, attendance_date, requested_status, requested_check_in, requested_check_out, reason, status, manager_comment, created_at")
    .eq("profile_id", user.id)
    .order("attendance_date", { ascending: false })
    .limit(20);

  // Is mahine kitni darkhwastain de chuki hain (limit 5)
  const today = new Date().toISOString().split("T")[0];
  const monthStart = today.slice(0, 7) + "-01";
  const { count: usedThisMonth } = await supabase
    .from("attendance_corrections")
    .select("id", { count: "exact", head: true })
    .eq("profile_id", user.id)
    .gte("created_at", monthStart);

  // Pichle 60 din ki attendance records — select karne ke liye
  const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 3600 * 1000).toISOString().split("T")[0];
  const { data: attRows } = await supabase
    .from("attendance_records")
    .select("attendance_date, status, check_in, check_out")
    .eq("profile_id", user.id)
    .gte("attendance_date", sixtyDaysAgo)
    .lte("attendance_date", today)
    .order("attendance_date", { ascending: false })
    .limit(60);

  // Team ki darkhwastein (pending/sent_back, doosron ki)
  const { data: open } = await supabase
    .from("attendance_corrections")
    .select(
      "id, profile_id, attendance_date, requested_status, requested_check_in, requested_check_out, reason, status, original_snapshot, created_at, profiles!attendance_corrections_profile_id_fkey(full_name)"
    )
    .in("status", ["pending", "sent_back"])
    .neq("profile_id", user.id)
    .order("attendance_date", { ascending: true });

  const rows = open ?? [];
  const allowed: typeof rows = [];
  for (const r of rows) {
    const { data: ok } = await supabase.rpc("fn_hr_can_decide_for", { p_target: r.profile_id });
    if (ok === true) allowed.push(r);
  }

  return (
    <div>
      <PageHeader title="Hazri theek karwayein" description="Apni ghalat hazri ki darkhwast dein — manager ya admin manzoor karega" />
      <CorrectionsClient
        lang={lang}
        usedThisMonth={usedThisMonth ?? 0}
        attendanceDates={(attRows ?? []).map((r) => ({
          date: r.attendance_date as string,
          status: (r.status as string) ?? "missing",
          checkIn: (r.check_in as string | null) ?? null,
          checkOut: (r.check_out as string | null) ?? null,
        }))}
        myRows={(apniRows ?? []).map((r) => ({
          id: r.id,
          date: r.attendance_date as string,
          requestedStatus: r.requested_status as string,
          requestedIn: r.requested_check_in as string | null,
          requestedOut: r.requested_check_out as string | null,
          reason: r.reason as string,
          status: r.status as string,
          managerComment: r.manager_comment as string | null,
        }))}
        teamRows={allowed.map((r) => {
          const snap = (r.original_snapshot ?? null) as { status?: string; check_in?: string | null } | null;
          return {
            id: r.id,
            who: (r as unknown as { profiles?: { full_name?: string } }).profiles?.full_name ?? "—",
            date: r.attendance_date as string,
            requestedStatus: r.requested_status as string,
            requestedIn: r.requested_check_in as string | null,
            requestedOut: r.requested_check_out as string | null,
            reason: r.reason as string,
            status: r.status as string,
            wasStatus: snap?.status ?? null,
            wasIn: snap?.check_in ?? null,
          };
        })}
      />
    </div>
  );
}
