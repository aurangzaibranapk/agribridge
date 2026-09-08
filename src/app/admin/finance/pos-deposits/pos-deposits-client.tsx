"use client";
import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { FileImage, Check, XCircle, AlertTriangle } from "lucide-react";
import { Card } from "@/components/ui/layout-primitives";
import { verifyCollectionDeposit, type ActionState, type PendingDepositRow } from "@/actions/pos-collection";

const KHALI: ActionState = {};

function rs(n: number): string {
  return `Rs ${Math.round(n).toLocaleString()}`;
}

function DecisionButton({ decision, label, icon, tone }: { decision: string; label: string; icon: React.ReactNode; tone: "brand" | "red" }) {
  const { pending } = useFormStatus();
  const colour = tone === "brand" ? "bg-brand-600 hover:bg-brand-700" : "bg-red-600 hover:bg-red-700";
  return (
    <button
      type="submit"
      name="decision"
      value={decision}
      disabled={pending}
      className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold text-white disabled:opacity-50 ${colour}`}
    >
      {icon} {pending ? "…" : label}
    </button>
  );
}

function DepositCard({ deposit }: { deposit: PendingDepositRow }) {
  const [state, action] = useFormState(verifyCollectionDeposit, KHALI);
  const [note, setNote] = useState("");

  if (state.success) {
    return (
      <Card className="p-4 text-center text-sm text-emerald-700 dark:text-emerald-400">{state.message}</Card>
    );
  }

  return (
    <Card className="p-4">
      <form action={action} className="space-y-3">
        <input type="hidden" name="deposit_id" value={deposit.id} />

        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="font-display text-xl font-bold text-surface-900 dark:text-white">{rs(deposit.amount)}</p>
            <p className="text-xs text-surface-500">
              {deposit.shopName} · {deposit.branchName}
            </p>
            <p className="text-xs text-surface-500">
              {deposit.staffName} — {deposit.depositNumber}
            </p>
          </div>
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
            Outstanding was {rs(deposit.outstandingBefore)}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2 rounded-lg bg-surface-50 p-2.5 text-xs dark:bg-surface-800">
          <div>
            <span className="block text-surface-400">Bank Account</span>
            <span className="font-medium text-surface-800 dark:text-surface-200">{deposit.bankAccountName}</span>
          </div>
          <div>
            <span className="block text-surface-400">Deposit Date</span>
            <span className="font-medium text-surface-800 dark:text-surface-200">{deposit.depositDate}</span>
          </div>
        </div>

        {deposit.staffNote && <p className="text-xs text-surface-500">Staff note: {deposit.staffNote}</p>}

        <a
          href={deposit.slipUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-sm text-brand-700 hover:underline dark:text-brand-400"
        >
          <FileImage className="h-4 w-4" /> Slip dekhein
        </a>

        <input
          name="finance_note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Finance note / reject reason"
          className="w-full rounded-lg border border-surface-200 px-3 py-2 text-sm dark:border-surface-700 dark:bg-surface-900"
        />

        {state.error && (
          <p className="flex items-start gap-1.5 rounded-lg bg-red-50 px-2 py-1.5 text-xs text-red-700 dark:bg-red-950/30 dark:text-red-400">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {state.error}
          </p>
        )}

        <div className="flex gap-2">
          <DecisionButton decision="approve" label="Approve" icon={<Check className="h-4 w-4" />} tone="brand" />
          <DecisionButton decision="reject" label="Reject" icon={<XCircle className="h-4 w-4" />} tone="red" />
        </div>
      </form>
    </Card>
  );
}

export function PosDepositsClient({ deposits }: { deposits: PendingDepositRow[] }) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {deposits.map((d) => (
        <DepositCard key={d.id} deposit={d} />
      ))}
    </div>
  );
}
