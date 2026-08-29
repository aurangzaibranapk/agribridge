"use client";
import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { sendCash, receiveCash, type ActionState } from "@/actions/cash-handover";
import { AlertTriangle } from "lucide-react";
import { t } from "@/lib/i18n/translations";
import { useLang } from "@/lib/i18n/lang-context";

const initialState: ActionState = {};

function rs(v: number): string {
  return `Rs ${Math.round(v).toLocaleString()}`;
}

function Submit({ label, blocked }: { label: string; blocked?: boolean }) {
  const lang = useLang();
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending || blocked}
      className="w-full rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
    >
      {pending ? t("ch_waiting", lang) : label}
    </button>
  );
}

export function SendCashForm({
  people,
  branches,
}: {
  people: { id: string; name: string; role: string }[];
  branches: { id: string; name: string }[];
}) {
  const lang = useLang();
  const [state, formAction] = useFormState(sendCash, initialState);

  return (
    <form action={formAction} className="space-y-3">
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-surface-600 dark:text-surface-400">
          {t("ch_to_whom", lang)} <span className="text-red-600">{t("ch_required", lang)}</span>
        </span>
        <select
          name="to_profile_id"
          required
          className="w-full rounded-lg border border-surface-300 bg-white px-3 py-2 text-sm dark:border-surface-700 dark:bg-surface-900"
        >
          <option value="">{t("ch_pick", lang)}</option>
          {people.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} ({p.role})
            </option>
          ))}
        </select>
        <span className="mt-1 block text-xs text-surface-400">
          {t("ch_to_whom_note", lang)}
        </span>
      </label>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-surface-600 dark:text-surface-400">
            {t("ch_amount", lang)} <span className="text-red-600">{t("ch_required", lang)}</span>
          </span>
          <input
            name="amount"
            type="number"
            min={1}
            step="0.01"
            required
            inputMode="numeric"
            className="w-full rounded-lg border border-surface-300 px-3 py-2 text-sm dark:border-surface-700 dark:bg-surface-900"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-surface-600 dark:text-surface-400">
            {t("ch_where_going", lang)}
          </span>
          <select
            name="to_branch_id"
            className="w-full rounded-lg border border-surface-300 bg-white px-3 py-2 text-sm dark:border-surface-700 dark:bg-surface-900"
          >
            <option value="">{t("ch_unknown", lang)}</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="block">
        <span className="mb-1 block text-xs font-medium text-surface-600 dark:text-surface-400">
          {t("ch_who_carries", lang)}
        </span>
        <select
          name="carrier_profile_id"
          className="w-full rounded-lg border border-surface-300 bg-white px-3 py-2 text-sm dark:border-surface-700 dark:bg-surface-900"
        >
          <option value="">{t("ch_self_carry", lang)}</option>
          {people.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} ({p.role})
            </option>
          ))}
        </select>
        <span className="mt-1 block text-xs text-surface-400">
          {t("ch_carrier_note", lang)}
        </span>
      </label>

      <label className="block">
        <span className="mb-1 block text-xs font-medium text-surface-600 dark:text-surface-400">
          {t("ch_note_optional", lang)}
        </span>
        <input
          name="sent_note"
          maxLength={255}
          placeholder={t("ch_note_eg", lang)}
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

      <Submit label={t("ch_record_sent", lang)} />
    </form>
  );
}

export function ReceiveCard({
  handover,
}: {
  handover: {
    id: string;
    amount: number;
    sentBy: string | null;
    carrier: string | null;
    fromBranch: string | null;
    note: string | null;
    daysOld: number;
  };
}) {
  const lang = useLang();
  const [state, formAction] = useFormState(receiveCash, initialState);
  const [received, setReceived] = useState("");
  const [reason, setReason] = useState("");

  const got = Number(received);
  const entered = received.trim() !== "" && Number.isFinite(got);
  const difference = entered ? Math.round((got - handover.amount) * 100) / 100 : 0;
  const needsReason = entered && difference !== 0 && reason.trim().length < 5;

  return (
    <form
      action={formAction}
      className="rounded-card border border-brand-300 bg-brand-50/50 p-4 dark:border-brand-800 dark:bg-brand-950/20"
    >
      <input type="hidden" name="handover_id" value={handover.id} />

      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-display text-xl font-bold text-surface-900 dark:text-white">
            {rs(handover.amount)}
          </p>
          <p className="mt-0.5 text-xs text-surface-600 dark:text-surface-400">
            {handover.sentBy ?? "—"}
            {handover.fromBranch ? ` (${handover.fromBranch})` : ""} {t("ch_sent_by", lang)}
            {handover.carrier ? ` — ${handover.carrier} ${t("ch_brought_by", lang)}` : ""}
          </p>
          {handover.note && (
            <p className="mt-0.5 text-xs text-surface-500">{handover.note}</p>
          )}
        </div>
        {handover.daysOld >= 2 && (
          <span className="shrink-0 rounded-md bg-red-100 px-2 py-1 text-xs font-medium text-red-800 dark:bg-red-950/40 dark:text-red-400">
            {handover.daysOld} {t("ch_days_ago", lang)}
          </span>
        )}
      </div>

      <label className="mt-3 block">
        <span className="mb-1 block text-xs font-medium text-surface-600 dark:text-surface-400">
          {t("ch_how_much_got", lang)}
        </span>
        <input
          name="amount_received"
          type="number"
          min={0}
          step="0.01"
          required
          inputMode="numeric"
          value={received}
          onChange={(e) => setReceived(e.target.value)}
          className="w-full rounded-lg border border-surface-300 px-3 py-2 text-sm dark:border-surface-700 dark:bg-surface-900"
        />
      </label>

      {entered && difference !== 0 && (
        <>
          <p className="mt-2 flex items-start gap-1.5 text-sm font-semibold text-red-800 dark:text-red-400">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              {rs(Math.abs(difference))} {difference < 0 ? t("cc_short", lang) : t("cc_over", lang)} {t("ch_received_word", lang)}
            </span>
          </p>
          <label className="mt-2 block">
            <span className="mb-1 block text-xs font-medium text-surface-600 dark:text-surface-400">
              {t("ch_what_happened", lang)} <span className="text-red-600">{t("ch_required", lang)}</span>
            </span>
            <input
              name="difference_reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={255}
              placeholder={t("ch_unknown_reason_ph", lang)}
              className="w-full rounded-lg border border-surface-300 px-3 py-2 text-sm dark:border-surface-700 dark:bg-surface-900"
            />
          </label>
        </>
      )}

      {entered && difference === 0 && (
        <p className="mt-2 text-sm font-medium text-green-800 dark:text-green-400">
          {t("ch_all_matched", lang)}
        </p>
      )}

      {state.error && (
        <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-400">
          {state.error}
        </p>
      )}
      {state.success && (
        <p className="mt-2 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-800 dark:bg-green-950/30 dark:text-green-400">
          {state.message}
        </p>
      )}

      <div className="mt-3">
        <Submit label={t("ch_record_receipt", lang)} blocked={!entered || needsReason} />
      </div>
    </form>
  );
}
