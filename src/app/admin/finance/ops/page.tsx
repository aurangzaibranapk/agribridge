import { loadOpsDesk } from "@/lib/finance/ops-load";
import { OpsBoard } from "./ops-board";

export const dynamic = "force-dynamic";

/** Tel, diesel, marammat aur is mahine ki payroll — maujooda tables. */
export default async function FinanceOpsPage() {
  const model = await loadOpsDesk();
  return (
    <div className="space-y-4">
      <OpsBoard model={model} />
    </div>
  );
}
