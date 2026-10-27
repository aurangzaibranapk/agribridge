/** POS cash chain — pure rules. Ledger balance yahan nahi. */

export const CUSTODY_VERIFY_MS = 24 * 60 * 60 * 1000;

export const HOLDING_KINDS = ["pos_close", "sent", "wasoli", "deposit_submitted", "returned"] as const;

export type CustodyStatus = "with_sales" | "in_transit" | "with_holder" | "deposit_pending" | "verified";

export type SlipCopy = "staff" | "deposit" | "both";

const DESK_ROLES = new Set(["owner", "super_admin", "admin", "finance"]);

export function canOpenCustodyDesk(role: string): boolean {
  return DESK_ROLES.has(role) || role === "manager";
}

export function canSeeCustodyPacket(input: {
  role: string;
  userId: string;
  branchId: string | null;
  packetBranchId: string | null;
  involvedProfileIds: string[];
}): boolean {
  if (DESK_ROLES.has(input.role)) return true;
  if (input.role === "manager") {
    return !!input.branchId && input.branchId === input.packetBranchId;
  }
  return input.involvedProfileIds.includes(input.userId);
}

export function isCustodyOverdue(openedAt: string, verifiedAt: string | null, now = Date.now()): boolean {
  if (verifiedAt) return false;
  const t = new Date(openedAt).getTime();
  if (!Number.isFinite(t)) return false;
  return now - t > CUSTODY_VERIFY_MS;
}

/** Kitni der. Verified chain ke liye overdue nahi. */
export function holdDuration(start: string | null, end: string | null, now = Date.now()): string {
  if (!start) return "—";
  const from = new Date(start).getTime();
  const to = end ? new Date(end).getTime() : now;
  if (!Number.isFinite(from) || !Number.isFinite(to) || to < from) return "—";
  const mins = Math.floor((to - from) / 60000);
  if (mins < 1) return "1 minute se kam";
  if (mins < 60) return `${mins} minute`;
  const hours = Math.floor(mins / 60);
  const rem = mins % 60;
  if (hours < 48) return rem ? `${hours} ghante ${rem} minute` : `${hours} ghante`;
  const days = Math.floor(hours / 24);
  const h = hours % 24;
  return h ? `${days} din ${h} ghante` : `${days} din`;
}

export function kindLabel(kind: string): string {
  switch (kind) {
    case "pos_close":
      return "POS band";
    case "sent":
      return "raaste mein";
    case "carrier_confirmed":
      return "carrier tasdeeq";
    case "wasoli":
      return "wasoli";
    case "staff_copy_confirmed":
      return "staff copy confirm";
    case "deposit_submitted":
      return "bank jama, tasdeeq baqi";
    case "deposit_verified":
      return "Finance ne verify kiya";
    case "deposit_rejected":
      return "jama radd";
    case "returned":
      return "jama radd ke baad wapas";
    default:
      return kind;
  }
}

export function statusLabel(status: string): string {
  switch (status) {
    case "with_sales":
      return "Sales ke paas";
    case "in_transit":
      return "Raaste mein";
    case "with_holder":
      return "Wasoli ke baad zimmedar ke paas";
    case "deposit_pending":
      return "Bank jama — tasdeeq baqi";
    case "verified":
      return "Jama verify ho gayi";
    default:
      return status;
  }
}

export function isHoldingKind(kind: string): boolean {
  return (HOLDING_KINDS as readonly string[]).includes(kind);
}

export function timelinePhrase(input: {
  holderName: string | null;
  kind: string;
  startedAt: string;
  endedAt: string | null;
  now?: number;
}): string {
  const who = input.holderName?.trim() || "—";
  const how = isHoldingKind(input.kind) ? holdDuration(input.startedAt, input.endedAt, input.now) : kindLabel(input.kind);
  if (!isHoldingKind(input.kind)) return `${who} — ${kindLabel(input.kind)}`;
  return `${who} ne ${how} rakha (${kindLabel(input.kind)})`;
}

export function parseSlipCopy(value: string | undefined): SlipCopy {
  if (value === "staff" || value === "deposit") return value;
  return "both";
}

export function rs(amount: number): string {
  const n = Number(amount);
  if (!Number.isFinite(n)) return "—";
  return `Rs ${Math.round(n).toLocaleString("en-PK")}`;
}

export function whenPkt(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-PK", { timeZone: "Asia/Karachi", dateStyle: "medium", timeStyle: "short" });
}
