import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

/**
 * POS cash jo 1 din mein bank-verify nahi hui.
 *
 * pg_cron ho to migration 717 har ghante :15 par khud chalti hai.
 * Na ho to cPanel:
 *   curl -s -H "Authorization: Bearer <CRON_SECRET>" https://alranatraders.pk/api/cron/cash-custody-overdue
 *
 * Sirf in-app notification. SMS / WhatsApp nahi.
 * Live par tab tak schedule na karein jab tak 717 Testing par chal jaye.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const bearer = req.headers.get("authorization");
  const token = req.nextUrl.searchParams.get("token");
  if (!secret || (bearer !== `Bearer ${secret}` && token !== secret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const service = createServiceClient() as any;
  const { data, error } = await service.rpc("fn_cash_custody_overdue_notify");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ alerted: Number(data ?? 0) });
}
