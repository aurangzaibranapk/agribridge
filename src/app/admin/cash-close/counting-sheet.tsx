"use client";
import { useMemo, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { recordCashClose, type ActionState } from "@/actions/cash-close";
import { DENOMINATIONS } from "@/lib/ledger/cash-close";
import { AlertTriangle, CheckCircle2, Calculator } from "lucide-react";

const initialState: ActionState = {};

function rs(v: number): string {
  return `Rs ${Math.round(v).toLocaleString()}`;
}

function SubmitButton({ blocked, label }: { blocked: boolean; label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending || blocked}
      className="w-full rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
    >
      {pending ? "Darj ho rahi hai…" : label}
    </button>
  );
}

export function CountingSheet({
  branches,
  today,
}: {
  branches: { id: string; name: string; expected: number; alreadyCounted: number | null }[];
  today: string;
}) {
  const [state, formAction] = useFormState(recordCashClose, initialState);
  const [branchId, setBranchId] = useState(branches[0]?.id ?? "");
  const [counts, setCounts] = useState<Record<string, string>>({});
  const [reason, setReason] = useState("");

  const counted = useMemo(
    () => DENOMINATIONS.reduce((sum, note) => sum + note * (Number(counts[String(note)]) || 0), 0),
    [counts]
  );

  const branch = branches.find((b) => b.id === branchId);
  const expected = branch?.expected ?? 0;
  const alreadyCounted = branch?.alreadyCounted ?? null;
  const isCorrection = alreadyCounted !== null;
  const difference = Math.round((counted - expected) * 100) / 100;
  const started = counted > 0;
  const [correctionReason, setCorrectionReason] = useState("");

  // Wajah ke baghair farq wali ginti bhejna rok diya jata hai -- server
  // par bhi yahi rok hai. Yahan sirf is liye ke jawab foran mile, form
  // bhejne ke baad nahi.
  const needsReason = started && difference !== 0 && reason.trim().length < 5;
  const needsCorrectionReason = isCorrection && correctionReason.trim().length < 5;

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="close_date" value={today} />

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-surface-600 dark:text-surface-400">Branch</span>
          <select
            name="branch_id"
            value={branchId}
            onChange={(e) => setBranchId(e.target.value)}
            className="w-full rounded-lg border border-surface-300 bg-white px-3 py-2 text-sm dark:border-surface-700 dark:bg-surface-900"
          >
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </label>
        <div>
          <span className="mb-1 block text-xs font-medium text-surface-600 dark:text-surface-400">Tareekh</span>
          <p className="rounded-lg border border-surface-200 bg-surface-50 px-3 py-2 text-sm dark:border-surface-800 dark:bg-surface-900">
            {today}
          </p>
        </div>
      </div>

      {isCorrection && (
        <div className="rounded-card border border-amber-300 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950/20">
          <p className="flex items-start gap-2 text-sm text-amber-900 dark:text-amber-300">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              Aaj ki ginti pehle ho chuki hai — <strong>{rs(alreadyCounted ?? 0)}</strong>.
              <span className="mt-0.5 block text-xs font-normal">
                Purani ginti mitegi nahi. Nayi ginti us ke sath nazar aayegi, taake ye maloom rahe ke
                pehli baar kya gina gaya tha.
              </span>
            </span>
          </p>
          <label className="mt-2 block">
            <span className="mb-1 block text-xs font-medium text-amber-900 dark:text-amber-300">
              Dobara kyun gin rahe hain? <span className="text-red-600">(lazmi)</span>
            </span>
            <input
              name="correction_reason"
              value={correctionReason}
              onChange={(e) => setCorrectionReason(e.target.value)}
              maxLength={255}
              placeholder="Jaise: pehli ginti mein Rs 1000 ka dher reh gaya tha"
              className="w-full rounded-lg border border-amber-300 px-3 py-2 text-sm dark:border-amber-800 dark:bg-surface-900"
            />
          </label>
        </div>
      )}

      {/* ---- Note ki ginti ---- */}
      <div className="rounded-card border border-surface-200 dark:border-surface-800">
        <div className="flex items-center gap-1.5 border-b border-surface-200 px-4 py-2.5 text-sm font-semibold text-surface-900 dark:border-surface-800 dark:text-white">
          <Calculator className="h-4 w-4" /> Note aur sikkay ginein
        </div>
        <div className="divide-y divide-surface-100 dark:divide-surface-800">
          {DENOMINATIONS.map((note) => {
            const qty = Number(counts[String(note)]) || 0;
            return (
              <div key={note} className="flex items-center gap-3 px-4 py-2">
                <span className="w-16 shrink-0 text-sm font-medium text-surface-700 dark:text-surface-300">
                  Rs {note}
                </span>
                <span className="text-surface-400">×</span>
                <input
                  type="number"
                  name={`d_${note}`}
                  min={0}
                  inputMode="numeric"
                  value={counts[String(note)] ?? ""}
                  onChange={(e) => setCounts({ ...counts, [String(note)]: e.target.value })}
                  placeholder="0"
                  className="w-24 rounded-lg border border-surface-300 px-2 py-1.5 text-sm dark:border-surface-700 dark:bg-surface-900"
                />
                <span className="ml-auto text-sm tabular-nums text-surface-500">
                  {qty > 0 ? rs(note * qty) : ""}
                </span>
              </div>
            );
          })}
        </div>
        <div className="flex items-center justify-between border-t-2 border-surface-300 px-4 py-3 dark:border-surface-700">
          <span className="text-sm font-semibold text-surface-900 dark:text-white">Gina gaya</span>
          <span className="font-display text-xl font-bold text-surface-900 dark:text-white">{rs(counted)}</span>
        </div>
      </div>

      {/* ---- Milaan ---- */}
      <div
        className={`rounded-card border p-4 ${
          !started
            ? "border-surface-200 dark:border-surface-800"
            : difference === 0
              ? "border-green-300 bg-green-50 dark:border-green-800 dark:bg-green-950/20"
              : "border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950/20"
        }`}
      >
        <div className="flex items-center justify-between text-sm">
          <span className="text-surface-600 dark:text-surface-400">System ke mutabiq hona chahiye</span>
          <span className="font-medium tabular-nums text-surface-900 dark:text-white">{rs(expected)}</span>
        </div>
        <div className="mt-1 flex items-center justify-between text-sm">
          <span className="text-surface-600 dark:text-surface-400">Gina gaya</span>
          <span className="font-medium tabular-nums text-surface-900 dark:text-white">{rs(counted)}</span>
        </div>

        {started && (
          <div className="mt-3 border-t border-surface-200 pt-3 dark:border-surface-700">
            {difference === 0 ? (
              <p className="flex items-center gap-2 text-sm font-semibold text-green-800 dark:text-green-400">
                <CheckCircle2 className="h-4 w-4" /> Farq koi nahi — hisaab poora mila.
              </p>
            ) : (
              <p className="flex items-start gap-2 text-sm font-semibold text-red-800 dark:text-red-400">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  {rs(Math.abs(difference))} {difference < 0 ? "KAM" : "ZYADA"} nikle hain.
                  <span className="mt-0.5 block text-xs font-normal">
                    Ye farq &quot;Cash ka farq&quot; khate mein darj hoga. Kisi kharche mein chhupaya nahi
                    jayega — mahine ke aakhir mein poochha ja sakega.
                  </span>
                </span>
              </p>
            )}
          </div>
        )}
      </div>

      {started && difference !== 0 && (
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-surface-600 dark:text-surface-400">
            Kya samajh aaya? <span className="text-red-600">(lazmi)</span>
          </span>
          <input
            name="difference_reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={255}
            placeholder="Jaise: shaam ko Rs 500 ka kharcha likhna reh gaya tha"
            className="w-full rounded-lg border border-surface-300 px-3 py-2 text-sm dark:border-surface-700 dark:bg-surface-900"
          />
          <span className="mt-1 block text-xs text-surface-400">
            Wajah maloom na ho to wahi likhein — &quot;wajah abhi maloom nahi&quot;. Adha sach likhna is se
            bura hai.
          </span>
        </label>
      )}

      <label className="block">
        <span className="mb-1 block text-xs font-medium text-surface-600 dark:text-surface-400">
          Koi aur baat (marzi)
        </span>
        <input
          name="notes"
          maxLength={255}
          className="w-full rounded-lg border border-surface-300 px-3 py-2 text-sm dark:border-surface-700 dark:bg-surface-900"
        />
      </label>

      {state.error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-400">
          {state.error}
        </p>
      )}
      {state.success && (
        <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-800 dark:bg-green-950/30 dark:text-green-400">
          {state.message}
        </p>
      )}

      <SubmitButton
        blocked={!started || needsReason || needsCorrectionReason}
        label={isCorrection ? "Dobara ginti darj karein" : "Ginti darj karein"}
      />

      <p className="text-center text-xs text-surface-400">
        Ginti darj hone ke baad badli nahi ja sakti — ye rok database mein hai.
      </p>
    </form>
  );
}
