import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SellProduceClient } from "@/app/portal/sell-produce/sell-produce-client";
import { checkFarmerVerification } from "@/lib/utils/verification-gate";
import { VerificationGateMessage } from "@/components/portal/verification-gate-message";

export const dynamic = "force-dynamic";

export default async function SellProducePage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: farmer } = await supabase.from("farmers").select("id").eq("user_id", user.id).single();
  if (!farmer) redirect("/login");

  const gate = await checkFarmerVerification(farmer.id);
  if (!gate.allowed) {
    return <VerificationGateMessage reason={gate.reason!} />;
  }

  const { data: listings } = await supabase
    .from("produce_listings")
    .select("id, crop_name, quantity_available, unit, asking_price_per_unit, status")
    .eq("farmer_id", farmer.id)
    .order("created_at", { ascending: false });

  const { data: rawOrders } = await supabase
    .from("produce_orders")
    .select("id, order_number, quantity, farmer_payout_amount, status, produce_listings(crop_name, unit)")
    .eq("farmer_id", farmer.id)
    .order("placed_at", { ascending: false });

  const orders = (rawOrders ?? []).map((o: any) => {
    const listing = Array.isArray(o.produce_listings) ? o.produce_listings[0] : o.produce_listings;
    return {
      id: o.id,
      order_number: o.order_number,
      quantity: Number(o.quantity),
      farmer_payout_amount: Number(o.farmer_payout_amount),
      status: o.status,
      crop_name: listing?.crop_name ?? "Unknown",
      unit: listing?.unit ?? "kg",
    };
  });

  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <Link href="/portal/dashboard" className="mb-4 inline-block text-sm text-surface-500 hover:text-brand-700">
        Back to Dashboard
      </Link>
      <h1 className="font-display text-2xl font-semibold text-surface-900">Sell Your Produce</h1>
      <p className="mt-1 text-surface-500">
        List your harvested crops for sale - verified buyers will place orders, and we'll route the payment to you.
      </p>

      <div className="mt-6">
        <SellProduceClient
          listings={(listings ?? []).map((l) => ({
            ...l,
            quantity_available: Number(l.quantity_available),
            asking_price_per_unit: Number(l.asking_price_per_unit),
          }))}
          orders={orders}
        />
      </div>
    </div>
  );
}