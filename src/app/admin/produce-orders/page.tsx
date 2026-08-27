import { createClient } from "@/lib/supabase/server";
import { PageHeader, EmptyState } from "@/components/ui/layout-primitives";
import { Badge } from "@/components/ui/form";
import { ProduceOrderActions } from "@/app/admin/produce-orders/produce-order-actions";

export const dynamic = "force-dynamic";

export default async function AdminProduceOrdersPage() {
  const supabase = createClient();

  const { data: rawOrders } = await supabase
    .from("produce_orders")
    .select(
      "id, order_number, quantity, unit_price, subtotal, commission_amount, farmer_payout_amount, status, placed_at, produce_listings(crop_name, unit), buyers(business_name)"
    )
    .order("placed_at", { ascending: false })
    .limit(100);

  const orders = (rawOrders ?? []).map((o: any) => {
    const listing = Array.isArray(o.produce_listings) ? o.produce_listings[0] : o.produce_listings;
    const buyer = Array.isArray(o.buyers) ? o.buyers[0] : o.buyers;
    return {
      id: o.id,
      order_number: o.order_number,
      quantity: Number(o.quantity),
      subtotal: Number(o.subtotal),
      commission: Number(o.commission_amount),
      farmer_payout: Number(o.farmer_payout_amount),
      status: o.status,
      crop_name: listing?.crop_name ?? "Unknown",
      unit: listing?.unit ?? "kg",
      buyer_name: buyer?.business_name ?? "Unknown",
    };
  });

  function statusTone(status: string) {
    if (["delivered", "settled"].includes(status)) return "green" as const;
    if (status === "placed") return "gray" as const;
    if (status === "farmer_rejected" || status === "cancelled") return "red" as const;
    return "amber" as const;
  }

  return (
    <div>
      <PageHeader title="Produce Orders" description="Farmer produce sold to buyers - identity-masked on both sides" />
      {orders.length === 0 ? (
        <EmptyState title="No produce orders yet" />
      ) : (
        <div className="overflow-hidden rounded-card border border-surface-200 bg-white shadow-card dark:border-surface-800 dark:bg-surface-900">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-200 bg-surface-50 text-left dark:border-surface-800 dark:bg-surface-800">
                <th className="px-4 py-3 font-medium text-surface-500">Order #</th>
                <th className="px-4 py-3 font-medium text-surface-500">Buyer</th>
                <th className="px-4 py-3 font-medium text-surface-500">Crop</th>
                <th className="px-4 py-3 text-right font-medium text-surface-500">Qty</th>
                <th className="px-4 py-3 text-right font-medium text-surface-500">Subtotal</th>
                <th className="px-4 py-3 text-right font-medium text-surface-500">Commission</th>
                <th className="px-4 py-3 font-medium text-surface-500">Status</th>
                <th className="px-4 py-3 font-medium text-surface-500">Action</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id} className="border-b border-surface-100 last:border-0 dark:border-surface-800">
                  <td className="px-4 py-3 font-mono text-xs text-surface-500">{o.order_number}</td>
                  <td className="px-4 py-3 text-surface-700 dark:text-surface-300">{o.buyer_name}</td>
                  <td className="px-4 py-3 text-surface-700 dark:text-surface-300">{o.crop_name}</td>
                  <td className="px-4 py-3 text-right text-surface-600 dark:text-surface-400">{o.quantity} {o.unit}</td>
                  <td className="px-4 py-3 text-right text-surface-700 dark:text-surface-300">Rs {o.subtotal.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right text-surface-500">Rs {o.commission.toLocaleString()}</td>
                  <td className="px-4 py-3">
                    <Badge tone={statusTone(o.status)}>{o.status.replace("_", " ")}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <ProduceOrderActions orderId={o.id} status={o.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}