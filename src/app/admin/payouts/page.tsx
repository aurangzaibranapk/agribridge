import { createClient } from "@/lib/supabase/server";
import { PageHeader, EmptyState } from "@/components/ui/layout-primitives";
import { Badge } from "@/components/ui/form";
import { MarkDealerPaidButton, MarkFarmerPaidButton } from "@/app/admin/payouts/payout-actions";

export const dynamic = "force-dynamic";

export default async function AdminPayoutsPage() {
  const supabase = createClient();

  const [{ data: rawDealerPayouts }, { data: rawFarmerPayouts }] = await Promise.all([
    supabase
      .from("dealer_payouts")
      .select("id, amount, status, created_at, dealers(business_name)")
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("farmer_produce_payouts")
      .select("id, amount, status, created_at, farmers(full_name)")
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  const dealerPayouts = (rawDealerPayouts ?? []).map((p: any) => ({
    id: p.id,
    amount: Number(p.amount),
    status: p.status,
    created_at: p.created_at,
    name: Array.isArray(p.dealers) ? p.dealers[0]?.business_name : p.dealers?.business_name,
  }));

  const farmerPayouts = (rawFarmerPayouts ?? []).map((p: any) => ({
    id: p.id,
    amount: Number(p.amount),
    status: p.status,
    created_at: p.created_at,
    name: Array.isArray(p.farmers) ? p.farmers[0]?.full_name : p.farmers?.full_name,
  }));

  return (
    <div>
      <PageHeader title="Payouts" description="Dealer and Farmer payouts awaiting release - marking paid also credits their wallet" />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div>
          <h2 className="mb-3 font-display text-base font-semibold text-surface-900 dark:text-surface-100">
            Dealer Payouts
          </h2>
          {dealerPayouts.length === 0 ? (
            <EmptyState title="No dealer payouts" />
          ) : (
            <div className="space-y-2">
              {dealerPayouts.map((p) => (
                <div key={p.id} className="flex items-center justify-between rounded-card border border-surface-200 bg-white p-3 shadow-card dark:border-surface-800 dark:bg-surface-900">
                  <div>
                    <p className="text-sm font-medium text-surface-800 dark:text-surface-200">{p.name}</p>
                    <p className="text-xs text-surface-400">Rs {p.amount.toLocaleString()}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge tone={p.status === "paid" ? "green" : "amber"}>{p.status}</Badge>
                    {p.status === "pending" && <MarkDealerPaidButton payoutId={p.id} />}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <h2 className="mb-3 font-display text-base font-semibold text-surface-900 dark:text-surface-100">
            Farmer Produce Payouts
          </h2>
          {farmerPayouts.length === 0 ? (
            <EmptyState title="No farmer payouts" />
          ) : (
            <div className="space-y-2">
              {farmerPayouts.map((p) => (
                <div key={p.id} className="flex items-center justify-between rounded-card border border-surface-200 bg-white p-3 shadow-card dark:border-surface-800 dark:bg-surface-900">
                  <div>
                    <p className="text-sm font-medium text-surface-800 dark:text-surface-200">{p.name}</p>
                    <p className="text-xs text-surface-400">Rs {p.amount.toLocaleString()}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge tone={p.status === "paid" ? "green" : "amber"}>{p.status}</Badge>
                    {p.status === "pending" && <MarkFarmerPaidButton payoutId={p.id} />}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}