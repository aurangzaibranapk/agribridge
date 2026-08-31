import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, Card } from "@/components/ui/layout-primitives";
import { ArrowLeft, ShieldAlert, FileText } from "lucide-react";
import { scoreDb, type ScoreSnapshot, type ScoreEvent, type ScoreObligation, type CreditEligibility } from "@/lib/score/read";

export const dynamic = "force-dynamic";

/**
 * Ek bande ka poora hisaab -- aur us ka har adad kahan se aaya.
 *
 * Sawal ek hai: YE NUMBER BANA KAHAN SE? Jawab teen qadam mein poora
 * hota hai -- upar teen adad, beech mein factor ki table, aur neeche har
 * waqia apne asal document ke naam ke sath.
 *
 * Batil ho chuke waqiat bhi dikhaye jate hain, alag shakl mein. Wo
 * hisaab mein nahi aate magar tareekh se mitte bhi nahi -- warna ye
 * sawal kabhi na khulta ke pehle kya likha tha aur kyun badla.
 */

const MASTER = ["owner", "super_admin", "admin"];

const STATE_LABEL: Record<string, string> = {
  active: "Darja bana hua hai",
  score_building: "Hisaab ban raha hai",
  insufficient_data: "Tasweer adhoori",
};

const BAND_LABEL: Record<string, string> = {
  platinum: "Platinum", gold: "Gold", silver: "Silver", bronze: "Bronze", low: "Low",
};

const ELIG_LABEL: Record<string, string> = {
  standard: "Aam qawaid par",
  unproven: "Abhi parkha nahi gaya",
  restricted: "Rok lagi hui hai",
  high_risk: "Bara khatra",
  not_assessed: "Hisaab hi nahi bana",
  not_applicable: "Is par lagta hi nahi",
};

export default async function TrustDetailPage({
  params,
}: {
  params: { subjectType: string; id: string };
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

  const { subjectType, id } = params;

  const [{ data: snaps }, { data: events }, { data: obligations }, { data: elig }] =
    await Promise.all([
      scoreDb(supabase)
        .from("score_snapshots")
        .select("*")
        .eq("subject_type", subjectType)
        .eq("subject_id", id)
        .order("snapshot_date", { ascending: false })
        .limit(30),
      scoreDb(supabase)
        .from("score_events")
        .select(
          "id, factor_key, event_type, direction, magnitude, occurred_at, never_decays, source_table, source_id, evidence_state, note, invalidated_at, invalidated_reason"
        )
        .eq("subject_type", subjectType)
        .eq("subject_id", id)
        .order("occurred_at", { ascending: false })
        .limit(200),
      scoreDb(supabase)
        .from("score_obligations")
        .select("kind, source_table, source_id, amount, settled_amount, due_date, due_date_source, state")
        .eq("subject_type", subjectType)
        .eq("subject_id", id),
      scoreDb(supabase).rpc("fn_credit_eligibility", {
        p_subject_type: subjectType,
        p_subject_id: id,
      }),
    ]);

  const rows = (snaps ?? []) as ScoreSnapshot[];
  const snap = rows[0];
  if (!snap) {
    return (
      <div className="space-y-4">
        <BackLink />
        <Card className="p-8 text-center text-surface-400">
          Is bande ka koi hisaab abhi bana hi nahi.
        </Card>
      </div>
    );
  }

  const factors = snap.factors ?? [];

  const eligRow = (Array.isArray(elig) ? elig[0] : null) as CreditEligibility | null;
  const obs = (obligations ?? []) as ScoreObligation[];
  const trail = (events ?? []) as ScoreEvent[];
  const live = trail.filter((e) => !e.invalidated_at);
  const dead = trail.filter((e) => e.invalidated_at);

  return (
    <div className="space-y-4">
      <BackLink />
      <PageHeader title="Ye number bana kahan se" description={`${subjectType} — saye wala hisaab`} />

      {/* ---- TEEN ADAD, EK NAHI ---- */}
      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="p-4">
          <div className="text-[11px] uppercase tracking-wider text-surface-400">Score</div>
          {snap.score === null ? (
            <div className="mt-1 text-lg font-medium text-surface-500">
              {STATE_LABEL[snap.state] ?? snap.state}
            </div>
          ) : (
            <div className="mt-1 flex items-baseline gap-2">
              <span className="font-mono text-3xl tabular-nums text-surface-900 dark:text-surface-100">
                {snap.score}
              </span>
              <span className="text-surface-500">{BAND_LABEL[snap.band ?? ""]}</span>
            </div>
          )}
          <div className="mt-1 text-xs text-surface-400">{snap.reason_summary}</div>
        </Card>

        <Card className="p-4">
          <div className="text-[11px] uppercase tracking-wider text-surface-400">Evidence Coverage</div>
          <div className="mt-1 font-mono text-3xl tabular-nums text-surface-900 dark:text-surface-100">
            {snap.evidence_coverage === null ? "—" : `${Math.round(snap.evidence_coverage * 100)}%`}
          </div>
          <div className="mt-1 text-xs text-surface-400">
            {snap.verified_event_count} tasdeeq shuda waqiat · {snap.relationship_days} din purana
          </div>
        </Card>

        <Card className="p-4">
          <div className="text-[11px] uppercase tracking-wider text-surface-400">Udhaar ki ijazat</div>
          <div className="mt-1 text-lg font-medium text-surface-900 dark:text-surface-100">
            {ELIG_LABEL[eligRow?.level ?? ""] ?? eligRow?.level ?? "—"}
          </div>
          <div className="mt-1 text-xs text-surface-400">
            {eligRow?.reasons?.[0]?.reason ?? ""}
          </div>
          {eligRow?.requires_human_approval ? (
            <div className="mt-2 text-[11px] text-surface-500">
              Faisla insaan ka hai — ye nizam manzoori nahi deta.
            </div>
          ) : null}
        </Card>
      </div>

      {snap.risk_flags.length > 0 ? (
        <Card className="border-red-200 bg-red-50 p-4 dark:border-red-900/40 dark:bg-red-950/20">
          <div className="flex gap-3">
            <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-red-700 dark:text-red-400" />
            <div className="text-sm">
              <p className="font-medium text-red-900 dark:text-red-200">Khatre ka nishan</p>
              <p className="mt-1 text-red-800 dark:text-red-300">{snap.risk_flags.join(", ")}</p>
            </div>
          </div>
        </Card>
      ) : null}

      {/* ---- Factor ki table ---- */}
      <Card className="overflow-x-auto p-0">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-surface-200 text-left text-[11px] uppercase tracking-wider text-surface-400 dark:border-surface-700">
              <th className="px-4 py-3 font-medium">Factor</th>
              <th className="px-4 py-3 font-medium">Wazan</th>
              <th className="px-4 py-3 font-medium">Nateeja</th>
              <th className="px-4 py-3 font-medium">Number</th>
              <th className="px-4 py-3 font-medium">Wajah</th>
            </tr>
          </thead>
          <tbody>
            {factors.map((f) => (
              <tr key={f.factor} className="border-b border-surface-100 last:border-0 dark:border-surface-800">
                <td className="px-4 py-3">
                  <div className="font-medium text-surface-900 dark:text-surface-100">{f.label}</div>
                  <div className="font-mono text-[11px] text-surface-400">{f.factor}</div>
                </td>
                <td className="px-4 py-3 font-mono tabular-nums text-surface-600 dark:text-surface-300">
                  {f.weight}
                </td>
                <td className="px-4 py-3 font-mono tabular-nums">
                  {f.applicable ? (
                    f.sub_score?.toFixed(3)
                  ) : (
                    // N/A. Yahan number ki jagah hamesha wajah aati hai.
                    <span className="text-amber-700 dark:text-amber-400">N/A</span>
                  )}
                </td>
                <td className="px-4 py-3 font-mono tabular-nums text-surface-600 dark:text-surface-300">
                  {f.applicable ? f.points : <span className="text-surface-300">—</span>}
                </td>
                <td className="px-4 py-3 text-surface-500">
                  {f.reason ?? (f.punitive ? "" : "Sirf barha sakta hai, ghata nahi")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {/* ---- Zimmedariyan ---- */}
      {obs.length > 0 ? (
        <Card className="overflow-x-auto p-0">
          <div className="px-4 pt-4 text-sm font-medium text-surface-900 dark:text-surface-100">
            Zimmedariyan
          </div>
          <table className="mt-2 w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-surface-200 text-left text-[11px] uppercase tracking-wider text-surface-400 dark:border-surface-700">
                <th className="px-4 py-2 font-medium">Kis cheez ki</th>
                <th className="px-4 py-2 font-medium">Raqam</th>
                <th className="px-4 py-2 font-medium">Aaya</th>
                <th className="px-4 py-2 font-medium">Tareekh</th>
                <th className="px-4 py-2 font-medium">Halat</th>
              </tr>
            </thead>
            <tbody>
              {obs.map((o, i) => (
                <tr key={i} className="border-b border-surface-100 last:border-0 dark:border-surface-800">
                  <td className="px-4 py-2">
                    <div>{o.kind}</div>
                    <div className="font-mono text-[11px] text-surface-400">{o.source_table}</div>
                  </td>
                  <td className="px-4 py-2 font-mono tabular-nums">{Number(o.amount).toLocaleString()}</td>
                  <td className="px-4 py-2 font-mono tabular-nums">
                    {Number(o.settled_amount).toLocaleString()}
                  </td>
                  <td className="px-4 py-2">
                    {o.due_date ? (
                      <span className="font-mono text-xs">
                        {o.due_date}
                        <span className="ml-1 text-surface-400">({o.due_date_source})</span>
                      </span>
                    ) : (
                      // Khali tareekh koi kami nahi -- wo sach hai.
                      <span className="text-surface-400">Tay hi nahi hui</span>
                    )}
                  </td>
                  <td className="px-4 py-2">{o.state}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      ) : null}

      {/* ---- Waqiat, aur un ke asal kaghaz ---- */}
      <Card className="p-0">
        <div className="px-4 pt-4 text-sm font-medium text-surface-900 dark:text-surface-100">
          Waqiat — aur har ek ka asal kaghaz
        </div>
        <ul className="mt-2 divide-y divide-surface-100 dark:divide-surface-800">
          {live.map((e) => (
            <li key={e.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-4 py-2.5 text-sm">
              <span
                className={
                  "font-mono tabular-nums " +
                  (e.direction === 1 ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400")
                }
              >
                {e.direction === 1 ? "+" : "−"}
                {e.magnitude}
              </span>
              <span className="font-medium text-surface-900 dark:text-surface-100">{e.event_type}</span>
              <span className="font-mono text-[11px] text-surface-400">{e.factor_key}</span>
              <span className="text-xs text-surface-400">{String(e.occurred_at).slice(0, 10)}</span>
              {e.never_decays ? (
                <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
                  waqt se mehfooz
                </span>
              ) : null}
              {e.evidence_state !== "verified" ? (
                <span className="rounded bg-surface-100 px-1.5 py-0.5 text-[10px] text-surface-500 dark:bg-surface-800">
                  {e.evidence_state} — ginti mein nahi
                </span>
              ) : null}
              <span className="flex items-center gap-1 font-mono text-[11px] text-surface-400">
                <FileText className="h-3 w-3" />
                {e.source_table}/{String(e.source_id).slice(0, 8)}
              </span>
              {e.note ? <span className="w-full text-xs text-surface-500">{e.note}</span> : null}
            </li>
          ))}
        </ul>

        {dead.length > 0 ? (
          <div className="border-t border-surface-200 px-4 py-3 dark:border-surface-700">
            <div className="text-xs font-medium text-surface-500">
              Batil ho chuke waqiat — hisaab mein nahi, magar tareekh se mite bhi nahi
            </div>
            <ul className="mt-1.5 space-y-1">
              {dead.map((e) => (
                <li key={e.id} className="text-xs text-surface-400">
                  <span className="line-through">
                    {e.event_type} ({e.direction === 1 ? "+" : "−"}
                    {e.magnitude})
                  </span>
                  <span className="ml-2">— {e.invalidated_reason}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </Card>

      {/* ---- Guzra hua waqt ---- */}
      <Card className="overflow-x-auto p-0">
        <div className="px-4 pt-4 text-sm font-medium text-surface-900 dark:text-surface-100">
          Guzra hua hisaab
        </div>
        <table className="mt-2 w-full min-w-[520px] text-sm">
          <thead>
            <tr className="border-b border-surface-200 text-left text-[11px] uppercase tracking-wider text-surface-400 dark:border-surface-700">
              <th className="px-4 py-2 font-medium">Tareekh</th>
              <th className="px-4 py-2 font-medium">Score</th>
              <th className="px-4 py-2 font-medium">Saboot</th>
              <th className="px-4 py-2 font-medium">Engine</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => (
              <tr key={s.snapshot_date} className="border-b border-surface-100 last:border-0 dark:border-surface-800">
                <td className="px-4 py-2 font-mono text-xs">{s.snapshot_date}</td>
                <td className="px-4 py-2 font-mono tabular-nums">
                  {s.score === null ? (
                    <span className="text-surface-400">{STATE_LABEL[s.state] ?? s.state}</span>
                  ) : (
                    <>
                      {s.score} <span className="text-surface-400">{BAND_LABEL[s.band ?? ""]}</span>
                    </>
                  )}
                </td>
                <td className="px-4 py-2 font-mono tabular-nums text-surface-500">
                  {s.evidence_coverage === null ? "—" : `${Math.round(s.evidence_coverage * 100)}%`}
                </td>
                <td className="px-4 py-2 font-mono text-xs text-surface-400">v{s.engine_version}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

function BackLink() {
  return (
    <Link
      href="/admin/trust"
      className="inline-flex items-center gap-1.5 text-sm text-surface-500 hover:text-surface-900 dark:hover:text-surface-100"
    >
      <ArrowLeft className="h-4 w-4" />
      Wapas fehrist par
    </Link>
  );
}
