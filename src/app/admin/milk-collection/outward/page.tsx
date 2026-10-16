import { createServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

export default async function OutwardPage() {
  const service = createServiceClient();

  // Use existing dispatch if available, otherwise show recent entries as outward proxy
  const { data: dispatches } = await service
    .from("milk_dispatches")
    .select("id, dispatch_date, quantity_liters, company_name, total_amount")
    .order("dispatch_date", { ascending: false })
    .limit(30)
    .maybeSingle();

  // Fallback: recent milk entries as "outward candidates"
  const { data: recent } = await service
    .from("milk_entries")
    .select("entry_date, quantity_liters, total_amount, farmers(full_name)")
    .order("entry_date", { ascending: false })
    .limit(20);

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Company Outward Reconciliation</h1>

      <div className="rounded-lg border p-4">
        <h2 className="font-semibold mb-2">Recent Dispatches</h2>
        {!dispatches ? (
          <p className="text-sm text-gray-500">Dispatch table empty ya nahi mili. Existing dispatch module use karein.</p>
        ) : (
          <p className="text-sm">Dispatch data available.</p>
        )}
      </div>

      <div className="rounded-lg border p-4">
        <h2 className="font-semibold mb-2">Recent Milk Entries (Inward)</h2>
        {!recent || recent.length === 0 ? (
          <p className="text-sm text-gray-500">Koi entry nahi.</p>
        ) : (
          <ul className="text-sm space-y-1">
            {recent.map((e: any, i: number) => (
              <li key={i}>
                {e.entry_date} – {e.farmers?.full_name ?? "Farmer"}: {e.quantity_liters} L / Rs {Number(e.total_amount || 0).toLocaleString()}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
