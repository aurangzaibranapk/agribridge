import { createClient } from "@/lib/supabase/server";
import { PageHeader, EmptyState } from "@/components/ui/layout-primitives";
import { Badge } from "@/components/ui/form";
import { formatDateTime } from "@/lib/utils/format";
import { OrderActions } from "@/app/admin/bridge-orders/order-actions";

export const dynamic = "force-dynamic";

export default async function AdminBridgeOrdersPage() {
  const supabase = createClient();

  const [{ data: orders }, { data: financeAccounts }] = await Promise.all([
    supabase
      .from("bridge_orders")
      .select(
        "id, order_number, status, district, tehsil, subtotal, commission_amount, dealer_payout_amount, placed_at, payment_mode, advance_required, advance_paid, source, dealers(business_name)"
      )
      .order("placed_at", { ascending: false })
      .limit(100),
    supabase.from("finance_accounts").select("id, name").eq("is_active", true).order("account_type"),
  ]);

  const normalized = (orders ?? []).map((o: any) => ({
    id: o.id,
    order_number: o.order_number,
    status: o.status,
    district: o.district,
    tehsil: o.tehsil,
    subtotal: Number(o.subtotal),
    commission_amount: Number(o.commission_amount),
    dealer_payout_amount: Number(o.dealer_payout_amount),
    placed_at: o.placed_at,
    dealer_name: Array.isArray(o.dealers) ? o.dealers[0]?.business_name : o.dealers?.business_name,
    payment_mode: o.payment_mode,
    advance_required: Number(o.advance_required ?? 0),
    advance_paid: Number(o.advance_paid ?? 0),
    source: o.source,
  }));

  function statusTone(status: string) {
    if (["delivered", "settled"].includes(status)) return "green" as const;
    if (["placed", "assigned"].includes(status)) return "gray" as const;
    if (status === "dealer_rejected" || status === "cancelled") return "red" as const;
    return "amber" as const;
  }

  return (
    <div>
      <PageHeader title="Bridge Orders" description="Farmer orders routed to dealers - identity-masked on both sides" />
      {normalized.length === 0 ? (
        <EmptyState title="No orders yet" />
      ) : (
        <div className="overflow-hidden rounded-card border border-surface-200 bg-white shadow-card dark:border-surface-800 dark:bg-surface-900">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-200 bg-surface-50 text-left dark:border-surface-800 dark:bg-surface-800">
                <th className="px-4 py-3 font-medium text-surface-500">Order #</th>
                <th className="px-4 py-3 font-medium text-surface-500">Dealer</th>
                <th className="px-4 py-3 font-medium text-surface-500">Area</th>
                <th className="px-4 py-3 text-right font-medium text-surface-500">Subtotal</th>
                <th className="px-4 py-3 text-right font-medium text-surface-500">Commission</th>
                <th className="px-4 py-3 font-medium text-surface-500">Status</th>
                <th className="px-4 py-3 font-medium text-surface-500">Action / Payment</th>
              </tr>
            </thead>
            <tbody>
              {normalized.map((o) => (
                <tr key={o.id} className="border-b border-surface-100 last:border-0 dark:border-surface-800">
                  <td className="px-4 py-3 font-mono text-xs text-surface-500">
                    {o.order_number}
                    {o.source === "marketplace" && <span className="ml-1 rounded bg-brand-50 px-1.5 py-0.5 text-[10px] font-medium text-brand-700">Marketplace</span>}
                  </td>
                  <td className="px-4 py-3 text-surface-700 dark:text-surface-300">{o.dealer_name ?? "Unassigned"}</td>
                  <td className="px-4 py-3 text-surface-500">{[o.district, o.tehsil].filter(Boolean).join(", ")}</td>
                  <td className="px-4 py-3 text-right text-surface-700 dark:text-surface-300">Rs {o.subtotal.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right text-surface-500">Rs {o.commission_amount.toLocaleString()}</td>
                  <td className="px-4 py-3">
                    <Badge tone={statusTone(o.status)}>{o.status.replace("_", " ")}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <OrderActions
                      orderId={o.id}
                      status={o.status}
                      paymentMode={o.payment_mode}
                      advanceRequired={o.advance_required}
                      advancePaid={o.advance_paid}
                      financeAccounts={financeAccounts ?? []}
                    />
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