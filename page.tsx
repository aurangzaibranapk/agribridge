import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { OrderForm } from "@/app/portal/orders/order-form";

export const dynamic = "force-dynamic";

export default async function FarmerOrdersPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: farmer } = await supabase
    .from("farmers")
    .select("id, district, tehsil")
    .eq("user_id", user.id)
    .single();
  if (!farmer) redirect("/login");

  const { data: products } = await supabase
    .from("products")
    .select("id, name, pack_size, selling_price")
    .eq("is_available", true)
    .eq("is_deleted", false)
    .order("name");

  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <Link href="/portal/dashboard" className="mb-4 inline-block text-sm text-surface-500 hover:text-brand-700">
        Back to Dashboard
      </Link>
      <h1 className="font-display text-2xl font-semibold text-surface-900">Place an Order</h1>
      <p className="mt-1 text-surface-500">
        Your order will be routed to a verified dealer in your area, delivered under Al Rana Traders.
      </p>

      <div className="mt-6">
        <OrderForm
          products={products ?? []}
          farmerDistrict={farmer.district}
          farmerTehsil={farmer.tehsil}
        />
      </div>
    </div>
  );
}