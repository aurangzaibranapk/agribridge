import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { PageHeader, Card } from "@/components/ui/layout-primitives";
import { RunNowButton, ResolveForm } from "./recon-client";
import { AlertTriangle, CheckCircle2, HelpCircle, ClipboardCheck } from "lucide-react";

export const dynamic = "force-dynamic";

const ROLES = ["owner", "super_admin", "admin", "manager", "finance"];

function rs(value: number): string {
  return `Rs ${Math.round(value).toLocaleString()}`;
}

export default async function ReconciliationPage() {
  const supabase = createClient();
  const service = createServiceClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: me } = user
    ? await supabase.from("profiles").select("role, is_active").eq("id", user.id).maybeSingle()
    : { data: null };

  if (!me?.is_active || !ROLES.includes(me.role)) {
    return <div className="p-8 text-center text-surface-400">Ye safha sirf Finance, Manager aur Admin ke liye hai.</div>;
  }

  const canResolve = ["owner", "super_admin", "admin", "finance"].includes(me.role);

  const [{ data: latest }, { data: openRows }, { data: history }] = await Promise.all([
    service
      .from("reconciliation_runs")
      .select("*")
      .order("run_date", { ascending: false })
      .limit(1)
      .maybeSingle(),
    service
      .from("v_open_findings")
      .select("id, check_key, severity, title, detail, amount, href, din_purani, first_seen_date")
      .order("severity"),
    service
      .from("reconciliation_runs")
      .select("run_date, verdict, checks_passed, checks_failed, checks_skipped")
      .order("run_date", { ascending: false })
      .limit(14),
  ]);

  const findings = openRows ?? [];
  const red = findings.filter((f) => f.severity === "red");
  const amber = findings.filter((f) => f.severity === "amber");
  const grey = findings.filter((f) => f.severity === "grey");
  const today = new Date().toISOString().slice(0, 10);
  const ranToday = latest?.run_date === today;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Roz ka Milaan"
        description="System roz khud dekhta hai. Har jaanch ke teen nateeje hain — theek, masla, ya “check nahi ho saka”. Teesra kabhi pehle jaisa nahi ginaya jata."
        actions={<RunNowButton />}
      />

      {/* ---- Aaj ka nateeja ---- */}
      {!latest ? (
        <Card className="p-6 text-center">
          <ClipboardCheck className="mx-auto h-8 w-8 text-surface-300" />
          <p className="mt-2 text-sm font-medium text-surface-900 dark:text-white">Abhi koi jaanch nahi hui</p>
          <p className="mt-1 text-xs text-surface-500">
            Cron Job set karein ya ooper se abhi chala lein. Jab tak jaanch nahi hoti, ye safha khali
            rahega — aur khali safha &quot;sab theek hai&quot; nahi hota.
          </p>
        </Card>
      ) : (
        <Card
          className={`p-4 ${
            latest.verdict === "clean"
              ? "border-l-4 border-l-green-500"
              : latest.verdict === "issues"
                ? "border-l-4 border-l-red-500 bg-red-50 dark:bg-red-950/20"
                : "border-l-4 border-l-amber-500 bg-amber-50 dark:bg-amber-950/20"
          }`}
        >
          <div className="flex items-start gap-3">
            {latest.verdict === "clean" ? (
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green-600" />
            ) : latest.verdict === "issues" ? (
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
            ) : (
              <HelpCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
            )}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-surface-900 dark:text-white">{latest.summary}</p>
              <p className="mt-0.5 text-xs text-surface-600 dark:text-surface-400">
                {latest.run_date}
                {!ranToday && " — AAJ ki jaanch abhi nahi hui"} • {latest.checks_passed} theek
                {latest.checks_failed > 0 && `, ${latest.checks_failed} masle`}
                {latest.checks_skipped > 0 && `, ${latest.checks_skipped} chal hi nahi saki`}
              </p>
              {latest.verdict === "partial" && (
                <p className="mt-1.5 text-xs font-medium text-amber-800 dark:text-amber-400">
                  Jo jaanch chal hi na sake, us ka nateeja &quot;theek&quot; nahi — maloom NAHI hai. Data
                  na hone se report khud ko sabz dikha deti hai, aur yehi wo jhoot hai jis se sab se zyada
                  nuqsan hota hai.
                </p>
              )}
            </div>
          </div>
        </Card>
      )}

      {/* ---- Nikli hui baatein ---- */}
      {[
        { rows: red, label: "Foran dekhne wali", tone: "red" as const },
        { rows: amber, label: "Dekh lena chahiye", tone: "amber" as const },
        { rows: grey, label: "Ye jaanch chal hi nahi saki", tone: "grey" as const },
      ]
        .filter((g) => g.rows.length > 0)
        .map((group) => (
          <div key={group.label}>
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-surface-400">
              {group.label} ({group.rows.length})
            </h2>
            <div className="space-y-2">
              {group.rows.map((f) => (
                <Card
                  key={f.id}
                  className={`p-4 ${
                    group.tone === "red"
                      ? "border-l-4 border-l-red-500"
                      : group.tone === "amber"
                        ? "border-l-4 border-l-amber-500"
                        : "border-l-4 border-l-surface-300 dark:border-l-surface-700"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-surface-900 dark:text-white">{f.title}</p>
                      <p className="mt-0.5 text-xs text-surface-600 dark:text-surface-400">{f.detail}</p>
                    </div>
                    {f.amount != null && Number(f.amount) !== 0 && (
                      <span
                        className={`shrink-0 text-sm font-semibold tabular-nums ${
                          group.tone === "red"
                            ? "text-red-700 dark:text-red-400"
                            : "text-amber-700 dark:text-amber-400"
                        }`}
                      >
                        {rs(Number(f.amount))}
                      </span>
                    )}
                  </div>

                  <div className="mt-2 flex flex-wrap items-center gap-3">
                    {f.href && (
                      <Link href={f.href} className="text-xs font-medium text-brand-700 underline dark:text-brand-400">
                        dekhein →
                      </Link>
                    )}
                    {Number(f.din_purani ?? 0) > 0 && (
                      <span
                        className={`text-xs ${
                          Number(f.din_purani) >= 7
                            ? "font-medium text-red-700 dark:text-red-400"
                            : "text-surface-400"
                        }`}
                      >
                        {f.din_purani} din se khuli hai
                      </span>
                    )}
                  </div>

                  {canResolve && group.tone !== "grey" && <ResolveForm findingId={f.id!} />}
                </Card>
              ))}
            </div>
          </div>
        ))}

      {latest && findings.length === 0 && (
        <Card className="border-l-4 border-l-green-500 p-4">
          <p className="flex items-center gap-2 text-sm text-green-800 dark:text-green-400">
            <CheckCircle2 className="h-4 w-4" /> Koi baat khuli nahi — har jaanch guzar gayi.
          </p>
        </Card>
      )}

      {/* ---- Pichhle din ---- */}
      {(history ?? []).length > 0 && (
        <Card className="overflow-hidden">
          <div className="border-b border-surface-200 px-4 py-3 text-sm font-semibold text-surface-900 dark:border-surface-800 dark:text-white">
            Pichhle din
          </div>
          <div className="flex flex-wrap gap-1.5 p-4">
            {(history ?? []).map((h) => (
              <span
                key={h.run_date}
                title={`${h.run_date}: ${h.checks_passed} theek, ${h.checks_failed} masle, ${h.checks_skipped} chal nahi saki`}
                className={`rounded-md px-2 py-1 text-xs ${
                  h.verdict === "clean"
                    ? "bg-green-100 text-green-800 dark:bg-green-950/40 dark:text-green-400"
                    : h.verdict === "issues"
                      ? "bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-400"
                      : "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-400"
                }`}
              >
                {h.run_date.slice(5)}
              </span>
            ))}
          </div>
        </Card>
      )}

      <p className="px-1 text-xs text-surface-400">
        Cron Job roz raat ko chalta hai. Sabz din bhi darj hote hain — sirf masle wale din likhein to ye
        maloom hi nahi rehta ke kis din jaanch hui hi nahi thi, aur khamoshi &quot;sab theek hai&quot; ki
        tarah parhi jati hai.
      </p>
    </div>
  );
}
