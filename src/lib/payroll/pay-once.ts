export type PayrollPayState = {
  status: string | null;
  createdBy: string | null;
  actorId: string | null;
  payJournalId: string | null;
  payLock: string | null;
  payLockAt: string | null;
  nowMs?: number;
  submittedBy?: string | null;
  onOwnLine?: boolean;
  actorRole?: string | null;
  payRole?: string | null;
};

const APPROVER_ROLES = new Set(["admin", "owner", "super_admin"]);

/** Approver, ya settings ki pay role (default HR). */
export function payrollPayRoleAllowed(actorRole: string | null | undefined, payRole = "hr"): boolean {
  if (!actorRole) return false;
  if (APPROVER_ROLES.has(actorRole)) return true;
  return actorRole === payRole;
}

const LOCK_MS = 10 * 60 * 1000;

/** Adaigi ka faisla. Database ka qatal (fn_payroll_claim_pay) isi usool par hai. */
export function payrollPayDecision(
  state: PayrollPayState,
): "already_paid" | "claimed" | "busy" | "not_ready" | "maker" | "submitter" | "self_line" | "forbidden" {
  if (state.actorRole !== undefined && !payrollPayRoleAllowed(state.actorRole, state.payRole ?? "hr")) return "forbidden";
  if (state.status === "paid" || state.payJournalId) return "already_paid";
  if (state.status !== "approved") return "not_ready";
  if (state.createdBy && state.actorId && state.createdBy === state.actorId) return "maker";
  if (state.submittedBy && state.actorId && state.submittedBy === state.actorId) return "submitter";
  if (state.onOwnLine) return "self_line";
  if (state.payLock && state.payLock !== state.actorId) {
    const lockedAt = state.payLockAt ? Date.parse(state.payLockAt) : NaN;
    const now = state.nowMs ?? Date.now();
    if (!Number.isFinite(lockedAt) || now - lockedAt < LOCK_MS) return "busy";
  }
  return "claimed";
}
