import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { notifyUser } from "@/lib/notifications";
import { dispatchSupportTicket, postSupportAgentComment } from "@/lib/support/agent-dispatch";

const MANAGER_ROLES = ["owner", "super_admin", "admin", "manager", "admin_assistant"];
const MANAGERS = new Set(MANAGER_ROLES);
const STATUSES = new Set(["new", "assigned", "investigating", "testing", "resolved", "reopened"]);

async function notifyAudience(service: any, ticket: any, title: string, message: string) {
  const recipients = new Set<string>();
  if (ticket.reporter_id) recipients.add(ticket.reporter_id);
  if (ticket.assigned_to) recipients.add(ticket.assigned_to);
  const { data: managers } = await service
    .from("profiles")
    .select("id")
    .eq("organization_id", ticket.organization_id)
    .eq("is_active", true)
    .in("role", MANAGER_ROLES);
  for (const manager of managers ?? []) recipients.add(manager.id);
  await Promise.all(Array.from(recipients).map((id) => notifyUser(id, title, message, "/admin/my-work")));
}

function ticketReference(ticket: any) {
  const year = new Date(ticket.created_at || Date.now()).getFullYear();
  return `ISS-${year}-${String(ticket.ticket_no).padStart(5, "0")}`;
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const client = createClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user) return NextResponse.json({ error: "Login zaroori hai." }, { status: 401 });
  const service = createServiceClient();
  const supportDb = service as any;
  const { data: me } = await service.from("profiles").select("id,role,organization_id,is_active").eq("id", user.id).maybeSingle();
  if (!me?.is_active) return NextResponse.json({ error: "Account inactive hai." }, { status: 403 });
  const { data: ticket } = await supportDb.from("support_tickets").select("*").eq("id", params.id).maybeSingle();
  if (!ticket || ticket.organization_id !== me.organization_id) return NextResponse.json({ error: "Ticket nahi mila." }, { status: 404 });

  const body = await req.json();
  const status = String(body.status ?? "");
  const note = String(body.note ?? "").trim().slice(0, 3000);
  const canManage = MANAGERS.has(String(me.role));
  const assigneeId = String(body.assigneeId ?? "").trim();
  const agentKey = String(body.agentKey ?? "").trim().toLowerCase();
  const workflowAction = String(body.workflowAction ?? "").trim().toLowerCase();
  if (!canManage && !(ticket.reporter_id === user.id && status === "reopened")) return NextResponse.json({ error: "Ijazat nahi hai." }, { status: 403 });

  if (canManage && workflowAction === "approve_fix") {
    if (ticket.assigned_kind !== "agent" || ticket.assignment_status !== "approval_required") {
      return NextResponse.json({ error: "Agent ka analysis aur approval request abhi complete nahi hai." }, { status: 409 });
    }
    const reference = ticketReference(ticket);
    const approvalMessage = `[AGRIBRIDGE:APPROVED:${reference}]\n\nOwner/Admin ne proposed fix approve kar diya hai. Ab approved plan ke mutabiq kaam shuru karein aur har stage ka marker post karein.`;
    const posted = await postSupportAgentComment(ticket.assigned_agent, ticket.external_task_id || "", approvalMessage);
    if (!posted.ok) return NextResponse.json({ error: posted.error }, { status: 502 });

    const now = new Date().toISOString();
    const { error } = await supportDb.from("support_tickets").update({
      assignment_status: "approved",
      status: "assigned",
      last_agent_update_at: now,
      updated_at: now,
    }).eq("id", ticket.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    await supportDb.from("support_ticket_comments").insert({
      ticket_id: ticket.id,
      author_id: user.id,
      body: "Proposed fix approve kar diya gaya. Agent ko kaam shuru karne ki ijazat mil gayi.",
    });
    await notifyAudience(service, ticket, `${reference} · Fix Approved`, "Admin ne agent ka fix plan approve kar diya; work start ho raha hai.");
    return NextResponse.json({ success: true, message: "Fix approve ho gaya. Agent ko work start signal mil gaya." });
  }

  if (canManage && workflowAction === "request_changes") {
    if (ticket.assigned_kind !== "agent") return NextResponse.json({ error: "Ye agent ticket nahi hai." }, { status: 409 });
    if (!note) return NextResponse.json({ error: "Required changes likhein." }, { status: 400 });
    const reference = ticketReference(ticket);
    const changeMessage = `[AGRIBRIDGE:CHANGES_REQUESTED:${reference}]\n\nAdmin feedback:\n${note}\n\nPlan revise karein aur dobara approval request bhejein. Abhi code change na karein.`;
    const posted = await postSupportAgentComment(ticket.assigned_agent, ticket.external_task_id || "", changeMessage);
    if (!posted.ok) return NextResponse.json({ error: posted.error }, { status: 502 });

    const now = new Date().toISOString();
    const { error } = await supportDb.from("support_tickets").update({
      assignment_status: "blocked",
      status: "assigned",
      last_agent_update_at: now,
      updated_at: now,
    }).eq("id", ticket.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    await supportDb.from("support_ticket_comments").insert({ ticket_id: ticket.id, author_id: user.id, body: `Plan changes requested: ${note}` });
    await notifyAudience(service, ticket, `${reference} · Plan Revision`, "Admin ne agent se plan revise karne ko kaha hai.");
    return NextResponse.json({ success: true, message: "Agent ko plan revise karne ka feedback bhej diya." });
  }

  if (canManage && assigneeId) {
    const { data: assignee } = await service
      .from("profiles")
      .select("id,full_name,organization_id,is_active")
      .eq("id", assigneeId)
      .maybeSingle();
    if (!assignee?.is_active || assignee.organization_id !== me.organization_id) {
      return NextResponse.json({ error: "Assignee active staff member nahi mila." }, { status: 400 });
    }
    const now = new Date().toISOString();
    const { error } = await supportDb.from("support_tickets").update({
      assigned_to: assignee.id,
      assigned_kind: "person",
      assigned_agent: null,
      assignment_status: "queued",
      assigned_at: now,
      status: "assigned",
      updated_at: now,
    }).eq("id", ticket.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    await supportDb.from("support_ticket_comments").insert({
      ticket_id: ticket.id,
      author_id: user.id,
      body: `${assignee.full_name} ko assign kiya gaya.`,
    });
    await notifyUser(assignee.id, `Support Issue ${ticketReference(ticket)}`, ticket.title, "/admin/my-work");
    await notifyUser(ticket.reporter_id, `${ticketReference(ticket)} · Assigned`, `Issue ${assignee.full_name} ko assign ho gaya.`, "/admin/my-work");
    return NextResponse.json({ success: true, message: `${assignee.full_name} ko issue mil gaya.` });
  }

  if (canManage && agentKey) {
    if (ticket.assigned_agent === agentKey && /^https:\/\/github\.com\//i.test(String(ticket.external_task_id ?? ""))) {
      return NextResponse.json({ success: true, message: "Is ticket ka GitHub/Codex task pehle se bana hua hai." });
    }
    let screenshotUrl: string | null = null;
    if (ticket.screenshot_path) {
      const signed = await service.storage.from("support-evidence").createSignedUrl(ticket.screenshot_path, 24 * 60 * 60);
      screenshotUrl = signed.data?.signedUrl ?? null;
    }
    const callbackUrl = new URL(`/api/support/tickets/${ticket.id}/agent-update`, req.url).toString();
    const dispatched = await dispatchSupportTicket(agentKey, {
      id: ticket.id,
      ticketNo: ticket.ticket_no,
      createdAt: ticket.created_at,
      title: ticket.title,
      description: ticket.description,
      priority: ticket.priority,
      pageUrl: ticket.page_url,
      deviceInfo: ticket.device_info,
      screenshotUrl,
    }, callbackUrl);
    if (!dispatched.ok) return NextResponse.json({ error: dispatched.error }, { status: 502 });
    const now = new Date().toISOString();
    const { error } = await supportDb.from("support_tickets").update({
      assigned_to: null,
      assigned_kind: "agent",
      assigned_agent: agentKey,
      assignment_status: dispatched.assignmentStatus ?? "analysis_requested",
      assigned_at: now,
      external_task_id: dispatched.externalTaskId ?? null,
      last_agent_update_at: now,
      status: dispatched.ticketStatus ?? "investigating",
      updated_at: now,
    }).eq("id", ticket.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    await supportDb.from("support_ticket_comments").insert({
      ticket_id: ticket.id,
      author_id: user.id,
      body: dispatched.message || `${agentKey} agent ko analysis ke liye issue bhej diya gaya.`,
    });
    await notifyAudience(service, ticket, `${ticketReference(ticket)} · Agent Analysis`, "Issue agent ko analysis ke liye assign ho gaya. Fix se pehle Admin approval li jayegi.");
    return NextResponse.json({ success: true, message: "Agent analysis task create ho gaya. Fix approval ke baad start hogi." });
  }

  if (!STATUSES.has(status)) return NextResponse.json({ error: "Status theek nahi hai." }, { status: 400 });
  if (
    status === "resolved"
    && ticket.assigned_kind === "agent"
    && !["testing", "fixed", "completed"].includes(String(ticket.assignment_status))
  ) {
    return NextResponse.json({ error: "Agent fix aur testing complete hone se pehle issue close nahi ho sakta." }, { status: 409 });
  }
  const update: Record<string, unknown> = { status, updated_at: new Date().toISOString() };
  if (canManage && body.assignToMe) {
    update.assigned_to = user.id;
    update.assigned_kind = "person";
    update.assigned_agent = null;
    update.assignment_status = "working";
    update.assigned_at = new Date().toISOString();
  }
  if (status === "resolved") { update.resolved_at = new Date().toISOString(); update.resolution_note = note || null; }
  if (status === "reopened") update.resolved_at = null;
  const { error } = await supportDb.from("support_tickets").update(update as any).eq("id", ticket.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (note) await supportDb.from("support_ticket_comments").insert({ ticket_id: ticket.id, author_id: user.id, body: note } as any);
  await notifyAudience(service, ticket, `${ticketReference(ticket)} · ${status}`, note || `Issue status ${status} ho gaya.`);
  return NextResponse.json({ success: true });
}
