import { isSelfApproveRole } from "@/lib/approval/guards";

/** Manager ke SLA ke baad item Admin aur Owner dono ke paas ek sath jati hai. */
export const DEFAULT_SLA_HOURS = 24;
export type EscalationLevel = "manager" | "escalated";
export type PendingListFilter = "all" | "mine" | "new" | "escalated" | "overdue";

export interface PendingTimelineEvent {
  id: string;
  kind: "opened" | "escalated" | "delay_note" | "self_decision";
  from_level: string | null;
  to_level: string | null;
  reason: string | null;
  note: string | null;
  actor_id: string | null;
  actor_name: string | null;
  waited_seconds: number | null;
  created_at: string;
}

export function slaHours(value: number | null | undefined): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 1) return DEFAULT_SLA_HOURS;
  return Math.min(720, Math.round(n));
}

/** Waqt SLA se aage ho to escalated, warna manager. */
export function escalationLevel(openedAt: string | null | undefined, hours: number, now = Date.now()): EscalationLevel {
  if (!openedAt) return "manager";
  const t = new Date(openedAt).getTime();
  if (!Number.isFinite(t)) return "manager";
  return now - t >= slaHours(hours) * 3_600_000 ? "escalated" : "manager";
}

export function escalationReason(hours: number): string {
  return `Manager ne ${slaHours(hours)} ghante mein approve nahi kiya`;
}

export interface EscOpenRow {
  category: string;
  item_id: string;
  opened_at: string;
  maker_id: string | null;
  maker_name: string | null;
  level: EscalationLevel;
}

export function ownerEscalationSummary(rows: EscOpenRow[], now = Date.now()) {
  const escalated = rows.filter((r) => r.level === "escalated");
  let oldest: string | null = null;
  const by = new Map<string, { name: string; count: number; oldest: string }>();
  for (const r of escalated) {
    const at = new Date(r.opened_at).getTime();
    if (Number.isFinite(at) && (oldest == null || at < new Date(oldest).getTime())) oldest = r.opened_at;
    const name = r.maker_name?.trim() || "—";
    const cur = by.get(name) ?? { name, count: 0, oldest: r.opened_at };
    cur.count += 1;
    if (Number.isFinite(at) && at < new Date(cur.oldest).getTime()) cur.oldest = r.opened_at;
    by.set(name, cur);
  }
  void now;
  return {
    count: escalated.length,
    oldest,
    byPerson: [...by.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)),
  };
}

export function escalatedToViewer(role: string | null | undefined): boolean {
  return isSelfApproveRole(role);
}

export function itemMatchesFilter(
  filter: PendingListFilter,
  item: { is_own?: boolean; code_own?: boolean; is_new?: boolean; escalation_level?: EscalationLevel; overdue?: boolean },
  role: string | null | undefined,
): boolean {
  if (filter === "mine") return !item.is_own && !item.code_own;
  if (filter === "new") return !!item.is_new;
  if (filter === "escalated") return item.escalation_level === "escalated" && escalatedToViewer(role);
  if (filter === "overdue") return !!item.overdue;
  return true;
}
