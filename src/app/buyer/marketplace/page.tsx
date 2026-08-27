import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { BuyerMarketplaceClient } from "@/app/buyer/marketplace/buyer-marketplace-client";

export const dynamic = "force-dynamic";

export default async function BuyerMarketplacePage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: buyer } = await supabase.from("buyers").select("id, business_name").eq("user_id", user.id).single();
  if (!buyer) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <p className="text-surface-600">This account is not linked to a buyer profile.</p>
      </div>
    );
  }

  const { data: listings } = await supabase
    .from("produce_listings")
    .select("id, crop_name, quantity_available, unit, asking_price_per_unit, quality_grade")
    .eq("status", "active")
    .order("created_at", { ascending: false });

  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <h1 className="font-display text-2xl font-semibold text-surface-900 dark:text-white">Produce Marketplace</h1>
      <p className="mt-1 text-surface-500">Welcome, {buyer.business_name} - browse and order fresh produce from verified farmers.</p>

      <div className="mt-6">
        <BuyerMarketplaceClient
          listings={(listings ?? []).map((l) => ({
            ...l,
            quantity_available: Number(l.quantity_available),
            asking_price_per_unit: Number(l.asking_price_per_unit),
          }))}
        />
      </div>
    </div>
  );
}