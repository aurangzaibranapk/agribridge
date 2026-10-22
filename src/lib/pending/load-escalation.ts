import { isSelfApproveRole, mayDecideEntry } from "@/lib/approval/guards";
import {
  escalationLevel,
  ownerEscalationSummary,
  slaHours,
  type EscOpenRow,
  type EscalationLevel,
  type PendingTimelineEvent,
} from "@/lib/pending/escalation";
import type { PendingItem } from "@/lib/pending/categories";

interface StateRow {
  category: string;
  item_id: string;
  level: string;
  opened_at: string;
  level_since: string;
  maker_id: string | null;
  escalated_at: string | null;
  closed_at: string | null;
}
interface EventRow {
  id: string;
  category: string;
  item_id: string;
  kind: PendingTimelineEvent["kind"];
  from_level: string | null;
  to_level: string | null;
  reason: string | null;
  note: string | null;
  actor_id: string | null;
  waited_seconds: number | null;
  created_at: string;
}

function rows<T>(res: { data: unknown; error: { message: string } | null }): T[] {
  if (res.error || !Array.isArray(res.data)) return [];
  return res.data as T[];
}

/**
 * Escalation state page par. Function ya table na ho to safha pehle jaisa.
 * Admin/Owner ke khulne par sweep ek dafa — idempotent — taake timeline likhe.
 */
export async function attachEscalation<T extends PendingItem>(
  db: { rpc: (fn: string, args?: Record<string, unknown>) => Promise<{ error: { message: string } | null }>; from: (table: string) => any },
  items: T[],
  role: string | null,
  actorId: string | null,
  now = Date.now(),
) {
  const empty = {
    items,
    summary: null as ReturnType<typeof ownerEscalationSummary> | null,
    sla: {} as Record<string, number>,
    escalatedToMe: 0,
    overdue: 0,
  };
  if (isSelfApproveRole(role)) {
    const swept = await db.rpc("fn_pending_escalate").catch(() => ({ error: { message: "skip" } }));
    void swept;
  }

  const settingsRes = await db.from("pending_escalation_settings").select("category, manager_hours");
  if (settingsRes.error && /does not exist|schema cache|could not find/i.test(settingsRes.error.message ?? "")) return empty;
  const sla: Record<string, number> = {};
  for (const s of rows<{ category: string; manager_hours: number }>(settingsRes)) sla[s.category] = slaHours(s.manager_hours);

  const stateRes = await db.from("pending_escalation_state").select("category, item_id, level, opened_at, level_since, maker_id, escalated_at, closed_at").is("closed_at", null);
  const allOpen = rows<StateRow>(stateRes);
  const ids = items.map((i) => i.item_id);
  const eventRes = ids.length
    ? await db.from("pending_escalation_events").select("id, category, item_id, kind, from_level, to_level, reason, note, actor_id, waited_seconds, created_at").in("item_id", ids)
    : { data: [], error: null };
  const events = rows<EventRow>(eventRes);

  const who = [...new Set([
    ...events.map((e) => e.actor_id),
    ...allOpen.map((r) => r.maker_id),
  ].filter((x): x is string => !!x))];
  const names = new Map<string, string>();
  if (who.length) {
    const people = rows<{ id: string; full_name: string | null }>(await db.from("profiles").select("id, full_name").in("id", who));
    for (const p of people) if (p.full_name) names.set(p.id, p.full_name);
  }

  const key = (c: string, id: string) => `${c}:${id}`;
  const byState = new Map(allOpen.map((s) => [key(s.category, s.item_id), s]));
  const byEvents = new Map<string, PendingTimelineEvent[]>();
  for (const e of events) {
    const k = key(e.category, e.item_id);
    const list = byEvents.get(k) ?? [];
    list.push({
      id: e.id,
      kind: e.kind,
      from_level: e.from_level,
      to_level: e.to_level,
      reason: e.reason,
      note: e.note,
      actor_id: e.actor_id,
      actor_name: e.actor_id ? names.get(e.actor_id) ?? null : null,
      waited_seconds: e.waited_seconds,
      created_at: e.created_at,
    });
    byEvents.set(k, list);
  }

  const next = items.map((item) => {
    const hours = sla[item.category] ?? 24;
    const st = byState.get(key(item.category, item.item_id));
    const opened = st?.opened_at ?? item.created_at;
    const level: EscalationLevel = st?.level === "escalated" || escalationLevel(opened, hours, now) === "escalated" ? "escalated" : "manager";
    const late = level === "escalated";
    const timeline = (byEvents.get(key(item.category, item.item_id)) ?? []).sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    );
    const canNote = mayDecideEntry(role, actorId, [item.entered_by]) && (isSelfApproveRole(role) || (role === "manager" && level === "manager"));
    return {
      ...item,
      escalation_level: level,
      escalation_since: st?.level_since ?? opened,
      sla_hours: hours,
      overdue: late,
      timeline,
      can_delay_note: canNote,
      pending_with: level === "escalated" ? "admin_owner" : "manager",
      actor_name: null,
    };
  });

  const shown = new Set(next.map((i) => key(i.category, i.item_id)));
  let overdue = next.filter((i) => i.overdue).length;
  let escalatedToMe = next.filter((i) => i.escalation_level === "escalated" && isSelfApproveRole(role)).length;
  for (const row of allOpen) {
    if (shown.has(key(row.category, row.item_id))) continue;
    const hours = sla[row.category] ?? 24;
    const late = row.level === "escalated" || escalationLevel(row.opened_at, hours, now) === "escalated";
    if (!late) continue;
    overdue += 1;
    if (isSelfApproveRole(role)) escalatedToMe += 1;
  }

  const summaryRows: EscOpenRow[] = allOpen
    .filter((r) => r.level === "escalated" || escalationLevel(r.opened_at, sla[r.category] ?? 24, now) === "escalated")
    .map((r) => ({
      category: r.category,
      item_id: r.item_id,
      opened_at: r.opened_at,
      maker_id: r.maker_id,
      maker_name: r.maker_id ? names.get(r.maker_id) ?? null : null,
      level: "escalated" as const,
    }));
  const summary = role === "owner" || role === "super_admin" ? ownerEscalationSummary(summaryRows, now) : null;
  return { items: next, summary, sla, escalatedToMe, overdue };
}
