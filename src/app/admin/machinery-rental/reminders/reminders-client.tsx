"use client";
import Link from "next/link";
import { useFormState, useFormStatus } from "react-dom";
import { sendPaymentReminderNow } from "@/actions/machinery-lifecycle";
import type { ActionState } from "@/actions/machinery-lifecycle";
import { t } from "@/lib/i18n/translations";
import { useLang } from "@/lib/i18n/lang-context";
import { Send, Check, AlertTriangle } from "lucide-react";

const initialState: ActionState = {};

interface DueRow {
  bookingId: string;
  bookingNumber: string;
  farmerId: string | null;
  farmerName: string;
  phone: string | null;
  village: string | null;
  outstanding: number;
  promiseDate: string | null;
  promiseArrived: boolean;
  lastReminder: string | null;
  reminderCount: number;
  lastStatus: string | null;
}

interface SentRow {
  id: string;
  bookingId: string;
  bookingNumber: string;
  farmerName: string;
  phone: string | null;
  amount: number;
  status: string;
  error: string | null;
  sentAt: string;
  bySystem: boolean;
}

export function RemindersClient({ due, sent }: { due: DueRow[]; sent: SentRow[] }) {
  const lang = useLang();

  // Jin ka wada aa chuka hai wo pehle. Baqi neeche -- un par abhi
  // maangna nahi banta, magar nazar mein rehna chahiye.
  const aaj = due.filter((d) => d.promiseArrived);
  const baad = due.filter((d) => !d.promiseArrived);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <Tile label={t("mr_due_today", lang)} value={String(aaj.length)} tone="red" />
        <Tile
          label={t("mc_outstanding", lang)}
          value={`Rs ${due.reduce((s, d) => s + d.outstanding, 0).toLocaleString()}`}
          tone="amber"
        />
        <Tile label={t("mr_sent_recent", lang)} value={String(sent.length)} />
      </div>

      <Section title={t("mr_due_today", lang)} hint={t("mr_due_today_hint", lang)} rows={aaj} />
      {baad.length > 0 && <Section title={t("mr_later", lang)} hint={t("mr_later_hint", lang)} rows={baad} />}

      <div className="overflow-hidden rounded-card border border-surface-200 bg-white shadow-card dark:border-surface-800 dark:bg-surface-900">
        <div className="border-b border-surface-200 px-4 py-3 dark:border-surface-800">
          <h2 className="font-display text-base font-semibold text-surface-900 dark:text-white">
            {t("mr_log_title", lang)}
          </h2>
          <p className="text-xs text-surface-500">{t("mr_log_hint", lang)}</p>
        </div>
        {sent.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-surface-400">{t("mr_log_empty", lang)}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-xs">
              <tbody>
                {sent.map((r) => (
                  <tr key={r.id} className="border-b border-surface-100 last:border-0 dark:border-surface-800">
                    <td className="px-3 py-2 whitespace-nowrap text-surface-500">
                      {new Date(r.sentAt).toLocaleString()}
                    </td>
                    <td className="px-3 py-2">
                      <Link
                        href={`/admin/machinery-rental/booking/${r.bookingId}`}
                        className="font-medium text-surface-800 hover:underline dark:text-surface-200"
                      >
                        {r.farmerName}
                      </Link>
                      <p className="text-surface-400">
                        {r.bookingNumber}
                        {r.phone ? ` · ${r.phone}` : ""}
                      </p>
                    </td>
                    <td className="px-3 py-2 text-right text-surface-600 dark:text-surface-400">
                      Rs {r.amount.toLocaleString()}
                    </td>
                    <td className="px-3 py-2">
                      {r.status === "sent" ? (
                        <span className="inline-flex items-center gap-1 text-brand-700 dark:text-brand-300">
                          <Check className="h-3.5 w-3.5" /> {t("mr_status_sent", lang)}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-red-600 dark:text-red-400">
                          <AlertTriangle className="h-3.5 w-3.5" /> {t("mr_status_failed", lang)}
                          {r.error && <span className="text-surface-400"> — {r.error}</span>}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right text-surface-400">
                      {r.bySystem ? t("mr_by_system", lang) : t("mr_by_staff", lang)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function Section({ title, hint, rows }: { title: string; hint: string; rows: DueRow[] }) {
  const lang = useLang();
  return (
    <div className="overflow-hidden rounded-card border border-surface-200 bg-white shadow-card dark:border-surface-800 dark:bg-surface-900">
      <div className="border-b border-surface-200 px-4 py-3 dark:border-surface-800">
        <h2 className="font-display text-base font-semibold text-surface-900 dark:text-white">{title}</h2>
        <p className="text-xs text-surface-500">{hint}</p>
      </div>
      {rows.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-surface-400">{t("mr_none", lang)}</p>
      ) : (
        <div className="divide-y divide-surface-100 dark:divide-surface-800">
          {rows.map((r) => (
            <DueLine key={r.bookingId} row={r} />
          ))}
        </div>
      )}
    </div>
  );
}

function DueLine({ row }: { row: DueRow }) {
  const lang = useLang();
  const [state, action] = useFormState(sendPaymentReminderNow, initialState);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
      <div className="min-w-[180px]">
        <Link
          href={`/admin/machinery-rental/booking/${row.bookingId}`}
          className="font-medium text-surface-800 hover:underline dark:text-surface-200"
        >
          {row.farmerName}
        </Link>
        <p className="text-xs text-surface-400">
          {row.bookingNumber}
          {row.village ? ` · ${row.village}` : ""}
          {row.phone ? ` · ${row.phone}` : ` · ${t("mr_no_phone", lang)}`}
        </p>
      </div>

      <div className="text-sm">
        <p className="font-semibold text-red-600 dark:text-red-400">Rs {row.outstanding.toLocaleString()}</p>
        {row.promiseDate && (
          <p className="text-xs text-surface-500">
            {t("mc_promise_recorded", lang)}: {new Date(row.promiseDate).toLocaleDateString()}
          </p>
        )}
      </div>

      {/* Kitni dafa aur kab -- ye button ke bilkul saath hai, jaan
          boojh kar. Jo banda bhejne ja raha hai usay usi lamhe pata
          hona chahiye ke paighaam pehle bhi ja chuka hai. */}
      <div className="text-xs text-surface-500">
        {row.reminderCount > 0 ? (
          <>
            <p>
              {t("mr_sent_times", lang).replace("{n}", String(row.reminderCount))}
              {row.lastStatus === "failed" && (
                <span className="text-red-600 dark:text-red-400"> — {t("mr_status_failed", lang)}</span>
              )}
            </p>
            {row.lastReminder && <p className="text-surface-400">{new Date(row.lastReminder).toLocaleString()}</p>}
          </>
        ) : (
          <p className="text-surface-400">{t("mr_never_sent", lang)}</p>
        )}
      </div>

      <form action={action}>
        <input type="hidden" name="booking_id" value={row.bookingId} />
        <SendButton />
        {state.error && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{state.error}</p>}
        {state.success && <p className="mt-1 text-xs text-brand-600 dark:text-brand-400">{state.notice}</p>}
      </form>
    </div>
  );
}

function SendButton() {
  const lang = useLang();
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-2 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-60"
    >
      <Send className="h-3.5 w-3.5" />
      {pending ? "…" : t("mr_send_now", lang)}
    </button>
  );
}

function Tile({ label, value, tone }: { label: string; value: string; tone?: "red" | "amber" }) {
  const colour =
    tone === "red"
      ? "text-red-600 dark:text-red-400"
      : tone === "amber"
        ? "text-amber-700 dark:text-amber-300"
        : "text-surface-900 dark:text-white";
  return (
    <div className="rounded-card border border-surface-200 bg-white p-3 shadow-card dark:border-surface-800 dark:bg-surface-900">
      <p className="text-xs text-surface-500">{label}</p>
      <p className={`mt-1 font-display text-lg font-semibold ${colour}`}>{value}</p>
    </div>
  );
}
