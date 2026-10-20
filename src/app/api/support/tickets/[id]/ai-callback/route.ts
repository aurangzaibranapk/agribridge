import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { notifyUser } from "@/lib/notifications";
import { callbackAuthorized } from "@/lib/support/ai-agent-webhook";
import { COMPLAINT_STAGE_META, complaintStageOf } from "@/lib/support/complaint-stage";
import { enqueueCallerStageSms } from "@/lib/sms/stage-sms";

const ALLOWED = new Set(["in_progress", "review", "completed", "rejected"]);

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const gate = callbackAuthorized(req.headers.get("x-agribridge-ai-token"), process.env.AI_AGENT_CALLBACK_SECRET);
  if (gate === "unset") return NextResponse.json({ error: "AI callback secret set nahi." }, { status: 503 });
  if (gate === "denied") return NextResponse.json({ error: "AI callback authorized nahi hai." }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const stage = complaintStageOf(String(body.stage ?? body.status ?? ""));
  const note = String(body.note ?? body.message ?? "").trim().slice(0, 3000);
  if (stage && !ALLOWED.has(stage)) return NextResponse.json({ error: "Stage theek nahi hai." }, { status: 400 });
  if (!stage && note.length < 1) return NextResponse.json({ error: "Note ya stage likhein." }, { status: 400 });

  const service = createServiceClient() as any;
  const { data: ticket } = await service.from("support_tickets").select("id,title,organization_id,reporter_id,complaint_stage,intake_source").eq("id", params.id).maybeSingle();
  if (!ticket || !["staff", "call_center"].includes(String(ticket.intake_source))) {
    return NextResponse.json({ error: "Complaint ticket nahi mili." }, { status: 404 });
  }
  if (stage) {
    const meta = COMPLAINT_STAGE_META[stage];
    const { error } = await service.from("support_tickets").update({
      complaint_stage: stage,
      stage_percent: meta.percent,
      status: meta.status,
      updated_at: new Date().toISOString(),
      resolved_at: stage === "completed" ? new Date().toISOString() : undefined,
      resolution_note: stage === "completed" ? note || undefined : undefined,
    }).eq("id", ticket.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    await service.from("support_ticket_events").insert({
      ticket_id: ticket.id,
      organization_id: ticket.organization_id,
      actor_id: null,
      event_type: "status",
      from_value: ticket.complaint_stage,
      to_value: stage,
      note: note || "AI agent update.",
    });
    if (ticket.reporter_id) await notifyUser(ticket.reporter_id, "AI agent ne stage badla", `${ticket.title}: ${meta.rm}`, "/admin/my-work");
    if (ticket.intake_source === "call_center") {
      try { await enqueueCallerStageSms(service, ticket, stage); } catch { /* SMS queue rehti hai */ }
    }
  } else {
    await service.from("support_ticket_events").insert({
      ticket_id: ticket.id,
      organization_id: ticket.organization_id,
      actor_id: null,
      event_type: "comment",
      from_value: ticket.complaint_stage,
      to_value: ticket.complaint_stage,
      note,
    });
  }
  return NextResponse.json({ success: true });
}
