export type PayrollPayState = {
  status: string | null;
  createdBy: string | null;
  actorId: string | null;
  payJournalId: string | null;
  payLock: string | null;
  payLockAt: string | null;
  nowMs?: number;
};

const LOCK_MS = 10 * 60 * 1000;

/** Adaigi ka faisla. Database ka qatal (fn_payroll_claim_pay) isi usool par hai. */
export function payrollPayDecision(state: PayrollPayState): "already_paid" | "claimed" | "busy" | "not_ready" | "maker" {
  if (state.status === "paid" || state.payJournalId) return "already_paid";
  if (state.status !== "approved") return "not_ready";
  if (state.createdBy && state.actorId && state.createdBy === state.actorId) return "maker";
  if (state.payLock && state.payLock !== state.actorId) {
    const lockedAt = state.payLockAt ? Date.parse(state.payLockAt) : NaN;
    const now = state.nowMs ?? Date.now();
    if (!Number.isFinite(lockedAt) || now - lockedAt < LOCK_MS) return "busy";
  }
  return "claimed";
}
