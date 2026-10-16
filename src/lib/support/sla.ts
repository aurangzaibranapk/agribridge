/**
 * Support Center -- SLA, views aur summaries (pure functions, test: npm run test:support).
 *
 * Purani `support_tickets` table ko chheda nahi jata. Us ki purani
 * priority (normal/urgent/work_stopped) aur status (new/assigned/...)
 * yahan naye paimaane par map hoti hai. Agar migration 529 lag jaye to
 * `support_ticket_meta` ki qeemat (critical/high/normal/low, aur
 * new/acknowledged/.../reopened) us mapping par ghalib aati hai.
 */
export const PRIORITIES = ["critical", "high", "normal", "low"] as const;
export const STATUSES = ["new", "acknowledged", "in_progress", "waiting", "resolved", "closed", "reopened"] as const;
export type Priority = (typeof PRIORITIES)[number];
export type Status = (typeof STATUSES)[number];

/** Ghanton mein jawab/hal ki had -- har priority ki. */
export const SLA_HOURS: Record<Priority, { response: number; resolve: number }> = {
  critical: { response: 1, resolve: 4 },
  high: { response: 4, resolve: 24 },
  normal: { response: 24, resolve: 72 },
  low: { response: 48, resolve: 168 },
};

export type TicketIn = {
  id: string;
  ticket_no: number;
  title: string;
  priority: string | null;
  status: string | null;
  assignment_status?: string | null;
  page_url?: string | null;
  reporter_id?: string | null;
  created_at: string;
  resolved_at?: string | null;
  assignee_name?: string | null;
};
export type MetaIn = { ticket_id: string; priority_level?: string | null; workflow_status?: string | null; module?: string | null; first_response_at?: string | null; closed_at?: string | null };
export type ActivityIn = { ticket_id: string; created_at: string; author_id?: string | null };

export type Ticket = {
  id: string;
  ref: string;
  title: string;
  priority: Priority;
  status: Status;
  module: string;
  assignee: string;
  raisedAt: string;
  firstResponseAt: string | null;
  resolvedAt: string | null;
  turnaroundHours: number | null;
  overdue: boolean;
};

export function mapPriority(legacy: string | null | undefined, meta?: string | null): Priority {
  if (meta && (PRIORITIES as readonly string[]).includes(meta)) return meta as Priority;
  if (legacy === "work_stopped") return "critical";
  if (legacy === "urgent") return "high";
  if (legacy === "low") return "low";
  return "normal";
}

export function mapStatus(legacy: string | null | undefined, assignment?: string | null, meta?: string | null): Status {
  if (meta && (STATUSES as readonly string[]).includes(meta)) return meta as Status;
  if (legacy === "resolved") return "resolved";
  if (legacy === "reopened") return "reopened";
  if (legacy === "resolved_pending_verify") return "waiting"; // 539: Admin verify ka intezar
  if (assignment === "blocked" || assignment === "approval_required") return "waiting";
  if (legacy === "investigating" || legacy === "testing") return "in_progress";
  if (assignment && ["approved", "working", "testing", "fixed", "analysis"].includes(assignment)) return "in_progress";
  if (legacy === "assigned") return "acknowledged";
  return "new";
}

export function moduleFromUrl(url: string | null | undefined): string {
  if (!url) return "General";
  try {
    const path = url.startsWith("http") ? new URL(url).pathname : url;
    const seg = path.split("/").filter(Boolean);
    const i = seg[0] === "admin" || seg[0] === "portal" ? 1 : 0;
    return seg[i] ? seg[i].replace(/-/g, " ").replace(/\b\w/g, (m) => m.toUpperCase()) : "General";
  } catch {
    return "General";
  }
}

export function hoursBetween(a: string | null | undefined, b: string | null | undefined): number | null {
  if (!a || !b) return null;
  const h = (new Date(b).getTime() - new Date(a).getTime()) / 3_600_000;
  return Number.isFinite(h) ? Math.max(0, h) : null;
}

export const isOpen = (s: Status) => s !== "resolved" && s !== "closed";

/**
 * Pehla jawab = reporter ke ilawa kisi ka pehla comment/event, ya meta
 * mein likha waqt. Na mile to NULL (sifar nahi).
 */
export function normalize(t: TicketIn, meta: MetaIn | undefined, activity: ActivityIn[], now: Date): Ticket {
  const priority = mapPriority(t.priority, meta?.priority_level);
  const status = mapStatus(t.status, t.assignment_status, meta?.workflow_status);
  const replies = activity
    .filter((a) => a.ticket_id === t.id && a.author_id !== t.reporter_id && a.created_at >= t.created_at)
    .map((a) => a.created_at)
    .sort();
  const firstResponseAt = meta?.first_response_at ?? replies[0] ?? null;
  const resolvedAt = isOpen(status) ? null : t.resolved_at ?? meta?.closed_at ?? null;
  const sla = SLA_HOURS[priority];
  const age = hoursBetween(t.created_at, now.toISOString()) ?? 0;
  const overdue = isOpen(status) && (age > sla.resolve || (!firstResponseAt && age > sla.response));
  return {
    id: t.id,
    ref: `ISS-${new Date(t.created_at).getFullYear()}-${String(t.ticket_no).padStart(5, "0")}`,
    title: t.title,
    priority,
    status,
    module: meta?.module?.trim() || moduleFromUrl(t.page_url),
    assignee: t.assignee_name || "Unassigned",
    raisedAt: t.created_at,
    firstResponseAt,
    resolvedAt,
    turnaroundHours: hoursBetween(t.created_at, resolvedAt),
    overdue,
  };
}

export function pkDate(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Karachi" }).format(new Date(iso));
}

export function titleKey(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9\u0600-\u06ff]+/g, " ").trim().split(" ").slice(0, 6).join(" ");
}

export function views(tickets: Ticket[], now: Date) {
  const today = pkDate(now.toISOString());
  const groups = new Map<string, Ticket[]>();
  for (const t of tickets) {
    const k = `${t.module}|${titleKey(t.title)}`;
    groups.set(k, [...(groups.get(k) ?? []), t]);
  }
  return {
    pending: tickets.filter((t) => isOpen(t.status)),
    overdue: tickets.filter((t) => t.overdue),
    resolvedToday: tickets.filter((t) => t.resolvedAt && pkDate(t.resolvedAt) === today),
    repeat: Array.from(groups.values()).filter((g) => g.length > 1).sort((a, b) => b.length - a.length),
  };
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

export function developerCounts(tickets: Ticket[]) {
  const m = new Map<string, Ticket[]>();
  for (const t of tickets) m.set(t.assignee, [...(m.get(t.assignee) ?? []), t]);
  return Array.from(m.entries())
    .map(([name, rows]) => ({
      name,
      total: rows.length,
      open: rows.filter((t) => isOpen(t.status)).length,
      resolved: rows.filter((t) => !isOpen(t.status)).length,
      overdue: rows.filter((t) => t.overdue).length,
      avgResponseHours: mean(rows.map((t) => hoursBetween(t.raisedAt, t.firstResponseAt)).filter((x): x is number => x != null)),
      avgTurnaroundHours: mean(rows.map((t) => t.turnaroundHours).filter((x): x is number => x != null)),
    }))
    .sort((a, b) => b.open - a.open || b.total - a.total);
}

/** ISO hafta (Monday se) ka pehla din, PK waqt mein. */
export function weekKey(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  const dow = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - dow);
  return d.toISOString().slice(0, 10);
}

export function summaries(tickets: Ticket[], period: "day" | "week" | "month") {
  const key = (iso: string) => {
    const d = pkDate(iso);
    return period === "day" ? d : period === "week" ? weekKey(d) : d.slice(0, 7);
  };
  const m = new Map<string, { raised: number; resolved: number; turnaround: number[] }>();
  const bump = (k: string) => m.get(k) ?? m.set(k, { raised: 0, resolved: 0, turnaround: [] }).get(k)!;
  for (const t of tickets) {
    bump(key(t.raisedAt)).raised++;
    if (t.resolvedAt) {
      const r = bump(key(t.resolvedAt));
      r.resolved++;
      if (t.turnaroundHours != null) r.turnaround.push(t.turnaroundHours);
    }
  }
  return Array.from(m.entries())
    .map(([k, v]) => ({ period: k, raised: v.raised, resolved: v.resolved, avgTurnaroundHours: mean(v.turnaround) }))
    .sort((a, b) => (a.period < b.period ? 1 : -1));
}

export function formatHours(h: number | null): string {
  if (h == null) return "—";
  if (h < 1) return `${Math.max(1, Math.round(h * 60))} min`;
  if (h < 24) return `${h.toFixed(1)} h`;
  return `${(h / 24).toFixed(1)} d`;
}

/** Status badalne ki ijazat-shuda raah (audit ke sath). */
export function canTransition(from: Status, to: Status): boolean {
  if (from === to) return false;
  if (from === "closed") return to === "reopened";
  if (from === "resolved") return to === "closed" || to === "reopened";
  return true;
}
