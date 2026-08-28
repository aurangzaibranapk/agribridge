"use client";
import { useFormState, useFormStatus } from "react-dom";
import { startCount, saveCounts, postCount, type ActionState } from "@/actions/stock-count";
import { EyeOff, AlertTriangle } from "lucide-react";

const initialState: ActionState = {};

function rs(v: number): string {
  return `Rs ${Math.round(v).toLocaleString()}`;
}

function Submit({ label, variant = "brand" }: { label: string; variant?: "brand" | "amber" }) {
  const { pending } = useFormStatus();
  const colour =
    variant === "amber"
      ? "bg-amber-600 hover:bg-amber-700"
      : "bg-brand-600 hover:bg-brand-700";
  return (
    <button
      type="submit"
      disabled={pending}
      className={`rounded-lg px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50 ${colour}`}
    >
      {pending ? "Ruk jayein…" : label}
    </button>
  );
}

function Feedback({ state }: { state: ActionState }) {
  if (state.error) {
    return (
      <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-400">
        {state.error}
      </p>
    );
  }
  if (state.success) {
    return (
      <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-800 dark:bg-green-950/30 dark:text-green-400">
        {state.message}
      </p>
    );
  }
  return null;
}

export function StartCountForm({ warehouses }: { warehouses: { id: string; name: string }[] }) {
  const [state, formAction] = useFormState(startCount, initialState);

  return (
    <form action={formAction} className="space-y-3">
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-surface-600 dark:text-surface-400">
          Kaunsa godam ginna hai
        </span>
        <select
          name="warehouse_id"
          required
          className="w-full rounded-lg border border-surface-300 bg-white px-3 py-2 text-sm dark:border-surface-700 dark:bg-surface-900"
        >
          <option value="">— select karein —</option>
          {warehouses.map((w) => (
            <option key={w.id} value={w.id}>
              {w.name}
            </option>
          ))}
        </select>
      </label>
      <Feedback state={state} />
      <Submit label="Ginti shuru karein" />
    </form>
  );
}

/**
 * Ginti ka safha -- yahan system ka adad kahin NAHI hai, na screen par,
 * na HTML mein. Hidden field mein bhej dena bhi kaafi nahi hota: page ka
 * source dekh kar adad mil jata hai.
 */
export function CountingSheet({
  countId,
  lines,
}: {
  countId: string;
  lines: { id: string; productName: string; unit: string | null; packSize: string | null; counted: number | null }[];
}) {
  const [state, formAction] = useFormState(saveCounts, initialState);

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="count_id" value={countId} />

      <div className="flex items-start gap-2 rounded-lg bg-surface-100 px-3 py-2.5 text-xs text-surface-700 dark:bg-surface-800 dark:text-surface-300">
        <EyeOff className="mt-0.5 h-4 w-4 shrink-0" />
        <span>
          System ka adad jaan boojh kar chhupaya gaya hai. Jo aap ginein, bilkul wohi likhein — agar farq
          nikla to wo agle safhe par saamne aayega. Adad dekh kar likhne se ginti ka koi faida nahi rehta.
        </span>
      </div>

      <div className="overflow-hidden rounded-card border border-surface-200 dark:border-surface-800">
        <table className="w-full text-sm">
          <thead className="border-b border-surface-200 bg-surface-50 text-left text-xs text-surface-500 dark:border-surface-800 dark:bg-surface-900">
            <tr>
              <th className="px-4 py-2 font-medium">Cheez</th>
              <th className="w-32 px-4 py-2 text-right font-medium">Aap ne gina</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-100 dark:divide-surface-800">
            {lines.map((l) => (
              <tr key={l.id}>
                <td className="px-4 py-2">
                  <span className="text-surface-800 dark:text-surface-200">{l.productName}</span>
                  {(l.packSize || l.unit) && (
                    <span className="block text-xs text-surface-400">
                      {[l.packSize, l.unit].filter(Boolean).join(" • ")}
                    </span>
                  )}
                </td>
                <td className="px-4 py-2">
                  <input
                    name={`qty_${l.id}`}
                    type="number"
                    min={0}
                    step="0.001"
                    inputMode="decimal"
                    defaultValue={l.counted ?? ""}
                    placeholder="—"
                    className="w-full rounded-lg border border-surface-300 px-2 py-1.5 text-right text-sm dark:border-surface-700 dark:bg-surface-900"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Feedback state={state} />
      <Submit label="Gine hue adad mahfooz karein" />
    </form>
  );
}

/**
 * Milaan ka safha -- ab dono adad saamne hain, aur har farq par wajah
 * maangi jati hai.
 */
export function ReviewSheet({
  countId,
  lines,
}: {
  countId: string;
  lines: {
    id: string;
    productName: string;
    unit: string | null;
    expected: number | null;
    counted: number | null;
    difference: number | null;
    unitCost: number;
    reason: string | null;
  }[];
}) {
  const [state, formAction] = useFormState(postCount, initialState);
  const gaps = lines.filter((l) => (l.difference ?? 0) !== 0);
  const matched = lines.length - gaps.length;

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="count_id" value={countId} />

      <p className="text-sm text-surface-600 dark:text-surface-400">
        {matched} cheezen bilkul theek milin.
        {gaps.length > 0 && ` ${gaps.length} mein farq hai — har ek ki wajah likhna zaroori hai.`}
      </p>

      {gaps.length > 0 && (
        <div className="overflow-hidden rounded-card border border-red-200 dark:border-red-900">
          <table className="w-full text-sm">
            <thead className="border-b border-red-200 bg-red-50 text-left text-xs text-red-800 dark:border-red-900 dark:bg-red-950/20 dark:text-red-400">
              <tr>
                <th className="px-3 py-2 font-medium">Cheez</th>
                <th className="px-3 py-2 text-right font-medium">Hona chahiye</th>
                <th className="px-3 py-2 text-right font-medium">Mila</th>
                <th className="px-3 py-2 text-right font-medium">Farq</th>
                <th className="px-3 py-2 text-right font-medium">Qeemat</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-red-100 dark:divide-red-900/40">
              {gaps.map((l) => {
                const diff = l.difference ?? 0;
                const value = diff * l.unitCost;
                return (
                  <tr key={l.id}>
                    <td className="px-3 py-2">
                      <span className="text-surface-800 dark:text-surface-200">{l.productName}</span>
                      <input
                        name={`reason_${l.id}`}
                        required
                        minLength={5}
                        maxLength={255}
                        defaultValue={l.reason ?? ""}
                        placeholder="Kya samajh aaya? (lazmi)"
                        className="mt-1 w-full rounded-lg border border-surface-300 px-2 py-1 text-xs dark:border-surface-700 dark:bg-surface-900"
                      />
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-surface-500">{l.expected}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-surface-900 dark:text-white">
                      {l.counted}
                    </td>
                    <td
                      className={`px-3 py-2 text-right font-medium tabular-nums ${
                        diff < 0 ? "text-red-700 dark:text-red-400" : "text-amber-700 dark:text-amber-400"
                      }`}
                    >
                      {diff > 0 ? "+" : ""}
                      {diff}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-surface-600 dark:text-surface-400">
                      {rs(Math.abs(value))}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="flex items-start gap-1.5 text-xs text-surface-500">
        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        Mukammal karne par stock gine hue adad par set ho jayega aur nuqsan &quot;Stock ka nuqsan&quot;
        khate mein chala jayega. Us ke baad ye ginti badli nahi ja sakti.
      </p>

      <Feedback state={state} />
      <Submit label="Milaan mukammal karein" variant={gaps.length > 0 ? "amber" : "brand"} />
    </form>
  );
}
