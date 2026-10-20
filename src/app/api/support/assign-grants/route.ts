import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { canAssignComplaints } from "@/lib/support/complaint-intake";

async function adminContext() {
  const client = createClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user) return null;
  const service = createServiceClient();
  const { data: profile } = await service.from("profiles").select("id,role,organization_id,is_active").eq("id", user.id).maybeSingle();
  if (!profile?.is_active || !canAssignComplaints(String(profile.role))) return null;
  return { client, service, profile };
}

export async function GET() {
  const ctx = await adminContext();
  if (!ctx) return NextResponse.json({ error: "Sirf Owner ya Admin ijazat dekhta hai." }, { status: 403 });
  const db = ctx.service as any;
  const { data: managers } = await ctx.service.from("profiles").select("id,full_name").eq("organization_id", ctx.profile.organization_id).eq("role", "manager").eq("is_active", true).order("full_name");
  const { data: grants, error } = await db.from("cc_assign_grants").select("profile_id,active").eq("organization_id", ctx.profile.organization_id);
  if (error) return NextResponse.json({ managers: [], notice: "Manager ijazat tab chalegi jab migration 627 backup ke baad chal jaye." });
  const on = new Set((grants ?? []).filter((row: { active: boolean }) => row.active !== false).map((row: { profile_id: string }) => row.profile_id));
  return NextResponse.json({
    managers: (managers ?? []).map((manager) => ({ id: manager.id, full_name: manager.full_name, granted: on.has(manager.id) })),
  });
}

export async function POST(req: NextRequest) {
  const ctx = await adminContext();
  if (!ctx) return NextResponse.json({ error: "Sirf Owner ya Admin ijazat deta hai." }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  const profileId = String(body.profileId ?? "").trim();
  if (!profileId) return NextResponse.json({ error: "Manager chunein." }, { status: 400 });
  const saved = await (ctx.client as any).rpc("fn_cc_set_assign_grant", { p_profile: profileId, p_on: Boolean(body.on) });
  if (saved.error) {
    const missing = /fn_cc_set_assign_grant|schema cache|does not exist|Could not find/i.test(saved.error.message);
    return NextResponse.json({
      error: missing ? "Manager ijazat migration 627 ke baad milti hai." : saved.error.message,
    }, { status: missing ? 503 : 400 });
  }
  return NextResponse.json({ success: true, on: Boolean(body.on) });
}
