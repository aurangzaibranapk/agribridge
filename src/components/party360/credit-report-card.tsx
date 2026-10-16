import { BANDS, TRUST_LABEL, improvementSteps, rsPk, trustOf, type Trust } from "@/lib/recovery/credit-report";
import type { CreditReport } from "@/lib/recovery/credit-report-load";

const CARD = "rounded-2xl border border-slate-200/70 bg-white p-6 shadow-[0_1px_2px_rgba(16,24,40,.04),0_8px_24px_-12px_rgba(16,24,40,.12)] dark:border-white/10 dark:bg-[#24324a]";
const MUTE = "text-slate-500 dark:text-slate-400";
export const TRUST_CLS: Record<Trust, string> = {
  trusted: "bg-teal-100 text-teal-800 dark:bg-teal-400/15 dark:text-teal-300",
  watch: "bg-amber-100 text-amber-800 dark:bg-amber-400/15 dark:text-amber-300",
  risky: "bg-orange-100 text-orange-800 dark:bg-orange-400/15 dark:text-orange-300",
  default: "bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-300",
  building: "bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300",
};
const BAND_ON: Record<string, string> = { low: "#DC2626", bronze: "#D97706", silver: "#64748B", gold: "#B7791F", platinum: "#0F766E" };
const STATUS: Record<string, [string, string]> = {
  open: ["Jari", TRUST_CLS.watch], fulfilled: ["Poora", TRUST_CLS.trusted], broken: ["Toota → Default", TRUST_CLS.default],
  replaced: ["Badal diya", TRUST_CLS.building],
};

export function CreditReportCard({ r, lateAmount }: { r: CreditReport; lateAmount?: number }) {
  const trust = trustOf({ band: r.band, defaultActive: r.defaultActive, state: r.state });
  const pct = Math.max(0, Math.min(100, r.score ?? 0));
  const ring = BAND_ON[r.band ?? ""] ?? "#94A3B8";
  const steps = improvementSteps({ score: r.score, lateAmount, defaultActive: r.defaultActive, openPromise: r.promises.some((p) => p.status === "open") });
  return (
    <div className="grid gap-4 lg:grid-cols-[1.1fr_1fr]" data-testid="credit-report">
      <div className={CARD}>
        <div className={`text-[11px] font-semibold uppercase tracking-[.08em] ${MUTE}`}>Credit report · Tasdeeq</div>
        <div className="mt-4 flex items-center gap-6">
          <div className="grid h-28 w-28 place-items-center rounded-full" style={{ background: `conic-gradient(${ring} 0 ${pct}%, rgba(148,163,184,.25) ${pct}% 100%)` }}>
            <div className="h-[88px] w-[88px] rounded-full bg-white dark:bg-[#24324a]" />
          </div>
          <div>
            <div className="text-4xl font-extrabold tabular-nums">{r.score ?? "—"}<span className={`text-base font-semibold ${MUTE}`}>/100</span></div>
            <span className={`mt-1 inline-block rounded-full px-2.5 py-1 text-xs font-bold ${TRUST_CLS[trust]}`}>{r.band ? `${r.band[0].toUpperCase()}${r.band.slice(1)} · ` : ""}{TRUST_LABEL[trust]}</span>
            <div className={`mt-2 text-xs ${MUTE}`}>{r.eligibility === "standard" ? "Udhaar: aam" : "Udhaar: Admin manzoori zaroori"}{r.snapshotDate ? ` · Updated ${r.snapshotDate}` : ""}</div>
          </div>
        </div>
        <div className="mt-5 flex gap-1.5">
          {BANDS.map((b) => <div key={b.band} className={`flex-1 rounded-lg py-2 text-center text-[11px] font-bold ${r.band === b.band ? "text-white" : `bg-slate-100 dark:bg-white/5 ${MUTE}`}`} style={r.band === b.band ? { background: BAND_ON[b.band] } : undefined}>{b.label} {b.min}-{b.max}</div>)}
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-xl bg-slate-50 p-3 dark:bg-white/5"><div className={`text-xs ${MUTE}`}>Waade poore</div><div className="text-xl font-bold text-emerald-600 dark:text-emerald-400">{r.kept}</div></div>
          <div className="rounded-xl bg-slate-50 p-3 dark:bg-white/5"><div className={`text-xs ${MUTE}`}>Waade toote</div><div className="text-xl font-bold text-red-600 dark:text-red-400">{r.broken}</div></div>
        </div>
        {r.defaults.length > 0 && <p className="mt-3 text-xs text-red-600 dark:text-red-300">Default: {r.defaults.map((d) => `${d.marked_at.slice(0, 10)}${d.softened ? " (halka)" : ""}`).join(", ")}</p>}
      </div>
      <div className="flex flex-col gap-4">
        <div className={CARD}>
          <h3 className="mb-3 text-sm font-semibold">Waadon ki tareekh</h3>
          {r.promises.length === 0 ? <p className={`text-sm ${MUTE}`}>Abhi koi waada nahi.</p> : (
            <table className="w-full text-sm"><thead><tr className={`text-left text-xs ${MUTE}`}><th className="py-2">Tareekh</th><th>Raqam</th><th>Natija</th></tr></thead><tbody>
              {r.promises.map((p, i) => { const [l, c] = STATUS[p.status] ?? [p.status, TRUST_CLS.building]; return <tr key={i} className="border-t border-slate-100 dark:border-white/[0.06]"><td className="py-2.5">{p.date}</td><td className="tabular-nums">{rsPk(p.amount)}</td><td><span className={`rounded-full px-2 py-0.5 text-xs font-bold ${c}`}>{l}</span></td></tr>; })}
            </tbody></table>
          )}
        </div>
        <div className={`${CARD} border-l-4 border-l-teal-700 dark:border-l-teal-400`}>
          <h3 className="mb-2 text-sm font-semibold">Darja kaise behtar ho?</h3>
          <ol className="ml-4 list-decimal space-y-1 text-sm">{steps.map((s) => <li key={s}>{s}</li>)}</ol>
        </div>
      </div>
    </div>
  );
}
