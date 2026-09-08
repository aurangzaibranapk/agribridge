import { PageHeader, Card, EmptyState } from "@/components/ui/layout-primitives";
import { pendingCollectionDeposits } from "@/actions/pos-collection";
import { PosDepositsClient } from "./pos-deposits-client";

export const dynamic = "force-dynamic";

export default async function PosDepositsPage() {
  const deposits = await pendingCollectionDeposits();

  if ("error" in deposits) {
    return <div className="p-8 text-center text-surface-400">{deposits.error}</div>;
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="POS Deposit Verification"
        description="Sales staff ne jo bank deposit slip jama ki hai, us ki tasdeeq -- manzoor karne se hi POS Collection Outstanding kam hota hai."
      />

      {deposits.length === 0 ? (
        <Card className="p-6">
          <EmptyState title="Koi deposit tasdeeq ka intezar nahi kar rahi" description="Nayi slip aane par yahan dikhengi." />
        </Card>
      ) : (
        <PosDepositsClient deposits={deposits} />
      )}
    </div>
  );
}
