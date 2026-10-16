import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { PageHeader, Card } from "@/components/ui/layout-primitives";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";
import { t } from "@/lib/i18n/translations";
import { canDo } from "@/lib/access/guard";
import { UNRESTRICTED_ROLES } from "@/lib/access/permissions";
import {
  PRIORITIES, STATUSES, normalize, views, developerCounts, summaries, formatHours, pkDate,
  type MetaIn, type ActivityIn, type Ticket,
} from "@/lib/support/sla";
import { SupportStatusForm } from "./status-form";
import { SupportAssignForm } from "./assign-form";
import { configuredSupportAgents } from "@/lib/support/agent-dispatch";

export const dynamic = "force-dynamic";
const MANAGERS = new Set(["owner", "super_admin", "admin", "manager", "admin_assistant"]);
const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleString("en-PK", { timeZone: "Asia/Karachi" }) : "—");
const PRI_TONE: Record<string, string> = { critical: "bg-red-100 text-red-800", high: "bg-amber-100 text-amber-800", normal: "bg-surface-100 text-surface-700", low: "bg-emerald-50 text-emerald-800" };

export default async function SupportCenterPage({ searchParams }: { searchParams: { view?: string; period?: string } }) {
  const lang = getLanguageFromCookies("rm");
  const client = createClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user) redirect("/login");
  const service = createServiceClient() as any;
  const { data: me } = await service.from("profiles").select("id,role,organization_id,is_active").eq("id", user.id).maybeSingle();
  if (!me?.is_active) redirect("/login");
  const allowed = MANAGERS.has(String(me.role)) && (UNRESTRICTED_ROLES.includes(me.role) || (await canDo("support.center", "view")));
  if (!allowed) return <div className="p-8 text-center text-surface-500">{t("spc_no_access", lang)}</div>;

  const { data: rows, error } = await service
    .from("support_tickets")
    .select("id,ticket_no,title,priority,status,assignment_status,page_url,reporter_id,created_at,resolved_at,assigned_agent,assignee:profiles!support_tickets_assigned_to_fkey(full_name)")
    .eq("organization_id", me.organization_id)
    .order("created_at", { ascending: false })
    .limit(2000);
  if (error) throw new Error(error.message);
  const ids = (rows ?? []).map((r: any) => r.id);
  const [metaRes, eventRes, commentRes] = await Promise.all([
    ids.length ? service.from("support_ticket_meta").select("ticket_id,priority_level,workflow_status,module,first_response_at,closed_at").in("ticket_id", ids) : { data: [], error: null },
    ids.length ? service.from("support_ticket_events").select("id,ticket_id,actor_id,event_type,from_value,to_value,note,created_at,actor:profiles(full_name)").in("ticket_id", ids).order("created_at", { ascending: false }).limit(500) : { data: [], error: null },
    ids.length ? service.from("support_ticket_comments").select("ticket_id,author_id,created_at").in("ticket_id", ids).limit(10000) : { data: [], error: null },
  ]);
  const { data: people } = await service.from("profiles").select("id,full_name,role").eq("organization_id", me.organization_id).eq("is_active", true).order("full_name");
  const agentList = configuredSupportAgents().map((a: any) => ({ key: String(a.key), label: String(a.label ?? a.key) }));
  const migrationPending = Boolean(metaRes.error || eventRes.error);
  const metaBy = new Map<string, MetaIn>(((metaRes.error ? [] : metaRes.data) ?? []).map((m: MetaIn) => [m.ticket_id, m]));
  const events = (eventRes.error ? [] : eventRes.data) ?? [];
  const activity: ActivityIn[] = [
    ...((commentRes.data ?? []) as ActivityIn[]),
    ...events.map((e: any) => ({ ticket_id: e.ticket_id, created_at: e.created_at, author_id: e.actor_id })),
  ];
  const now = new Date();
  const tickets: Ticket[] = (rows ?? []).map((r: any) =>
    normalize({ ...r, assignee_name: r.assignee?.full_name || (r.assigned_agent === "codex_subscription" ? "ChatGPT / Codex" : r.assigned_agent) }, metaBy.get(r.id), activity, now),
  );
  const v = views(tickets, now);
  const view = (["pending", "overdue", "resolvedToday", "repeat"] as const).find((k) => k === searchParams.view) ?? "pending";
  const period = searchParams.period === "week" ? "week" : searchParams.period === "month" ? "month" : "day";
  const list: Ticket[] = view === "repeat" ? v.repeat.flat() : v[view];
  const devs = developerCounts(tickets);
  const sums = summaries(tickets, period).slice(0, 14);
  const refById = new Map(tickets.map((x) => [x.id, x.ref]));
  const cards = [
    { key: "pending", label: t("spc_pending", lang), n: v.pending.length, tone: "text-amber-700" },
    { key: "overdue", label: t("spc_overdue", lang), n: v.overdue.length, tone: "text-red-700" },
    { key: "resolvedToday", label: t("spc_resolved_today", lang), n: v.resolvedToday.length, tone: "text-emerald-700" },
    { key: "repeat", label: t("spc_repeat", lang), n: v.repeat.length, tone: "text-rose-700" },
  ];

  return (
    <div className="space-y-4">
      <PageHeader title={t("spc_title", lang)} description={t("spc_subtitle", lang)} />
      <div className="-mt-2 mb-3 text-xs"><Link href="/admin/my-work/support-dashboard" className="font-semibold text-brand-700 hover:underline">→ Support Dashboard (development / agent progress)</Link></div>
      {migrationPending && <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">{t("spc_migration_pending", lang)}</p>}
      <div className="grid gap-3 sm:grid-cols-4">
        {cards.map((c) => (
          <Link key={c.key} href={`?view=${c.key}&period=${period}`} className={`rounded-xl border bg-white p-4 shadow-sm ${view === c.key ? "border-brand-500" : "border-surface-200"}`}>
            <p className="text-[11px] font-semibold uppercase text-surface-500">{c.label}</p>
            <p className={`mt-1 text-3xl font-semibold tabular-nums ${c.tone}`}>{c.n}</p>
          </Link>
        ))}
      </div>

      <Card className="overflow-x-auto p-0">
        <table className="w-full min-w-[1100px] text-left text-xs">
          <thead className="bg-surface-50 text-[10px] uppercase text-surface-500"><tr>
            <th className="px-3 py-2">{t("spc_issue", lang)}</th><th>{t("spc_module", lang)}</th><th>{t("spc_priority", lang)}</th><th>{t("spc_status", lang)}</th><th>{t("spc_assignee", lang)}</th>
            <th>{t("spc_raised", lang)}</th><th>{t("spc_first_response", lang)}</th><th>{t("spc_resolved", lang)}</th><th>{t("spc_turnaround", lang)}</th><th></th>
          </tr></thead>
          <tbody className="divide-y divide-surface-100">
            {list.slice(0, 100).map((x) => (
              <tr key={x.id} className={x.overdue ? "bg-red-50/40" : ""}>
                <td className="px-3 py-2"><b>{x.ref}</b><p className="max-w-[260px] truncate text-surface-500">{x.title}</p></td>
                <td>{x.module}</td>
                <td><span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${PRI_TONE[x.priority]}`}>{x.priority}</span></td>
                <td>{x.status}{x.overdue && <span className="ml-1 text-red-700">⚠</span>}</td>
                <td>{x.assignee}</td>
                <td>{fmt(x.raisedAt)}</td><td>{fmt(x.firstResponseAt)}</td><td>{fmt(x.resolvedAt)}</td>
                <td>{formatHours(x.turnaroundHours)}</td>
                <td>{!migrationPending && <SupportStatusForm ticketId={x.id} status={x.status} priority={x.priority} module={x.module}
                  labels={{ update: t("spc_update", lang), note: t("spc_note", lang), statuses: [...STATUSES], priorities: [...PRIORITIES] }} />}
                  {x.status !== "resolved" && x.status !== "closed" && <SupportAssignForm ticketId={x.id} people={people ?? []} agents={agentList} />}</td>
              </tr>
            ))}
            {list.length === 0 && <tr><td colSpan={10} className="p-6 text-center text-surface-400">{t("spc_none", lang)}</td></tr>}
          </tbody>
        </table>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="overflow-x-auto p-0">
          <h2 className="border-b px-4 py-3 text-sm font-semibold">{t("spc_developers", lang)}</h2>
          <table className="w-full text-left text-xs"><thead className="bg-surface-50 text-[10px] uppercase text-surface-500"><tr>
            <th className="px-3 py-2">{t("spc_assignee", lang)}</th><th>{t("spc_total", lang)}</th><th>{t("spc_open", lang)}</th><th>{t("spc_resolved", lang)}</th><th>{t("spc_overdue", lang)}</th><th>{t("spc_avg_response", lang)}</th><th>{t("spc_turnaround", lang)}</th>
          </tr></thead><tbody className="divide-y divide-surface-100">
            {devs.map((d) => <tr key={d.name}><td className="px-3 py-2 font-medium">{d.name}</td><td>{d.total}</td><td>{d.open}</td><td>{d.resolved}</td><td className="text-red-700">{d.overdue}</td><td>{formatHours(d.avgResponseHours)}</td><td>{formatHours(d.avgTurnaroundHours)}</td></tr>)}
            {devs.length === 0 && <tr><td colSpan={7} className="p-6 text-center text-surface-400">{t("spc_none", lang)}</td></tr>}
          </tbody></table>
        </Card>
        <Card className="overflow-x-auto p-0">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <h2 className="text-sm font-semibold">{t("spc_summary", lang)}</h2>
            <div className="flex gap-2 text-xs">
              {(["day", "week", "month"] as const).map((p) => <Link key={p} href={`?view=${view}&period=${p}`} className={period === p ? "font-bold text-brand-700" : "text-surface-500"}>{t(p === "day" ? "spc_daily" : p === "week" ? "spc_weekly" : "spc_monthly", lang)}</Link>)}
            </div>
          </div>
          <table className="w-full text-left text-xs"><thead className="bg-surface-50 text-[10px] uppercase text-surface-500"><tr>
            <th className="px-3 py-2"></th><th>{t("spc_raised", lang)}</th><th>{t("spc_resolved", lang)}</th><th>{t("spc_turnaround", lang)}</th>
          </tr></thead><tbody className="divide-y divide-surface-100">
            {sums.map((s) => <tr key={s.period}><td className="px-3 py-2">{s.period}</td><td>{s.raised}</td><td>{s.resolved}</td><td>{formatHours(s.avgTurnaroundHours)}</td></tr>)}
          </tbody></table>
        </Card>
      </div>

      <Card className="p-0">
        <h2 className="border-b px-4 py-3 text-sm font-semibold">{t("spc_history", lang)}</h2>
        <div className="max-h-[400px] divide-y divide-surface-100 overflow-y-auto text-xs">
          {events.map((e: any) => (
            <div key={e.id} className="px-4 py-2">
              <b className="text-brand-700">{refById.get(e.ticket_id)}</b> · {e.event_type}: {e.from_value ?? "—"} → {e.to_value ?? "—"}
              {e.note && <p className="text-surface-600">{e.note}</p>}
              <p className="text-[10px] text-surface-400">{e.actor?.full_name ?? "System"} · {fmt(e.created_at)} · {pkDate(e.created_at)}</p>
            </div>
          ))}
          {events.length === 0 && <p className="p-6 text-center text-surface-400">{t("spc_none", lang)}</p>}
        </div>
      </Card>
    </div>
  );
}
