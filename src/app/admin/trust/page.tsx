import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, Card, EmptyState } from "@/components/ui/layout-primitives";
import { AlertTriangle, ShieldAlert, Eye, Clock, CheckCircle2 } from "lucide-react";
import { scoreDb } from "@/lib/score/read";

export const dynamic = "force-dynamic";

/**
 * Trust & Performance Intelligence -- SAYE WALA SAFHA.
 *
 * Ye safha sirf Master Admin ke liye hai, aur jaan boojh kar. Score ka
 * nizam abhi parkha ja raha hai; jab tak wo theher na jaye, kisi kisan,
 * customer, vendor ya staff ko us ka apna darja nahi dikhaya jata. Ek
 * aazmaishi adad ka kisi ke saamne aa jana wapas nahi liya ja sakta.
 *
 * TEEN ADAD SATH CHALTE HAIN, EK NAHI:
 *
 *   Score       -- is bande ka chaal chalan
 *   Coverage    -- ye nateeja kitne saboot par khara hai
 *   Eligibility -- is waqt usay kya diya ja sakta hai
 *
 * Isi liye har qatar par teenon likhe hain. "86 Platinum" akela kabhi
 * nazar nahi aata.
 *
 * AUR JIS KA HISAAB NAHI, US KE SAAMNE SIFAR NAHI LIKHA JATA. Jahan
 * darja bana hi nahi, wahan number ki jagah us ki halat likhi hai --
 * "Hisaab ban raha hai" ya "Tasweer adhoori". Ye is project ka purana
 * usool hai: sifar aur "hisaab nahi rakha jata" ek cheez nahi.
 */

const MASTER = ["owner", "super_admin", "admin"];

const KINDS = [
  { key: "farmer", label: "Kisan" },
  { key: "customer", label: "Customer" },
  { key: "vendor", label: "Vendor" },
  { key: "staff", label: "Staff" },
] as const;

const BANDS = [
  { key: "platinum", label: "Platinum", dot: "bg-emerald-600" },
  { key: "gold", label: "Gold", dot: "bg-amber-500" },
  { key: "silver", label: "Silver", dot: "bg-slate-400" },
  { key: "bronze", label: "Bronze", dot: "bg-orange-700" },
  { key: "low", label: "Low", dot: "bg-red-700" },
];

const STATE_LABEL: Record<string, string> = {
  score_building: "Hisaab ban raha hai",
  insufficient_data: "Tasweer adhoori",
};

type Row = {
  subject_type: string;
  subject_id: string;
  score: number | null;
  band: string | null;
  state: string;
  evidence_coverage: number | null;
  credit_history_state: string | null;
  risk_flags: string[];
  snapshot_date: string;
  last_evidence_at: string | null;
};

export default async function TrustPage({
  searchParams,
}: {
  searchParams?: { kind?: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: me } = user
    ? await supabase.from("profiles").select("role, is_active").eq("id", user.id).maybeSingle()
    : { data: null };

  if (!me?.is_active || !MASTER.includes(me.role as string)) {
    return <div className="p-8 text-center text-surface-400">Ye safha sirf Master Admin ke liye hai.</div>;
  }

  const kind = KINDS.find((k) => k.key === searchParams?.kind)?.key ?? "farmer";

  // Har bande ka sirf AAKHRI snapshot. Purane snapshot apni jagah rehte
  // hain (wo tareekh hain), magar yahan aaj ki tasweer chahiye.
  const { data: all } = await scoreDb(supabase)
    .from("score_snapshots")
    .select(
      "subject_type, subject_id, score, band, state, evidence_coverage, credit_history_state, risk_flags, snapshot_date, last_evidence_at"
    )
    .eq("subject_type", kind)
    .order("snapshot_date", { ascending: false })
    .limit(2000);

  const latest = new Map<string, Row>();
  for (const r of (all ?? []) as Row[]) {
    if (!latest.has(r.subject_id)) latest.set(r.subject_id, r);
  }
  const rows = [...latest.values()];

  const names = await loadNames(supabase, kind, rows.map((r) => r.subject_id));

  const count = (f: (r: Row) => boolean) => rows.filter(f).length;
  const tiles = [
    { label: "Hisaab ban raha hai", n: count((r) => r.state === "score_building"), tone: "neutral" },
    { label: "Tasweer adhoori", n: count((r) => r.state === "insufficient_data"), tone: "neutral" },
    ...BANDS.map((b) => ({ label: b.label, n: count((r) => r.band === b.key), tone: "band" })),
    {
      label: "Khatre ka nishan",
      n: count((r) => (r.risk_flags ?? []).length > 0),
      tone: "risk",
    },
  ];

  const { count: openObligations } = await scoreDb(supabase)
    .from("score_obligations")
    .select("id", { count: "exact", head: true })
    .eq("subject_type", kind)
    .eq("state", "open");

  // TAAZGI -- ye safha khud hisaab nahi lagata. Ek hi function se
  // poochta hai, taake do jagah do jawab na hon.
  const { data: healthRows } = await scoreDb(supabase).rpc("fn_score_health");
  const health = (Array.isArray(healthRows) ? healthRows[0] : null) as {
    last_ok_run: string | null;
    hours_since_run: number | null;
    queue_pending: number;
    queue_failed: number;
    is_stale: boolean;
    reason: string;
  } | null;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Trust & Performance Intelligence"
        description="Saye mein chal raha hai — abhi sirf aap dekh rahe hain."
      />

      <Card className="border-amber-200 bg-amber-50 p-4 dark:border-amber-900/40 dark:bg-amber-950/20">
        <div className="flex gap-3">
          <Eye className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          <div className="text-sm text-amber-900 dark:text-amber-200">
            <p className="font-medium">Ye adad abhi kisi ko nahi dikhaye jate.</p>
            <p className="mt-1 text-amber-800 dark:text-amber-300">
              Na kisan ko, na customer ko, na vendor ko, na staff ko. Nizam parkha ja raha hai — aur
              ek aazmaishi adad ka kisi ke saamne aa jana wapas nahi liya ja sakta.
            </p>
          </div>
        </div>
      </Card>

      {/* ---- TAAZGI ---- */}
      {health ? (
        <Card
          className={
            "p-4 " +
            (health.is_stale
              ? "border-red-200 bg-red-50 dark:border-red-900/40 dark:bg-red-950/20"
              : "")
          }
        >
          <div className="flex flex-wrap items-start gap-x-6 gap-y-3">
            <div className="flex gap-3">
              {health.is_stale ? (
                <Clock className="mt-0.5 h-5 w-5 shrink-0 text-red-700 dark:text-red-400" />
              ) : (
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700 dark:text-emerald-400" />
              )}
              <div className="text-sm">
                <p
                  className={
                    "font-medium " +
                    (health.is_stale
                      ? "text-red-900 dark:text-red-200"
                      : "text-surface-900 dark:text-surface-100")
                  }
                >
                  {health.is_stale
                    ? "Ye adad purane ho sakte hain"
                    : "Adad taaza hain"}
                </p>
                <p
                  className={
                    "mt-0.5 " +
                    (health.is_stale
                      ? "text-red-800 dark:text-red-300"
                      : "text-surface-500")
                  }
                >
                  {health.reason}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-surface-500">
              <span>
                Aakhri kaamyab hisaab:{" "}
                <b className="font-mono text-surface-900 dark:text-surface-100">
                  {health.last_ok_run
                    ? new Date(health.last_ok_run).toLocaleString()
                    : /* Kabhi chala hi nahi -- ye sifar nahi hai. */ "kabhi nahi"}
                </b>
              </span>
              <span>
                Muntazir parchiyan:{" "}
                <b className="font-mono tabular-nums text-surface-900 dark:text-surface-100">
                  {health.queue_pending}
                </b>
              </span>
              <span>
                Nakaam:{" "}
                <b
                  className={
                    "font-mono tabular-nums " +
                    (health.queue_failed > 0
                      ? "text-red-700 dark:text-red-400"
                      : "text-surface-900 dark:text-surface-100")
                  }
                >
                  {health.queue_failed}
                </b>
              </span>
            </div>
          </div>
        </Card>
      ) : null}

      {/* ---- Kis kism ke log ---- */}
      <div className="flex flex-wrap gap-2">
        {KINDS.map((k) => (
          <Link
            key={k.key}
            href={`/admin/trust?kind=${k.key}`}
            className={
              "rounded-full border px-4 py-1.5 text-sm font-medium transition-colors " +
              (k.key === kind
                ? "border-transparent bg-surface-900 text-white dark:bg-surface-100 dark:text-surface-900"
                : "border-surface-200 text-surface-600 hover:border-surface-400 dark:border-surface-700 dark:text-surface-300")
            }
          >
            {k.label}
          </Link>
        ))}
      </div>

      {/* ---- Ginti ---- */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
        {tiles.map((t) => (
          <Card key={t.label} className="p-3">
            <div className="font-mono text-2xl tabular-nums text-surface-900 dark:text-surface-100">
              {t.n}
            </div>
            <div className="mt-0.5 text-[11px] leading-tight text-surface-500">{t.label}</div>
          </Card>
        ))}
      </div>

      <Card className="flex items-center gap-3 p-3 text-sm">
        <AlertTriangle className="h-4 w-4 text-amber-600" />
        <span className="text-surface-600 dark:text-surface-300">
          Khuli zimmedariyan:{" "}
          <b className="font-mono tabular-nums text-surface-900 dark:text-surface-100">
            {openObligations ?? 0}
          </b>
        </span>
      </Card>

      {/* ---- Fehrist ---- */}
      {rows.length === 0 ? (
        <EmptyState
          title="Is kism ka koi record nahi"
          description="Jin ke naam par koi waqia ya zimmedari darj hai, sirf wohi yahan aate hain."
        />
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-surface-200 text-left text-[11px] uppercase tracking-wider text-surface-400 dark:border-surface-700">
                <th className="px-4 py-3 font-medium">Naam</th>
                <th className="px-4 py-3 font-medium">Score</th>
                <th className="px-4 py-3 font-medium">Saboot</th>
                <th className="px-4 py-3 font-medium">Udhaar ka record</th>
                <th className="px-4 py-3 font-medium">Nishan</th>
                <th className="px-4 py-3 font-medium">Aakhri saboot</th>
              </tr>
            </thead>
            <tbody>
              {rows
                .sort((a, b) => (b.score ?? -1) - (a.score ?? -1))
                .map((r) => {
                  const band = BANDS.find((b) => b.key === r.band);
                  return (
                    <tr
                      key={r.subject_id}
                      className="border-b border-surface-100 last:border-0 dark:border-surface-800"
                    >
                      <td className="px-4 py-3">
                        <Link
                          href={`/admin/trust/${r.subject_type}/${r.subject_id}`}
                          className="font-medium text-surface-900 hover:underline dark:text-surface-100"
                        >
                          {names.get(r.subject_id) ?? r.subject_id.slice(0, 8)}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        {r.score === null ? (
                          // Sifar nahi. Halat.
                          <span className="text-surface-400">{STATE_LABEL[r.state] ?? r.state}</span>
                        ) : (
                          <span className="flex items-center gap-2">
                            <span className={`h-2 w-2 rounded-full ${band?.dot ?? "bg-surface-300"}`} />
                            <b className="font-mono tabular-nums">{r.score}</b>
                            <span className="text-surface-500">{band?.label}</span>
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 font-mono tabular-nums text-surface-600 dark:text-surface-300">
                        {r.evidence_coverage === null
                          ? "—"
                          : `${Math.round(r.evidence_coverage * 100)}%`}
                      </td>
                      <td className="px-4 py-3 text-surface-600 dark:text-surface-300">
                        {r.credit_history_state === "established"
                          ? "Maujood"
                          : r.credit_history_state === "insufficient"
                            ? "Adhoora"
                            : "Koi nahi"}
                      </td>
                      <td className="px-4 py-3">
                        {(r.risk_flags ?? []).length === 0 ? (
                          <span className="text-surface-300">—</span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-medium text-red-800 dark:bg-red-950/30 dark:text-red-300">
                            <ShieldAlert className="h-3 w-3" />
                            {r.risk_flags.join(", ")}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-surface-400">
                        {/* Hisaab kab laga ye kaafi nahi -- ye batana zaroori
                            hai ke us mein SABOOT kahan tak ka tha. */}
                        {r.last_evidence_at ? r.last_evidence_at.slice(0, 10) : "—"}
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

/** Naam alag alag tableon se aate hain -- subject ki kism ke mutabiq. */
async function loadNames(
  supabase: ReturnType<typeof createClient>,
  kind: string,
  ids: string[]
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (ids.length === 0) return map;

  const table =
    kind === "farmer"
      ? { name: "farmers", col: "full_name" }
      : kind === "customer"
        ? { name: "customers", col: "name" }
        : kind === "vendor"
          ? { name: "machinery_vendors", col: "vendor_name" }
          : { name: "profiles", col: "full_name" };

  // Column ka naam chalte waqt tay hota hai, is liye ye query bhi usi
  // darwaze se guzarti hai.
  const { data } = await scoreDb(supabase).from(table.name).select(`id, ${table.col}`).in("id", ids);
  for (const row of (data ?? []) as unknown as Record<string, string>[]) {
    map.set(row.id, row[table.col]);
  }
  return map;
}
