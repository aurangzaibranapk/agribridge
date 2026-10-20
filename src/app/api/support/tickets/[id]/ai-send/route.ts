import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { notifyUser } from "@/lib/notifications";
import { canAssignComplaints } from "@/lib/support/complaint-intake";
import { AI_DISCONNECTED_LABEL, AI_SCREENSHOT_TTL_SECONDS, buildAiTicketBody, postComplaintToAiAgent } from "@/lib/support/ai-agent-webhook";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const client = createClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user) return NextResponse.json({ error: "Login zaroori hai." }, { status: 401 });
  const service = createServiceClient();
  const { data: me } = await service.from("profiles").select("id,role,organization_id,is_active").eq("id", user.id).maybeSingle();
  if (!me?.is_active) return NextResponse.json({ error: "Account inactive hai." }, { status: 403 });
  if (!canAssignComplaints(String(me.role))) return NextResponse.json({ error: "AI ko sirf Owner ya Admin bhejta hai." }, { status: 403 });
  const db = service as any;
  const { data: ticket } = await db.from("support_tickets").select("id,title,description,organization_id,reporter_id,intake_source,suggested_department,routed_label").eq("id", params.id).maybeSingle();
  if (!ticket || ticket.organization_id !== me.organization_id) return NextResponse.json({ error: "Ticket nahi mila." }, { status: 404 });
  if (!["staff", "call_center"].includes(String(ticket.intake_source))) {
    return NextResponse.json({ error: "Ye complaint queue ka ticket nahi." }, { status: 400 });
  }
  if (!process.env.AI_AGENT_WEBHOOK_URL?.trim()) {
    return NextResponse.json({ connected: false, message: AI_DISCONNECTED_LABEL }, { status: 200 });
  }
  const { data: files } = await db.from("support_ticket_attachments").select("storage_path").eq("ticket_id", ticket.id);
  const screenshotUrls: string[] = [];
  for (const file of files ?? []) {
    const signed = await service.storage.from("support-evidence").createSignedUrl(file.storage_path, AI_SCREENSHOT_TTL_SECONDS);
    if (signed.data?.signedUrl) screenshotUrls.push(signed.data.signedUrl);
  }
  const link = new URL(`/admin/my-work/support-dashboard`, req.url).toString();
  const payload = buildAiTicketBody({
    id: ticket.id,
    title: ticket.title,
    description: ticket.description,
    category: ticket.suggested_department ?? ticket.routed_label ?? null,
    screenshotUrls,
    link,
  });
  const sent = await postComplaintToAiAgent({
    payload,
    env: {
      AI_AGENT_WEBHOOK_URL: process.env.AI_AGENT_WEBHOOK_URL,
      AI_AGENT_WEBHOOK_SECRET: process.env.AI_AGENT_WEBHOOK_SECRET,
    },
  });
  if (!sent.ok) return NextResponse.json({ connected: sent.connected, message: sent.message }, { status: sent.connected ? 502 : 200 });
  const marked = await (client as any).rpc("fn_complaint_mark_ai", { p_ticket: ticket.id });
  if (marked.error) return NextResponse.json({ error: marked.error.message }, { status: 400 });
  if (ticket.reporter_id && ticket.reporter_id !== user.id) {
    await notifyUser(ticket.reporter_id, "Shikayat AI agent ko gayi", ticket.title, "/admin/my-work");
  }
  return NextResponse.json({ success: true, connected: true, message: "AI agent ko bhej diya." });
}
