/** Complaint stages. Percent is the bar. Support status stays the old column. */

export const COMPLAINT_STAGE_ORDER = ["received", "assigned", "in_progress", "review", "completed"] as const;

export type ComplaintStage = (typeof COMPLAINT_STAGE_ORDER)[number] | "rejected";

export const COMPLAINT_STAGE_META: Record<ComplaintStage, { en: string; rm: string; ur: string; percent: number; status: string }> = {
  received: { en: "Received", rm: "Mila", ur: "موصول", percent: 10, status: "new" },
  assigned: { en: "Assigned", rm: "Saunpa gaya", ur: "سونا", percent: 30, status: "assigned" },
  in_progress: { en: "In progress", rm: "Kaam jari", ur: "جاری", percent: 55, status: "investigating" },
  review: { en: "Review", rm: "Check", ur: "جانچ", percent: 80, status: "testing" },
  completed: { en: "Completed", rm: "Mukammal", ur: "مکمل", percent: 100, status: "resolved" },
  rejected: { en: "Rejected", rm: "Wapas", ur: "واپس", percent: 100, status: "reopened" },
};

const EVENT_STAGE: Record<string, ComplaintStage> = {
  received: "received",
  new: "received",
  assigned: "assigned",
  in_progress: "in_progress",
  investigating: "in_progress",
  review: "review",
  testing: "review",
  completed: "completed",
  resolved: "completed",
  rejected: "rejected",
  reopened: "rejected",
};

export function complaintStageOf(value: string | null | undefined): ComplaintStage | null {
  if (!value) return null;
  return EVENT_STAGE[value] ?? null;
}

export function stagePercent(stage: string | null | undefined): number {
  const key = complaintStageOf(stage);
  return key ? COMPLAINT_STAGE_META[key].percent : 0;
}

export interface StageMoveInput {
  actorId: string;
  submitterId: string;
  actorRole: string;
  assigneeId: string | null;
  from: string;
  to: string;
}

/**
 * Assignee ek qadam aage (Assigned → Kaam jari → Check). Mukammal nahi.
 * Mukammal sirf Owner, super admin, ya Admin, aur sirf Check ke baad.
 * Banane wala, chahe Admin ho, band nahi karta. Call-center agent stage nahi chheRta.
 */
export function decideComplaintStage(input: StageMoveInput): { ok: true } | { ok: false; reason: string } {
  if (!input.actorId) return { ok: false, reason: "login" };
  if (input.actorRole === "call_center_agent") return { ok: false, reason: "agent" };
  if (input.actorId === input.submitterId) return { ok: false, reason: "maker" };
  const admin = input.actorRole === "owner" || input.actorRole === "super_admin" || input.actorRole === "admin";
  const assignee = Boolean(input.assigneeId && input.assigneeId === input.actorId);
  if (!admin && !assignee) return { ok: false, reason: "stranger" };
  const to = complaintStageOf(input.to);
  const from = complaintStageOf(input.from) ?? "received";
  if (!to) return { ok: false, reason: "stage" };
  if (to === from) return { ok: false, reason: "same" };
  if (to === "rejected") return { ok: true };
  if (to === "completed") {
    if (!admin) return { ok: false, reason: "admin-only" };
    if (from !== "review") return { ok: false, reason: "review-first" };
    return { ok: true };
  }
  const fromI = COMPLAINT_STAGE_ORDER.indexOf(from as (typeof COMPLAINT_STAGE_ORDER)[number]);
  const toI = COMPLAINT_STAGE_ORDER.indexOf(to as (typeof COMPLAINT_STAGE_ORDER)[number]);
  if (fromI < 0 || toI <= fromI) return { ok: false, reason: "back" };
  if (!admin && toI !== fromI + 1) return { ok: false, reason: "one-step" };
  return { ok: true };
}

export function managerForwardNote(fullName: string): string {
  return `Forwarded by Manager ${fullName.trim()}`;
}
