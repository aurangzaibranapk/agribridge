import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { notifyUser } from "@/lib/notifications";
import { dispatchSupportTicket } from "@/lib/support/agent-dispatch";

const MANAGERS = new Set(["owner", "super_admin", "admin", "manager", "admin_assistant"]);
const STATUSES = new Set(["new", "assigned", "investigating", "testing", "resolved", "reopened"]);

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const client = createClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user) return NextResponse.json({ error: "Login zaroori hai." }, { status: 401 });
  const service = createServiceClient();
  // Support tables are added by the accompanying migration and may not yet
  // exist in an older generated Database type snapshot.
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
  if (!canManage && !(ticket.reporter_id === user.id && status === "reopened")) return NextResponse.json({ error: "Ijazat nahi hai." }, { status: 403 });

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
    await notifyUser(assignee.id, `Support Issue ISS-${ticket.ticket_no}`, ticket.title, "/admin/my-work");
    return NextResponse.json({ success: true, message: `${assignee.full_name} ko issue mil gaya.` });
  }

  if (canManage && agentKey) {
    let screenshotUrl: string | null = null;
    if (ticket.screenshot_path) {
      const signed = await service.storage.from("support-evidence").createSignedUrl(ticket.screenshot_path, 24 * 60 * 60);
      screenshotUrl = signed.data?.signedUrl ?? null;
    }
    const callbackUrl = new URL(`/api/support/tickets/${ticket.id}/agent-update`, req.url).toString();
    const dispatched = await dispatchSupportTicket(agentKey, {
      id: ticket.id,
      ticketNo: ticket.ticket_no,
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
      assignment_status: "dispatched",
      assigned_at: now,
      external_task_id: dispatched.externalTaskId ?? null,
      last_agent_update_at: now,
      status: "investigating",
      updated_at: now,
    }).eq("id", ticket.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    await supportDb.from("support_ticket_comments").insert({
      ticket_id: ticket.id,
      author_id: user.id,
      body: dispatched.message || `${agentKey} agent ko issue bhej diya gaya.`,
    });
    return NextResponse.json({ success: true, message: "Agent ne task receive kar liya." });
  }

  if (!STATUSES.has(status)) return NextResponse.json({ error: "Status theek nahi hai." }, { status: 400 });
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
  return NextResponse.json({ success: true });
}
