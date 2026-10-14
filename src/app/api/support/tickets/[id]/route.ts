import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

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
  const { data: ticket } = await supportDb.from("support_tickets").select("id,reporter_id,organization_id,status").eq("id", params.id).maybeSingle();
  if (!ticket || ticket.organization_id !== me.organization_id) return NextResponse.json({ error: "Ticket nahi mila." }, { status: 404 });

  const body = await req.json();
  const status = String(body.status ?? "");
  const note = String(body.note ?? "").trim().slice(0, 3000);
  const canManage = MANAGERS.has(String(me.role));
  if (!canManage && !(ticket.reporter_id === user.id && status === "reopened")) return NextResponse.json({ error: "Ijazat nahi hai." }, { status: 403 });
  if (!STATUSES.has(status)) return NextResponse.json({ error: "Status theek nahi hai." }, { status: 400 });
  const update: Record<string, unknown> = { status, updated_at: new Date().toISOString() };
  if (canManage && body.assignToMe) update.assigned_to = user.id;
  if (status === "resolved") { update.resolved_at = new Date().toISOString(); update.resolution_note = note || null; }
  if (status === "reopened") update.resolved_at = null;
  const { error } = await supportDb.from("support_tickets").update(update as any).eq("id", ticket.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (note) await supportDb.from("support_ticket_comments").insert({ ticket_id: ticket.id, author_id: user.id, body: note } as any);
  return NextResponse.json({ success: true });
}
