import { createServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

export default async function ChillarControlPage() {
  const service = createServiceClient();
  const today = new Date().toISOString().slice(0, 10);

  const { data: entries } = await service
    .from("milk_entries")
    .select("quantity_liters, chillar_id, milk_chillars(name)")
    .eq("entry_date", today);

  const byChillar: Record<string, { name: string; total: number; count: number }> = {};
  for (const e of entries ?? []) {
    const id = e.chillar_id ?? "none";
    const name = (e.milk_chillars as any)?.name ?? "No Chillar";
    if (!byChillar[id]) byChillar[id] = { name, total: 0, count: 0 };
    byChillar[id].total += Number(e.quantity_liters);
    byChillar[id].count += 1;
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Chillar Control – Today</h1>
      <div className="space-y-4">
        {Object.entries(byChillar).length === 0 ? (
          <p className="text-gray-500">Aaj koi entry nahi.</p>
        ) : (
          Object.entries(byChillar).map(([id, d]) => (
            <div key={id} className="rounded-lg border p-4">
              <h2 className="font-semibold">{d.name}</h2>
              <p>Entries: {d.count}</p>
              <p>Total Milk: {d.total.toFixed(2)} L</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
