"use client";

import { useFormState, useFormStatus } from "react-dom";
import { confirmLiabilityShare, declineLiabilityShare, type ActionState } from "@/actions/stock-count-liability";
import { AlertTriangle } from "lucide-react";

const initialState: ActionState = {};

function rs(n: number): string {
  return `Rs ${Math.round(n).toLocaleString()}`;
}

function ActBtn({ label, className }: { label: string; className: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={className}>
      {pending ? "…" : label}
    </button>
  );
}

interface Share {
  id: string;
  productName: string;
  reason: string;
  amount: number;
  staffName: string;
  warehouseName: string;
  countDate: string;
}

function ShareRow({ share, isAdmin }: { share: Share; isAdmin: boolean }) {
  const [confirmState, confirmAction] = useFormState(confirmLiabilityShare, initialState);
  const [declineState, declineAction] = useFormState(declineLiabilityShare, initialState);

  if (confirmState.success) {
    return <p className="border-t border-amber-100 py-2 text-xs text-green-700 dark:border-amber-900/40 dark:text-green-400">{confirmState.message}</p>;
  }
  if (declineState.success) {
    return <p className="border-t border-amber-100 py-2 text-xs text-surface-500 dark:border-amber-900/40">{declineState.message}</p>;
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-amber-100 py-2 first:border-t-0 dark:border-amber-900/40">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-surface-900 dark:text-white">
          {share.productName} — <span className="tabular-nums text-amber-700 dark:text-amber-400">{rs(share.amount)}</span>
        </p>
        <p className="mt-0.5 text-xs text-surface-500">
          {isAdmin && <>{share.staffName} · </>}
          {share.warehouseName} · {share.countDate}
          {share.reason && <> — &quot;{share.reason}&quot;</>}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        <form action={confirmAction}>
          <input type="hidden" name="share_id" value={share.id} />
          <ActBtn label="Qabool" className="flex items-center gap-1 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-60" />
        </form>
        <form action={declineAction}>
          <input type="hidden" name="share_id" value={share.id} />
          <ActBtn label="Mana" className="flex items-center gap-1 rounded-lg bg-surface-100 px-3 py-1.5 text-xs font-medium text-surface-600 hover:bg-surface-200 dark:bg-surface-800 dark:text-surface-300" />
        </form>
      </div>
      {(confirmState.error || declineState.error) && (
        <p className="w-full text-xs text-red-600">{confirmState.error || declineState.error}</p>
      )}
    </div>
  );
}

/**
 * Stock ginti mein "kami" jo Sale Staff ke khate mein bheji gayi hai --
 * har product ka apna alag Qabool/Mana button (malik, 15 September).
 * Qabool karne par asal katauti hoti hai (tankhwah se), Mana karne par
 * company ke "Stock ka nuqsan" khate mein chala jata hai.
 */
export function LiabilityPanel({ shares, isAdmin }: { shares: Share[]; isAdmin: boolean }) {
  if (shares.length === 0) return null;

  return (
    <div className="rounded-card border border-amber-200 bg-amber-50/40 p-4 shadow-card dark:border-amber-900/40 dark:bg-amber-950/10">
      <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400">
        <AlertTriangle className="h-3.5 w-3.5" />
        {shares.length} {isAdmin ? "ginti ke farq — staff ki tasdeeq baqi hai" : "ginti ka farq aap ke khate ke liye bheja gaya hai"}
      </p>
      {shares.map((s) => (
        <ShareRow key={s.id} share={s} isAdmin={isAdmin} />
      ))}
    </div>
  );
}
