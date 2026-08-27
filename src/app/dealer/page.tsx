import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DealerDashboardClient } from "./dealer-dashboard-client";

export const dynamic = "force-dynamic";

export default async function DealerPortalPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: dealer } = await supabase.from("dealers").select("*").eq("user_id", user.id).single();
  if (!dealer) redirect("/login");

  const { data: orders } = await supabase
    .from("bridge_orders")
    .select("id, order_number, status, subtotal, commission_amount, placed_at, district, tehsil")
    .eq("assigned_dealer_id", dealer.id)
    .order("placed_at", { ascending: false })
    .limit(50);

  const normalized = (orders ?? []).map((o) => ({
    id: o.id,
    orderNumber: o.order_number,
    status: o.status,
    subtotal: Number(o.subtotal),
    commissionAmount: Number(o.commission_amount),
    placedAt: o.placed_at,
    area: [o.district, o.tehsil].filter(Boolean).join(", "),
  }));

  const pendingCount = normalized.filter((o) => o.status === "assigned").length;
  const totalPayable = Number(dealer.current_payable);

  return (
    <DealerDashboardClient
      dealerName={dealer.business_name}
      dealerCode={dealer.dealer_code}
      currentPayable={totalPayable}
      pendingCount={pendingCount}
      orders={normalized}
    />
  );
}