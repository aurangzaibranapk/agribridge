"use client";
import { useFormState, useFormStatus } from "react-dom";
import { CheckCircle2, AlertTriangle, Printer, Clock, ArrowLeft, Truck } from "lucide-react";
import { receiveCash, carrierConfirm, type ActionState } from "@/actions/cash-handover";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ReceiptRow } from "@/components/pos/receipt-modal";
import { thermalReceiptCss } from "@/components/pos/thermal-receipt-print";

const PRINT_AREA_ID = "handover-receipt-print-area";

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
  header,
  autoPrint = false,
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
  /** POS receipt jaisa header -- Shop, Branch, POS counter, shift. */
  header?: {
    shopName: string | null;
    branchName: string | null;
    counterName: string | null;
    shiftNumbers: string[];
  };
  /** POS close ke baad khule to slip khud print ho (?print=1). */
  autoPrint?: boolean;
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

  // POS sale receipt wala date format.
  const receiptDate = (d: string) =>
    new Date(d).toLocaleString("en-PK", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  // POS close ke baad seedha print -- Shift slip wali tarah thori der ruk
  // kar, taake receipt poori render ho jaye.
  useEffect(() => {
    if (!autoPrint) return;
    const timer = window.setTimeout(() => window.print(), 450);
    return () => window.clearTimeout(timer);
  }, [autoPrint]);

  const shopTitle = header?.shopName ?? header?.branchName ?? "AgriBridge";
  const branchLine = header?.shopName ? header?.branchName : null;
  const statusText =
    isPending && !handover.carrierConfirmedAt
      ? `Bheja gaya — ${handover.carrierName ? "carrier ki tasdeeq baqi" : "tasdeeq baqi"}`
      : isPending && handover.carrierConfirmedAt
        ? "Carrier ne le liya — Finance ki tasdeeq baqi"
        : isDone
          ? handover.status === "received"
            ? `${rs(handover.amountReceived!)} mile — hisaab barabar`
            : `${rs(handover.amountReceived!)} mile — ${rs(Math.abs(handover.difference!))} ${handover.difference! < 0 ? "kam" : "zyada"}`
          : handover.status;

  const borderColor = isDone
    ? "border-emerald-200 dark:border-emerald-800"
    : "border-amber-200 dark:border-amber-800";
  const bgColor = isDone
    ? "bg-emerald-50 dark:bg-emerald-950/20"
    : "bg-amber-50 dark:bg-amber-950/20";

  return (
    <div className="mx-auto w-full max-w-sm px-3 py-6 print:p-0">
      <style>{thermalReceiptCss(PRINT_AREA_ID, { pageMode: true })}</style>

      {/* Nav */}
      <div className="mb-3 flex items-center justify-between print:hidden">
        <Link href="/admin/cash-handover" className="flex items-center gap-1.5 text-xs text-surface-500 hover:text-surface-800">
          <ArrowLeft className="h-3.5 w-3.5" /> Cash Handover
        </Link>
        <button
          onClick={() => window.print()}
          className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700"
        >
          <Printer className="h-3.5 w-3.5" /> Print
        </button>
      </div>

      {/* Slip -- POS sale receipt (receipt-modal.tsx) jaisi thermal slip */}
      <div
        id={PRINT_AREA_ID}
        className="w-full rounded-card bg-white p-5 font-mono text-black shadow-xl print:w-[74mm] print:max-w-[74mm] print:rounded-none print:p-[2mm] print:text-[13px] print:shadow-none"
      >
        <div className="receipt-watermark" aria-hidden="true">
          <img src="/branding/kisan-watermark.svg" alt="" />
        </div>

        {/* Header -- POS receipt jaisa */}
        <div className="text-center">
          <p className="font-display text-lg font-bold uppercase tracking-wide text-surface-900">{shopTitle}</p>
          {branchLine && <p className="text-[11px] uppercase tracking-wide text-surface-500">{branchLine}</p>}
          {header?.counterName && <p className="mt-0.5 text-xs text-surface-500">POS: {header.counterName}</p>}
          <p className="mt-1 text-xs text-surface-500">{handover.sentAt ? receiptDate(handover.sentAt) : "—"}</p>
          <p className="mt-2 text-sm font-bold uppercase tracking-wide text-surface-900">Cash Handover Slip</p>
        </div>

        <div className="receipt-rule my-3 border-t-2 border-dashed border-surface-400" />

        <div className="space-y-1 text-xs">
          <ReceiptRow label="Slip #" value={handover.id.slice(0, 8).toUpperCase()} />
          {header && header.shiftNumbers.length > 0 && (
            <ReceiptRow label="Shift" value={header.shiftNumbers.join(", ")} />
          )}
          <ReceiptRow label="Bhejne wala" value={handover.senderName} />
          {handover.senderRole && <ReceiptRow label="" value={handover.senderRole} capitalize />}
          <ReceiptRow label="Pane wala" value={handover.recipientName} />
          {handover.recipientRole && <ReceiptRow label="" value={handover.recipientRole} capitalize />}
          {handover.carrierName && <ReceiptRow label="Carrier" value={handover.carrierName} />}
        </div>

        <div className="receipt-rule my-3 border-t-2 border-dashed border-surface-400" />

        <div className="receipt-totals space-y-1 text-xs">
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="font-semibold text-surface-900">Raqam</span>
            <span className="shrink-0 whitespace-nowrap text-right text-base font-bold tabular-nums text-surface-900">
              {rs(handover.amountSent)}
            </span>
          </div>
          {handover.amountReceived != null && (
            <ReceiptRow label="Mili" value={rs(handover.amountReceived)} />
          )}
          {handover.difference != null && handover.difference !== 0 && (
            <ReceiptRow
              label={handover.difference < 0 ? "Kam" : "Zyada"}
              value={rs(Math.abs(handover.difference))}
              tone="red"
            />
          )}
        </div>

        {handover.sentNote && (
          <>
            <div className="receipt-rule my-3 border-t-2 border-dashed border-surface-400" />
            <div className="text-xs">
              <p className="text-surface-500">Tareeqa / Note</p>
              <p className="mt-0.5 break-words text-surface-900">{handover.sentNote}</p>
            </div>
          </>
        )}

        <div className="receipt-rule my-3 border-t-2 border-dashed border-surface-400" />

        <div className="receipt-balances text-xs">
          <p className="text-surface-500">Status</p>
          <p
            className={`mt-0.5 flex items-start gap-1.5 font-semibold ${
              isDone
                ? handover.status === "received"
                  ? "text-emerald-700"
                  : "text-red-600"
                : handover.carrierConfirmedAt
                  ? "text-blue-700"
                  : "text-amber-700"
            }`}
          >
            {isDone ? (
              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 print:hidden" />
            ) : handover.carrierConfirmedAt ? (
              <Truck className="mt-0.5 h-3.5 w-3.5 shrink-0 print:hidden" />
            ) : (
              <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0 print:hidden" />
            )}
            <span>{statusText}</span>
          </p>
          {handover.differenceReason && <p className="mt-0.5 text-surface-500">{handover.differenceReason}</p>}
        </div>

        {/* Digital signatures */}
        {((handover.carrierConfirmedAt && handover.carrierConfirmedByName) ||
          (handover.receivedByName && handover.receivedAt)) && (
          <>
            <div className="receipt-rule my-3 border-t-2 border-dashed border-surface-400" />
            <div className="receipt-balances space-y-2 text-xs">
              {handover.carrierConfirmedAt && handover.carrierConfirmedByName && (
                <div>
                  <p className="text-surface-500">Carrier — Digital Signature</p>
                  <p className="font-semibold text-surface-900">{handover.carrierConfirmedByName}</p>
                  <p className="text-[11px] text-surface-500">{receiptDate(handover.carrierConfirmedAt)} par tasdeeq ki</p>
                </div>
              )}
              {handover.receivedByName && handover.receivedAt && (
                <div>
                  <p className="text-surface-500">Finance / Pane wala — Digital Signature</p>
                  <p className="font-semibold text-surface-900">{handover.receivedByName}</p>
                  <p className="text-[11px] text-surface-500">{receiptDate(handover.receivedAt)} par tasdeeq ki</p>
                </div>
              )}
            </div>
          </>
        )}

        <div className="receipt-footer">
          <div className="receipt-rule my-3 border-t-2 border-dashed border-surface-400" />
          <p className="text-center text-xs font-medium text-surface-600">Cash ke sath ye slip office jama karayein</p>
          <p className="text-center text-[11px] text-surface-500">POS Solution by ZR Technologies</p>
          <p className="text-center text-[11px] text-surface-500">📞 0312-6513294</p>
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
