"use client";
import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import Link from "next/link";
import { verifyAdvanceClaim, type ActionState } from "@/actions/machinery-lifecycle";
import { useLang } from "@/lib/i18n/lang-context";
import { t } from "@/lib/i18n/translations";

const initialState: ActionState = {};

interface Claim {
  paymentId: string;
  bookingId: string;
  bookingNumber: string;
  farmerName: string;
  farmerPhone: string | null;
  amount: number;
  method: string;
  reference: string | null;
  proofUrl: string | null;
  claimedAt: string | null;
  daysOld: number | null;
}

export function ClaimsClient({
  claims,
  accounts,
}: {
  claims: Claim[];
  accounts: Array<{ id: string; name: string; account_type: string }>;
}) {
  const lang = useLang();

  if (claims.length === 0) {
    return (
      <p className="rounded-card border border-surface-200 bg-white px-3 py-8 text-center text-surface-400 dark:border-surface-800 dark:bg-surface-900">
        {t("ac_empty", lang)}
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {claims.map((c) => (
        <ClaimCard key={c.paymentId} claim={c} accounts={accounts} />
      ))}
    </div>
  );
}

function ClaimCard({
  claim,
  accounts,
}: {
  claim: Claim;
  accounts: Array<{ id: string; name: string; account_type: string }>;
}) {
  const lang = useLang();
  const [state, action] = useFormState(verifyAdvanceClaim, initialState);
  const [mode, setMode] = useState<"" | "accept" | "reject">("");

  return (
    <div className="rounded-card border border-surface-200 bg-white p-4 shadow-card dark:border-surface-800 dark:bg-surface-900">
      <div className="flex items-start justify-between gap-3">
        <div>
          <Link
            href={`/admin/machinery-rental/booking/${claim.bookingId}`}
            className="font-mono text-sm text-brand-600 hover:underline"
          >
            {claim.bookingNumber}
          </Link>
          <p className="font-medium text-surface-900 dark:text-surface-100">{claim.farmerName}</p>
          <p className="text-xs text-surface-500">
            {claim.farmerPhone ?? "—"} · {claim.method}
            {claim.reference ? ` · ${claim.reference}` : ""}
          </p>
          {/* Kitne din se para hai. Ye adad raqam se kam ahem nahi:
              teen hafte purana dawa ya to bhula diya gaya hai ya
              kisan ko jhoot lag raha hai ke us ka paisa gum ho gaya. */}
          {claim.daysOld !== null && claim.daysOld > 2 && (
            <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
              {claim.daysOld} {t("ac_days_waiting", lang)}
            </p>
          )}
          {claim.proofUrl && (
            <a
              href={claim.proofUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-medium text-brand-600 hover:underline"
            >
              {t("ac_view_proof", lang)}
            </a>
          )}
        </div>
        <p className="whitespace-nowrap font-display text-lg font-semibold text-surface-900 dark:text-white">
          Rs {claim.amount.toLocaleString()}
        </p>
      </div>

      {state.error && (
        <p className="mt-2 rounded border border-red-200 bg-red-50 p-2 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300">
          {state.error}
        </p>
      )}
      {state.success && (
        <p className="mt-2 rounded border border-brand-200 bg-brand-50 p-2 text-sm text-brand-700 dark:border-brand-900/40 dark:bg-brand-950/30 dark:text-brand-300">
          {t("ac_done", lang)}
        </p>
      )}

      {!state.success && (
        <>
          {mode === "" && (
            <div className="mt-3 flex gap-2">
              <button
                onClick={() => setMode("accept")}
                className="flex-1 rounded-lg bg-brand-600 py-2 text-sm font-medium text-white hover:bg-brand-700"
              >
                {t("ac_accept", lang)}
              </button>
              <button
                onClick={() => setMode("reject")}
                className="flex-1 rounded-lg border border-surface-200 py-2 text-sm font-medium text-surface-600 hover:bg-surface-50 dark:border-surface-700"
              >
                {t("ac_reject", lang)}
              </button>
            </div>
          )}

          {mode === "accept" && (
            <form action={action} className="mt-3 space-y-2">
              <input type="hidden" name="payment_id" value={claim.paymentId} />
              <input type="hidden" name="decision" value="accept" />
              <label className="block text-xs font-medium text-surface-600">{t("ac_which_account", lang)}</label>
              <select
                name="finance_account_id"
                required
                className="w-full rounded-lg border border-surface-200 p-2 text-sm dark:border-surface-700 dark:bg-surface-900"
              >
                <option value="">-</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
              <p className="text-xs text-surface-500">{t("ac_accept_hint", lang)}</p>
              <div className="flex gap-2">
                <Submit label={t("ac_confirm", lang)} />
                <button type="button" onClick={() => setMode("")} className="rounded-lg border border-surface-200 px-3 text-sm text-surface-500 dark:border-surface-700">
                  {t("ac_cancel", lang)}
                </button>
              </div>
            </form>
          )}

          {mode === "reject" && (
            <form action={action} className="mt-3 space-y-2">
              <input type="hidden" name="payment_id" value={claim.paymentId} />
              <input type="hidden" name="decision" value="reject" />
              <label className="block text-xs font-medium text-surface-600">{t("ac_reject_reason", lang)}</label>
              <input
                name="rejection_reason"
                required
                className="w-full rounded-lg border border-surface-200 p-2 text-sm dark:border-surface-700 dark:bg-surface-900"
                placeholder={t("ac_reject_reason_hint", lang)}
              />
              <div className="flex gap-2">
                <Submit label={t("ac_confirm_reject", lang)} />
                <button type="button" onClick={() => setMode("")} className="rounded-lg border border-surface-200 px-3 text-sm text-surface-500 dark:border-surface-700">
                  {t("ac_cancel", lang)}
                </button>
              </div>
            </form>
          )}
        </>
      )}
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
