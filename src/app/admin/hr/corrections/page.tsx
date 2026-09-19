import { redirect } from "next/navigation";
import { PageHeader, Card, EmptyState } from "@/components/ui/layout-primitives";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";
import { t } from "@/lib/i18n/translations";
import { createClient } from "@/lib/supabase/server";
import { CorrectionsClient } from "./corrections-client";

export const dynamic = "force-dynamic";

/**
 * Afsar ka safha: hazri ki darkhwastein.
 *
 * Yahan sirf wo darkhwastein aati hain jin ka faisla ye banda kar sakta
 * hai. Wo faisla code se nahi, database ke fn_hr_can_decide_for se hota
 * hai -- kyunke reporting ki poori zanjeer wahan hai. Aur usi function
 * mein ye rok bhi hai ke apni darkhwast koi khud manzoor na kar sake.
 */
export default async function CorrectionsPage() {
  const supabase = createClient();
  const lang = getLanguageFromCookies("rm");

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: open } = await supabase
    .from("attendance_corrections")
    .select(
      "id, profile_id, attendance_date, requested_status, requested_check_in, requested_check_out, reason, status, original_snapshot, created_at, profiles!attendance_corrections_profile_id_fkey(full_name)"
    )
    .in("status", ["pending", "sent_back"])
    .neq("profile_id", user.id)
    .order("attendance_date", { ascending: true });

  // Har qatar par alag se poochha jata hai ke is ka faisla mera haq hai
  // ya nahi. RLS pehle hi chhaant chuki hoti hai; ye doosra taala hai --
  // agar kal RLS badal gayi to safha khud ba khud khul na jaye.
  const rows = open ?? [];
  const allowed: typeof rows = [];
  for (const r of rows) {
    const { data: ok } = await supabase.rpc("fn_hr_can_decide_for", { p_target: r.profile_id });
    if (ok === true) allowed.push(r);
  }

  return (
    <div>
      <PageHeader title={t("hrb_pending_corrections", lang)} description={t("hra_subtitle", lang)} />

      {allowed.length === 0 ? (
        <Card>
          <EmptyState title={t("hrb_nobody", lang)} description={t("hra_history_empty", lang)} />
        </Card>
      ) : (
        <CorrectionsClient
          lang={lang}
          rows={allowed.map((r) => {
            const snap = (r.original_snapshot ?? null) as { status?: string; check_in?: string | null } | null;
            return {
              id: r.id,
              who: (r as unknown as { profiles?: { full_name?: string } }).profiles?.full_name ?? "—",
              date: r.attendance_date,
              requestedStatus: r.requested_status,
              requestedIn: r.requested_check_in,
              requestedOut: r.requested_check_out,
              reason: r.reason,
              status: r.status,
              wasStatus: snap?.status ?? null,
              wasIn: snap?.check_in ?? null,
            };
          })}
        />
      )}
    </div>
  );
}
