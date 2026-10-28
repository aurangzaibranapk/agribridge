"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { useFormState } from "@/lib/hooks/use-safe-form-state";
import { approveCustodyJama, askCustodyWhy, type CustodyActionState } from "@/actions/cash-custody-chain";

const INIT: CustodyActionState = {};

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-full bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
    >
      {pending ? "…" : label}
    </button>
  );
}

function ApproveButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center gap-1 rounded-full bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow-[0_8px_20px_-12px_rgba(16,185,129,.9)] disabled:opacity-50"
    >
      <CheckCircle2 className="h-3.5 w-3.5" />
      {pending ? "…" : label}
    </button>
  );
}

export function NeedsActions({
  packetId,
  mode,
  askLabel,
  askAlt,
  approveLabel,
  approveAlt,
  alertLabel,
  alertAlt,
  notePlaceholder,
  sendLabel,
}: {
  packetId: string;
  mode: "ask" | "approve" | "alert" | "none";
  askLabel: string;
  askAlt: string;
  approveLabel: string;
  approveAlt: string;
  alertLabel: string;
  alertAlt: string;
  notePlaceholder: string;
  sendLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const [askState, askAction] = useFormState(askCustodyWhy, INIT);
  const [approveState, approveAction] = useFormState(approveCustodyJama, INIT);

  if (mode === "alert") {
    return (
      <p data-needs-action="alert" className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-300">
        <AlertTriangle className="h-4 w-4" />
        {alertLabel}
        <span className="font-normal text-amber-200/70">({alertAlt})</span>
      </p>
    );
  }

  if (mode === "approve") {
    return (
      <form action={approveAction} className="text-right">
        <input type="hidden" name="packet_id" value={packetId} />
        {!approveState.success && <ApproveButton label={`${approveLabel} (${approveAlt})`} />}
        {approveState.error && <p className="mt-1 max-w-xs text-xs text-rose-300">{approveState.error}</p>}
        {approveState.success && <p className="text-xs text-emerald-300">{approveState.message}</p>}
      </form>
    );
  }

  if (mode !== "ask") return null;

  return (
    <div className="text-right">
      {!open && !askState.success && (
        <button
          type="button"
          data-needs-action="ask"
          onClick={() => setOpen(true)}
          className="rounded-full border border-rose-400/70 bg-rose-500/10 px-3 py-1.5 text-xs font-semibold text-rose-100 hover:bg-rose-500/20"
        >
          {askLabel} <span className="font-normal text-rose-100/70">({askAlt})</span>
        </button>
      )}
      {open && !askState.success && (
        <form action={askAction} className="mt-2 space-y-2">
          <input type="hidden" name="packet_id" value={packetId} />
          <textarea
            name="note"
            required
            minLength={3}
            maxLength={500}
            rows={2}
            placeholder={notePlaceholder}
            className="w-full min-w-0 rounded-xl border border-white/15 bg-black/30 px-2 py-1.5 text-xs text-white placeholder:text-white/35 sm:min-w-[14rem]"
          />
          <Submit label={sendLabel} />
        </form>
      )}
      {askState.error && <p className="mt-1 text-xs text-rose-300">{askState.error}</p>}
      {askState.success && <p className="text-xs text-emerald-300">{askState.message}</p>}
    </div>
  );
}
