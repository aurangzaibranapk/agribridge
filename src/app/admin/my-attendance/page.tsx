import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertTriangle, CalendarDays } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card, PageHeader } from "@/components/ui/layout-primitives";
import { Badge } from "@/components/ui/form";
import { CheckinClient } from "./checkin-client";
import { t } from "@/lib/i18n/translations";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";

export const dynamic = "force-dynamic";

/**
 * Meri hazri.
 *
 * Do cheezein ek safhe par: aaj ka check-in/out, aur is mahine ka
 * hisaab. Doosri cheez jaan boojh kar yahan hai -- banda mahine ke
 * aakhir mein tankhwah dekh kar hairan na ho, balke usay har roz nazar
 * aaye ke kitne din "record hi nahi" par khaRe hain.
 *
 * Poora calendar aur darkhwast ka form Hazri Calendar par hai; wahan
 * apna safha khud khulta hai. Yahan dobara wohi calendar banane se do
 * jagah do alag jawab nikalne ka khatra paida hota.
 */
export default async function MyAttendancePage() {
  const lang = getLanguageFromCookies("rm");
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth() + 1;

  const [{ data: record }, { data: summaryRows }, { data: myCorrections }, { data: entRows }] = await Promise.all([
    supabase
      .from("attendance_records")
      .select("check_in_at, check_out_at")
      .eq("profile_id", user.id)
      .eq("attendance_date", today.toISOString().split("T")[0])
      .maybeSingle(),
    supabase.rpc("fn_attendance_month_summary", { p_profile: user.id, p_year: year, p_month: month }),
    supabase
      .from("attendance_corrections")
      .select("id, attendance_date, status, reason, manager_comment")
      .eq("profile_id", user.id)
      .order("attendance_date", { ascending: false })
      .limit(10),
    supabase.rpc("fn_leave_entitlement", { p_profile: user.id, p_year: year }),
  ]);

  const s = summaryRows?.[0] ?? null;
  const ent = entRows?.[0] ?? null;

  return (
    <div>
      <PageHeader
        title={t("at_my_attendance", lang)}
        description="Check in and check out - your location is captured automatically."
        actions={
          <Link
            href="/admin/hr/attendance"
            className="inline-flex items-center gap-1 rounded-lg border border-surface-300 px-3 py-1.5 text-sm hover:bg-surface-50"
          >
            <CalendarDays className="h-4 w-4" /> {t("hra_title", lang)}
          </Link>
        }
      />

      <CheckinClient today={record} />

      {/* ---- Is mahine ka hisaab ---- */}
      <Card className="mt-4">
        <h2 className="mb-2 text-sm font-semibold">
          {String(month).padStart(2, "0")}/{year}
        </h2>

        {!s ? (
          // Sifar nahi likha jata. Agar hisaab parha hi nahi ja saka to
          // "0 din hazir" likhna jhoot hai.
          <p className="text-sm text-surface-500">Is mahine ka hisaab parha nahi ja saka.</p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-6">
              <Stat label={t("hra_working_days", lang)} value={s.working_days} />
              <Stat label={t("hra_present_days", lang)} value={s.present_days} tone="text-emerald-700" />
              <Stat label={t("hra_late_days", lang)} value={s.late_count} tone="text-amber-700" />
              <Stat label={t("hra_leave_days", lang)} value={s.paid_leave_days + s.unpaid_leave_days} tone="text-sky-700" />
              <Stat label={t("hra_absent_days", lang)} value={s.absent_days} tone="text-red-700" />
              <Stat label={t("hra_missing_days", lang)} value={s.missing_days} tone="text-orange-700" />
            </div>

            {s.missing_days > 0 && (
              <p className="mt-2 inline-flex items-center gap-1 text-xs text-orange-800">
                <AlertTriangle className="h-3.5 w-3.5" />
                {s.missing_days} din ka koi record nahi. Calendar kholein aur us din ki darkhwast dein.
              </p>
            )}
          </>
        )}
      </Card>

      {/* ---- Saalana chhutti ---- */}
      <Card className="mt-4">
        <h2 className="mb-2 text-sm font-semibold">{t("hrl_balance", lang)} — {year}</h2>
        {!ent ? (
          <p className="text-sm text-surface-500">Chhutti ka hisaab parha nahi ja saka.</p>
        ) : ent.is_confirmed === false ? (
          // Sifar nahi likha jata: wajah likhi jati hai. "0 din baqi"
          // aur "abhi haq shuru hi nahi hua" do alag baatein hain.
          <p className="text-sm text-amber-800">{ent.reason ?? t("hrl_no_entitlement", lang)}</p>
        ) : (
          <div className="grid grid-cols-3 gap-3">
            <Stat label={t("hrl_entitled", lang)} value={Number(ent.entitled_days ?? 0)} />
            <Stat label={t("hrl_used", lang)} value={Number(ent.used_days ?? 0)} tone="text-sky-700" />
            <Stat label={t("hrl_remaining", lang)} value={Number(ent.remaining_days ?? 0)} tone="text-emerald-700" />
          </div>
        )}
      </Card>

      {/* ---- Meri darkhwastein ---- */}
      {(myCorrections ?? []).length > 0 && (
        <Card className="mt-4">
          <h2 className="mb-2 text-sm font-semibold">{t("hrb_pending_corrections", lang)}</h2>
          <ul className="divide-y divide-surface-100">
            {(myCorrections ?? []).map((c) => (
              <li key={c.id} className="py-2 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="tabular-nums text-surface-500">{c.attendance_date}</span>
                  <Badge
                    tone={
                      c.status === "approved"
                        ? "green"
                        : c.status === "rejected"
                          ? "red"
                          : c.status === "sent_back"
                            ? "amber"
                            : "gray"
                    }
                  >
                    {c.status}
                  </Badge>
                </div>
                <p className="text-xs text-surface-600">{c.reason}</p>
                {c.manager_comment && <p className="text-xs text-surface-500">— {c.manager_comment}</p>}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

function Stat({ label, value, tone = "text-surface-800" }: { label: string; value: number; tone?: string }) {
  return (
    <div className="rounded-lg border border-surface-200 bg-white p-2">
      <p className="text-[10px] uppercase tracking-wide text-surface-500">{label}</p>
      <p className={`text-lg font-bold tabular-nums ${tone}`}>{value}</p>
    </div>
  );
}
