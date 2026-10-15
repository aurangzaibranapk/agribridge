import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { PRIORITIES, STATUSES, canTransition, mapStatus, type Status } from "@/lib/support/sla";

const MANAGERS = new Set(["owner", "super_admin", "admin", "manager", "admin_assistant"]);

/**
 * Support Center: status / priority / module badalna -- har tabdeeli
 * `support_ticket_events` mein likhi jati hai (append-only). Purana
 * ticket row nahi badla jata; naya paimaana `support_ticket_meta` mein.
 */
export async function POST(req: NextRequest) {
  const client = createClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user) return NextResponse.json({ error: "Login zaroori hai." }, { status: 401 });
  const service = createServiceClient() as any;
  const { data: me } = await service.from("profiles").select("id,role,organization_id,is_active").eq("id", user.id).maybeSingle();
  if (!me?.is_active || !MANAGERS.has(String(me.role))) return NextResponse.json({ error: "Ijazat nahi." }, { status: 403 });

  const body = (await req.json().catch(() => ({}))) as { ticket_id?: string; status?: string; priority?: string; module?: string; note?: string };
  if (!body.ticket_id) return NextResponse.json({ error: "ticket_id zaroori hai." }, { status: 400 });
  if (body.status && !(STATUSES as readonly string[]).includes(body.status)) return NextResponse.json({ error: "Ghalat status." }, { status: 400 });
  if (body.priority && !(PRIORITIES as readonly string[]).includes(body.priority)) return NextResponse.json({ error: "Ghalat priority." }, { status: 400 });
  const note = body.note?.trim().slice(0, 3000) || null;

  const { data: ticket } = await service.from("support_tickets").select("id,organization_id,status,assignment_status,priority").eq("id", body.ticket_id).maybeSingle();
  if (!ticket || ticket.organization_id !== me.organization_id) return NextResponse.json({ error: "Ticket nahi mila." }, { status: 404 });
  const { data: meta, error: metaErr } = await service.from("support_ticket_meta").select("*").eq("ticket_id", ticket.id).maybeSingle();
  if (metaErr) return NextResponse.json({ error: "Support Center migration (529) abhi nahi lagi." }, { status: 503 });

  const current: Status = mapStatus(ticket.status, ticket.assignment_status, meta?.workflow_status);
  const events: any[] = [];
  const patch: Record<string, unknown> = {};
  const nowIso = new Date().toISOString();
  if (body.status) {
    if (!canTransition(current, body.status as Status)) return NextResponse.json({ error: `${current} se ${body.status} nahi ho sakta.` }, { status: 409 });
    patch.workflow_status = body.status;
    if (body.status === "closed") patch.closed_at = nowIso;
    events.push({ event_type: "status", from_value: current, to_value: body.status });
  }
  if (body.priority && body.priority !== meta?.priority_level) {
    patch.priority_level = body.priority;
    events.push({ event_type: "priority", from_value: meta?.priority_level ?? ticket.priority, to_value: body.priority });
  }
  if (body.module !== undefined && body.module.trim() !== (meta?.module ?? "")) {
    patch.module = body.module.trim().slice(0, 80) || null;
    events.push({ event_type: "module", from_value: meta?.module ?? null, to_value: patch.module });
  }
  if (!events.length && note) events.push({ event_type: "comment" });
  if (!events.length) return NextResponse.json({ error: "Koi tabdeeli nahi." }, { status: 400 });
  if (!meta?.first_response_at) patch.first_response_at = nowIso;

  const { error: upErr } = await service.from("support_ticket_meta").upsert(
    { ticket_id: ticket.id, organization_id: ticket.organization_id, ...(meta ?? {}), ...patch, updated_by: me.id, updated_at: nowIso },
    { onConflict: "ticket_id" },
  );
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });
  const { error: evErr } = await service.from("support_ticket_events").insert(
    events.map((e) => ({ ...e, note, ticket_id: ticket.id, organization_id: ticket.organization_id, actor_id: me.id })),
  );
  if (evErr) return NextResponse.json({ error: evErr.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
