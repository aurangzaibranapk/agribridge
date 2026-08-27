import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

const ESCALATION_ROLES = ["super_admin", "admin", "owner", "manager", "admin_assistant"];

const STAGE_LABELS: Record<string, string> = {
  submitted: "Sales Verification",
  sales_verified: "Finance Verification",
  finance_verified: "Manager Approval",
  approved: "Warehouse Dispatch",
};

// cPanel Cron Job hits this URL every 30 minutes:
// curl "https://alranatraders.pk/api/cron/order-escalation?token=YOUR_SECRET"
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");
  if (token !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();

  const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();

  const { data: stuckOrders } = await supabase
    .from("agri_orders")
    .select("id, order_number, status, shop_dealer_name, created_at, sales_verified_at, finance_verified_at, approved_at")
    .in("status", Object.keys(STAGE_LABELS))
    .lt("created_at", thirtyMinAgo);

  // Only escalate orders whose CURRENT stage's own timestamp is old
  // enough — not just the original submission time — so we don't
  // re-flag an order that moved forward recently.
  const now = Date.now();
  const toEscalate = (stuckOrders ?? []).filter((o) => {
    const stageTimestamp =
      o.status === "submitted" ? o.created_at :
      o.status === "sales_verified" ? o.sales_verified_at :
      o.status === "finance_verified" ? o.finance_verified_at :
      o.status === "approved" ? o.approved_at :
      o.created_at;
    if (!stageTimestamp) return true;
    const ageMinutes = (now - new Date(stageTimestamp).getTime()) / 60000;
    return ageMinutes >= 30;
  });

  if (toEscalate.length === 0) {
    return NextResponse.json({ success: true, escalated: 0 });
  }

  const { data: escalationStaff } = await supabase.from("profiles").select("id").in("role", ESCALATION_ROLES).eq("is_active", true);

  const notificationRows = toEscalate.flatMap((o) =>
    (escalationStaff ?? []).map((staff) => ({
      recipient_user_id: staff.id,
      title: "Order Bohot Der Se Pending Hai",
      message: `${o.order_number} (${o.shop_dealer_name ?? "Order"}) - ${STAGE_LABELS[o.status]} 30 minute se zyada se ruka hua hai.`,
      link_url: `/admin/agri-orders/${o.id}`,
    }))
  );

  if (notificationRows.length > 0) {
    await supabase.from("notifications").insert(notificationRows);
  }

  return NextResponse.json({ success: true, escalated: toEscalate.length });
}