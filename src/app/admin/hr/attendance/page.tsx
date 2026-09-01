import { redirect } from "next/navigation";
import { PageHeader, Card } from "@/components/ui/layout-primitives";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";
import { t } from "@/lib/i18n/translations";
import { createClient } from "@/lib/supabase/server";
import { CalendarClient } from "./calendar-client";

export const dynamic = "force-dynamic";

/**
 * Hazri ka calendar.
 *
 * Ek mahina, ek banda, har din. Yahan ka sab se ahem faisla ye hai ke
 * KHAALI DIN KA JAWAB kahan se aata hai. Agar safha khud tay karta --
 * "record nahi mila to ghair hazir" -- to itwaar aur Eid bhi ghair
 * haziri ban jate. Is liye har din ka jawab database ke ek hi function
 * se aata hai (fn_attendance_calendar), jo record aur qawaid dono
 * parhta hai. Safha sirf dikhata hai.
 *
 * Aur jis ko dekhne ka haq nahi, usay khali calendar nahi milta --
 * saaf inkaar milta hai. Khali calendar "koi ghair hazir nahi" lagta
 * hai, aur wo jhoot hai.
 */
export default async function AttendanceCalendarPage({
  searchParams,
}: {
  searchParams: { p?: string; y?: string; m?: string };
}) {
  const supabase = createClient();
  const lang = getLanguageFromCookies("rm");

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: staff } = await supabase.rpc("fn_hr_staff_directory");
  const people = (staff ?? []).map((s) => ({
    id: s.profile_id,
    name: s.full_name ?? "—",
    designation: s.designation ?? null,
  }));

  const profileId = searchParams.p || user.id;
  const now = new Date();
  const year = Number(searchParams.y) || now.getFullYear();
  const month = Number(searchParams.m) || now.getMonth() + 1;

  const from = `${year}-${String(month).padStart(2, "0")}-01`;
  const to = new Date(Date.UTC(year, month, 0)).toISOString().split("T")[0];

  const [{ data: days, error: calErr }, { data: summaryRows }, { data: canDecideRaw }, { data: audit }, { data: corrections }] =
    await Promise.all([
      supabase.rpc("fn_attendance_calendar", { p_profile: profileId, p_year: year, p_month: month }),
      supabase.rpc("fn_attendance_month_summary", { p_profile: profileId, p_year: year, p_month: month }),
      supabase.rpc("fn_hr_can_decide_for", { p_target: profileId }),
      supabase
        .from("attendance_audit")
        .select("attendance_date, action, changed_fields, old_value, new_value, reason, changed_at")
        .eq("profile_id", profileId)
        .gte("attendance_date", from)
        .lte("attendance_date", to)
        .order("changed_at", { ascending: false })
        .limit(100),
      supabase
        .from("attendance_corrections")
        .select("id, attendance_date, requested_status, requested_check_in, requested_check_out, reason, status, manager_comment, decided_at")
        .eq("profile_id", profileId)
        .gte("attendance_date", from)
        .lte("attendance_date", to)
        .order("attendance_date", { ascending: false }),
    ]);

  const person = people.find((p) => p.id === profileId);

  // Inkaar ko khali calendar mein nahi badla jata. Wajah safhe par likhi
  // hai, warna dekhne wala samajhta hai ke us bande ka koi record hi
  // nahi -- jo bilkul aur baat hai.
  if (calErr) {
    return (
      <div>
        <PageHeader title={t("hra_title", lang)} description={t("hra_subtitle", lang)} />
        <Card>
          <p className="text-sm text-red-700">{calErr.message}</p>
        </Card>
      </div>
    );
  }

  const summary = summaryRows?.[0] ?? null;

  return (
    <div>
      <PageHeader title={t("hra_title", lang)} description={t("hra_subtitle", lang)} />
      <CalendarClient
        lang={lang}
        meId={user.id}
        people={people}
        profileId={profileId}
        personName={person?.name ?? null}
        year={year}
        month={month}
        canDecide={canDecideRaw === true}
        days={(days ?? []).map((d) => ({
          date: d.the_date,
          state: d.state,
          checkIn: d.check_in,
          checkOut: d.check_out,
          workMinutes: d.work_minutes,
          lateMinutes: d.late_minutes,
          source: d.source,
          notes: d.notes,
          holidayName: d.holiday_name,
          pendingCorrection: d.pending_correction,
          changesCount: d.changes_count,
        }))}
        summary={
          summary
            ? {
                workingDays: summary.working_days,
                presentDays: summary.present_days,
                halfDays: summary.half_days,
                paidLeave: summary.paid_leave_days,
                unpaidLeave: summary.unpaid_leave_days,
                absentDays: summary.absent_days,
                missingDays: summary.missing_days,
                lateCount: summary.late_count,
                openItems: summary.open_items,
                isFinalized: summary.is_finalized,
              }
            : null
        }
        audit={(audit ?? []).map((a) => ({
          date: a.attendance_date,
          action: a.action,
          fields: a.changed_fields ?? [],
          oldStatus: (a.old_value as { status?: string } | null)?.status ?? null,
          newStatus: (a.new_value as { status?: string } | null)?.status ?? null,
          reason: a.reason,
          at: a.changed_at,
        }))}
        corrections={(corrections ?? []).map((c) => ({
          id: c.id,
          date: c.attendance_date,
          requestedStatus: c.requested_status,
          reason: c.reason,
          status: c.status,
          managerComment: c.manager_comment,
        }))}
      />
    </div>
  );
}
