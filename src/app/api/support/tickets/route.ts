import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { configuredSupportAgents } from "@/lib/support/agent-dispatch";
import { parseAssignChoice } from "@/lib/support/assign";
import { notifyUser } from "@/lib/notifications";

export const dynamic = "force-dynamic";
const MANAGER_ROLES = ["owner", "super_admin", "admin", "manager", "admin_assistant"];
const MANAGERS = new Set(MANAGER_ROLES);
const VALID_PRIORITY = new Set(["normal", "urgent", "work_stopped"]);

async function context() {
  const client = createClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user) return null;
  const service = createServiceClient();
  const { data: profile } = await service.from("profiles").select("id,full_name,role,organization_id,is_active").eq("id", user.id).maybeSingle();
  if (!profile?.is_active) return null;
  const supportDb = service as any;
  return { user, profile, service, supportDb, canManage: MANAGERS.has(String(profile.role)) };
}

export async function GET() {
  const ctx = await context();
  if (!ctx) return NextResponse.json({ error: "Login zaroori hai." }, { status: 401 });
  let query = ctx.supportDb.from("support_tickets").select("*, reporter:profiles!support_tickets_reporter_id_fkey(full_name), assignee:profiles!support_tickets_assigned_to_fkey(full_name)").eq("organization_id", ctx.profile.organization_id).order("created_at", { ascending: false }).limit(100);
  if (!ctx.canManage) query = query.eq("reporter_id", ctx.user.id);
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const ticketIds = (data ?? []).map((row: any) => row.id);
  const { data: comments } = ticketIds.length
    ? await ctx.supportDb
        .from("support_ticket_comments")
        .select("id,ticket_id,body,source_label,created_at,author:profiles!support_ticket_comments_author_id_fkey(full_name)")
        .in("ticket_id", ticketIds)
        .order("created_at", { ascending: true })
    : { data: [] };
  const items = await Promise.all((data ?? []).map(async (row: any) => {
    let screenshotUrl: string | null = null;
    if (row.screenshot_path) {
      const signed = await ctx.service.storage.from("support-evidence").createSignedUrl(row.screenshot_path, 3600);
      screenshotUrl = signed.data?.signedUrl ?? null;
    }
    return { ...row, screenshotUrl, comments: (comments ?? []).filter((c: any) => c.ticket_id === row.id) };
  }));
  // Har staff issue bhejte waqt developer/staff chun sakta hai (sirf naam aur role).
  const { data: assignees } = await ctx.service
    .from("profiles")
    .select("id,full_name,role")
    .eq("organization_id", ctx.profile.organization_id)
    .eq("is_active", true)
    .order("full_name");
  return NextResponse.json({
    items,
    canManage: ctx.canManage,
    assignees: assignees ?? [],
    agents: ctx.canManage ? configuredSupportAgents() : [],
  });
}

export async function POST(req: NextRequest) {
  const ctx = await context();
  if (!ctx) return NextResponse.json({ error: "Login zaroori hai." }, { status: 401 });
  const form = await req.formData();
  const title = String(form.get("title") ?? "").trim();
  const description = String(form.get("description") ?? "").trim();
  const priority = String(form.get("priority") ?? "normal");
  if (title.length < 3 || description.length < 3) return NextResponse.json({ error: "Title aur issue detail likhein." }, { status: 400 });
  if (!VALID_PRIORITY.has(priority)) return NextResponse.json({ error: "Priority theek nahi hai." }, { status: 400 });
  // Khali = "Admin triage" (unassigned). Ghalat qeemat par bhi issue rukta nahi.
  const choice = parseAssignChoice(form.get("assign"));
  let assignee: { id: string; full_name: string } | null = null;
  if (choice.kind === "person") {
    const { data: a } = await ctx.service.from("profiles").select("id,full_name,organization_id,is_active").eq("id", choice.id).maybeSingle();
    if (a?.is_active && a.organization_id === ctx.profile.organization_id) assignee = { id: a.id, full_name: a.full_name };
  }

  let screenshotPath: string | null = null;
  const screenshot = form.get("screenshot");
  if (screenshot instanceof File && screenshot.size > 0) {
    if (screenshot.size > 8 * 1024 * 1024 || !screenshot.type.startsWith("image/")) return NextResponse.json({ error: "Screenshot image 8MB se chhoti honi chahiye." }, { status: 400 });
    const ext = screenshot.name.split(".").pop()?.replace(/[^a-z0-9]/gi, "").toLowerCase() || "png";
    screenshotPath = `${ctx.profile.organization_id}/${ctx.user.id}/${crypto.randomUUID()}.${ext}`;
    const uploaded = await ctx.service.storage.from("support-evidence").upload(screenshotPath, screenshot, { contentType: screenshot.type, upsert: false });
    if (uploaded.error) return NextResponse.json({ error: "Screenshot upload nahi hua: " + uploaded.error.message }, { status: 500 });
  }

  let deviceInfo: Record<string, unknown> = {};
  try { deviceInfo = JSON.parse(String(form.get("device_info") ?? "{}")); } catch { /* invalid client metadata ignored */ }
  const { data, error } = await ctx.supportDb.from("support_tickets").insert({
    organization_id: ctx.profile.organization_id,
    reporter_id: ctx.user.id,
    title: title.slice(0, 160),
    description: description.slice(0, 5000),
    priority,
    page_url: String(form.get("page_url") ?? "").slice(0, 1000) || null,
    screenshot_path: screenshotPath,
    device_info: deviceInfo,
    ...(assignee ? { assigned_to: assignee.id, assigned_kind: "person", assignment_status: "queued", assigned_at: new Date().toISOString(), status: "assigned" } : {}),
  } as any).select("id,ticket_no,created_at").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const reference = `ISS-${new Date(data.created_at).getFullYear()}-${String(data.ticket_no).padStart(5, "0")}`;
  const { data: managers } = await ctx.service
    .from("profiles")
    .select("id")
    .eq("organization_id", ctx.profile.organization_id)
    .eq("is_active", true)
    .in("role", MANAGER_ROLES);
  await Promise.all((managers ?? []).map((manager) =>
    notifyUser(manager.id, `${reference} · New Support Issue`, `${ctx.profile.full_name}: ${title}`, "/admin/my-work")
  ));
  if (assignee) {
    await notifyUser(assignee.id, `Support Issue ${reference}`, title, "/admin/my-work");
    await ctx.supportDb.from("support_ticket_comments").insert({ ticket_id: data.id, author_id: ctx.user.id, body: `Report karte waqt ${assignee.full_name} ko assign kiya.` });
  } else if (choice.kind === "agent") {
    // Agent sirf Admin dispatch karta hai; raiser ki pasand comment mein.
    await ctx.supportDb.from("support_ticket_comments").insert({ ticket_id: data.id, author_id: ctx.user.id, body: `Raiser ne agent suggest kiya: ${choice.key}. Admin triage karega.` });
  }
  await notifyUser(ctx.user.id, `${reference} · Reported`, "Aapka issue receive ho gaya. Har stage ki update yahin milegi.", "/admin/my-work");
  return NextResponse.json({ success: true, ticket: data });
}
