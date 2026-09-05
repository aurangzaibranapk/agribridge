import { redirect } from "next/navigation";
import { PageHeader, Card } from "@/components/ui/layout-primitives";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";
import { t } from "@/lib/i18n/translations";
import { createClient } from "@/lib/supabase/server";
import { SettingsClient } from "./settings-client";

export const dynamic = "force-dynamic";

const HR_ROLES = ["hr", "admin", "owner", "super_admin"];

/**
 * Chhutti aur waqt -- calendar ke qawaid.
 *
 * Ye safha chhota hai magar is ka wazan sab se zyada hai. Yahan se
 * hafte ki chhutti badalti hai, aur hafte ki chhutti har bande ke
 * mahine mein 4-5 din ka farq daal deti hai. Is liye ye safha
 * is_sensitive hai aur sirf HR/Admin ke liye khulta hai.
 */
export default async function HrSettingsPage() {
  const supabase = createClient();
  const lang = getLanguageFromCookies("rm");

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: me } = await supabase.from("profiles").select("role, is_active").eq("id", user.id).maybeSingle();
  if (!me?.is_active || !HR_ROLES.includes(me.role)) {
    return (
      <div>
        <PageHeader title={t("hrs_title", lang)} description={t("hrs_subtitle", lang)} />
        <Card>
          <p className="text-sm text-surface-600">
            Ye safha sirf HR aur Admin ke liye hai. Yahan se hafte ki chhutti aur mahine ka taala badalta hai — dono
            seedha tankhwah par asar daalte hain.
          </p>
        </Card>
      </div>
    );
  }

  const today = new Date();
  const yearStart = `${today.getFullYear()}-01-01`;

  const [{ data: schedule }, { data: holidays }, { data: locks }, { data: branches }] = await Promise.all([
    supabase
      .from("hr_work_schedules")
      .select("id, branch_id, weekly_off_days, shift_start, shift_end, late_grace_minutes, half_day_max_minutes")
      .eq("is_active", true)
      .is("branch_id", null)
      .maybeSingle(),
    supabase
      .from("hr_holidays")
      .select("id, holiday_date, name, branch_id, is_paid")
      .gte("holiday_date", yearStart)
      .order("holiday_date"),
    supabase
      .from("attendance_month_locks")
      .select("id, branch_id, lock_year, lock_month, locked_at, note, reopened_at, reopen_reason")
      .order("lock_year", { ascending: false })
      .order("lock_month", { ascending: false })
      .limit(24),
    supabase.from("branches").select("id, name").eq("is_active", true).order("name"),
  ]);

  const { data: policy } = await supabase
    .from("hr_leave_policy")
    .select("annual_leave_days, probation_months, probation_max_total_months, probation_paid_leave, prorate_first_year, carry_forward_days")
    .eq("id", true)
    .maybeSingle();

  return (
    <div>
      <PageHeader title={t("hrs_title", lang)} description={t("hrs_subtitle", lang)} />
      <SettingsClient
        lang={lang}
        schedule={
          schedule
            ? {
                weeklyOffDays: (schedule.weekly_off_days ?? []).map(Number),
                shiftStart: schedule.shift_start?.slice(0, 5) ?? "09:00",
                shiftEnd: schedule.shift_end?.slice(0, 5) ?? "17:00",
                grace: schedule.late_grace_minutes ?? 15,
                halfDayMax: schedule.half_day_max_minutes ?? 300,
              }
            : null
        }
        holidays={(holidays ?? []).map((h) => ({
          id: h.id,
          date: h.holiday_date,
          name: h.name,
          isPaid: h.is_paid,
        }))}
        locks={(locks ?? []).map((l) => ({
          id: l.id,
          year: l.lock_year,
          month: l.lock_month,
          lockedAt: l.locked_at,
          note: l.note,
          reopenedAt: l.reopened_at,
          reopenReason: l.reopen_reason,
        }))}
        branches={(branches ?? []).map((b) => ({ id: b.id, name: b.name }))}
        currentYear={today.getFullYear()}
        currentMonth={today.getMonth() + 1}
        policy={
          policy
            ? {
                annualDays: policy.annual_leave_days,
                probationMonths: policy.probation_months,
                probationMax: policy.probation_max_total_months,
                probationPaidLeave: policy.probation_paid_leave,
                prorateFirstYear: policy.prorate_first_year,
                carryForward: policy.carry_forward_days,
              }
            : null
        }
      />
    </div>
  );
}
