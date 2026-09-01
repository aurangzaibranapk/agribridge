import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/layout-primitives";
import { CheckinClient } from "./checkin-client";
import { t } from "@/lib/i18n/translations";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";

export const dynamic = "force-dynamic";

export default async function MyAttendancePage() {
  const lang = getLanguageFromCookies("rm");
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const today = new Date().toISOString().split("T")[0];
  const { data: record } = await supabase
    .from("attendance_records")
    .select("check_in_at, check_out_at")
    .eq("profile_id", user.id)
    .eq("attendance_date", today)
    .maybeSingle();

  return (
    <div>
      <PageHeader title={t("at_my_attendance", lang)} description="Check in and check out - your location is captured automatically." />
      <CheckinClient today={record} />
    </div>
  );
}