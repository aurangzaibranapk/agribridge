"use client";
import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { recordVendorCashHandover, type ActionState } from "@/actions/machinery-lifecycle";
import { useLang } from "@/lib/i18n/lang-context";
import { t } from "@/lib/i18n/translations";

const initialState: ActionState = {};

interface VendorRow {
  vendorId: string;
  vendorName: string;
  phone: string | null;
  holding: number;
  oldest: string | null;
  count: number;
}

export function VendorCashClient({
  vendors,
  accounts,
}: {
  vendors: VendorRow[];
  accounts: Array<{ id: string; name: string; account_type: string }>;
}) {
  const lang = useLang();
  if (vendors.length === 0) {
    return (
      <p className="rounded-card border border-surface-200 bg-white px-3 py-8 text-center text-surface-400 dark:border-surface-800 dark:bg-surface-900">
        {t("vc_empty", lang)}
      </p>
    );
  }
  return (
    <div className="space-y-3">
      {vendors.map((v) => (
        <VendorCard key={v.vendorId} vendor={v} accounts={accounts} />
      ))}
    </div>
  );
}

function VendorCard({
  vendor,
  accounts,
}: {
  vendor: VendorRow;
  accounts: Array<{ id: string; name: string; account_type: string }>;
}) {
  const lang = useLang();
  const [state, action] = useFormState(recordVendorCashHandover, initialState);
  const [open, setOpen] = useState(false);

  const daysOld = vendor.oldest
    ? Math.floor((Date.now() - new Date(vendor.oldest).getTime()) / 86400000)
    : null;

  return (
    <div className="rounded-card border border-surface-200 bg-white p-4 shadow-card dark:border-surface-800 dark:bg-surface-900">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-medium text-surface-900 dark:text-surface-100">{vendor.vendorName}</p>
          <p className="text-xs text-surface-500">
            {vendor.phone ?? "—"} · {vendor.count} {t("vc_payments", lang)}
          </p>
          {/* Kitne din se para hai -- raqam se kam ahem nahi. Teen hafte
              purana paisa aksar wo hota hai jo koi maangna bhool gaya. */}
          {daysOld !== null && daysOld > 3 && (
            <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
              {daysOld} {t("vc_days_old", lang)}
            </p>
          )}
        </div>
        <p className="whitespace-nowrap font-display text-lg font-semibold text-surface-900 dark:text-white">
          Rs {vendor.holding.toLocaleString()}
        </p>
      </div>

      {state.error && (
        <p className="mt-2 rounded border border-red-200 bg-red-50 p-2 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300">
          {state.error}
        </p>
      )}
      {state.notice && (
        <p className="mt-2 rounded border border-brand-200 bg-brand-50 p-2 text-sm text-brand-700 dark:border-brand-900/40 dark:bg-brand-950/30 dark:text-brand-300">
          {state.notice}
        </p>
      )}

      {!state.success &&
        (!open ? (
          <button
            onClick={() => setOpen(true)}
            className="mt-3 rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700"
          >
            {t("vc_received", lang)}
          </button>
        ) : (
          <form action={action} className="mt-3 space-y-2">
            <input type="hidden" name="vendor_id" value={vendor.vendorId} />
            <div className="grid grid-cols-2 gap-2">
              <input
                type="number"
                step="0.01"
                name="amount"
                defaultValue={vendor.holding}
                className="rounded-lg border border-surface-200 p-2 text-sm dark:border-surface-700 dark:bg-surface-900"
              />
              <select
                name="finance_account_id"
                required
                className="rounded-lg border border-surface-200 p-2 text-sm dark:border-surface-700 dark:bg-surface-900"
              >
                <option value="">{t("ac_which_account", lang)}</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </div>
            <input
              type="date"
              name="received_date"
              defaultValue={new Date().toISOString().slice(0, 10)}
              className="w-full rounded-lg border border-surface-200 p-2 text-sm dark:border-surface-700 dark:bg-surface-900"
            />
            <div className="flex gap-2">
              <Submit label={t("ac_confirm", lang)} />
              <button type="button" onClick={() => setOpen(false)} className="rounded-lg border border-surface-200 px-3 text-sm text-surface-500 dark:border-surface-700">
                {t("ac_cancel", lang)}
              </button>
            </div>
          </form>
        ))}
    </div>
  );
}

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="flex-1 rounded-lg bg-brand-600 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
    >
      {pending ? "..." : label}
    </button>
  );
}
