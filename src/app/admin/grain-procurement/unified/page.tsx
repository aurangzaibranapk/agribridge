import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

export const dynamic = "force-dynamic";

const GRAIN_LABELS: Record<string, string> = {
  wheat: "Wheat (Gandum)",
  rice: "Rice (Chawal)",
  maize: "Maize (Makai)",
};

export default async function UnifiedGrainDashboard() {
  const supabase = createClient();

  const [
    { data: rawEntries },
    { data: sales },
    { data: expenses },
    { data: payments },
    { data: salePayments },
  ] = await Promise.all([
    supabase
      .from("grain_procurement_entries")
      .select("weight_kg, total_amount, grain_type, farmer_id, party_id, farmers(full_name), grain_parties(party_name)")
      .is("reclassified_as_sale_id", null)
      .limit(500),
    supabase.from("grain_sales").select("quantity_kg, total_amount, total_cogs, profit, grain_type, buyer_id, buyers(business_name)"),
    supabase.from("grain_expenses").select("amount"),
    supabase.from("grain_procurement_payments").select("amount, farmer_id, party_id, farmers(full_name), grain_parties(party_name)").is("reclassified_as_sale_payment_id", null).limit(500),
    supabase.from("grain_sale_payments").select("amount, buyer_id, buyers(business_name)").limit(500),
  ]);

  const entries = rawEntries ?? [];
  const totalBoughtKg = entries.reduce((s, e: any) => s + Number(e.weight_kg || 0), 0);
  const totalBoughtValue = entries.reduce((s, e: any) => s + Number(e.total_amount || 0), 0);

  const totalSoldKg = (sales ?? []).reduce((s, r: any) => s + Number(r.quantity_kg || 0), 0);
  const totalSalesRevenue = (sales ?? []).reduce((s, r: any) => s + Number(r.total_amount || 0), 0);
  const totalCogs = (sales ?? []).reduce((s, r: any) => s + Number(r.total_cogs || 0), 0);
  const totalExpenses = (expenses ?? []).reduce((s, e: any) => s + Number(e.amount || 0), 0);
  const netProfit = totalSalesRevenue - totalCogs - totalExpenses;
  const stockKg = totalBoughtKg - totalSoldKg;

  // Grain-wise
  const grainWise: Record<string, { bought: number; sold: number }> = {};
  for (const e of entries) {
    const t = e.grain_type || "other";
    if (!grainWise[t]) grainWise[t] = { bought: 0, sold: 0 };
    grainWise[t].bought += Number(e.weight_kg || 0);
  }
  for (const s of sales ?? []) {
    const t = s.grain_type || "other";
    if (!grainWise[t]) grainWise[t] = { bought: 0, sold: 0 };
    grainWise[t].sold += Number(s.quantity_kg || 0);
  }

  // Payables: entries - payments per farmer/party
  const payableMap: Record<string, { name: string; due: number }> = {};
  for (const e of entries) {
    const name = (e.farmers as any)?.full_name || (e.grain_parties as any)?.party_name || "Unknown";
    const key = e.farmer_id || e.party_id || name;
    if (!payableMap[key]) payableMap[key] = { name, due: 0 };
    payableMap[key].due += Number(e.total_amount || 0);
  }
  for (const p of payments ?? []) {
    const name = (p.farmers as any)?.full_name || (p.grain_parties as any)?.party_name || "Unknown";
    const key = p.farmer_id || p.party_id || name;
    if (!payableMap[key]) payableMap[key] = { name, due: 0 };
    payableMap[key].due -= Number(p.amount || 0);
  }
  const payables = Object.values(payableMap).filter((x) => x.due > 0).sort((a, b) => b.due - a.due).slice(0, 15);
  const totalPayable = payables.reduce((s, x) => s + x.due, 0);

  // Receivables: sales - sale payments per buyer
  const receivableMap: Record<string, { name: string; due: number }> = {};
  for (const s of sales ?? []) {
    const name = (s.buyers as any)?.business_name || "Unknown Buyer";
    const key = s.buyer_id || name;
    if (!receivableMap[key]) receivableMap[key] = { name, due: 0 };
    receivableMap[key].due += Number(s.total_amount || 0);
  }
  for (const sp of salePayments ?? []) {
    const name = (sp.buyers as any)?.business_name || "Unknown Buyer";
    const key = sp.buyer_id || name;
    if (!receivableMap[key]) receivableMap[key] = { name, due: 0 };
    receivableMap[key].due -= Number(sp.amount || 0);
  }
  const receivables = Object.values(receivableMap).filter((x) => x.due > 0).sort((a, b) => b.due - a.due).slice(0, 15);
  const totalReceivable = receivables.reduce((s, x) => s + x.due, 0);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Grain Business Dashboard</h1>
        <p className="text-sm text-gray-500">Ek jagah – kya lena, kahan se, kya dena, kahan. Khata match.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-lg border p-4">
          <p className="text-xs text-gray-500">Total Bought</p>
          <p className="text-xl font-bold">{totalBoughtKg.toLocaleString()} kg</p>
          <p className="text-sm">Rs {totalBoughtValue.toLocaleString()}</p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-xs text-gray-500">Total Sold</p>
          <p className="text-xl font-bold">{totalSoldKg.toLocaleString()} kg</p>
          <p className="text-sm">Rs {totalSalesRevenue.toLocaleString()}</p>
        </div>
        <div className={`rounded-lg border p-4 ${stockKg < 0 ? "bg-red-50" : ""}`}>
          <p className="text-xs text-gray-500">In Stock Now</p>
          <p className={`text-xl font-bold ${stockKg < 0 ? "text-red-600" : ""}`}>{stockKg.toLocaleString()} kg</p>
        </div>
        <div className={`rounded-lg border p-4 ${netProfit >= 0 ? "bg-green-50" : "bg-red-50"}`}>
          <p className="text-xs text-gray-500">Net Profit</p>
          <p className={`text-xl font-bold ${netProfit >= 0 ? "text-green-700" : "text-red-700"}`}>Rs {netProfit.toLocaleString()}</p>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="rounded-lg border p-4">
          <h2 className="font-semibold mb-2">Jin Se Lena Hai (Receivables)</h2>
          <p className="text-sm mb-2">Total: Rs {totalReceivable.toLocaleString()}</p>
          {receivables.length === 0 ? (
            <p className="text-sm text-gray-500">Koi pending nahi.</p>
          ) : (
            <ul className="text-sm space-y-1">
              {receivables.map((b, i) => (
                <li key={i} className="flex justify-between">
                  <span>{b.name}</span>
                  <span className="font-medium">Rs {b.due.toLocaleString()}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="rounded-lg border p-4">
          <h2 className="font-semibold mb-2">Jin Ko Dena Hai (Payables)</h2>
          <p className="text-sm mb-2">Total: Rs {totalPayable.toLocaleString()}</p>
          {payables.length === 0 ? (
            <p className="text-sm text-gray-500">Koi pending nahi.</p>
          ) : (
            <ul className="text-sm space-y-1">
              {payables.map((f, i) => (
                <li key={i} className="flex justify-between">
                  <span>{f.name}</span>
                  <span className="font-medium">Rs {f.due.toLocaleString()}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="rounded-lg border p-4">
        <h2 className="font-semibold mb-3">Grain-wise Position</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="text-left py-1">Grain</th>
              <th className="text-right">Bought</th>
              <th className="text-right">Sold</th>
              <th className="text-right">Stock</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(grainWise).map(([type, d]) => {
              const stock = d.bought - d.sold;
              return (
                <tr key={type} className="border-b">
                  <td className="py-1">{GRAIN_LABELS[type] || type}</td>
                  <td className="text-right">{d.bought.toLocaleString()}</td>
                  <td className="text-right">{d.sold.toLocaleString()}</td>
                  <td className={`text-right ${stock < 0 ? "text-red-600" : ""}`}>{stock.toLocaleString()}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="rounded-lg border p-4">
        <h2 className="font-semibold mb-2">Khata Match Check</h2>
        <p className="text-sm">Receivable: Rs {totalReceivable.toLocaleString()}</p>
        <p className="text-sm">Payable: Rs {totalPayable.toLocaleString()}</p>
        <p className="text-sm font-medium mt-1">
          Difference: Rs {(totalReceivable - totalPayable).toLocaleString()}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Link href="/admin/grain-procurement" className="rounded bg-green-600 text-white px-4 py-2 text-sm">New Purchase</Link>
        <Link href="/admin/grain-procurement/sell" className="rounded bg-blue-600 text-white px-4 py-2 text-sm">New Sale</Link>
        <Link href="/admin/grain-procurement/dashboard" className="rounded border px-4 py-2 text-sm">Old Dashboard</Link>
      </div>
    </div>
  );
}
