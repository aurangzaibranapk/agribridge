import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { canSeeComplaintTicket } from "@/lib/support/attachments";
import { storeComplaintImages } from "@/lib/support/store-attachments";

async function viewer(ticketId: string) {
  const client = createClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: "Login zaroori hai." }, { status: 401 }) };
  const service = createServiceClient();
  const { data: me } = await service.from("profiles").select("id,role,organization_id,is_active").eq("id", user.id).maybeSingle();
  if (!me?.is_active) return { error: NextResponse.json({ error: "Account inactive hai." }, { status: 403 }) };
  const db = service as any;
  const { data: ticket } = await db.from("support_tickets").select("id,organization_id,reporter_id,assigned_to,intake_source").eq("id", ticketId).maybeSingle();
  if (!ticket || ticket.organization_id !== me.organization_id) return { error: NextResponse.json({ error: "Ticket nahi mila." }, { status: 404 }) };
  const allowed = canSeeComplaintTicket({
    actorId: user.id,
    actorRole: String(me.role),
    reporterId: ticket.reporter_id,
    assigneeId: ticket.assigned_to ?? null,
  });
  if (!allowed) return { error: NextResponse.json({ error: "Ye tasveer aap ko nahi dikhti." }, { status: 403 }) };
  return { user, me, service, db, ticket };
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await viewer(params.id);
  if ("error" in ctx && ctx.error) return ctx.error;
  const { data, error } = await ctx.db.from("support_ticket_attachments").select("id,storage_path,mime,created_at").eq("ticket_id", params.id).order("created_at");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const images = await Promise.all((data ?? []).map(async (row: { id: string; storage_path: string; mime: string }) => {
    const signed = await ctx.service.storage.from("support-evidence").createSignedUrl(row.storage_path, 3600);
    return signed.data?.signedUrl ? { id: row.id, url: signed.data.signedUrl, mime: row.mime } : null;
  }));
  return NextResponse.json({ images: images.filter(Boolean) });
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await viewer(params.id);
  if ("error" in ctx && ctx.error) return ctx.error;
  const form = await req.formData();
  const files = form.getAll("images").filter((item): item is File => item instanceof File && item.size > 0);
  const single = form.get("screenshot");
  if (single instanceof File && single.size > 0) files.push(single);
  if (files.length === 0) return NextResponse.json({ error: "Tasveer chunein." }, { status: 400 });
  const stored = await storeComplaintImages({
    ticketId: params.id,
    organizationId: ctx.me.organization_id,
    userId: ctx.user.id,
    files,
  });
  if (stored.error && stored.saved === 0) return NextResponse.json({ error: stored.error }, { status: 400 });
  return NextResponse.json({ success: true, saved: stored.saved, error: stored.error ?? null });
}
