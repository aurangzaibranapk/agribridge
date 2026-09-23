"use client";
import { useFormState, useFormStatus } from "react-dom";
import { CheckCircle2, AlertTriangle, Printer, Clock, ArrowLeft, Truck } from "lucide-react";
import { receiveCash, carrierConfirm, type ActionState } from "@/actions/cash-handover";
import Link from "next/link";
import { useState } from "react";

const INIT: ActionState = {};

function rs(n: number): string {
  return `Rs ${Math.round(n).toLocaleString()}`;
}

function ConfirmBtn({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-xl bg-brand-600 px-4 py-3 text-sm font-semibold text-white shadow hover:bg-brand-700 disabled:opacity-50"
    >
      {pending ? "Tasdeeq ho rahi hai..." : label}
    </button>
  );
}

function ReceiveButton({ blocked }: { blocked: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending || blocked}
      className="w-full rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white shadow hover:bg-emerald-700 disabled:opacity-50"
    >
      {pending ? "Tasdeeq ho rahi hai..." : "✓ Main ne le liya — Digital Signature"}
    </button>
  );
}

function SigBlock({ name, date, label }: { name: string; date: string; label: string }) {
  return (
    <div className="rounded-xl border-2 border-dashed border-emerald-400 bg-emerald-50/50 p-3 dark:border-emerald-700 dark:bg-emerald-950/20">
      <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
        {label}
      </p>
      <p className="text-sm font-bold text-emerald-900 dark:text-emerald-300">{name}</p>
      <p className="text-xs text-emerald-700 dark:text-emerald-500">{date} par tasdeeq ki</p>
    </div>
  );
}

export function SlipClient({
  handover,
  isRecipient,
  isCarrier,
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
    carrierName: string | null;
    carrierConfirmedAt: string | null;
    carrierConfirmedByName: string | null;
  };
  isRecipient: boolean;
  isCarrier: boolean;
  viewerName: string;
}) {
  const [carrierState, carrierAction] = useFormState(carrierConfirm, INIT);
  const [receiveState, receiveAction] = useFormState(receiveCash, INIT);
  const [received, setReceived] = useState(String(handover.amountSent));
  const [reason, setReason] = useState("");

  const got = Number(received);
  const entered = received.trim() !== "" && Number.isFinite(got) && got >= 0;
  const diff = entered ? Math.round((got - handover.amountSent) * 100) / 100 : 0;
  const needsReason = entered && diff !== 0 && reason.trim().length < 5;

  const isPending = handover.status === "sent";
  const isDone = handover.status === "received" || handover.status === "short";

  const fmt = (d: string) =>
    new Date(d).toLocaleString("en-PK", { dateStyle: "medium", timeStyle: "short" });

  const borderColor = isDone
    ? "border-emerald-200 dark:border-emerald-800"
    : "border-amber-200 dark:border-amber-800";
  const bgColor = isDone
    ? "bg-emerald-50 dark:bg-emerald-950/20"
    : "bg-amber-50 dark:bg-amber-950/20";

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
      <div className={`rounded-2xl border-2 p-6 ${borderColor} ${bgColor}`}>
        {/* Header */}
        <div className="mb-5 border-b border-dashed border-surface-300 pb-4 dark:border-surface-600">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-surface-400">Cash Handover Slip</p>
          <p className="mt-0.5 font-mono text-xs text-surface-500">#{handover.id.slice(0, 8).toUpperCase()}</p>
          <div className="mt-3 text-4xl font-bold tabular-nums text-surface-900 dark:text-white">
            {rs(handover.amountSent)}
          </div>
          <p className="mt-1 text-xs text-surface-500">{handover.sentAt ? fmt(handover.sentAt) : "—"}</p>
        </div>

        {/* Parties */}
        <div className="mb-4 grid grid-cols-2 gap-4">
          <div>
            <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wider text-surface-400">Bhejne wala</p>
            <p className="text-sm font-semibold text-surface-900 dark:text-white">{handover.senderName}</p>
            <p className="text-xs capitalize text-surface-500">{handover.senderRole}</p>
          </div>
          <div>
            <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wider text-surface-400">Pane wala</p>
            <p className="text-sm font-semibold text-surface-900 dark:text-white">{handover.recipientName}</p>
            <p className="text-xs capitalize text-surface-500">{handover.recipientRole}</p>
          </div>
        </div>

        {/* Carrier */}
        {handover.carrierName && (
          <div className="mb-4">
            <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wider text-surface-400">
              Carrier (le jane wala)
            </p>
            <p className="flex items-center gap-1.5 text-sm font-semibold text-surface-900 dark:text-white">
              <Truck className="h-4 w-4 text-surface-400" /> {handover.carrierName}
            </p>
          </div>
        )}

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
          {isPending && !handover.carrierConfirmedAt && (
            <p className="flex items-center gap-1.5 text-sm font-semibold text-amber-800 dark:text-amber-400">
              <Clock className="h-4 w-4" /> Bheja gaya — {handover.carrierName ? "carrier ki tasdeeq baqi" : "tasdeeq baqi"}
            </p>
          )}
          {isPending && handover.carrierConfirmedAt && (
            <p className="flex items-center gap-1.5 text-sm font-semibold text-blue-800 dark:text-blue-400">
              <Truck className="h-4 w-4" /> Carrier ne le liya — Finance ki tasdeeq baqi
            </p>
          )}
          {isDone && (
            <p className={`flex items-center gap-1.5 text-sm font-semibold ${handover.status === "received" ? "text-emerald-800 dark:text-emerald-400" : "text-red-800 dark:text-red-400"}`}>
              <CheckCircle2 className="h-4 w-4" />
              {handover.status === "received"
                ? `${rs(handover.amountReceived!)} mile — hisaab barabar`
                : `${rs(handover.amountReceived!)} mile — ${rs(Math.abs(handover.difference!))} ${handover.difference! < 0 ? "kam" : "zyada"}`}
            </p>
          )}
          {handover.differenceReason && (
            <p className="mt-0.5 text-xs text-surface-500">{handover.differenceReason}</p>
          )}
        </div>

        {/* Signatures */}
        <div className="space-y-2">
          {handover.carrierConfirmedAt && handover.carrierConfirmedByName && (
            <SigBlock
              label="Carrier — Digital Signature"
              name={handover.carrierConfirmedByName}
              date={fmt(handover.carrierConfirmedAt)}
            />
          )}
          {handover.receivedByName && handover.receivedAt && (
            <SigBlock
              label="Finance / Pane wala — Digital Signature"
              name={handover.receivedByName}
              date={fmt(handover.receivedAt)}
            />
          )}
        </div>
      </div>

      {/* Carrier confirm form */}
      {isCarrier && isPending && !handover.carrierConfirmedAt && !carrierState.success && (
        <div className="mt-6 print:hidden">
          <form action={carrierAction} className="rounded-2xl border border-surface-200 bg-white p-4 shadow-sm dark:border-surface-700 dark:bg-surface-900">
            <input type="hidden" name="handover_id" value={handover.id} />
            <p className="mb-3 text-sm font-semibold text-surface-900 dark:text-white">
              Aap ne {rs(handover.amountSent)} receive kiya?
            </p>
            <ConfirmBtn label="✓ Main ne le liya — Finance ko pohoncha deta hoon" />
            <p className="mt-2 text-center text-[11px] text-surface-400">
              Aap ka naam ({viewerName}) aur waqt automatic darj hoga — ye aap ki digital signature hai.
            </p>
          </form>
          {carrierState.error && (
            <p className="mt-2 rounded-xl bg-red-50 px-4 py-2 text-xs text-red-700">{carrierState.error}</p>
          )}
        </div>
      )}

      {carrierState.success && (
        <div className="mt-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-400 print:hidden">
          <CheckCircle2 className="mb-1 h-5 w-5" /> {carrierState.message}
        </div>
      )}

      {/* Finance receive form */}
      {isRecipient && isPending && !receiveState.success && (
        <div className="mt-6 print:hidden">
          <h2 className="mb-3 text-sm font-semibold text-surface-900 dark:text-white">Raqam tasdeeq karein (Finance)</h2>
          <form action={receiveAction} className="space-y-3 rounded-2xl border border-surface-200 bg-white p-4 shadow-sm dark:border-surface-700 dark:bg-surface-900">
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
            {receiveState.error && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{receiveState.error}</p>
            )}
            <ReceiveButton blocked={!entered || needsReason} />
            <p className="text-center text-[11px] text-surface-400">
              Aap ka naam ({viewerName}) aur waqt automatic darj hoga — ye aap ki digital signature hai.
            </p>
          </form>
        </div>
      )}

      {receiveState.success && (
        <div className="mt-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-400 print:hidden">
          <CheckCircle2 className="mb-1 h-5 w-5" />
          {receiveState.message}
          <p className="mt-1 text-xs text-emerald-600">Page refresh karein slip mein signature dekhne ke liye.</p>
        </div>
      )}
    </div>
  );
}
