import { listCustomerBalanceDrift } from "@/actions/customer-balance-drift";

/** Owner/Admin ko dikhao jab customer ka stored balance ledger se alag ho. */
export async function CustomerBalanceDriftAlert() {
  const result = await listCustomerBalanceDrift();
  if ("error" in result || result.rows.length === 0) return null;
  const top = result.rows.slice(0, 5);
  return (
    <div className="mb-4 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-900">
      <p className="font-semibold">Customer balance ledger se alag hai ({result.rows.length})</p>
      <ul className="mt-1 list-disc pl-5">
        {top.map((row) => (
          <li key={row.customerId}>
            {row.name ?? row.customerId}: stored {row.stored ?? "—"}, ledger {row.ledger ?? "—"}
          </li>
        ))}
      </ul>
    </div>
  );
}
