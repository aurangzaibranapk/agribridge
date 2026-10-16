import type { CreditPosition } from "@/lib/recovery/credit-position";
import { limitLabel } from "@/lib/recovery/credit-position";

const rs = (n: number) => "Rs " + Math.round(n).toLocaleString("en-PK");
const pk = (d: string | null) => (d ? d.split("-").reverse().join("-") : "");

/** Teen saaf adad: Kul baqaya, Late raqam, Abhi itna dein to udhaar bahal (538). */
export function CreditPositionStrip({ position, compact = false }: { position: CreditPosition; compact?: boolean }) {
  const p = position;
  const box = compact ? "p-2" : "p-3";
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className={`rounded-lg border border-surface-200 bg-white ${box} dark:border-surface-700 dark:bg-surface-900`}>
          <div className="text-[11px] text-surface-500">Kul baqaya</div>
          <div className="text-lg font-bold">{rs(p.kulBaqaya)}</div>
        </div>
        <div className={`rounded-lg border ${p.lateAmount > 0 ? "border-red-200" : "border-surface-200"} bg-white ${box} dark:bg-surface-900`}>
          <div className="text-[11px] text-surface-500">Late raqam</div>
          <div className={`text-lg font-bold ${p.lateAmount > 0 ? "text-red-600" : ""}`}>{rs(p.lateAmount)}</div>
          <div className="text-[10px] text-surface-400">{p.oldestDays != null ? `${p.oldestDays} din · ` : ""}{limitLabel(p)}</div>
        </div>
        <div className={`rounded-lg border-2 ${p.blocked ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30" : "border-surface-200 bg-white dark:bg-surface-900"} ${box}`}>
          <div className="text-[11px] font-semibold text-emerald-800 dark:text-emerald-300">Abhi itna dein to udhaar bahal</div>
          <div className="text-lg font-bold text-emerald-700 dark:text-emerald-400">{rs(p.bahaliAmount)}</div>
        </div>
      </div>
      {p.promiseState && (
        <div className={`rounded-lg border p-2 text-xs ${p.promiseState === "broken" ? "border-orange-200 bg-orange-50 text-orange-800" : p.promiseState === "open" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-surface-200 bg-surface-50 text-surface-600"}`}>
          Waada: {pk(p.promiseDate)} tak{p.promiseAmount != null ? ` · ${rs(p.promiseAmount)}` : ""} —{" "}
          {p.promiseState === "open" ? "khula (is dauran udhaar chalu)" : p.promiseState === "broken" ? "tareekh guzar gayi, adaigi nahi hui — naya udhaar sirf Admin" : "poora ho gaya"}
        </div>
      )}
      <div className="text-xs">
        {p.blocked ? <span className="rounded bg-red-100 px-2 py-0.5 font-semibold text-red-700">Udhaar band</span> : <span className="rounded bg-emerald-100 px-2 py-0.5 font-semibold text-emerald-700">Udhaar chalu</span>}
      </div>
    </div>
  );
}
