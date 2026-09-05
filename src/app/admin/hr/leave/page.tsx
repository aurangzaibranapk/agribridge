import Link from "next/link";
import { redirect } from "next/navigation";
import { CalendarDays } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, Card } from "@/components/ui/layout-primitives";
import { Badge } from "@/components/ui/form";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";
import { t } from "@/lib/i18n/translations";
import { LeaveClient } from "./leave-client";

export const dynamic = "force-dynamic";

const DECIDERS = ["hr", "manager", "admin", "owner", "super_admin"];

/**
 * Chhutti.
 *
 * Do hisse: apni darkhwast, aur (agar ijazat ho to) doosron ki
 * darkhwaston par faisla.
 *
 * Har banda apni chhutti khud maangta hai, aur apni hi dekh sakta hai --
 * ye rok database mein hai (RLS), yahan sirf us ka natija dikhta hai.
 */
export default async function LeavePage() {
  const supabase = createClient();
  const lang = getLanguageFromCookies("rm");

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: me } = await supabase.from("profiles").select("id, full_name, role").eq("id", user.id).maybeSingle();
  if (!me) redirect("/login");

  const canDecide = DECIDERS.includes(me.role);

  const [{ data: mine }, { data: pending }] = await Promise.all([
    supabase
      .from("leave_requests")
      .select("id, from_date, to_date, days, leave_type, reason, status, decision_note, created_at")
      .eq("profile_id", user.id)
      .order("from_date", { ascending: false })
      .limit(20),
    canDecide
      ? supabase
          .from("leave_requests")
          .select("id, profile_id, from_date, to_date, days, leave_type, reason, status, created_at, profiles!leave_requests_profile_id_fkey(full_name)")
          .eq("status", "pending")
          .neq("profile_id", user.id)
          .order("from_date")
      : Promise.resolve({ data: [] }),
  ]);

  return (
    <div>
      <PageHeader
        title={t("lv_title", lang)}
        description={t("lv_subtitle", lang)}
        actions={
          canDecide ? (
            <Link
              href="/admin/hr/leave/calendar"
              className="inline-flex items-center gap-1.5 rounded-lg border border-surface-200 px-3 py-2 text-sm font-medium text-surface-800 hover:bg-surface-100 dark:border-surface-700 dark:text-surface-200 dark:hover:bg-surface-800"
            >
              <CalendarDays className="h-4 w-4" /> Team ka calendar
            </Link>
          ) : undefined
        }
      />

      <LeaveClient
        lang={lang}
        canDecide={canDecide}
        mine={(mine ?? []).map((r) => ({
          id: r.id,
          fromDate: r.from_date,
          toDate: r.to_date,
          days: r.days ?? 0,
          leaveType: r.leave_type,
          reason: r.reason,
          status: r.status,
          decisionNote: r.decision_note,
        }))}
        pending={((pending ?? []) as any[]).map((r) => ({
          id: r.id,
          who: r.profiles?.full_name ?? "—",
          fromDate: r.from_date,
          toDate: r.to_date,
          days: r.days ?? 0,
          leaveType: r.leave_type,
          reason: r.reason,
        }))}
      />

      {/* Ye jumla safhe par jaan boojh kar hai, kisi madad ke safhe par
          nahi: manzoori dene wale ko usi lamhe maloom hona chahiye ke
          us ke dabane se hazri bhi badal jayegi. */}
      <Card className="mt-4">
        <p className="text-xs text-surface-500">{t("lv_attendance_note", lang)}</p>
      </Card>
    </div>
  );
}
