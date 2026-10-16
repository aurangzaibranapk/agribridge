import { createServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

export default async function AlertsPage() {
  const service = createServiceClient();
  const today = new Date().toISOString().slice(0, 10);

  // Simple alerts: entries without chillar or collector
  const { data: missingLinks } = await service
    .from("milk_entries")
    .select("id, entry_date, quantity_liters, farmers(full_name)")
    .eq("entry_date", today)
    .or("chillar_id.is.null,collector_id.is.null")
    .limit(50);

  // High pending balances
  const { data: highPending } = await service
    .from("milk_farmer_balances")
    .select("full_name, balance_due")
    .gt("balance_due", 10000)
    .order("balance_due", { ascending: false })
    .limit(20);

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Zero Leakage Alerts</h1>

      <div className="rounded-lg border p-4">
        <h2 className="font-semibold mb-2">Missing Collector / Chillar (Today)</h2>
        {!missingLinks || missingLinks.length === 0 ? (
          <p className="text-green-600 text-sm">Sab entries linked hain.</p>
        ) : (
          <ul className="text-sm space-y-1">
            {missingLinks.map((e: any) => (
              <li key={e.id}>
                {e.farmers?.full_name ?? "Farmer"} – {e.quantity_liters} L (collector/chillar missing)
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-lg border p-4">
        <h2 className="font-semibold mb-2">High Pending (> Rs 10,000)</h2>
        {!highPending || highPending.length === 0 ? (
          <p className="text-green-600 text-sm">Koi high pending nahi.</p>
        ) : (
          <ul className="text-sm space-y-1">
            {highPending.map((b: any) => (
              <li key={b.full_name}>
                {b.full_name}: Rs {Number(b.balance_due).toLocaleString()}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
