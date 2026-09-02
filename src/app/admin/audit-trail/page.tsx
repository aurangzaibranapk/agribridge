import { loadUserAccess, can } from "@/lib/access/permissions";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, Card } from "@/components/ui/layout-primitives";
import { ReverseForm } from "./reverse-form";
import { ledgerWatch, recentEntries, auditLog } from "@/lib/ledger/audit-trail";
import { AlertTriangle, Eye, History, Undo2, CalendarClock } from "lucide-react";
import { t } from "@/lib/i18n/translations";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";

export const dynamic = "force-dynamic";

const ROLES = ["owner", "super_admin", "admin", "manager", "finance"];

function rs(value: number): string {
  return `Rs ${Math.round(value).toLocaleString()}`;
}

export default async function AuditTrailPage() {
  const lang = getLanguageFromCookies("rm");
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: me } = user
    ? await supabase.from("profiles").select("role, is_active").eq("id", user.id).maybeSingle()
    : { data: null };

  if (!me?.is_active || !ROLES.includes(me.role)) {
    return <div className="p-8 text-center text-surface-400">{t("c_only_finance_admin", lang)}</div>;
  }

  const access = user ? await loadUserAccess(user.id) : null;
  const canReverse = !!access && can(access, "finance.reversal", "create");
  const [watch, entries, logs] = await Promise.all([ledgerWatch(40), recentEntries(30), auditLog(50)]);

  const reversals = watch.filter((w) => w.kind === "reversal");
  const backdated = watch.filter((w) => w.kind === "backdated");

  return (
    <div className="space-y-4">
      <PageHeader
        title={t("at_title", lang)}
        description="Purani tareekh ki entry aur reversal — dono jaiz kaam hain. Inhen roka nahi jata, nazar mein rakha jata hai."
      />

      {/* ---- Nazar mein rehne wali entriyan ---- */}
      <Card className="p-4">
        <div className="flex items-start gap-3">
          <Eye className="mt-0.5 h-5 w-5 shrink-0 text-surface-500" />
          <div>
            <p className="text-sm font-semibold text-surface-900 dark:text-white">
              {watch.length === 0
                ? "Koi aisi entry nahi jo nazar mein rakhni ho"
                : `${reversals.length} reversal aur ${backdated.length} purani tareekh ki entry`}
            </p>
            <p className="mt-0.5 text-xs text-surface-600 dark:text-surface-400">
              Ghalti hoti hai, aur kabhi entry waqai us din ki hoti hai jo guzar chuka — is liye ye dono
              kaam jaiz hain. Magar yehi do jagahen hain jahan haath ki safai chhup sakti hai. Ek hi
              shakhs har hafte purani tareekh mein entry daale, ya ek hi qism ki entry baar baar ulti
              jaye — ye baat sirf tab nazar aati hai jab sab ek jagah ho.
            </p>
          </div>
        </div>
      </Card>

      {watch.length > 0 && (
        <div className="overflow-hidden rounded-card border border-surface-200 dark:border-surface-800">
          <table className="w-full min-w-[680px] text-sm">
            <thead className="border-b border-surface-200 bg-surface-50 text-left text-xs text-surface-500 dark:border-surface-800 dark:bg-surface-900">
              <tr>
                <th className="px-4 py-2 font-medium">{t("at_kind", lang)}</th>
                <th className="px-4 py-2 font-medium">{t("at_entry", lang)}</th>
                <th className="px-4 py-2 text-right font-medium">{t("sb_amount", lang)}</th>
                <th className="px-4 py-2 font-medium">{t("at_who", lang)}</th>
                <th className="px-4 py-2 font-medium">{t("c_reason", lang)}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-100 dark:divide-surface-800">
              {watch.map((w) => (
                <tr key={w.id}>
                  <td className="px-4 py-2">
                    <span
                      className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium ${
                        w.kind === "reversal"
                          ? "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-400"
                          : "bg-surface-100 text-surface-700 dark:bg-surface-800 dark:text-surface-300"
                      }`}
                    >
                      {w.kind === "reversal" ? (
                        <>
                          <Undo2 className="h-3 w-3" />{t("at_reversed", lang)}</>
                      ) : (
                        <>
                          <CalendarClock className="h-3 w-3" />{t("at_backdated", lang)}</>
                      )}
                    </span>
                    {w.kind === "backdated" && w.dayGap > 0 && (
                      <span
                        className={`ml-1.5 text-xs ${
                          w.dayGap >= 7 ? "font-medium text-red-700 dark:text-red-400" : "text-surface-400"
                        }`}
                      >
                        {w.dayGap} din baad likhi
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2">
                    <span className="font-mono text-xs text-surface-500">{w.entryNumber}</span>
                    <span className="block text-xs text-surface-700 dark:text-surface-300">
                      {w.description}
                    </span>
                    {w.originalEntry && (
                      <span className="block text-xs text-surface-400">asal: {w.originalEntry}</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums text-surface-900 dark:text-white">
                    {rs(w.amount)}
                  </td>
                  <td className="px-4 py-2 text-xs text-surface-600 dark:text-surface-400">
                    {w.by ?? "—"}
                    <span className="block text-surface-400">{w.createdAt.slice(0, 10)}</span>
                  </td>
                  <td className="max-w-[220px] px-4 py-2 text-xs text-surface-600 dark:text-surface-400">
                    {w.reason ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ---- Haal ki entriyan + reversal ---- */}
      <Card className="overflow-hidden">
        <div className="border-b border-surface-200 px-4 py-3 dark:border-surface-800">
          <h2 className="text-sm font-semibold text-surface-900 dark:text-white">{t("at_recent", lang)}</h2>
          <p className="mt-0.5 text-xs text-surface-500">
            {canReverse
              ? "Ghalti ho to yahan se ulti karein — yehi wahid raasta hai. Mitane ka koi tareeqa nahi, aur ye jaan boojh kar hai."
              : "Entry ulti karne ka haq sirf Malik, Admin aur Finance ke paas hai."}
          </p>
        </div>
        {entries.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-surface-400">{t("at_no_entry", lang)}</p>
        ) : (
          <ul className="divide-y divide-surface-100 dark:divide-surface-800">
            {entries.map((e) => (
              <li key={e.id} className="px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <span className="font-mono text-xs text-surface-500">{e.entryNumber}</span>
                    <p className="text-sm text-surface-800 dark:text-surface-200">{e.description}</p>
                    <p className="text-xs text-surface-400">
                      {e.entryDate} • {e.sourceModule}
                      {e.by && ` • ${e.by}`}
                    </p>
                  </div>
                  <span className="shrink-0 text-sm font-medium tabular-nums text-surface-900 dark:text-white">
                    {rs(e.amount)}
                  </span>
                </div>

                {e.reversedBy ? (
                  <p className="mt-1.5 text-xs text-amber-700 dark:text-amber-400">
                    Ye entry pehle hi ulti ja chuki hai ({e.reversedBy}).
                  </p>
                ) : e.isReversal ? (
                  <p className="mt-1.5 text-xs text-surface-400">{t("at_is_reversal", lang)}</p>
                ) : canReverse ? (
                  <ReverseForm entryId={e.id} entryNumber={e.entryNumber} amount={e.amount} />
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* ---- Aam kaamon ka record ---- */}
      <Card className="overflow-hidden">
        <div className="flex items-center gap-1.5 border-b border-surface-200 px-4 py-3 text-sm font-semibold text-surface-900 dark:border-surface-800 dark:text-white">
          <History className="h-4 w-4" />{t("at_other_actions", lang)}</div>
        {logs.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-surface-400">{t("at_no_record", lang)}</p>
        ) : (
          <ul className="divide-y divide-surface-100 dark:divide-surface-800">
            {logs.map((l) => (
              <li key={l.id} className="flex items-start justify-between gap-3 px-4 py-2.5">
                <div className="min-w-0">
                  <p className="text-sm text-surface-800 dark:text-surface-200">
                    {l.description ?? `${l.actionType} — ${l.module}`}
                  </p>
                  <p className="text-xs text-surface-400">
                    {l.actorName ?? "—"}
                    {l.actorRole && ` (${l.actorRole})`} • {l.module}
                    {l.recordLabel && ` • ${l.recordLabel}`}
                  </p>
                </div>
                <span className="shrink-0 text-xs text-surface-400">{l.createdAt.slice(0, 16).replace("T", " ")}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <p className="flex items-start gap-1.5 px-1 text-xs text-surface-400">
        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        Ye poora record khud bhi badla ya mitaya nahi ja sakta — ye rok database mein hai. Jo shakhs kuch
        chhupana chahe, us ka pehla qadam apna nishan mitana hota hai; wo raasta band hai.
      </p>
    </div>
  );
}
