import { redirect } from "next/navigation";
import { PageHeader, Card } from "@/components/ui/layout-primitives";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";
import { t } from "@/lib/i18n/translations";
import { createClient } from "@/lib/supabase/server";
import { ProbationClient } from "./probation-client";

export const dynamic = "force-dynamic";

const HR_ROLES = ["hr", "admin", "owner", "super_admin"];

/**
 * Aazmaishi muddat.
 *
 * Do fehristein: pehli wo jin ki muddat khatam ho rahi hai ya guzar
 * chuki hai (yahi asal kaam hai), doosri poori fehrist.
 *
 * Guzri hui tareekh wale sab se oopar hain aur laal hain. Wajah ye ek
 * jumle mein hai: jo banda aazmaish par bhool gaya, wo chhutti se
 * mehroom rehta hai aur kisi ko pata nahi chalta.
 */
export default async function ProbationPage() {
  const supabase = createClient();
  const lang = getLanguageFromCookies("rm");

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: me } = await supabase.from("profiles").select("role, is_active").eq("id", user.id).maybeSingle();
  const canEdit = !!me?.is_active && HR_ROLES.includes(me.role);

  const [{ data: due }, { data: dir }, { data: pol }, { data: reviews }] = await Promise.all([
    // 3650 din = poori fehrist, sirf aane wale do hafte nahi.
    supabase.rpc("fn_hr_probation_due", { p_days_ahead: 3650 }),
    supabase.rpc("fn_hr_staff_directory"),
    supabase.from("hr_leave_policy").select("probation_months, probation_max_total_months").eq("id", true).maybeSingle(),
    supabase
      .from("staff_probation_reviews")
      .select("profile_id, decision, extend_months, comment, old_end_date, new_end_date, reviewed_at")
      .order("reviewed_at", { ascending: false })
      .limit(50),
  ]);

  const staffStatus = await supabase
    .from("staff_details")
    .select("profile_id, employment_status, probation_start_date, probation_end_date, confirmed_at, hire_date");

  const statusBy = new Map(
    (staffStatus.data ?? []).map((r) => [
      r.profile_id,
      {
        status: r.employment_status,
        start: r.probation_start_date,
        end: r.probation_end_date,
        confirmedAt: r.confirmed_at,
        hireDate: r.hire_date,
      },
    ])
  );

  const people = (dir ?? []).map((d) => {
    const st = statusBy.get(d.profile_id);
    return {
      id: d.profile_id,
      name: d.full_name ?? "—",
      designation: d.designation,
      // status undefined = staff_details parhi nahi ja saki (RLS).
      // Us soorat mein "pakka" maan lena us bande ko chhutti de deta
      // jis ka haq abhi nahi bana. Is liye NULL rehta hai.
      status: st?.status ?? null,
      start: st?.start ?? st?.hireDate ?? null,
      end: st?.end ?? null,
      confirmedAt: st?.confirmedAt ?? null,
    };
  });

  return (
    <div>
      <PageHeader title={t("hrp_title", lang)} description={t("hrp_subtitle", lang)} />

      {!canEdit && (
        <Card className="mb-4">
          <p className="text-sm text-surface-600">
            Faisla sirf HR aur Admin karte hain. Yahan sirf haalat nazar aayegi.
          </p>
        </Card>
      )}

      <ProbationClient
        lang={lang}
        canEdit={canEdit}
        defaultMonths={pol?.probation_months ?? 3}
        maxMonths={pol?.probation_max_total_months ?? 6}
        due={(due ?? []).map((d) => ({
          id: d.profile_id,
          name: d.full_name ?? "—",
          designation: d.designation,
          start: d.probation_start_date,
          end: d.probation_end_date,
          daysLeft: d.days_left,
          isOverdue: d.is_overdue,
          extensions: d.extensions,
          canExtend: d.can_extend,
        }))}
        people={people}
        reviews={(reviews ?? []).map((r) => ({
          profileId: r.profile_id,
          decision: r.decision,
          extendMonths: r.extend_months,
          comment: r.comment,
          oldEnd: r.old_end_date,
          newEnd: r.new_end_date,
          at: r.reviewed_at,
        }))}
      />
    </div>
  );
}
