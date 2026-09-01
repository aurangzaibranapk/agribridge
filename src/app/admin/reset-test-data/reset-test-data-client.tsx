"use client";
import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { resetTestData, lockLiveMode, type ActionState } from "@/actions/reset-test-data";
import { AlertTriangle, Trash2, Lock, ShieldCheck } from "lucide-react";
import { t } from "@/lib/i18n/translations";
import { useLang } from "@/lib/i18n/lang-context";

const initialState: ActionState = {};

export function ResetTestDataClient({ isLive }: { isLive: boolean }) {
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const lang = useLang();
  const [showLockConfirm, setShowLockConfirm] = useState(false);

  if (isLive) {
    return (
      <div className="rounded-card border border-green-200 bg-green-50 p-6 text-center dark:border-green-900/40 dark:bg-green-950/30">
        <ShieldCheck className="mx-auto mb-3 h-10 w-10 text-green-600" />
        <h2 className="font-display text-lg font-semibold text-green-800 dark:text-green-300">{t("rt_system_live", lang)}</h2>
        <p className="mt-1 text-sm text-green-700 dark:text-green-400">
          "Hum LIVE Hain" lock lag chuka hai. Reset Test Data hamesha ke liye band ho chuka hai — real data 100% mehfooz hai.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-xl space-y-6">
      <div className="rounded-card border border-red-200 bg-red-50 p-5 dark:border-red-900/40 dark:bg-red-950/30">
        <h2 className="flex items-center gap-2 font-display text-base font-semibold text-red-800 dark:text-red-300">
          <Trash2 className="h-5 w-5" />{t("rt_delete_test", lang)}</h2>
        <p className="mt-2 text-sm text-red-700 dark:text-red-400">
          Ye poori Orders, Sales, Purchases, Farmers, Dealers, Suppliers, Investors, Finance, Milk, Grain,
          Machinery, HR records, Stock/Inventory quantities aur Logs — sab <strong>{t("rt_will_delete_forever", lang)}</strong>{t("rt_will_do", lang)}</p>
        <p className="mt-2 text-sm font-medium text-red-800 dark:text-red-300">{t("rt_survives", lang)}</p>
        {!showResetConfirm ? (
          <button
            onClick={() => setShowResetConfirm(true)}
            className="mt-4 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
          >{t("rt_delete_test", lang)}</button>
        ) : (
          <ResetForm onCancel={() => setShowResetConfirm(false)} />
        )}
      </div>

      <div className="rounded-card border border-amber-200 bg-amber-50 p-5 dark:border-amber-900/40 dark:bg-amber-950/30">
        <h2 className="flex items-center gap-2 font-display text-base font-semibold text-amber-800 dark:text-amber-300">
          <Lock className="h-5 w-5" />{t("rt_permanent_lock", lang)}</h2>
        <p className="mt-2 text-sm text-amber-700 dark:text-amber-400">
          Jab aap testing mukammal kar lein aur real business shuru ho jaye, ye button dabayein.
          Iske baad "Reset Test Data" <strong>{t("rt_will_close_forever", lang)}</strong> — koi bhi dobara chala nahi sakega,
          taake real data kabhi bhool se delete na ho.
        </p>
        {!showLockConfirm ? (
          <button
            onClick={() => setShowLockConfirm(true)}
            className="mt-4 rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700"
          >{t("rt_we_are_live_lock", lang)}</button>
        ) : (
          <LockForm onCancel={() => setShowLockConfirm(false)} />
        )}
      </div>
    </div>
  );
}

function ResetForm({ onCancel }: { onCancel: () => void }) {
  const [state, formAction] = useFormState(resetTestData, initialState);
  const lang = useLang();

  if (state.success) {
    return (
      <div className="mt-4 rounded-lg bg-green-100 px-3 py-2 text-sm text-green-800">
        <p className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4" />{t("rt_deleted", lang)}</p>
        {/* Ginti sath likhi jati hai. "Ho gaya" par bharosa karne ke
            bajaye banda khud dekh leta hai ke waqai kya gaya -- pehle
            machinery aur ledger chup chaap reh jate the. */}
        {state.notice && <p className="mt-1 text-xs text-green-700">{state.notice}</p>}
      </div>
    );
  }

  return (
    <form action={formAction} className="mt-4 space-y-2">
      {state.error && <p className="rounded-lg bg-red-100 px-3 py-2 text-xs text-red-800">{state.error}</p>}
      <label className="block text-xs font-medium text-red-700">{t("rt_type_exactly", lang)}<strong>{t("at_delete_test_data", lang)}</strong>{t("rt_type_word", lang)}</label>
      <input name="confirm_text" required placeholder={t("at_delete_test_data", lang)} className="w-full rounded-lg border border-red-300 p-2 text-sm" />
      <div className="flex gap-2">
        <SubmitButton label={t("rt_yes_delete_all", lang)} />
        <button type="button" onClick={onCancel} className="rounded-lg border border-surface-200 px-3 py-2 text-sm text-surface-600 hover:bg-surface-50">{t("c_cancel", lang)}</button>
      </div>
    </form>
  );
}

function LockForm({ onCancel }: { onCancel: () => void }) {
  const [state, formAction] = useFormState(lockLiveMode, initialState);
  const lang = useLang();

  if (state.success) {
    return (
      <div className="mt-4 flex items-center gap-2 rounded-lg bg-green-100 px-3 py-2 text-sm text-green-800">
        <ShieldCheck className="h-4 w-4" />{t("rt_locked", lang)}</div>
    );
  }

  return (
    <form action={formAction} className="mt-4 space-y-2">
      {state.error && <p className="rounded-lg bg-red-100 px-3 py-2 text-xs text-red-800">{state.error}</p>}
      <label className="block text-xs font-medium text-amber-700">{t("rt_type_exactly", lang)}<strong>{t("at_we_are_live", lang)}</strong>{t("rt_type_word", lang)}</label>
      <input name="confirm_text" required placeholder={t("at_we_are_live", lang)} className="w-full rounded-lg border border-amber-300 p-2 text-sm" />
      <div className="flex gap-2">
        <SubmitButton label={t("rt_yes_lock_forever", lang)} />
        <button type="button" onClick={onCancel} className="rounded-lg border border-surface-200 px-3 py-2 text-sm text-surface-600 hover:bg-surface-50">{t("c_cancel", lang)}</button>
      </div>
    </form>
  );
}

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60">
      {pending ? "..." : label}
    </button>
  );
}