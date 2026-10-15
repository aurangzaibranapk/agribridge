import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

const AGENT_STATUSES = new Set(["working", "blocked", "testing", "completed", "failed"]);

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const expected = process.env.SUPPORT_AGENT_CALLBACK_SECRET?.trim();
  const supplied = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  if (!expected || !supplied || supplied !== expected) {
    return NextResponse.json({ error: "Agent callback authorized nahi hai." }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const assignmentStatus = String(body.status ?? "working").toLowerCase();
  const message = String(body.message ?? "").trim().slice(0, 3000);
  const resolution = String(body.resolution ?? "").trim().slice(0, 3000);
  const externalTaskId = String(body.taskId ?? "").trim().slice(0, 300);
  if (!AGENT_STATUSES.has(assignmentStatus)) {
    return NextResponse.json({ error: "Agent status theek nahi hai." }, { status: 400 });
  }

  const service = createServiceClient() as any;
  const { data: ticket } = await service
    .from("support_tickets")
    .select("id,assigned_kind,assigned_agent,status")
    .eq("id", params.id)
    .maybeSingle();
  if (!ticket || ticket.assigned_kind !== "agent") {
    return NextResponse.json({ error: "Agent ticket nahi mila." }, { status: 404 });
  }

  const now = new Date().toISOString();
  const completed = assignmentStatus === "completed";
  const { error } = await service.from("support_tickets").update({
    assignment_status: assignmentStatus,
    last_agent_update_at: now,
    external_task_id: externalTaskId || undefined,
    status: completed ? "testing" : assignmentStatus === "testing" ? "testing" : "investigating",
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
  return NextResponse.json({ success: true });
}
