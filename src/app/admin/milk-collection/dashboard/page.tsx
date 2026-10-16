import { createServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

export default async function MilkDashboardPage() {
  const service = createServiceClient();
  const today = new Date().toISOString().slice(0, 10);

  const [{ data: todayEntries }, { data: balances }, { count: collectors }, { count: chillars }] = await Promise.all([
    service.from("milk_entries").select("quantity_liters, total_amount").eq("entry_date", today),
    service.from("milk_farmer_balances").select("balance_due").gt("balance_due", 0),
    service.from("milk_collectors").select("*", { count: "exact", head: true }).eq("is_active", true),
    service.from("milk_chillars").select("*", { count: "exact", head: true }).eq("is_active", true),
  ]);

  const totalMilk = (todayEntries ?? []).reduce((s, e: any) => s + Number(e.quantity_liters || 0), 0);
  const totalAmount = (todayEntries ?? []).reduce((s, e: any) => s + Number(e.total_amount || 0), 0);
  const pending = (balances ?? []).reduce((s, b: any) => s + Number(b.balance_due || 0), 0);

  const cards = [
    { label: "Aaj ka Milk", value: `${totalMilk.toFixed(1)} L` },
    { label: "Aaj ka Amount", value: `Rs ${totalAmount.toLocaleString()}` },
    { label: "Pending Payments", value: `Rs ${pending.toLocaleString()}` },
    { label: "Collectors", value: String(collectors ?? 0) },
    { label: "Chillars", value: String(chillars ?? 0) },
    { label: "Entries Today", value: String(todayEntries?.length ?? 0) },
  ];

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Milk Dashboard</h1>
      <div className="grid gap-4 md:grid-cols-3">
        {cards.map((c) => (
          <div key={c.label} className="rounded-lg border p-4">
            <p className="text-sm text-gray-500">{c.label}</p>
            <p className="text-2xl font-bold mt-1">{c.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
