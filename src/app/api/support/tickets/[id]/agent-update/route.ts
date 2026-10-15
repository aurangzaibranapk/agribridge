import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { notifyUser } from "@/lib/notifications";

const MANAGER_ROLES = ["owner", "super_admin", "admin", "manager", "admin_assistant"];
const AGENT_STATUSES = new Set(["analysis", "approval_required", "working", "blocked", "testing", "fixed", "completed", "failed"]);
const WORK_STATUSES = new Set(["working", "testing", "fixed", "completed"]);

function ticketReference(ticket: any) {
  const year = new Date(ticket.created_at || Date.now()).getFullYear();
  return `ISS-${year}-${String(ticket.ticket_no).padStart(5, "0")}`;
}

async function notifyAudience(service: any, ticket: any, title: string, message: string) {
  const recipients = new Set<string>();
  if (ticket.reporter_id) recipients.add(ticket.reporter_id);
  const { data: managers } = await service
    .from("profiles")
    .select("id")
    .eq("organization_id", ticket.organization_id)
    .eq("is_active", true)
    .in("role", MANAGER_ROLES);
  for (const manager of managers ?? []) recipients.add(manager.id);
  await Promise.all(Array.from(recipients).map((id) => notifyUser(id, title, message, "/admin/my-work")));
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const expected = process.env.SUPPORT_AGENT_CALLBACK_SECRET?.trim();
  const supplied = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  if (!expected || !supplied || supplied !== expected) {
    return NextResponse.json({ error: "Agent callback authorized nahi hai." }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const requestedStatus = String(body.status ?? "analysis").toLowerCase();
  const assignmentStatus = requestedStatus === "completed" ? "fixed" : requestedStatus;
  const message = String(body.message ?? "").trim().slice(0, 3000);
  const resolution = String(body.resolution ?? "").trim().slice(0, 3000);
  const externalTaskId = String(body.taskId ?? "").trim().slice(0, 500);
  if (!AGENT_STATUSES.has(requestedStatus)) {
    return NextResponse.json({ error: "Agent status theek nahi hai." }, { status: 400 });
  }

  const service = createServiceClient() as any;
  const { data: ticket } = await service
    .from("support_tickets")
    .select("id,ticket_no,created_at,organization_id,reporter_id,assigned_kind,assigned_agent,assignment_status,status")
    .eq("id", params.id)
    .maybeSingle();
  if (!ticket || ticket.assigned_kind !== "agent") {
    return NextResponse.json({ error: "Agent ticket nahi mila." }, { status: 404 });
  }

  if (WORK_STATUSES.has(requestedStatus) && !["approved", "working", "testing", "fixed"].includes(String(ticket.assignment_status))) {
    return NextResponse.json({ error: "Owner/Admin approval ke baghair agent work start nahi kar sakta." }, { status: 409 });
  }

  const now = new Date().toISOString();
  const ticketStatus = assignmentStatus === "approval_required" || assignmentStatus === "blocked"
    ? "assigned"
    : ["testing", "fixed"].includes(assignmentStatus)
      ? "testing"
      : "investigating";
  const { error } = await service.from("support_tickets").update({
    assignment_status: assignmentStatus,
    last_agent_update_at: now,
    external_task_id: externalTaskId || undefined,
    status: ticketStatus,
    resolution_note: resolution || undefined,
    updated_at: now,
  }).eq("id", ticket.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (message || resolution) {
    await service.from("support_ticket_comments").insert({
      ticket_id: ticket.id,
      author_id: null,
      source_label: `AI Agent: ${ticket.assigned_agent}`,
      body: message || resolution,
    });
  }

  const reference = ticketReference(ticket);
  const labels: Record<string, string> = {
    analysis: "Agent issue analyze kar raha hai.",
    approval_required: "Agent ki analysis aur proposed fix approval ke liye tayar hai.",
    working: "Approved fix par kaam shuru ho gaya.",
    blocked: "Agent ko blocker mila hai; Admin attention chahiye.",
    testing: "Fix ki testing aur production build chal rahi hai.",
    fixed: "Fix complete hai aur Admin verification ke liye tayar hai.",
    failed: "Agent task fail hua; Admin review chahiye.",
  };
  await notifyAudience(service, ticket, `${reference} · ${assignmentStatus}`, message || resolution || labels[assignmentStatus] || "Issue update ho gaya.");
  return NextResponse.json({ success: true });
}
