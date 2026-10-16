import { createServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

export default async function WeeklyPaymentPage() {
  const service = createServiceClient();

  const { data: balances } = await service
    .from("milk_farmer_balances")
    .select("*")
    .gt("balance_due", 0)
    .order("balance_due", { ascending: false })
    .limit(100);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Weekly Payment Sheet</h1>
      <p className="text-sm text-gray-600 mb-4">Farmers with pending balance</p>

      {!balances || balances.length === 0 ? (
        <p className="text-gray-500">Koi pending nahi.</p>
      ) : (
        <table className="w-full text-sm border">
          <thead>
            <tr className="border-b bg-gray-50">
              <th className="text-left p-2">Farmer</th>
              <th className="text-right p-2">Total Supplied</th>
              <th className="text-right p-2">Paid</th>
              <th className="text-right p-2">Pending</th>
            </tr>
          </thead>
          <tbody>
            {balances.map((b: any) => (
              <tr key={b.farmer_id} className="border-b">
                <td className="p-2">{b.full_name}</td>
                <td className="text-right p-2">{Number(b.total_supplied).toLocaleString()}</td>
                <td className="text-right p-2">{Number(b.total_paid).toLocaleString()}</td>
                <td className="text-right p-2 font-semibold">{Number(b.balance_due).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
