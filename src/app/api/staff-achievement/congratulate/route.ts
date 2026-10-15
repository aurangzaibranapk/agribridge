import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { notifyUser } from "@/lib/notifications";
import { loadAchievement } from "@/lib/staff/achievement-data";
import { topPerformer, type Period } from "@/lib/staff/achievement";

const MANAGERS = new Set(["owner", "super_admin", "admin", "manager", "hr"]);

/** Top performer ko mubarakbad -- har period mein sirf ek dafa (unique). */
export async function POST(req: NextRequest) {
  const { data: { user } } = await createClient().auth.getUser();
  if (!user) return NextResponse.json({ error: "Login zaroori hai." }, { status: 401 });
  const db = createServiceClient() as any;
  const { data: me } = await db.from("profiles").select("id,role,organization_id,is_active").eq("id", user.id).maybeSingle();
  if (!me?.is_active || !MANAGERS.has(String(me.role))) return NextResponse.json({ error: "Ijazat nahi." }, { status: 403 });
  const body = (await req.json().catch(() => ({}))) as { period?: string };
  const period: Period = body.period === "weekly" || body.period === "monthly" ? body.period : "daily";
  const data = await loadAchievement(me.organization_id, period);
  const top = topPerformer(data.rows);
  if (!top) return NextResponse.json({ error: "Is period mein abhi koi bikri nahi." }, { status: 404 });
  const { error } = await db.from("staff_achievement_congrats").insert({ organization_id: me.organization_id, profile_id: top.staff.id, period, period_start: data.start, sales_amount: top.sales, sent_by: me.id });
  if (error) return NextResponse.json({ error: error.code === "23505" ? "Is period ki mubarakbad pehle hi bheji ja chuki hai." : error.message }, { status: 409 });
  await notifyUser(top.staff.id, "Mubarak ho! 🏆", `Aap ${period} top performer hain: Rs ${Math.round(top.sales).toLocaleString("en-PK")} bikri.`, "/admin/staff-achievement/performance");
  return NextResponse.json({ ok: true, staff: top.staff.full_name });
}
