import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertTriangle, CalendarDays } from "lucide-react";
import { PageHeader, Card } from "@/components/ui/layout-primitives";
import { Badge } from "@/components/ui/form";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";
import { t, type TranslationKey } from "@/lib/i18n/translations";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const STATE_LABEL: Record<string, TranslationKey> = {
  present: "hra_st_present",
  absent: "hra_st_absent",
  late: "hra_st_late",
  leave: "hra_st_leave",
  half_day: "hra_st_half_day",
  holiday: "hra_st_holiday",
  weekly_off: "hra_st_weekly_off",
  missing_punch: "hra_st_missing_punch",
  missing: "hra_st_missing",
  leave_pending: "hra_st_leave_pending",
  future: "hra_st_future",
  today: "hra_st_today",
};

const STATE_TONE: Record<string, "green" | "amber" | "red" | "gray" | "blue"> = {
  present: "green",
  late: "amber",
  absent: "red",
  leave: "blue",
  half_day: "blue",
  holiday: "gray",
  weekly_off: "gray",
  missing_punch: "amber",
  missing: "amber",
  leave_pending: "blue",
  today: "gray",
  future: "gray",
};

/**
 * Aaj ka board.
 *
 * Do hisse: "dhyan chahiye" (jo abhi kaam maangta hai) aur "aaj ek ek
 * banda". Tarteeb jaan boojh kar aisi hai -- board kholne wale ko pehle
 * ye dikhna chahiye ke kya ruka hua hai, phir ye ke kaun kahan hai.
 *
 * Fehrist database ke function se aati hai, is liye us mein sirf wo log
 * hain jin ko dekhne ka haq hai. Manager ko apni team, HR ko sab.
 */
export default async function AttendanceBoardPage() {
  const supabase = createClient();
  const lang = getLanguageFromCookies("rm");

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: board, error: boardErr }, { data: attn }] = await Promise.all([
    supabase.rpc("fn_hr_today_board"),
    supabase.rpc("fn_hr_needs_attention"),
  ]);

  const a = attn?.[0] ?? null;
  const rows = board ?? [];

  const counts = rows.reduce<Record<string, number>>((acc, r) => {
    acc[r.state] = (acc[r.state] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div>
      <PageHeader
        title={t("hrb_title", lang)}
        description={t("hrb_subtitle", lang)}
        actions={
          <Link
            href="/admin/hr/attendance"
            className="inline-flex items-center gap-1 rounded-lg border border-surface-300 px-3 py-1.5 text-sm hover:bg-surface-50"
          >
            <CalendarDays className="h-4 w-4" /> {t("hra_title", lang)}
          </Link>
        }
      />

      {boardErr && (
        <Card className="mb-4">
          <p className="text-sm text-red-700">{boardErr.message}</p>
        </Card>
      )}

      {/* ---- Dhyan chahiye ---- */}
      <Card className="mb-4">
        <h2 className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
          <AlertTriangle className="h-4 w-4 text-amber-600" /> {t("hrb_needs_attention", lang)}
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Kpi label={t("hrb_pending_corrections", lang)} value={a?.pending_corrections ?? null} href="/admin/hr/corrections" />
          <Kpi label={t("hrb_pending_leaves", lang)} value={a?.pending_leaves ?? null} href="/admin/hr/leave" />
          <Kpi label={t("hrb_missing_punch_7d", lang)} value={a?.missing_punch_7d ?? null} />
          <Kpi label={t("hrb_missing_7d", lang)} value={a?.missing_days_7d ?? null} />
        </div>
      </Card>

      {/* ---- Aaj ka khulasa ---- */}
      <Card className="mb-4">
        <div className="flex flex-wrap gap-2">
          {Object.entries(counts)
            .sort((x, y) => y[1] - x[1])
            .map(([state, n]) => (
              <Badge key={state} tone={STATE_TONE[state] ?? "gray"}>
                {t(STATE_LABEL[state] ?? "hra_st_missing", lang)}: {n}
              </Badge>
            ))}
        </div>
      </Card>

      {/* ---- Aaj, ek ek banda ---- */}
      <Card>
        <h2 className="mb-2 text-sm font-semibold">{t("hrb_live_feed", lang)}</h2>
        {rows.length === 0 ? (
          <p className="text-sm text-surface-500">{t("hrb_nobody", lang)}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[38rem] text-sm">
              <thead>
                <tr className="border-b border-surface-200 text-left text-xs uppercase text-surface-500">
                  <th className="py-2">{t("hra_pick_person", lang)}</th>
                  <th className="py-2">{t("hrt_designation", lang)}</th>
                  <th className="py-2">{t("hra_check_in", lang)}</th>
                  <th className="py-2">{t("hra_check_out", lang)}</th>
                  <th className="py-2">{t("hra_late_by", lang)}</th>
                  <th className="py-2">{t("hra_source", lang)}</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.profile_id} className="border-b border-surface-100">
                    <td className="py-2">
                      <Link href={`/admin/hr/attendance?p=${r.profile_id}`} className="font-medium hover:underline">
                        {r.full_name ?? "—"}
                      </Link>
                      {r.pending_correction && <span className="ml-1 text-amber-600">•</span>}
                    </td>
                    <td className="py-2 text-surface-600">{r.designation ?? "—"}</td>
                    <td className="py-2 tabular-nums">{r.check_in ? r.check_in.slice(0, 5) : "—"}</td>
                    <td className="py-2 tabular-nums">{r.check_out ? r.check_out.slice(0, 5) : "—"}</td>
                    <td className="py-2 tabular-nums">
                      {r.late_minutes ? `${r.late_minutes} ${t("hra_minutes", lang)}` : "—"}
                    </td>
                    <td className="py-2 text-xs text-surface-500">{r.source ?? "—"}</td>
                    <td className="py-2">
                      <Badge tone={STATE_TONE[r.state] ?? "gray"}>
                        {t(STATE_LABEL[r.state] ?? "hra_st_missing", lang)}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

/**
 * value NULL ho to "0" NAHI likha jata.
 *
 * Sifar kehta hai "dekh liya, kuch nahi hai". Jab function hi jawab na
 * de saka ho, wahan sifar likhna jhoot hai -- is project mein wo ghalti
 * pehle bhi ho chuki hai.
 */
function Kpi({ label, value, href }: { label: string; value: number | null; href?: string }) {
  const inner = (
    <div className="rounded-lg border border-surface-200 bg-white p-3 transition hover:border-brand-300">
      <p className="text-[10px] uppercase tracking-wide text-surface-500">{label}</p>
      {value == null ? (
        <p className="text-sm font-medium text-surface-400">— parha nahi ja saka</p>
      ) : (
        <p className={`text-2xl font-bold tabular-nums ${value > 0 ? "text-amber-700" : "text-surface-700"}`}>{value}</p>
      )}
    </div>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}
