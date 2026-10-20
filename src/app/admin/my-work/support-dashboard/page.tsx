import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  CheckCircle2,
  Clock3,
  FolderKanban,
  Gauge,
  RefreshCw,
  Repeat2,
  Users,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { ComplaintQueue, type QueueTicket } from "@/components/support/complaint-queue";
import { ManagerGrantList } from "@/components/support/manager-grants";
import { canAssignComplaints, canForwardComplaint } from "@/lib/support/complaint-intake";
import { aiAgentConnected } from "@/lib/support/ai-agent-webhook";
import { configuredSupportAgents } from "@/lib/support/agent-dispatch";

export const dynamic = "force-dynamic";

const MANAGER_ROLES = new Set(["owner", "super_admin", "admin", "manager", "admin_assistant"]);
const CLOSED = new Set(["resolved"]);
const PENDING_STAGES = new Set(["approval_required", "blocked"]);
const WORKING_STAGES = new Set(["approved", "working", "testing", "fixed"]);

type Ticket = {
  id: string;
  ticket_no: number;
  title: string;
  description: string;
  priority: string;
  status: string;
  page_url: string | null;
  created_at: string;
  assigned_at: string | null;
  resolved_at: string | null;
  updated_at: string;
  assigned_kind: string | null;
  assigned_agent: string | null;
  assignment_status: string | null;
  reporter?: { full_name?: string } | null;
  assignee?: { full_name?: string } | null;
};

type Comment = {
  id: string;
  ticket_id: string;
  body: string;
  source_label: string | null;
  created_at: string;
  author?: { full_name?: string } | null;
};

function hoursBetween(start?: string | null, end?: string | null) {
  if (!start || !end) return null;
  return Math.max(0, (new Date(end).getTime() - new Date(start).getTime()) / 3_600_000);
}

function duration(hours: number | null) {
  if (hours == null || !Number.isFinite(hours)) return "—";
  if (hours < 1) return `${Math.max(1, Math.round(hours * 60))} min`;
  if (hours < 24) return `${hours.toFixed(hours < 10 ? 1 : 0)} hrs`;
  return `${(hours / 24).toFixed(1)} days`;
}

function stage(ticket: Ticket) {
  if (ticket.status === "resolved") return "Verified & Closed";
  const value = ticket.assignment_status || ticket.status;
  const labels: Record<string, string> = {
    new: "Reported",
    assigned: "Assigned",
    investigating: "Analysis",
    analysis_requested: "Analysis Queued",
    analysis: "Analysis",
    approval_required: "Approval Required",
    approved: "Approved",
    working: "Working",
    blocked: "Needs Attention",
    testing: "Testing",
    fixed: "Fixed — Verification",
    reopened: "Reopened",
    failed: "Failed",
  };
  return labels[value] || value;
}

function moduleName(pageUrl: string | null) {
  if (!pageUrl) return "Unknown page";
  try {
    const path = new URL(pageUrl, "https://erp.local").pathname;
    const parts = path.split("/").filter(Boolean);
    if (parts[0] === "admin") parts.shift();
    if (parts[0] === "api") parts.shift();
    return (parts.slice(0, 2).join(" / ") || "Home")
      .split("-")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  } catch {
    return "Unknown page";
  }
}

function titleKey(title: string) {
  return title
    .toLowerCase()
    .replace(/\d+/g, "#")
    .replace(/[^a-z0-9#\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function dayKey(value: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Karachi",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
}

function mean(values: number[]) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

export default async function DevelopmentSupportDashboard() {
  const client = createClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user) redirect("/login");

  const service = createServiceClient();
  const { data: profile } = await service
    .from("profiles")
    .select("id,full_name,role,organization_id,is_active")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.is_active) redirect("/login");
  if (!MANAGER_ROLES.has(String(profile.role))) redirect("/admin/my-work");

  const db = service as any;
  const { data: ticketRows, error } = await db
    .from("support_tickets")
    .select("id,ticket_no,title,description,priority,status,page_url,created_at,assigned_at,resolved_at,updated_at,assigned_kind,assigned_agent,assignment_status,reporter:profiles!support_tickets_reporter_id_fkey(full_name),assignee:profiles!support_tickets_assigned_to_fkey(full_name)")
    .eq("organization_id", profile.organization_id)
    .order("created_at", { ascending: false })
    .limit(1000);

  if (error) throw new Error(error.message);
  const tickets = (ticketRows ?? []) as Ticket[];
  const ids = tickets.map((ticket) => ticket.id);
  const { data: commentRows } = ids.length
    ? await db
        .from("support_ticket_comments")
        .select("id,ticket_id,body,source_label,created_at,author:profiles!support_ticket_comments_author_id_fkey(full_name)")
        .in("ticket_id", ids)
        .order("created_at", { ascending: false })
        .limit(300)
    : { data: [] };
  const comments = (commentRows ?? []) as Comment[];

  const now = Date.now();
  const open = tickets.filter((ticket) => !CLOSED.has(ticket.status));
  const fixed = tickets.filter((ticket) => CLOSED.has(ticket.status));
  const pendingApproval = open.filter((ticket) => PENDING_STAGES.has(String(ticket.assignment_status))).length;
  const activeWork = open.filter((ticket) => WORKING_STAGES.has(String(ticket.assignment_status))).length;
  const reopened = tickets.filter((ticket) => ticket.status === "reopened").length;
  const critical = open.filter((ticket) => ticket.priority === "work_stopped" || ticket.priority === "urgent").length;
  const olderThan24 = open.filter((ticket) => now - new Date(ticket.created_at).getTime() > 86_400_000).length;
  const olderThan72 = open.filter((ticket) => now - new Date(ticket.created_at).getTime() > 259_200_000).length;

  const responseTimes = tickets
    .map((ticket) => hoursBetween(ticket.created_at, ticket.assigned_at))
    .filter((value): value is number => value != null);
  const resolutionTimes = fixed
    .map((ticket) => hoursBetween(ticket.created_at, ticket.resolved_at))
    .filter((value): value is number => value != null);

  const today = dayKey(new Date().toISOString());
  const todayTickets = tickets.filter((ticket) => dayKey(ticket.created_at) === today);
  const todayResolved = fixed.filter((ticket) => ticket.resolved_at && dayKey(ticket.resolved_at) === today);

  const developers = new Map<string, {
    name: string;
    total: number;
    open: number;
    fixed: number;
    response: number[];
    resolution: number[];
  }>();
  for (const ticket of tickets) {
    const name = ticket.assignee?.full_name
      || (ticket.assigned_agent === "codex_subscription" ? "ChatGPT / Codex" : ticket.assigned_agent)
      || "Unassigned";
    const row = developers.get(name) ?? { name, total: 0, open: 0, fixed: 0, response: [], resolution: [] };
    row.total += 1;
    if (ticket.status === "resolved") row.fixed += 1;
    else row.open += 1;
    const response = hoursBetween(ticket.created_at, ticket.assigned_at);
    const resolution = hoursBetween(ticket.created_at, ticket.resolved_at);
    if (response != null) row.response.push(response);
    if (resolution != null) row.resolution.push(resolution);
    developers.set(name, row);
  }
  const developerRows = Array.from(developers.values()).sort((a, b) => b.fixed - a.fixed || b.total - a.total);

  const modules = new Map<string, { total: number; open: number; fixed: number }>();
  for (const ticket of tickets) {
    const key = moduleName(ticket.page_url);
    const row = modules.get(key) ?? { total: 0, open: 0, fixed: 0 };
    row.total += 1;
    if (ticket.status === "resolved") row.fixed += 1;
    else row.open += 1;
    modules.set(key, row);
  }
  const moduleRows = Array.from(modules, ([name, counts]) => ({ name, ...counts }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 10);

  const repeats = new Map<string, Ticket[]>();
  for (const ticket of tickets) {
    const key = titleKey(ticket.title);
    if (!key) continue;
    repeats.set(key, [...(repeats.get(key) ?? []), ticket]);
  }
  const repeatRows = Array.from(repeats.values())
    .filter((rows) => rows.length > 1)
    .sort((a, b) => b.length - a.length)
    .slice(0, 8);

  const days = Array.from({ length: 7 }, (_, offset) => {
    const date = new Date(now - (6 - offset) * 86_400_000);
    const key = dayKey(date.toISOString());
    return {
      key,
      label: new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Karachi", weekday: "short", day: "2-digit" }).format(date),
      reported: tickets.filter((ticket) => dayKey(ticket.created_at) === key).length,
      resolved: fixed.filter((ticket) => ticket.resolved_at && dayKey(ticket.resolved_at) === key).length,
    };
  });
  const maxDaily = Math.max(1, ...days.flatMap((day) => [day.reported, day.resolved]));

  let complaintNotice: string | null = null;
  let queue: QueueTicket[] = [];
  const complaintQuery = await db
    .from("support_tickets")
    .select("id,ticket_no,title,description,status,created_at,intake_source,suggested_department,routed_label,reporter_id,reporter:profiles!support_tickets_reporter_id_fkey(full_name),assignee:profiles!support_tickets_assigned_to_fkey(full_name)")
    .eq("organization_id", profile.organization_id)
    .in("intake_source", ["staff", "call_center"])
    .order("created_at", { ascending: false })
    .limit(80);
  if (complaintQuery.error) {
    complaintNotice = "Complaint queue tab yahan aayegi jab migration 626 backup ke baad chal jaye.";
  } else {
    const rows = complaintQuery.data ?? [];
    const cids = rows.map((row: { id: string }) => row.id);
    const eventsQuery = cids.length
      ? await db.from("support_ticket_events").select("ticket_id,event_type,from_value,to_value,note,created_at,actor:profiles(full_name)").in("ticket_id", cids).order("created_at", { ascending: true }).limit(400)
      : { data: [], error: null };
    const events = (eventsQuery.error ? [] : eventsQuery.data) ?? [];
    const stageQuery = cids.length
      ? await db.from("support_tickets").select("id,complaint_stage,stage_percent,manager_forward_label,assigned_to,assigned_agent,reporter_id").in("id", cids)
      : { data: [], error: null };
    const stageById = new Map((stageQuery.error ? [] : (stageQuery.data ?? [])).map((row: { id: string }) => [row.id, row]));
    const attQuery = cids.length
      ? await db.from("support_ticket_attachments").select("id,ticket_id,storage_path").in("ticket_id", cids)
      : { data: [], error: null };
    const attRows = attQuery.error ? [] : (attQuery.data ?? []);
    queue = await Promise.all(rows.map(async (row: any) => {
      const extra = stageById.get(row.id) as { complaint_stage?: string; stage_percent?: number; manager_forward_label?: string; assigned_to?: string; assigned_agent?: string } | undefined;
      const images = [];
      for (const file of attRows.filter((item: { ticket_id: string }) => item.ticket_id === row.id)) {
        const signed = await service.storage.from("support-evidence").createSignedUrl(file.storage_path, 3600);
        if (signed.data?.signedUrl) images.push({ src: signed.data.signedUrl, alt: row.title });
      }
      return {
        id: row.id,
        ticketNo: row.ticket_no,
        title: row.title,
        description: row.description,
        status: row.status,
        intake: row.intake_source,
        suggested: row.suggested_department,
        routed: row.routed_label,
        assignee: row.assignee?.full_name ?? (extra?.assigned_agent === "ai_webhook" ? "AI agent" : null),
        assigneeId: extra?.assigned_to ?? null,
        assignedAgent: extra?.assigned_agent ?? null,
        reporter: row.reporter?.full_name ?? "Staff",
        reporterId: row.reporter_id,
        createdAt: new Date(row.created_at).toLocaleString("en-PK", { timeZone: "Asia/Karachi" }),
        stage: extra?.complaint_stage ?? null,
        percent: extra?.stage_percent ?? null,
        managerForward: extra?.manager_forward_label ?? null,
        images,
        history: events.filter((event: any) => event.ticket_id === row.id).map((event: any) => ({
          at: new Date(event.created_at).toLocaleString("en-PK", { timeZone: "Asia/Karachi" }),
          event: event.event_type,
          from: event.from_value,
          to: event.to_value,
          note: event.note,
          actor: event.actor?.full_name ?? "System",
        })),
      };
    }));
  }
  const { data: queuePeople } = await service.from("profiles").select("id,full_name,role").eq("organization_id", profile.organization_id).eq("is_active", true).order("full_name");
  let grantNotice: string | null = null;
  const grantQuery = await db.from("cc_assign_grants").select("profile_id,active").eq("organization_id", profile.organization_id);
  if (grantQuery.error) grantNotice = "Manager ijazat tab yahan aayegi jab migration 627 backup ke baad chal jaye.";
  const grantOn = new Set((grantQuery.error ? [] : (grantQuery.data ?? [])).filter((row: { active?: boolean }) => row.active !== false).map((row: { profile_id: string }) => row.profile_id));
  const managers = ((queuePeople ?? []) as { id: string; full_name: string; role: string }[])
    .filter((person) => person.role === "manager")
    .map((person) => ({ id: person.id, full_name: person.full_name, granted: grantOn.has(person.id) }));
  const viewerGrant = grantOn.has(profile.id);

  const ticketById = new Map(tickets.map((ticket) => [ticket.id, ticket]));
  const recentUpdates = comments.slice(0, 15).map((comment) => ({
    ...comment,
    ticket: ticketById.get(comment.ticket_id),
  }));

  const cards = [
    { label: "Total Issues", value: tickets.length, note: `${todayTickets.length} aaj report huay`, tone: "text-slate-900", icon: FolderKanban },
    { label: "Open / Pending", value: open.length, note: `${pendingApproval} approval ya attention par`, tone: "text-amber-700", icon: Clock3 },
    { label: "Active Work", value: activeWork, note: "Approved, working ya testing", tone: "text-blue-700", icon: Activity },
    { label: "Fixed & Verified", value: fixed.length, note: `${todayResolved.length} aaj close huay`, tone: "text-emerald-700", icon: CheckCircle2 },
    { label: "Avg Response", value: duration(mean(responseTimes)), note: "Report se assignment tak", tone: "text-violet-700", icon: Gauge },
    { label: "Avg Resolution", value: duration(mean(resolutionTimes)), note: "Report se verified close tak", tone: "text-cyan-700", icon: RefreshCw },
    { label: "Repeat Issues", value: repeatRows.length, note: `${reopened} tickets dobara khulay`, tone: "text-rose-700", icon: Repeat2 },
    { label: "SLA Risk", value: olderThan24, note: `${olderThan72} issues 72+ ghantay puranay`, tone: "text-red-700", icon: AlertTriangle },
  ];

  return (
    <main className="min-h-screen bg-surface-50 p-4 md:p-6">
      <div className="mx-auto max-w-[1500px]">
        <header className="mb-5 flex flex-wrap items-start justify-between gap-3">
          <div>
            <Link href="/admin/my-work" className="mb-2 inline-flex items-center gap-1 text-xs font-medium text-brand-700">
              <ArrowLeft className="h-3.5 w-3.5" /> Mera Kaam
            </Link>
            <Link href="/admin/support-center" className="mb-2 ml-3 inline-flex items-center gap-1 text-xs font-medium text-brand-700">→ Support Center (SLA, assign, status)</Link>
            <h1 className="font-display text-2xl font-semibold text-surface-950">Development Support Dashboard</h1>
            <p className="mt-1 text-sm text-surface-500">
              Issue response, approval, fixes, repeat problems aur ERP module health — ek professional control room.
            </p>
          </div>
          <div className="rounded-lg border border-surface-200 bg-white px-3 py-2 text-right text-xs text-surface-500">
            <p className="font-semibold text-surface-800">{profile.full_name || "Admin"}</p>
            <p>Live support data · Asia/Karachi</p>
          </div>
        </header>

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {cards.map((card) => {
            const Icon = card.icon;
            return (
              <article key={card.label} className="rounded-xl border border-surface-200 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-surface-500">{card.label}</p>
                    <p className={`mt-2 text-3xl font-semibold tabular-nums ${card.tone}`}>{card.value}</p>
                  </div>
                  <span className="rounded-lg bg-surface-100 p-2"><Icon className="h-5 w-5 text-surface-600" /></span>
                </div>
                <p className="mt-2 text-xs text-surface-500">{card.note}</p>
              </article>
            );
          })}
        </section>

        <section className="mt-4 grid gap-4 xl:grid-cols-[1.25fr_.75fr]">
          <article className="rounded-xl border border-surface-200 bg-white shadow-sm">
            <div className="border-b border-surface-100 px-4 py-3">
              <h2 className="flex items-center gap-2 text-sm font-semibold"><Users className="h-4 w-4 text-brand-700" /> Development Team Performance</h2>
              <p className="mt-0.5 text-xs text-surface-500">Har developer/agent ka workload, response aur verified delivery.</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[680px] text-left text-xs">
                <thead className="bg-surface-50 text-[10px] uppercase text-surface-500">
                  <tr><th className="px-4 py-2">Developer / Agent</th><th>Total</th><th>Open</th><th>Fixed</th><th>Fix Rate</th><th>Avg Response</th><th>Avg Resolution</th></tr>
                </thead>
                <tbody className="divide-y divide-surface-100">
                  {developerRows.map((row) => (
                    <tr key={row.name}>
                      <td className="px-4 py-3 font-medium text-surface-900">{row.name}</td>
                      <td>{row.total}</td><td>{row.open}</td><td className="text-emerald-700">{row.fixed}</td>
                      <td>{row.total ? Math.round((row.fixed / row.total) * 100) : 0}%</td>
                      <td>{duration(mean(row.response))}</td><td>{duration(mean(row.resolution))}</td>
                    </tr>
                  ))}
                  {developerRows.length === 0 && <tr><td colSpan={7} className="px-4 py-8 text-center text-surface-400">Abhi support data nahi hai.</td></tr>}
                </tbody>
              </table>
            </div>
          </article>

          <article className="rounded-xl border border-surface-200 bg-white p-4 shadow-sm">
            <h2 className="flex items-center gap-2 text-sm font-semibold"><BarChart3 className="h-4 w-4 text-brand-700" /> 7 Din ki Daily Report</h2>
            <div className="mt-5 flex h-48 items-end justify-between gap-2 border-b border-surface-200">
              {days.map((day) => (
                <div key={day.key} className="flex flex-1 flex-col items-center gap-1">
                  <div className="flex h-36 w-full items-end justify-center gap-1">
                    <div title={`${day.reported} reported`} className="w-3 rounded-t bg-amber-400" style={{ height: `${Math.max(day.reported ? 8 : 1, (day.reported / maxDaily) * 100)}%` }} />
                    <div title={`${day.resolved} resolved`} className="w-3 rounded-t bg-emerald-500" style={{ height: `${Math.max(day.resolved ? 8 : 1, (day.resolved / maxDaily) * 100)}%` }} />
                  </div>
                  <p className="text-[9px] text-surface-500">{day.label}</p>
                </div>
              ))}
            </div>
            <div className="mt-3 flex gap-4 text-[10px] text-surface-500">
              <span><i className="mr-1 inline-block h-2 w-2 rounded-sm bg-amber-400" /> Reported</span>
              <span><i className="mr-1 inline-block h-2 w-2 rounded-sm bg-emerald-500" /> Resolved</span>
            </div>
          </article>
        </section>

        <section className="mt-4 grid gap-4 xl:grid-cols-3">
          <article className="rounded-xl border border-surface-200 bg-white shadow-sm">
            <div className="border-b border-surface-100 px-4 py-3">
              <h2 className="text-sm font-semibold">ERP Module Health Map</h2>
              <p className="mt-0.5 text-xs text-surface-500">Kis module se kitne issues aa rahe hain.</p>
            </div>
            <div className="divide-y divide-surface-100">
              {moduleRows.map((row) => (
                <div key={row.name} className="flex items-center justify-between px-4 py-2.5 text-xs">
                  <span className="font-medium">{row.name}</span>
                  <span className="text-surface-500">{row.total} total · <b className="text-amber-700">{row.open} open</b> · <b className="text-emerald-700">{row.fixed} fixed</b></span>
                </div>
              ))}
              {moduleRows.length === 0 && <p className="p-6 text-center text-xs text-surface-400">Module data abhi nahi hai.</p>}
            </div>
          </article>

          <article className="rounded-xl border border-surface-200 bg-white shadow-sm">
            <div className="border-b border-surface-100 px-4 py-3">
              <h2 className="flex items-center gap-2 text-sm font-semibold"><Repeat2 className="h-4 w-4 text-rose-600" /> Repeat Issue Watch</h2>
              <p className="mt-0.5 text-xs text-surface-500">Wohi masla dobara aa raha ho to foran nazar aaye.</p>
            </div>
            <div className="divide-y divide-surface-100">
              {repeatRows.map((rows) => (
                <div key={titleKey(rows[0].title)} className="px-4 py-2.5">
                  <div className="flex justify-between gap-2"><p className="text-xs font-medium">{rows[0].title}</p><b className="text-xs text-rose-700">{rows.length}x</b></div>
                  <p className="mt-1 text-[10px] text-surface-500">{rows.filter((row) => row.status !== "resolved").length} abhi open · {moduleName(rows[0].page_url)}</p>
                </div>
              ))}
              {repeatRows.length === 0 && <p className="p-6 text-center text-xs text-emerald-700">Koi repeated title detect nahi hua.</p>}
            </div>
          </article>

          <article className="rounded-xl border border-surface-200 bg-white shadow-sm">
            <div className="border-b border-surface-100 px-4 py-3">
              <h2 className="text-sm font-semibold">Live Update Timeline</h2>
              <p className="mt-0.5 text-xs text-surface-500">Kis issue par kab aur kya update hui.</p>
            </div>
            <div className="max-h-[370px] divide-y divide-surface-100 overflow-y-auto">
              {recentUpdates.map((update) => (
                <div key={update.id} className="px-4 py-3">
                  <div className="flex justify-between gap-2 text-[10px]">
                    <b className="text-brand-700">ISS-{new Date(update.ticket?.created_at || update.created_at).getFullYear()}-{String(update.ticket?.ticket_no ?? 0).padStart(5, "0")}</b>
                    <span className="text-surface-400">{new Date(update.created_at).toLocaleString("en-PK", { timeZone: "Asia/Karachi" })}</span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs text-surface-700">{update.body}</p>
                  <p className="mt-1 text-[10px] text-surface-400">{update.author?.full_name || update.source_label || "System"} · {update.ticket ? stage(update.ticket) : "Update"}</p>
                </div>
              ))}
              {recentUpdates.length === 0 && <p className="p-6 text-center text-xs text-surface-400">Abhi update history nahi hai.</p>}
            </div>
          </article>
        </section>

        {canAssignComplaints(String(profile.role)) && (
          <ManagerGrantList managers={managers} notice={grantNotice} />
        )}
        <ComplaintQueue
          tickets={queue}
          people={(queuePeople ?? []) as { id: string; full_name: string; role: string }[]}
          agents={configuredSupportAgents().map((agent) => ({ key: agent.key, label: agent.label }))}
          canAssign={canForwardComplaint({ role: String(profile.role), managerGrant: viewerGrant })}
          canSendAi={canAssignComplaints(String(profile.role))}
          aiConnected={aiAgentConnected({ AI_AGENT_WEBHOOK_URL: process.env.AI_AGENT_WEBHOOK_URL })}
          viewerId={profile.id}
          viewerRole={String(profile.role)}
          notice={complaintNotice}
        />

        <section className="mt-4 rounded-xl border border-surface-200 bg-white shadow-sm">
          <div className="border-b border-surface-100 px-4 py-3">
            <h2 className="text-sm font-semibold">Current Issue Control</h2>
            <p className="mt-0.5 text-xs text-surface-500">Pending issues, owner, stage, age aur last update.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-xs">
              <thead className="bg-surface-50 text-[10px] uppercase text-surface-500">
                <tr><th className="px-4 py-2">Issue</th><th>Raised By</th><th>Module</th><th>Owner</th><th>Stage</th><th>Age</th><th>Last Update</th></tr>
              </thead>
              <tbody className="divide-y divide-surface-100">
                {open.slice(0, 50).map((ticket) => (
                  <tr key={ticket.id}>
                    <td className="px-4 py-3"><p className="font-medium">ISS-{new Date(ticket.created_at).getFullYear()}-{String(ticket.ticket_no).padStart(5, "0")}</p><p className="max-w-[300px] truncate text-surface-500">{ticket.title}</p></td>
                    <td>{ticket.reporter?.full_name || "Staff"}</td>
                    <td>{moduleName(ticket.page_url)}</td>
                    <td>{ticket.assignee?.full_name || (ticket.assigned_agent === "codex_subscription" ? "ChatGPT / Codex" : ticket.assigned_agent) || "Unassigned"}</td>
                    <td><span className="rounded-full bg-amber-50 px-2 py-1 text-[10px] font-medium text-amber-800">{stage(ticket)}</span></td>
                    <td>{duration(hoursBetween(ticket.created_at, new Date().toISOString()))}</td>
                    <td>{new Date(ticket.updated_at).toLocaleString("en-PK", { timeZone: "Asia/Karachi" })}</td>
                  </tr>
                ))}
                {open.length === 0 && <tr><td colSpan={7} className="px-4 py-8 text-center text-emerald-700">Tamam issues verified aur closed hain.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
