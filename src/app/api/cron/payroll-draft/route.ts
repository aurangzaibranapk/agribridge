import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { isLastDayOfMonthPkt, pktParts, payrollDraftMessage, PAYROLL_NOTIFY_ROLES } from "@/lib/payroll/auto-draft";
import { MONTHS_RU } from "@/lib/payroll/compute";

export const dynamic = "force-dynamic";

/**
 * 696: Mahine ke aakhri din payroll draft (branch "Sab") khud banta hai.
 * cPanel cron rozana chalayein -- sirf aakhri din kaam karta hai; run pehle se ho to skip.
 * curl -s "https://alranatraders.pk/api/cron/payroll-draft?token=CRON_SECRET"
 */
async function run(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const bearer = req.headers.get("authorization");
  const token = req.nextUrl.searchParams.get("token");
  if (!secret || (bearer !== `Bearer ${secret}` && token !== secret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const now = new Date();
  if (!isLastDayOfMonthPkt(now)) return NextResponse.json({ action: "not_month_end" });
  const { year, month } = pktParts(now);
  const sb = createServiceClient() as any;
  const { data, error } = await sb.rpc("fn_payroll_auto_draft", { p_year: year, p_month: month });
  if (error) return NextResponse.json({ error: "Payroll draft nahi bana." }, { status: 500 });
  if (data?.action === "created" || data?.action === "filled") {
    const { data: staff } = await sb.from("profiles").select("id").in("role", PAYROLL_NOTIFY_ROLES).eq("is_active", true);
    const rows = (staff ?? []).map((s: any) => ({
      recipient_user_id: s.id,
      title: "Payroll draft tayyar hai",
      message: payrollDraftMessage(data, `${MONTHS_RU[month - 1]} ${year}`),
      link_url: `/admin/hr/payroll?m=${year}-${String(month).padStart(2, "0")}`,
    }));
    if (rows.length) await sb.from("notifications").insert(rows);
  }
  return NextResponse.json(data);
}

export const GET = run;
export const POST = run;
