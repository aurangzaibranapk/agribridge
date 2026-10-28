/**
 * Aaj aapki zarurat — queue ke saaf faisle.
 * Ledger balance yahan nahi. Packet ka status aur 1 din ka qanoon
 * chain.ts se aata hai. Koi naya approval rule nahi.
 */

import { holdDuration, isCustodyOverdue, rs } from "@/lib/cash-custody/chain";

export const CUSTODY_ASK_PREFIX = "Ask why — ";

export type NeedsStage = "pos_close" | "manager_held" | "verify";
export type NeedsAction = "ask_why" | "approve" | "admin_alert";
export type NeedsTone = "rose" | "amber" | "green";

export interface NeedsCue {
  stage: NeedsStage;
  action: NeedsAction;
  tone: NeedsTone;
}

const ASK_ROLES = new Set(["owner", "super_admin", "admin", "finance"]);

/** POS close / raaste / wasoli baqi → poochain. Manager ke paas + 1 din → alert. Jama copy → approve. */
export function needsCue(status: string, overdue: boolean): NeedsCue {
  if (status === "deposit_pending") return { stage: "verify", action: "approve", tone: "green" };
  if (status === "with_holder" && overdue) return { stage: "manager_held", action: "admin_alert", tone: "amber" };
  if (status === "with_holder") return { stage: "manager_held", action: "ask_why", tone: "amber" };
  return { stage: "pos_close", action: "ask_why", tone: "rose" };
}

export function canAskCustodyWhy(role: string): boolean {
  return ASK_ROLES.has(role);
}

export function canApproveCustodyJama(role: string): boolean {
  return ASK_ROLES.has(role);
}

/**
 * Ask why sirf desk (Admin / Owner / Finance) ko, aur khud se nahi.
 * Admin alert wale card par sawal nahi — wahan pehle se 1 din ka alert hai.
 */
export function showAskWhy(role: string, action: NeedsAction, viewerId: string, holderId: string | null): boolean {
  if (action !== "ask_why" || !canAskCustodyWhy(role)) return false;
  if (holderId && holderId === viewerId) return false;
  return true;
}

/**
 * Approve wahi log jin ke paas jama ki tasdeeq hai.
 * Jis ne cash nikali ya jama karayi, wo khud nahi — deposit verify ka qanoon.
 */
export function showApprove(input: {
  role: string;
  action: NeedsAction;
  viewerId: string;
  originId: string;
  holderId: string | null;
  depositId: string | null;
  makerIds: string[];
}): boolean {
  if (input.action !== "approve" || !canApproveCustodyJama(input.role)) return false;
  if (!input.depositId) return false;
  const blocked = new Set([input.originId, input.holderId, ...input.makerIds].filter(Boolean));
  return !blocked.has(input.viewerId);
}

export interface OpenKpi {
  status: string;
  openedAt: string;
  verifiedAt: string | null;
}

export interface NeedsKpis {
  /** null = aaj ki jama parhi nahi gayi. 0 = dekha, aaj koi jama nahi. */
  aajJama: number | null;
  stuck: number | null;
  managerPaas: number | null;
  verifyPending: number | null;
}

export function kpisFromOpen(packets: OpenKpi[], aajJama: number | null, now = Date.now()): NeedsKpis {
  let stuck = 0;
  let managerPaas = 0;
  let verifyPending = 0;
  for (const p of packets) {
    if (p.status === "verified" || p.verifiedAt) continue;
    if (isCustodyOverdue(p.openedAt, p.verifiedAt, now)) stuck += 1;
    if (p.status === "with_holder") managerPaas += 1;
    if (p.status === "deposit_pending") verifyPending += 1;
  }
  return { aajJama, stuck, managerPaas, verifyPending };
}

export function kpisUnread(): NeedsKpis {
  return { aajJama: null, stuck: null, managerPaas: null, verifyPending: null };
}

/** Chip: 18h, 2d. Poori ibarat holdDuration mein rehti hai. */
export function holdShort(start: string | null, end: string | null, now = Date.now()): string {
  if (!start) return "—";
  const from = new Date(start).getTime();
  const to = end ? new Date(end).getTime() : now;
  if (!Number.isFinite(from) || !Number.isFinite(to) || to < from) return "—";
  const mins = Math.floor((to - from) / 60000);
  if (mins < 60) return `${Math.max(mins, 1)}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 48) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

function trim1(v: number): string {
  const s = v.toFixed(1);
  return s.endsWith(".0") ? s.slice(0, -2) : s;
}

/** Rs 2.4L — sirf KPI. Card par poori raqam. */
export function rsCompact(amount: number): string {
  const n = Number(amount);
  if (!Number.isFinite(n)) return "—";
  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(n);
  if (abs >= 10000000) return `${sign}Rs ${trim1(abs / 10000000)} Cr`;
  if (abs >= 100000) return `${sign}Rs ${trim1(abs / 100000)}L`;
  return rs(n);
}

export interface TrailHop {
  kind: string;
  holderName: string | null;
  fromName: string | null;
  toName: string | null;
  startedAt: string;
  endedAt: string | null;
}

const HOLDING = new Set(["pos_close", "sent", "wasoli", "deposit_submitted", "returned"]);

/** Kis ne kitni der rakha — aakhri chaar holding hops. */
export function cardTrail(hops: TrailHop[], now = Date.now()): string {
  const held = hops.filter((h) => HOLDING.has(h.kind));
  if (held.length === 0) return "";
  return held
    .slice(-4)
    .map((h) => {
      const who = (h.holderName || h.toName || h.fromName || "—").trim() || "—";
      return `${who} · ${holdDuration(h.startedAt, h.endedAt, now)}`;
    })
    .join(" → ");
}

/** Pakistan din ki shuruat, UTC ISO. Karachi UTC+5, DST nahi. */
export function pktDayStart(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Karachi",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const y = Number(parts.find((p) => p.type === "year")?.value);
  const m = Number(parts.find((p) => p.type === "month")?.value);
  const d = Number(parts.find((p) => p.type === "day")?.value);
  return new Date(Date.UTC(y, m - 1, d, -5, 0, 0)).toISOString();
}

export function sortNeeds<T extends { overdue: boolean; opened_at: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    if (a.overdue !== b.overdue) return a.overdue ? -1 : 1;
    if (a.opened_at < b.opened_at) return -1;
    if (a.opened_at > b.opened_at) return 1;
    return 0;
  });
}
