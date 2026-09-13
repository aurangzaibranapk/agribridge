import { createClient } from "@/lib/supabase/server";
import { PageHeader, Card, EmptyState } from "@/components/ui/layout-primitives";
import { Badge } from "@/components/ui/form";
import Link from "next/link";
import { Inbox, AlertTriangle, Check, X, CornerUpLeft, Clock, ArrowRight } from "lucide-react";
import { manzooriKiQatar, qatarKaKhulasa, umarLikhein, QATAR_KA_RAASTA } from "@/lib/manzoori-qatar";
import { LiveRefresh } from "@/components/live/live-refresh";
import { KIND_LABEL, STATUS_LABEL, type SubmissionKind, type SubmissionStatus } from "@/lib/whatsapp-submissions";
import { t } from "@/lib/i18n/translations";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";

export const dynamic = "force-dynamic";

function statusTone(status: string) {
  if (status === "approved") return "green" as const;
  if (status === "rejected") return "red" as const;
  if (status === "sent_back") return "amber" as const;
  return "blue" as const;
}

/**
 * Approval Inbox — ab poore nizam ki EK hi qatar.
 *
 * =====================================================================
 * DO NAAM SE EK HI KAAM NAHI
 * =====================================================================
 *
 * Malik (6 September): *"Pehle bane ko update karo, behtar karo. Ek hi
 * kaam baar baar naye tag naye naam ke sath nahi hone chahiye."*
 *
 * Ye jumla theek mujh par tha. Maine `/admin/verification` ke naam se
 * ek NAYA safha bana diya tha, jab ke ye Approval Inbox pehle se maujood
 * tha aur Command Center par is ka apna department bhi bana hua tha.
 *
 * Ab wo naya safha nahi hai. Us ka kaam yahan aa gaya hai, aur safha
 * do hisson mein hai:
 *
 *   1. **Safhon se aayi qatarein** — Paisa & Khata, Mazdoori, aur
 *      Khaton ka Adjustment. Umar ke sath, purani sab se ooper.
 *   2. **WhatsApp se aayi parchiyan** — jo pehle se yahan thin.
 *
 * Dono ka manzoori ka raasta alag hai (WhatsApp wali ka apna review
 * safha hai, baqi ki manzoori un ke apne safhon par hoti hai), is liye
 * unhen zabardasti ek table mein nahi thoosa gaya. Magar DEKHNE ki jagah
 * ek hai — aur sawal yehi hota hai: "kya kya ruka hua hai".
 */
export default async function SubmissionsInboxPage() {
  const lang = getLanguageFromCookies("rm");
  const supabase = createClient();

  const { data: rows } = await supabase
    .from("whatsapp_submissions")
    .select("id, submission_number, kind, status, original_amount, corrected_amount, flags, created_at, staff_profile_id, branch_id, manager_comment")
    .order("created_at", { ascending: false })
    .limit(200);

  const submissions = rows ?? [];

  const staffIds = Array.from(new Set(submissions.map((s) => s.staff_profile_id).filter(Boolean))) as string[];
  const branchIds = Array.from(new Set(submissions.map((s) => s.branch_id).filter(Boolean))) as string[];

  const { data: profiles } = staffIds.length
    ? await supabase.from("profiles").select("id, full_name").in("id", staffIds)
    : { data: [] as { id: string; full_name: string | null }[] };
  const { data: branches } = branchIds.length
    ? await supabase.from("branches").select("id, name").in("id", branchIds)
    : { data: [] as { id: string; name: string }[] };

  const staffName = new Map((profiles ?? []).map((p) => [p.id, p.full_name ?? "Staff"]));
  const branchName = new Map((branches ?? []).map((b) => [b.id, b.name]));

  const pending = submissions.filter((s) => s.status === "pending");
  const flagged = submissions.filter((s) => Array.isArray(s.flags) && (s.flags as unknown[]).length > 0);
  const pendingValue = pending.reduce((sum, s) => sum + Number(s.original_amount ?? 0), 0);

  /**
   * Safhon se aayi qatarein.
   *
   * Manager ko us ki apni shaakh ki — poore karobar ki qatarein us ka
   * waqt khati hain. Owner, Admin aur Finance ko sab, kyunke wo kisi ek
   * shaakh ke nahi hote.
   */
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: mera } = user
    ? await supabase.from("profiles").select("role, branch_id").eq("id", user.id).maybeSingle()
    : { data: null };
  const meraRole = String(mera?.role ?? "");
  const sirfMeriShaakh = meraRole === "manager" ? ((mera?.branch_id as string | null) ?? null) : null;

  const qatarein = await manzooriKiQatar(sirfMeriShaakh);
  const qk = qatarKaKhulasa(qatarein);

  return (
    <div>
      <PageHeader
        title={t("sb_inbox", lang)}
        description="WhatsApp se aaye bills, meter readings aur cash. Manager ki comment ke baghair koi transaction accounts mein nahi jati."
        actions={
          <LiveRefresh
            tables={["whatsapp_submissions", "company_expense_requests", "labour_work_entries", "party_settlements"]}
          />
        }
      />

      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-4">
        <Card className="p-4">
          <p className="flex items-center gap-1.5 text-xs text-surface-500">
            <Clock className="h-3.5 w-3.5 text-brand-600" />
            Safhon se — intezar mein
          </p>
          <p className="mt-1 font-display text-xl font-bold text-surface-900 dark:text-white">{qk.kul}</p>
          <p className="text-xs text-surface-500">
            Rs {Math.round(qk.raqam).toLocaleString()}
            {/* Sifar aur "koi qatar hi nahi" ek cheez nahi -- umar tabhi
                likhi jati hai jab koi qatar maujood ho. */}
            {qk.puraniUmar != null && ` · sab se purani ${umarLikhein(qk.puraniUmar)}`}
          </p>
        </Card>
        <Card className="p-4">
          <p className="flex items-center gap-1.5 text-xs text-surface-500"><Inbox className="h-3.5 w-3.5 text-blue-600" />{t("sb_awaiting", lang)}</p>
          <p className="mt-1 font-display text-xl font-bold text-surface-900 dark:text-white">{pending.length}</p>
          <p className="text-xs text-surface-500">Rs {pendingValue.toLocaleString()}</p>
        </Card>
        <Card className="p-4">
          <p className="flex items-center gap-1.5 text-xs text-surface-500"><AlertTriangle className="h-3.5 w-3.5 text-amber-600" />{t("sb_flagged_by_person", lang)}</p>
          <p className="mt-1 font-display text-xl font-bold text-amber-600">{flagged.length}</p>
          <p className="text-xs text-surface-500">{t("sb_flagged_by_system", lang)}</p>
        </Card>
        <Card className="p-4">
          <p className="flex items-center gap-1.5 text-xs text-surface-500"><Check className="h-3.5 w-3.5 text-green-600" />{t("sb_decided", lang)}</p>
          <p className="mt-1 font-display text-xl font-bold text-surface-900 dark:text-white">{submissions.length - pending.length}</p>
        </Card>
      </div>

      {/* ---- Safhon se aayi qatarein ---- */}
      <Card className="mb-4 overflow-x-auto">
        <div className="flex flex-wrap items-center gap-3 border-b border-surface-100 px-4 py-3 dark:border-surface-800">
          <h2 className="font-display text-sm font-semibold text-surface-900 dark:text-white">
            Safhon se aayi qatarein ({qatarein.length})
          </h2>
          {qk.ooper > 0 && (
            <span className="rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-medium text-red-800 dark:bg-surface-800 dark:text-red-300">
              {qk.ooper} hadd se guzar chuki
            </span>
          )}
          {qk.guzri > 0 && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800 dark:bg-surface-800 dark:text-amber-300">
              {qk.guzri} overdue
            </span>
          )}
          {sirfMeriShaakh && <span className="text-xs text-surface-400">(sirf aap ki shaakh)</span>}
        </div>

        {qatarein.length === 0 ? (
          <p className="px-4 py-6 text-sm text-surface-400">
            Safhon se koi qatar intezar mein nahi.
            {sirfMeriShaakh && " (Ye sirf aap ki shaakh ki ginti hai.)"}
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-200 bg-surface-50 text-left dark:border-surface-800 dark:bg-surface-800">
                <th className="px-3 py-2 font-medium text-surface-500">Umar</th>
                <th className="px-3 py-2 font-medium text-surface-500">Kahan se</th>
                <th className="px-3 py-2 font-medium text-surface-500">Number</th>
                <th className="px-3 py-2 font-medium text-surface-500">Tafseel</th>
                <th className="px-3 py-2 text-right font-medium text-surface-500">Raqam</th>
                <th className="px-3 py-2 font-medium text-surface-500"></th>
              </tr>
            </thead>
            <tbody>
              {qatarein.map((q) => (
                <tr
                  key={`${q.kahan}-${q.id}`}
                  className="border-b border-surface-100 last:border-0 hover:bg-surface-50 dark:border-surface-800 dark:hover:bg-surface-800/50"
                >
                  <td className="px-3 py-2 whitespace-nowrap">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                        q.darja === "malik"
                          ? "bg-red-100 text-red-800 dark:bg-surface-800 dark:text-red-300"
                          : q.darja === "head"
                            ? "bg-amber-100 text-amber-800 dark:bg-surface-800 dark:text-amber-300"
                            : "bg-emerald-100 text-emerald-800 dark:bg-surface-800 dark:text-emerald-300"
                      }`}
                    >
                      <Clock className="h-3 w-3" />
                      {umarLikhein(q.ghante)}
                    </span>
                    {q.darja !== "manager" && (
                      <span className="mt-0.5 block text-[10px] font-semibold uppercase tracking-wide text-red-600">
                        overdue
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-surface-600 dark:text-surface-400">{q.kahanKaNaam}</td>
                  <td className="px-3 py-2 font-mono text-xs text-surface-500">{q.number}</td>
                  <td className="px-3 py-2 text-surface-700 dark:text-surface-300">{q.tafseel}</td>
                  <td className="px-3 py-2 text-right font-medium tabular-nums text-surface-900 dark:text-white">
                    Rs {Math.round(q.amount).toLocaleString()}
                  </td>
                  <td className="px-3 py-2">
                    {/*
                      Manzoori YAHAN se nahi hoti -- us ke apne safhe par
                      hoti hai, jahan poori tafseel saamne hoti hai.
                      Fehrist mein se seedhi manzoori wo aadat banati hai
                      jis mein banda parhe baghair haan kar deta hai.
                    */}
                    <Link
                      href={QATAR_KA_RAASTA[q.kahan] ?? "/admin"}
                      className="inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:underline"
                    >
                      Kholein <ArrowRight className="h-3 w-3" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {/* ---- WhatsApp se aayi parchiyan ---- */}
      <h2 className="mb-2 px-1 font-display text-sm font-semibold text-surface-900 dark:text-white">
        WhatsApp se aayi parchiyan ({submissions.length})
      </h2>

      {submissions.length === 0 ? (
        <EmptyState
          title={t("sb_none_yet", lang)}
          description="Jab staff WhatsApp par bill ya meter ki photo bhejega, wo yahan nazar aayegi."
        />
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-200 bg-surface-50 text-left dark:border-surface-800 dark:bg-surface-800">
                <th className="px-3 py-2 font-medium text-surface-500">{t("sb_number", lang)}</th>
                <th className="px-3 py-2 font-medium text-surface-500">{t("sb_kind", lang)}</th>
                <th className="px-3 py-2 font-medium text-surface-500">{t("c_staff", lang)}</th>
                <th className="px-3 py-2 font-medium text-surface-500">{t("c_branch", lang)}</th>
                <th className="px-3 py-2 text-right font-medium text-surface-500">{t("sb_amount", lang)}</th>
                <th className="px-3 py-2 font-medium text-surface-500">{t("sb_state", lang)}</th>
              </tr>
            </thead>
            <tbody>
              {submissions.map((s) => {
                const flagCount = Array.isArray(s.flags) ? (s.flags as unknown[]).length : 0;
                const amount = s.corrected_amount ?? s.original_amount;
                return (
                  <tr key={s.id} className="border-b border-surface-100 last:border-0 hover:bg-surface-50 dark:border-surface-800 dark:hover:bg-surface-800/50">
                    <td className="px-3 py-2">
                      <Link href={`/admin/submissions/${s.id}`} className="font-mono text-xs text-brand-600 hover:underline">
                        {s.submission_number}
                      </Link>
                      {flagCount > 0 && (
                        <span className="ml-1.5 inline-flex items-center gap-0.5 rounded-full bg-amber-50 px-1.5 py-0.5 text-xs text-amber-700">
                          <AlertTriangle className="h-3 w-3" /> {flagCount}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-surface-700 dark:text-surface-300">{KIND_LABEL[s.kind as SubmissionKind] ?? s.kind}</td>
                    <td className="px-3 py-2 text-surface-600 dark:text-surface-400">{staffName.get(s.staff_profile_id as string) ?? "-"}</td>
                    <td className="px-3 py-2 text-surface-600 dark:text-surface-400">{branchName.get(s.branch_id as string) ?? "-"}</td>
                    <td className="px-3 py-2 text-right font-medium text-surface-900 dark:text-white">
                      {amount == null ? "-" : `Rs ${Number(amount).toLocaleString()}`}
                      {s.corrected_amount != null && s.original_amount != null && Number(s.corrected_amount) !== Number(s.original_amount) && (
                        <span className="ml-1 text-xs text-surface-400 line-through">Rs {Number(s.original_amount).toLocaleString()}</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <Badge tone={statusTone(s.status)}>
                        {s.status === "approved" && <Check className="mr-0.5 inline h-3 w-3" />}
                        {s.status === "rejected" && <X className="mr-0.5 inline h-3 w-3" />}
                        {s.status === "sent_back" && <CornerUpLeft className="mr-0.5 inline h-3 w-3" />}
                        {STATUS_LABEL[s.status as SubmissionStatus] ?? s.status}
                      </Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
