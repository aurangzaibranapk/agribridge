"use client";
import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { startCount, saveCounts, postCount, verifyCount, addExtraCountItem, type ActionState } from "@/actions/stock-count";
import { EyeOff, AlertTriangle, PlusCircle } from "lucide-react";
import { t } from "@/lib/i18n/translations";
import { useLang } from "@/lib/i18n/lang-context";

const initialState: ActionState = {};

function rs(v: number): string {
  return `Rs ${Math.round(v).toLocaleString()}`;
}

function Submit({ label, variant = "brand" }: { label: string; variant?: "brand" | "amber" }) {
  const lang = useLang();
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
      {pending ? t("sc_waiting", lang) : label}
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
  const lang = useLang();
  const [state, formAction] = useFormState(startCount, initialState);

  return (
    <form action={formAction} className="space-y-3">
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-surface-600 dark:text-surface-400">
          {t("sc_which_warehouse", lang)}
        </span>
        <select
          name="warehouse_id"
          required
          className="w-full rounded-lg border border-surface-300 bg-white px-3 py-2 text-sm dark:border-surface-700 dark:bg-surface-900"
        >
          <option value="">{t("sc_pick", lang)}</option>
          {warehouses.map((w) => (
            <option key={w.id} value={w.id}>
              {w.name}
            </option>
          ))}
        </select>
      </label>
      <Feedback state={state} />
      <Submit label={t("sc_start_count", lang)} />
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
  const lang = useLang();
  const [state, formAction] = useFormState(saveCounts, initialState);

  return (
    <div className="space-y-3">
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="count_id" value={countId} />

      <div className="flex items-start gap-2 rounded-lg bg-surface-100 px-3 py-2.5 text-xs text-surface-700 dark:bg-surface-800 dark:text-surface-300">
        <EyeOff className="mt-0.5 h-4 w-4 shrink-0" />
        <span>
          {t("sc_hidden_note", lang)}
        </span>
      </div>

      <p className="text-xs font-medium text-surface-500">
        {t("sc_total_items", lang)}: {lines.length}
      </p>

      <div className="overflow-hidden rounded-card border border-surface-200 dark:border-surface-800">
        <table className="w-full text-sm">
          <thead className="border-b border-surface-200 bg-surface-50 text-left text-xs text-surface-500 dark:border-surface-800 dark:bg-surface-900">
            <tr>
              <th className="w-10 px-4 py-2 text-right font-medium">#</th>
              <th className="px-4 py-2 font-medium">{t("sc_item", lang)}</th>
              <th className="w-32 px-4 py-2 text-right font-medium">{t("sc_you_counted", lang)}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-100 dark:divide-surface-800">
            {lines.map((l, i) => (
              <tr key={l.id}>
                <td className="px-4 py-2 text-right text-xs tabular-nums text-surface-400">{i + 1}</td>
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
      <Submit label={t("sc_save_counts", lang)} />
    </form>

      <ExtraItemForm countId={countId} />
    </div>
  );
}

/**
 * Ginti ke dauran koi cheez mile jo list mein nahi thi (14 September).
 * Naam se milan pehle hota hai -- mile to usi ka stock badhta hai, na
 * mile to naya product ban jata hai. Rate khali chhoRa ja sakta hai --
 * "Rate Baqi" ki fehrist mein khud pahunch jayega.
 */
function ExtraItemForm({ countId }: { countId: string }) {
  const lang = useLang();
  const [open, setOpen] = useState(false);
  const [state, formAction] = useFormState(addExtraCountItem, initialState);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 text-sm font-medium text-brand-700 hover:underline dark:text-brand-300"
      >
        <PlusCircle className="h-4 w-4" /> {t("sc_extra_open", lang)}
      </button>
    );
  }

  return (
    <div className="rounded-lg border border-dashed border-surface-300 p-3 dark:border-surface-700">
      <p className="mb-2 text-sm font-medium text-surface-900 dark:text-white">{t("sc_extra_title", lang)}</p>
      <p className="mb-3 text-xs text-surface-500">{t("sc_extra_note", lang)}</p>
      <form
        action={formAction}
        className="grid gap-2 sm:grid-cols-[1fr_120px_120px_auto]"
      >
        <input type="hidden" name="count_id" value={countId} />
        <input
          name="name"
          required
          placeholder={t("sc_extra_name", lang)}
          className="rounded-lg border border-surface-300 px-2 py-1.5 text-sm dark:border-surface-700 dark:bg-surface-900"
        />
        <input
          name="quantity"
          type="number"
          min={0}
          step="0.001"
          required
          placeholder={t("sc_extra_qty", lang)}
          className="rounded-lg border border-surface-300 px-2 py-1.5 text-sm dark:border-surface-700 dark:bg-surface-900"
        />
        <input
          name="purchase_price"
          type="number"
          min={0}
          step="0.01"
          placeholder={t("sc_extra_rate", lang)}
          className="rounded-lg border border-surface-300 px-2 py-1.5 text-sm dark:border-surface-700 dark:bg-surface-900"
        />
        <ExtraSubmit label={t("sc_extra_add", lang)} />
      </form>
      <Feedback state={state} />
      <button type="button" onClick={() => setOpen(false)} className="mt-2 text-xs text-surface-400 underline">
        {t("sc_extra_close", lang)}
      </button>
    </div>
  );
}

function ExtraSubmit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
    >
      {pending ? "…" : label}
    </button>
  );
}

/**
 * Milaan ka safha -- ab dono adad saamne hain, aur har farq par wajah
 * maangi jati hai.
 */
export function ReviewSheet({
  countId,
  lines,
  status,
  canVerify,
  canApprove,
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
  /** 'counting' | 'verified'. */
  status: string;
  /** Branch Manager: sirf apni branch ki tasdeeq -- final post nahi. */
  canVerify: boolean;
  canApprove: boolean;
}) {
  const lang = useLang();
  const [postState, postAction] = useFormState(postCount, initialState);
  const [verifyState, verifyAction] = useFormState(verifyCount, initialState);
  const state = canApprove ? postState : verifyState;
  const gaps = lines.filter((l) => (l.difference ?? 0) !== 0);
  const matched = lines.length - gaps.length;
  // Tasdeeq ke baad reason ke khane already bhare/lock -- dobara wajah
  // maangna Manager se ho chuka kaam dobara karwana hota.
  const readOnlyReasons = status === "verified" && !canApprove;

  const canAct = canApprove || canVerify;
  const formAction = canApprove ? postAction : verifyAction;

  return (
    <form action={canAct ? formAction : undefined} className="space-y-3">
      <input type="hidden" name="count_id" value={countId} />

      <p className="text-sm text-surface-600 dark:text-surface-400">
        {matched} {t("sc_matched", lang)}
        {gaps.length > 0 && ` ${gaps.length} ${t("sc_gaps_note", lang)}`}
      </p>

      {gaps.length > 0 && (
        <div className="overflow-hidden rounded-card border border-red-200 dark:border-red-900">
          <table className="w-full text-sm">
            <thead className="border-b border-red-200 bg-red-50 text-left text-xs text-red-800 dark:border-red-900 dark:bg-red-950/20 dark:text-red-400">
              <tr>
                <th className="px-3 py-2 font-medium">{t("sc_item", lang)}</th>
                <th className="px-3 py-2 text-right font-medium">{t("sc_expected", lang)}</th>
                <th className="px-3 py-2 text-right font-medium">{t("sc_found", lang)}</th>
                <th className="px-3 py-2 text-right font-medium">{t("sc_difference", lang)}</th>
                <th className="px-3 py-2 text-right font-medium">{t("sc_worth", lang)}</th>
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
                        required={!readOnlyReasons}
                        readOnly={readOnlyReasons}
                        minLength={5}
                        maxLength={255}
                        defaultValue={l.reason ?? ""}
                        placeholder={t("sc_what_happened", lang)}
                        className="mt-1 w-full rounded-lg border border-surface-300 px-2 py-1 text-xs read-only:bg-surface-50 dark:border-surface-700 dark:bg-surface-900 dark:read-only:bg-surface-800"
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
        {t("sc_post_note", lang)}
      </p>

      {canAct ? (
        <>
          <Feedback state={state} />
          <Submit
            label={canApprove ? t("sc_finish_review", lang) : t("sc_verify_review", lang)}
            variant={gaps.length > 0 ? "amber" : "brand"}
          />
        </>
      ) : (
        <p className="rounded-lg bg-surface-100 px-3 py-2 text-sm text-surface-600 dark:bg-surface-800 dark:text-surface-400">
          {status === "verified" ? t("sc_waiting_post", lang) : t("sc_waiting_verify", lang)}
        </p>
      )}
    </form>
  );
}
