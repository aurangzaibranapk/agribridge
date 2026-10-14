import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";
const MANAGERS = new Set(["owner", "super_admin", "admin", "manager", "admin_assistant"]);
const VALID_PRIORITY = new Set(["normal", "urgent", "work_stopped"]);

async function context() {
  const client = createClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user) return null;
  const service = createServiceClient();
  const { data: profile } = await service.from("profiles").select("id,full_name,role,organization_id,is_active").eq("id", user.id).maybeSingle();
  if (!profile?.is_active) return null;
  return { user, profile, service, canManage: MANAGERS.has(String(profile.role)) };
}

export async function GET() {
  const ctx = await context();
  if (!ctx) return NextResponse.json({ error: "Login zaroori hai." }, { status: 401 });
  let query = ctx.service.from("support_tickets").select("*, reporter:profiles!support_tickets_reporter_id_fkey(full_name), assignee:profiles!support_tickets_assigned_to_fkey(full_name)").eq("organization_id", ctx.profile.organization_id).order("created_at", { ascending: false }).limit(100);
  if (!ctx.canManage) query = query.eq("reporter_id", ctx.user.id);
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const items = await Promise.all((data ?? []).map(async (row: any) => {
    let screenshotUrl: string | null = null;
    if (row.screenshot_path) {
      const signed = await ctx.service.storage.from("support-evidence").createSignedUrl(row.screenshot_path, 3600);
      screenshotUrl = signed.data?.signedUrl ?? null;
    }
    return { ...row, screenshotUrl };
  }));
  return NextResponse.json({ items, canManage: ctx.canManage });
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
  const { data, error } = await ctx.service.from("support_tickets").insert({
    organization_id: ctx.profile.organization_id,
    reporter_id: ctx.user.id,
    title: title.slice(0, 160),
    description: description.slice(0, 5000),
    priority,
    page_url: String(form.get("page_url") ?? "").slice(0, 1000) || null,
    screenshot_path: screenshotPath,
    device_info: deviceInfo,
  } as any).select("id,ticket_no").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, ticket: data });
}
