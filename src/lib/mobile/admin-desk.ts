/**
 * Admin phone desk — hisaab aur faisle.
 * Website ke guards (purchaseApproveCheck, mayDecideEntry) yahin se.
 * Koi naya approval rule nahi: doodh, chhutti aur khareed wahi columns
 * likhte hain jo ERP actions likhte hain. Ruki hui adaigi phone se
 * post nahi hoti, kyunke ledger ka raasta website par hai.
 */

import {
  isSelfApproval,
  isSelfApproveRole,
  mayDecideEntry,
  purchaseApproveCheck,
  shouldPostHeldPayment,
} from "../approval/guards";

/** chk_milk_verify_comment aur leave action: kam az kam 5 harf. */
export const DECISION_COMMENT_MIN = 5;
/** milk-collection VERIFY_COMMENT_MAX. */
export const DECISION_COMMENT_MAX = 255;

const MILK_DECIDERS = new Set(["owner", "super_admin", "admin", "manager"]);
const LEAVE_DECIDERS = new Set(["hr", "manager", "admin", "owner", "super_admin"]);
const PURCHASE_DECIDERS = new Set(["owner", "super_admin", "admin"]);

export type ApprovalFilter = "all" | "doodh" | "purchase" | "leave";

export type InboxItem = {
  category: string;
  groupKey: string;
  itemId: string;
  ref: string | null;
  title: string | null;
  amount: number | null;
  createdAt: string;
  enteredBy: string | null;
  enteredByName: string | null;
  actorName: string | null;
  pendingWith: string | null;
  isOwn: boolean;
};

export type DeskStep = {
  title: string;
  detail: string;
  state: "done" | "current" | "wait";
};

export type DeskActor = { id: string; role: string };

export type HeldPayment = { amount?: number | null; posted?: boolean | null } | null;

type MilkRow = {
  id: string;
  status: string | null;
  createdBy: string | null;
  mcaProfileId: string | null;
};

type LeaveRow = {
  id: string;
  profileId: string | null;
  status: string | null;
};

type PurchaseRow = {
  id: string;
  reviewStatus: string | null;
  status: string | null;
  createdBy: string | null;
  verifiedBy: string | null;
  creatorRole: string | null;
  held: HeldPayment;
};

export type DeskPlan =
  | { ok: false; message: string }
  | {
      ok: true;
      kind: "milk";
      id: string;
      match: string;
      patch: Record<string, string>;
    }
  | {
      ok: true;
      kind: "leave";
      id: string;
      match: string;
      patch: Record<string, string | null>;
    }
  | {
      ok: true;
      kind: "purchase";
      id: string;
      match: string;
      patch: Record<string, string>;
      comment: { purchase_id: string; author_id: string; kind: string; body: string };
    };

export function cardRupees(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  const sign = value < 0 ? "-" : "";
  const abs = Math.abs(value);
  if (abs >= 100000) {
    const lakh = abs / 100000;
    const text = lakh >= 10 ? String(Math.round(lakh)) : (Math.round(lakh * 10) / 10).toFixed(1).replace(/\.0$/, "");
    return `${sign}Rs ${text}L`;
  }
  return `${sign}Rs ${Math.round(abs).toLocaleString("en-PK")}`;
}

export function rupeeLabel(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return `Rs ${Math.round(value).toLocaleString("en-PK")}`;
}

export function litreLabel(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  const rounded = Math.round(value * 10) / 10;
  const body = Number.isInteger(rounded) ? String(Math.round(rounded)) : String(rounded);
  return `${body} L`;
}

export function agoLabel(iso: string | null | undefined, now = Date.now()): string {
  if (!iso) return "";
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "";
  const mins = Math.max(0, Math.round((now - t) / 60000));
  if (mins < 1) return "abhi";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

function karachiClock(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Karachi",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).formatToParts(date);
  const pick = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return `${pick("hour")}:${pick("minute")} ${pick("dayPeriod").toUpperCase()}`;
}

/** Mockup line: `10 May 2025, 08:15 AM`. Date-only stays the day. */
export function deskStamp(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(iso);
  const date = dateOnly ? new Date(`${iso}T00:00:00+05:00`) : new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  const day = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Karachi", day: "numeric", month: "short", year: "numeric" }).format(date);
  if (dateOnly) return day;
  return `${day}, ${karachiClock(date)}`;
}

export function roleTitle(role: string | null | undefined): string {
  const key = String(role ?? "").trim();
  const map: Record<string, string> = {
    owner: "Owner",
    super_admin: "Super Admin",
    admin: "Admin",
    admin_assistant: "Admin",
    manager: "Manager",
    hr: "HR",
    finance: "Finance",
  };
  return map[key] || (key ? key.replace(/_/g, " ") : "Admin");
}

export function approvalBucket(category: string | null | undefined): ApprovalFilter | "other" {
  if (category === "milk_verify") return "doodh";
  if (category === "purchases") return "purchase";
  if (category === "leave") return "leave";
  return "other";
}

export function categoryLabel(category: string | null | undefined): string {
  const bucket = approvalBucket(category);
  if (bucket === "doodh") return "Doodh";
  if (bucket === "purchase") return "Purchase";
  if (bucket === "leave") return "Leave";
  const key = String(category || "Request").replace(/_/g, " ");
  return key.charAt(0).toUpperCase() + key.slice(1);
}

export function approvalHeading(category: string | null | undefined): string {
  const label = categoryLabel(category);
  return `${label} approval`;
}

export function approvalHeadline(item: Pick<InboxItem, "category" | "title" | "ref" | "enteredByName">): string {
  if (item.category === "leave") return item.enteredByName || item.title || "Leave";
  return item.title || item.enteredByName || item.ref || categoryLabel(item.category);
}

export function filterInbox(items: InboxItem[], filter: ApprovalFilter, mineOnly: boolean): InboxItem[] {
  return items
    .filter((item) => filter === "all" || approvalBucket(item.category) === filter)
    .filter((item) => !mineOnly || item.isOwn !== true)
    .slice()
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}

function personLine(name: string | null | undefined, stamp: string | null, fallback: string): string {
  const who = (name || "").trim();
  if (who && stamp) return `${who} · ${stamp}`;
  if (who) return who;
  if (stamp) return stamp;
  return fallback;
}

export function milkSteps(input: {
  status: string | null;
  collectedAt: string | null;
  fatAt: string | null;
  verifiedAt: string | null;
  requestedBy: string | null;
  checkedBy: string | null;
  decidedBy: string | null;
}): DeskStep[] {
  const status = String(input.status || "");
  const verified = status === "verified";
  const priced = status === "priced";
  const checked = Boolean(input.fatAt || input.checkedBy);
  const entry = personLine(input.requestedBy, deskStamp(input.collectedAt), "Requested");
  const check = checked
    ? personLine(input.checkedBy, deskStamp(input.fatAt), "Check hui")
    : "Pending check";
  if (verified) {
    return [
      { title: "Entry hui", detail: entry, state: "done" },
      { title: "Check hui", detail: check, state: "done" },
      { title: "Manzoor hui", detail: personLine(input.decidedBy, deskStamp(input.verifiedAt), "Approved"), state: "done" },
      { title: "Khata mein post", detail: personLine(null, deskStamp(input.verifiedAt), "Posted with tasdeeq"), state: "done" },
    ];
  }
  if (priced) {
    return [
      { title: "Entry hui", detail: entry, state: "done" },
      { title: "Check hui", detail: check, state: "done" },
      { title: "Manzoor hui", detail: "Pending approval", state: "current" },
      { title: "Khata mein post", detail: "Pending", state: "wait" },
    ];
  }
  if (checked) {
    return [
      { title: "Entry hui", detail: entry, state: "done" },
      { title: "Check hui", detail: check, state: "done" },
      { title: "Manzoor hui", detail: "Rate ke baad", state: "current" },
      { title: "Khata mein post", detail: "Pending", state: "wait" },
    ];
  }
  return [
    { title: "Entry hui", detail: entry, state: "done" },
    { title: "Check hui", detail: "Pending check", state: "current" },
    { title: "Manzoor hui", detail: "Pending approval", state: "wait" },
    { title: "Khata mein post", detail: "Pending", state: "wait" },
  ];
}

export function purchaseSteps(input: {
  reviewStatus: string | null;
  requestedBy: string | null;
  verifiedBy: string | null;
  createdAt: string | null;
  verifiedAt: string | null;
  reviewedAt: string | null;
}): DeskStep[] {
  const review = String(input.reviewStatus || "submitted");
  const requested = personLine(input.requestedBy, deskStamp(input.createdAt), "Requested");
  const verified = review === "verified" || review === "approved"
    ? personLine(input.verifiedBy, deskStamp(input.verifiedAt), "Verified")
    : "Pending review";
  if (review === "approved") {
    return [
      { title: "Entry hui", detail: requested, state: "done" },
      { title: "Check hui", detail: verified, state: "done" },
      { title: "Manzoor hui", detail: personLine(null, deskStamp(input.reviewedAt), "Approved"), state: "done" },
      { title: "Khata mein post", detail: "Stock receive agla qadam", state: "current" },
    ];
  }
  if (review === "rejected") {
    return [
      { title: "Entry hui", detail: requested, state: "done" },
      { title: "Check hui", detail: verified, state: "done" },
      { title: "Manzoor hui", detail: "Rejected", state: "current" },
      { title: "Khata mein post", detail: "Next · nahi", state: "wait" },
    ];
  }
  if (review === "verified") {
    return [
      { title: "Entry hui", detail: requested, state: "done" },
      { title: "Check hui", detail: verified, state: "done" },
      { title: "Manzoor hui", detail: "Pending approval", state: "current" },
      { title: "Khata mein post", detail: "Next · pending", state: "wait" },
    ];
  }
  return [
    { title: "Entry hui", detail: requested, state: "done" },
    { title: "Check hui", detail: "Pending review", state: "current" },
    { title: "Manzoor hui", detail: "Next · pending approval", state: "wait" },
    { title: "Khata mein post", detail: "Next · pending", state: "wait" },
  ];
}

export function leaveSteps(input: {
  status: string | null;
  requestedBy: string | null;
  managerName: string | null;
  createdAt: string | null;
  decidedAt: string | null;
}): DeskStep[] {
  const status = String(input.status || "pending");
  const requested = personLine(input.requestedBy, deskStamp(input.createdAt), "Requested");
  if (status === "approved" || status === "rejected") {
    return [
      { title: "Entry hui", detail: requested, state: "done" },
      { title: "Check hui", detail: personLine(input.managerName, null, "Reviewed"), state: "done" },
      { title: "Manzoor hui", detail: personLine(input.managerName, deskStamp(input.decidedAt), status === "approved" ? "Approved" : "Rejected"), state: "done" },
      { title: "Khata mein post", detail: status === "approved" ? "Hazri update" : "Hazri nahi badli", state: status === "approved" ? "done" : "wait" },
    ];
  }
  return [
    { title: "Entry hui", detail: requested, state: "done" },
    { title: "Check hui", detail: input.managerName ? `${input.managerName} · pending review` : "Pending review", state: "current" },
    { title: "Manzoor hui", detail: "Next · pending approval", state: "wait" },
    { title: "Khata mein post", detail: "Next · hazri", state: "wait" },
  ];
}

export function otherSteps(item: Pick<InboxItem, "enteredByName" | "actorName" | "pendingWith" | "createdAt">): DeskStep[] {
  return [
    { title: "Entry hui", detail: personLine(item.enteredByName, deskStamp(item.createdAt), "Requested"), state: "done" },
    { title: "Check hui", detail: personLine(item.actorName, null, "Pending review"), state: item.actorName ? "done" : "current" },
    { title: "Manzoor hui", detail: item.pendingWith ? `Pending with ${item.pendingWith.replace(/_/g, " ")}` : "Pending approval", state: "current" },
    { title: "Khata mein post", detail: "Next · ERP record", state: "wait" },
  ];
}

function commentError(comment: string): string | null {
  const text = comment.trim();
  if (text.length < DECISION_COMMENT_MIN) return `Comment kam az kam ${DECISION_COMMENT_MIN} harf. Bina wajah faisla nahi hota.`;
  if (text.length > DECISION_COMMENT_MAX) return `Comment zyada se zyada ${DECISION_COMMENT_MAX} harf.`;
  return null;
}

export function planMilkDecision(input: {
  readOnly: boolean;
  actor: DeskActor;
  row: MilkRow;
  decision: "approve" | "reject";
  comment: string;
  nowIso: string;
}): DeskPlan {
  if (input.readOnly) return { ok: false, message: "Sirf dekhna. Manzoor band hai." };
  if (!MILK_DECIDERS.has(input.actor.role)) return { ok: false, message: "Doodh ki tasdeeq Owner, Admin ya Manager kar sakta hai." };
  if (!mayDecideEntry(input.actor.role, input.actor.id, [input.row.createdBy, input.row.mcaProfileId])) {
    return { ok: false, message: "Apni entry khud manzoor nahi kar sakte." };
  }
  if (input.row.status !== "priced") return { ok: false, message: "Pehle fat aur rate lagna baqi hai. Sirf priced entry par faisla hota hai." };
  const comment = commentError(input.comment);
  if (comment) return { ok: false, message: comment };
  return {
    ok: true,
    kind: "milk",
    id: input.row.id,
    match: `id=eq.${input.row.id}&status=eq.priced`,
    patch: {
      status: input.decision === "approve" ? "verified" : "rejected",
      verified_by_profile_id: input.actor.id,
      verified_comment: input.comment.trim(),
      verified_at: input.nowIso,
    },
  };
}

export function planLeaveDecision(input: {
  readOnly: boolean;
  actor: DeskActor;
  row: LeaveRow;
  decision: "approve" | "reject";
  comment: string;
  nowIso: string;
}): DeskPlan {
  if (input.readOnly) return { ok: false, message: "Sirf dekhna. Manzoor band hai." };
  if (!LEAVE_DECIDERS.has(input.actor.role)) return { ok: false, message: "Chhutti par faisla HR, Manager ya Admin kar sakta hai." };
  if (input.row.profileId && input.row.profileId === input.actor.id) return { ok: false, message: "Apni chhutti khud manzoor nahi ki ja sakti." };
  if (input.row.status !== "pending" && input.row.status !== "sent_back") {
    return { ok: false, message: "Is par pehle hi faisla ho chuka hai." };
  }
  const comment = commentError(input.comment);
  if (comment) return { ok: false, message: comment };
  return {
    ok: true,
    kind: "leave",
    id: input.row.id,
    match: `id=eq.${input.row.id}&status=in.(pending,sent_back)`,
    patch: {
      status: input.decision === "approve" ? "approved" : "rejected",
      manager_comment: input.comment.trim(),
      decision_note: input.comment.trim(),
      decided_by: input.actor.id,
      decided_at: input.nowIso,
    },
  };
}

export function planPurchaseDecision(input: {
  readOnly: boolean;
  actor: DeskActor;
  row: PurchaseRow;
  decision: "approve" | "reject";
  comment: string;
  nowIso: string;
}): DeskPlan {
  if (input.readOnly) return { ok: false, message: "Sirf dekhna. Manzoor band hai." };
  if (!PURCHASE_DECIDERS.has(input.actor.role)) return { ok: false, message: "Purchase manzoor sirf Owner ya Admin kar sakta hai." };
  if (input.row.status === "cancelled") return { ok: false, message: "Radd shuda purchase par faisla nahi." };
  if (input.row.status !== "pending") return { ok: false, message: "Sirf jo purchase abhi receive nahi hui, us par faisla ho sakta hai." };
  if (!isSelfApproveRole(input.actor.role) && isSelfApproval(input.row.createdBy, input.actor.id)) {
    return { ok: false, message: "Apni banayi hui purchase par khud faisla nahi kar sakte." };
  }
  if (input.decision === "approve" && shouldPostHeldPayment("approve", heldAmount(input.row.held))) {
    return { ok: false, message: "Is purchase par ruki hui adaigi hai. Manzoori ledger post karti hai — wo ERP website par hoti hai, taake raqam do dafa na kate." };
  }
  if (input.decision === "approve") {
    if (!input.row.creatorRole) return { ok: false, message: "Banane wale ka role nahi khula, is liye manzoori nahi." };
    const chk = purchaseApproveCheck(
      { review_status: input.row.reviewStatus, verified_by: input.row.verifiedBy },
      input.row.creatorRole,
      input.actor.id,
      input.actor.role,
    );
    if (!chk.ok) return { ok: false, message: chk.error };
  } else if (input.row.reviewStatus === "rejected" || input.row.reviewStatus === "approved") {
    return { ok: false, message: "Is purchase par pehle hi faisla ho chuka hai." };
  }
  const comment = commentError(input.comment);
  if (comment) return { ok: false, message: comment };
  const patch: Record<string, string> = {
    review_status: input.decision === "approve" ? "approved" : "rejected",
    reviewed_by: input.actor.id,
    reviewed_at: input.nowIso,
  };
  if (input.decision === "reject") patch.status = "cancelled";
  return {
    ok: true,
    kind: "purchase",
    id: input.row.id,
    match: `id=eq.${input.row.id}&status=eq.pending`,
    patch,
    comment: {
      purchase_id: input.row.id,
      author_id: input.actor.id,
      kind: input.decision === "approve" ? "approve" : "reject",
      body: input.comment.trim(),
    },
  };
}

function heldAmount(held: HeldPayment): { amount: number; posted?: boolean } | null {
  if (!held || held.amount == null || !Number.isFinite(Number(held.amount))) return null;
  return { amount: Number(held.amount), posted: held.posted === true };
}

export function countFromContentRange(header: string | null | undefined): number | null {
  if (!header) return null;
  const match = /\/(\d+)\s*$/.exec(header);
  if (!match) return null;
  const count = Number(match[1]);
  return Number.isFinite(count) ? count : null;
}
