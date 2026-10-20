import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { isCustomerBalanceDrift } from "@/lib/finance/money-guards";

export const dynamic = "force-dynamic";

/**
 * Rozana customer balance drift.
 * cPanel: curl -s -H "Authorization: Bearer <CRON_SECRET>" https://alranatraders.pk/api/cron/customer-balance-drift
 * Koi row rewrite nahi hoti. Admin finance safha yahi farq dikhata hai.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const bearer = req.headers.get("authorization");
  const token = req.nextUrl.searchParams.get("token");
  if (!secret || (bearer !== `Bearer ${secret}` && token !== secret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const service = createServiceClient();
  const { data, error } = await (service as any).rpc("fn_customer_balance_drift");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const rows = (data ?? []).filter((row: { stored: number | null; ledger: number | null }) =>
    isCustomerBalanceDrift(row.stored, row.ledger)
  );
  return NextResponse.json({ ok: true, count: rows.length, rows });
}
