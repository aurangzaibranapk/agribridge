import { createHmac, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { notifyUser } from "@/lib/notifications";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MANAGER_ROLES = ["owner", "super_admin", "admin", "manager", "admin_assistant"];

function validSignature(raw: string, signature: string | null) {
  const secret = process.env.SUPPORT_GITHUB_WEBHOOK_SECRET?.trim();
  if (!secret || !signature?.startsWith("sha256=")) return false;
  const expected = Buffer.from(`sha256=${createHmac("sha256", secret).update(raw).digest("hex")}`);
  const supplied = Buffer.from(signature);
  return expected.length === supplied.length && timingSafeEqual(expected, supplied);
}

function markerStatus(body: string): string | null {
  if (/\[AGRIBRIDGE:APPROVAL_REQUIRED:/i.test(body)) return "approval_required";
  if (/\[AGRIBRIDGE:APPROVED:/i.test(body)) return "approved";
  if (/\[AGRIBRIDGE:CHANGES_REQUESTED:/i.test(body)) return "blocked";
  if (/\[AGRIBRIDGE:WORKING:/i.test(body)) return "working";
  if (/\[AGRIBRIDGE:TESTING:/i.test(body)) return "testing";
  if (/\[AGRIBRIDGE:FIXED:/i.test(body)) return "fixed";
  return null;
}

function ticketStatus(assignmentStatus: string) {
  if (["approval_required", "approved", "blocked"].includes(assignmentStatus)) return "assigned";
  if (["testing", "fixed"].includes(assignmentStatus)) return "testing";
  return "investigating";
}

async function notifyAudience(service: any, ticket: any, message: string) {
  const recipients = new Set<string>();
  if (ticket.reporter_id) recipients.add(ticket.reporter_id);
  const { data: managers } = await service
    .from("profiles")
    .select("id")
    .eq("organization_id", ticket.organization_id)
    .eq("is_active", true)
    .in("role", MANAGER_ROLES);
  for (const manager of managers ?? []) recipients.add(manager.id);
  const reference = `ISS-${new Date(ticket.created_at || Date.now()).getFullYear()}-${String(ticket.ticket_no).padStart(5, "0")}`;
  await Promise.all(Array.from(recipients).map((id) => notifyUser(id, `${reference} · Agent Update`, message, "/admin/my-work")));
}

async function handleIssueComment(service: any, payload: any) {
  if (!["created", "edited"].includes(String(payload.action))) return;
  const issueUrl = String(payload.issue?.html_url ?? "");
  const comment = String(payload.comment?.body ?? "").trim().slice(0, 3000);
  if (!issueUrl || !comment) return;

  const { data: ticket } = await service
    .from("support_tickets")
    .select("*")
    .eq("assigned_kind", "agent")
    .eq("assigned_agent", "codex_subscription")
    .eq("external_task_id", issueUrl)
    .maybeSingle();
  if (!ticket) return;

  let assignmentStatus = markerStatus(comment) ?? (ticket.assignment_status === "analysis_requested" ? "analysis" : ticket.assignment_status);
  const requiresApproval = ["working", "testing", "fixed"].includes(assignmentStatus);
  if (requiresApproval && !["approved", "working", "testing", "fixed"].includes(String(ticket.assignment_status))) {
    assignmentStatus = "approval_required";
    await service.from("support_ticket_comments").insert({
      ticket_id: ticket.id,
      author_id: null,
      source_label: "GitHub Guard",
      body: "Agent ne approval se pehle work stage bheji; system ne work rok kar approval required rakha.",
    });
  }

  const now = new Date().toISOString();
  await service.from("support_tickets").update({
    assignment_status: assignmentStatus,
    status: ticketStatus(assignmentStatus),
    last_agent_update_at: now,
    updated_at: now,
  }).eq("id", ticket.id);
  await service.from("support_ticket_comments").insert({
    ticket_id: ticket.id,
    author_id: null,
    source_label: `GitHub · ${String(payload.sender?.login ?? "Codex")}`,
    body: comment,
  });
  await notifyAudience(service, ticket, assignmentStatus === "approval_required"
    ? "Agent analysis complete hai; Admin approval required hai."
    : `Agent stage: ${assignmentStatus} — ${comment.slice(0, 180)}`);
}

async function handlePullRequest(service: any, payload: any) {
  if (!["opened", "reopened", "ready_for_review", "synchronize"].includes(String(payload.action))) return;
  const pr = payload.pull_request;
  const searchable = `${String(pr?.title ?? "")}\n${String(pr?.body ?? "")}`;
  const match = searchable.match(/ISS-(\d{4})-(\d{5,})/i);
  if (!match) return;
  const ticketNo = Number(match[2]);
  if (!Number.isFinite(ticketNo)) return;

  const { data: ticket } = await service
    .from("support_tickets")
    .select("*")
    .eq("ticket_no", ticketNo)
    .eq("assigned_kind", "agent")
    .maybeSingle();
  if (!ticket) return;

  const allowed = ["approved", "working", "testing", "fixed"].includes(String(ticket.assignment_status));
  const status = allowed ? "testing" : "approval_required";
  const now = new Date().toISOString();
  await service.from("support_tickets").update({
    assignment_status: status,
    status: allowed ? "testing" : "assigned",
    last_agent_update_at: now,
    updated_at: now,
  }).eq("id", ticket.id);
  await service.from("support_ticket_comments").insert({
    ticket_id: ticket.id,
    author_id: null,
    source_label: "GitHub Pull Request",
    body: allowed
      ? `PR #${pr?.number ?? payload.number} testing ke liye tayar: ${String(pr?.html_url ?? "")}`
      : `PR approval ke baghair bana; verification roki gayi: ${String(pr?.html_url ?? "")}`,
  });
  await notifyAudience(service, ticket, allowed
    ? "Agent ne Pull Request bana di; testing/Admin verification required hai."
    : "Agent ne approval gate bypass kiya; system ne issue rok diya.");
}

export async function POST(req: NextRequest) {
  const raw = await req.text();
  if (!validSignature(raw, req.headers.get("x-hub-signature-256"))) {
    return NextResponse.json({ error: "GitHub webhook signature invalid hai." }, { status: 401 });
  }
  const event = String(req.headers.get("x-github-event") ?? "");
  const payload = JSON.parse(raw || "{}");
  const service = createServiceClient() as any;

  if (event === "ping") return NextResponse.json({ success: true, pong: true });
  if (event === "issue_comment") await handleIssueComment(service, payload);
  if (event === "pull_request") await handlePullRequest(service, payload);
  return NextResponse.json({ success: true });
}
