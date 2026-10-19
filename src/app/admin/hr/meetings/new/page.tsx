import { redirect } from "next/navigation";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";
import { isStaffRole } from "@/lib/utils/roles";
import type { UserRole } from "@/lib/utils/roles";
import { addDays, isValidDate } from "@/lib/hr-meetings";
import { currentStaff, meetingsBetween, meetingsDb, todayPkt } from "@/lib/hr-meetings-data";
import { MeetingsHero } from "@/components/hr-meetings/ui";
import { ScheduleForm } from "./schedule-form";

export const dynamic = "force-dynamic";

/** Nayi meeting. Mockup: mock_schedule_*. Organizer hamesha khud (auto). */
export default async function NewMeetingPage({ searchParams }: { searchParams: { parent?: string; title?: string; d?: string } }) {
  const lang = getLanguageFromCookies("rm");
  const supabase = meetingsDb();
  const meUser = await currentStaff(supabase);
  if (!meUser) redirect("/login");
  const today = todayPkt();
  const [{ data: people }, { data: leaves }, upcoming] = await Promise.all([
    supabase.from("profiles").select("id, full_name, role").eq("is_active", true).order("full_name"),
    supabase.from("leave_requests").select("profile_id, from_date, to_date").eq("status", "approved").gte("to_date", today).lte("from_date", addDays(today, 60)),
    meetingsBetween(supabase, today, addDays(today, 60)),
  ]);
  const staff = ((people ?? []) as { id: string; full_name: string | null; role: string }[])
    .filter((p) => isStaffRole(p.role as UserRole) && p.id !== meUser.id)
    .map((p) => ({ id: p.id, name: p.full_name ?? "—", role: p.role }));
  const busy = upcoming.filter((m) => m.status !== "cancelled").map((m) => ({
    starts_at: m.starts_at, duration_min: m.duration_min, title: m.title,
    people: [m.organizer_id, ...m.hr_meeting_attendees.map((a) => a.profile_id)],
  }));
  const parent = /^[0-9a-f-]{36}$/i.test(searchParams.parent ?? "") ? searchParams.parent! : "";
  return (
    <div>
      <MeetingsHero lang={lang} title="hm_new_title" sub="hm_new_sub" urdu="میٹنگ طے کریں" active="new" />
      <ScheduleForm lang={lang} me={{ name: meUser.name, role: meUser.role }} staff={staff}
        leaves={(leaves ?? []) as { profile_id: string; from_date: string; to_date: string }[]} busy={busy}
        defaults={{ date: isValidDate(searchParams.d) ? searchParams.d : today, title: (searchParams.title ?? "").slice(0, 200), parent }} />
    </div>
  );
}
