"use client";
import { useFormState, useFormStatus } from "react-dom";
import { CheckCircle2, AlertTriangle, Printer, Clock, ArrowLeft } from "lucide-react";
import { receiveCash, type ActionState } from "@/actions/cash-handover";
import Link from "next/link";
import { useState } from "react";

const INIT: ActionState = {};

function rs(n: number): string {
  return `Rs ${Math.round(n).toLocaleString()}`;
}

function ReceiveButton({ blocked }: { blocked: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending || blocked}
      className="w-full rounded-xl bg-brand-600 px-4 py-3 text-sm font-semibold text-white shadow hover:bg-brand-700 disabled:opacity-50"
    >
      {pending ? "Tasdeeq ho rahi hai..." : "✓ Main ne le liya — Tasdeeq karta hoon"}
    </button>
  );
}

export function SlipClient({
  handover,
  isRecipient,
  viewerName,
}: {
  handover: {
    id: string;
    amountSent: number;
    amountReceived: number | null;
    difference: number | null;
    differenceReason: string | null;
    status: string;
    sentNote: string | null;
    sentAt: string | null;
    receivedAt: string | null;
    senderName: string;
    senderRole: string;
    recipientName: string;
    recipientRole: string;
    receivedByName: string | null;
  };
  isRecipient: boolean;
  viewerName: string;
}) {
  const [state, action] = useFormState(receiveCash, INIT);
  const [received, setReceived] = useState(String(handover.amountSent));
  const [reason, setReason] = useState("");

  const got = Number(received);
  const entered = received.trim() !== "" && Number.isFinite(got) && got >= 0;
  const diff = entered ? Math.round((got - handover.amountSent) * 100) / 100 : 0;
  const needsReason = entered && diff !== 0 && reason.trim().length < 5;

  const statusColor =
    handover.status === "received"
      ? "bg-emerald-50 border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-800"
      : handover.status === "short"
        ? "bg-red-50 border-red-200 dark:bg-red-950/20 dark:border-red-800"
        : "bg-amber-50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-800";

  const sentDate = handover.sentAt
    ? new Date(handover.sentAt).toLocaleString("en-PK", { dateStyle: "medium", timeStyle: "short" })
    : "—";
  const receivedDate = handover.receivedAt
    ? new Date(handover.receivedAt).toLocaleString("en-PK", { dateStyle: "medium", timeStyle: "short" })
    : null;

  return (
    <div className="mx-auto max-w-lg px-4 py-6 print:py-2">
      {/* Nav */}
      <div className="mb-4 flex items-center justify-between print:hidden">
        <Link href="/admin/cash-handover" className="flex items-center gap-1.5 text-xs text-surface-500 hover:text-surface-800">
          <ArrowLeft className="h-3.5 w-3.5" /> Cash Handover
        </Link>
        <button
          onClick={() => window.print()}
          className="flex items-center gap-1.5 rounded-lg border border-surface-200 px-3 py-1.5 text-xs text-surface-600 hover:bg-surface-50 dark:border-surface-700 dark:text-surface-400"
        >
          <Printer className="h-3.5 w-3.5" /> Print
        </button>
      </div>

      {/* Slip */}
      <div className={`rounded-2xl border-2 p-6 ${statusColor}`}>
        {/* Header */}
        <div className="mb-5 border-b border-dashed border-surface-300 pb-4 dark:border-surface-600">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-surface-400">Cash Handover Slip</p>
          <p className="mt-0.5 font-mono text-xs text-surface-500">#{handover.id.slice(0, 8).toUpperCase()}</p>
          <div className="mt-3 text-4xl font-bold tabular-nums text-surface-900 dark:text-white">
            {rs(handover.amountSent)}
          </div>
          <p className="mt-1 text-xs text-surface-500">{sentDate}</p>
        </div>

        {/* Parties */}
        <div className="mb-4 grid grid-cols-2 gap-4">
          <div>
            <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wider text-surface-400">Bhejne wala</p>
            <p className="text-sm font-semibold text-surface-900 dark:text-white">{handover.senderName}</p>
            <p className="text-xs capitalize text-surface-500">{handover.senderRole}</p>
          </div>
          <div>
            <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wider text-surface-400">Lene wala</p>
            <p className="text-sm font-semibold text-surface-900 dark:text-white">{handover.recipientName}</p>
            <p className="text-xs capitalize text-surface-500">{handover.recipientRole}</p>
          </div>
        </div>

        {/* Note */}
        {handover.sentNote && (
          <div className="mb-4">
            <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wider text-surface-400">Tareeqa / Note</p>
            <p className="text-sm text-surface-700 dark:text-surface-300">{handover.sentNote}</p>
          </div>
        )}

        {/* Status */}
        <div className="mb-4 rounded-xl bg-white/70 p-3 dark:bg-surface-900/50">
          <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wider text-surface-400">Status</p>
          {handover.status === "sent" && (
            <p className="flex items-center gap-1.5 text-sm font-semibold text-amber-800 dark:text-amber-400">
              <Clock className="h-4 w-4" /> Raaste mein — tasdeeq baqi
            </p>
          )}
          {(handover.status === "received" || handover.status === "short") && (
            <div>
              <p className={`flex items-center gap-1.5 text-sm font-semibold ${handover.status === "received" ? "text-emerald-800 dark:text-emerald-400" : "text-red-800 dark:text-red-400"}`}>
                <CheckCircle2 className="h-4 w-4" />
                {handover.status === "received"
                  ? `${rs(handover.amountReceived!)} mile — hisaab barabar`
                  : `${rs(handover.amountReceived!)} mile — ${rs(Math.abs(handover.difference!))} ${handover.difference! < 0 ? "kam" : "zyada"}`}
              </p>
              {handover.differenceReason && (
                <p className="mt-0.5 text-xs text-surface-500">{handover.differenceReason}</p>
              )}
            </div>
          )}
        </div>

        {/* Digital Signature */}
        {receivedDate && handover.receivedByName && (
          <div className="rounded-xl border-2 border-dashed border-emerald-400 bg-emerald-50/50 p-3 dark:border-emerald-700 dark:bg-emerald-950/20">
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">Digital Signature</p>
            <p className="text-sm font-bold text-emerald-900 dark:text-emerald-300">{handover.receivedByName}</p>
            <p className="text-xs text-emerald-700 dark:text-emerald-500">{receivedDate} par tasdeeq ki</p>
          </div>
        )}
      </div>

      {/* Receive form — sirf recipient ke liye, agar abhi pending ho */}
      {isRecipient && handover.status === "sent" && !state.success && (
        <div className="mt-6 print:hidden">
          <h2 className="mb-3 text-sm font-semibold text-surface-900 dark:text-white">Raqam tasdeeq karein</h2>
          <form action={action} className="space-y-3 rounded-2xl border border-surface-200 bg-white p-4 shadow-sm dark:border-surface-700 dark:bg-surface-900">
            <input type="hidden" name="handover_id" value={handover.id} />
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-surface-600 dark:text-surface-400">
                Kitni raqam mili? (Rs)
              </span>
              <input
                name="amount_received"
                type="number"
                min={0}
                step="0.01"
                required
                value={received}
                onChange={(e) => setReceived(e.target.value)}
                className="w-full rounded-xl border border-surface-200 px-3 py-2.5 text-sm dark:border-surface-700 dark:bg-surface-900"
              />
            </label>
            {entered && diff !== 0 && (
              <>
                <p className="flex items-center gap-1.5 text-sm font-semibold text-red-700 dark:text-red-400">
                  <AlertTriangle className="h-4 w-4" />
                  {rs(Math.abs(diff))} {diff < 0 ? "kam" : "zyada"} mile
                </p>
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-surface-600 dark:text-surface-400">
                    Wajah <span className="text-red-600">*</span>
                  </span>
                  <input
                    name="difference_reason"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    maxLength={255}
                    className="w-full rounded-xl border border-surface-200 px-3 py-2.5 text-sm dark:border-surface-700 dark:bg-surface-900"
                  />
                </label>
              </>
            )}
            {entered && diff === 0 && (
              <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">✓ Poori raqam mil gayi</p>
            )}
            {state.error && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-950/30 dark:text-red-400">
                {state.error}
              </p>
            )}
            <ReceiveButton blocked={!entered || needsReason} />
            <p className="text-center text-[11px] text-surface-400">
              Aap ka naam ({viewerName}) aur waqt automatic darj ho jayega — ye aap ki digital signature hai.
            </p>
          </form>
        </div>
      )}

      {state.success && (
        <div className="mt-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-400 print:hidden">
          <CheckCircle2 className="mb-1 h-5 w-5" />
          {state.message}
          <p className="mt-1 text-xs text-emerald-600">Page refresh karein slip mein signature dekhne ke liye.</p>
        </div>
      )}
    </div>
  );
}
