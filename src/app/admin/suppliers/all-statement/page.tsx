import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/layout-primitives";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function AllSuppliersStatementPage({
  searchParams,
}: {
  searchParams: Promise<{ start?: string; end?: string }>;
}) {
  const sp = await searchParams;
  const now = new Date();
  const defaultStart = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate()).toISOString().slice(0, 10);
  const startDate = sp.start ?? defaultStart;
  const endDate = sp.end ?? now.toISOString().slice(0, 10);

  const supabase = createClient();

  const { data: purchases } = await supabase
    .from("purchases")
    .select("purchase_number, purchase_date, total_amount, suppliers(id, name)")
    .gte("purchase_date", startDate)
    .lte("purchase_date", endDate)
    .order("purchase_date", { ascending: false });

  const { data: payments } = await supabase
    .from("supplier_payments")
    .select("payment_date, amount, notes, suppliers(id, name)")
    .gte("payment_date", startDate)
    .lte("payment_date", endDate)
    .order("payment_date", { ascending: false });

  const supplierMap = new Map<string, { name: string; id: string; purchases: number; payments: number }>();

  (purchases ?? []).forEach((p: any) => {
    const supplier = Array.isArray(p.suppliers) ? p.suppliers[0] : p.suppliers;
    if (!supplier) return;
    const cur = supplierMap.get(supplier.id) ?? { name: supplier.name, id: supplier.id, purchases: 0, payments: 0 };
    cur.purchases += Number(p.total_amount);
    supplierMap.set(supplier.id, cur);
  });

  (payments ?? []).forEach((p: any) => {
    const supplier = Array.isArray(p.suppliers) ? p.suppliers[0] : p.suppliers;
    if (!supplier) return;
    const cur = supplierMap.get(supplier.id) ?? { name: supplier.name, id: supplier.id, purchases: 0, payments: 0 };
    cur.payments += Number(p.amount);
    supplierMap.set(supplier.id, cur);
  });

  const rows = [...supplierMap.values()].sort((a, b) => b.purchases - a.purchases);
  const totalPurchases = rows.reduce((s, r) => s + r.purchases, 0);
  const totalPayments = rows.reduce((s, r) => s + r.payments, 0);

  return (
    <div>
      <PageHeader title="Sab Suppliers - Statement" description="Ek sath sab suppliers ka purchases/payments overview" />

      <form className="mb-4 flex items-center gap-2 print:hidden">
        <input type="date" name="start" defaultValue={startDate} className="rounded-lg border border-surface-200 p-2 text-sm" />
        <input type="date" name="end" defaultValue={endDate} className="rounded-lg border border-surface-200 p-2 text-sm" />
        <button type="submit" className="rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700">View</button>
      </form>

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="rounded-card border border-surface-200 bg-white p-4 text-center shadow-card dark:border-surface-800 dark:bg-surface-900">
          <p className="text-xs text-surface-400">Total Purchases</p>
          <p className="font-display text-xl font-bold text-red-600">Rs {totalPurchases.toLocaleString()}</p>
        </div>
        <div className="rounded-card border border-surface-200 bg-white p-4 text-center shadow-card dark:border-surface-800 dark:bg-surface-900">
          <p className="text-xs text-surface-400">Total Payments</p>
          <p className="font-display text-xl font-bold text-green-600">Rs {totalPayments.toLocaleString()}</p>
        </div>
        <div className="rounded-card border border-amber-200 bg-amber-50 p-4 text-center">
          <p className="text-xs text-amber-500">Net Payable</p>
          <p className="font-display text-xl font-bold text-amber-700">Rs {(totalPurchases - totalPayments).toLocaleString()}</p>
        </div>
      </div>

      <div className="overflow-hidden rounded-card border border-surface-200 bg-white shadow-card dark:border-surface-800 dark:bg-surface-900">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-surface-200 bg-surface-50 text-left dark:border-surface-800 dark:bg-surface-800">
              <th className="px-3 py-2 font-medium text-surface-500">Supplier</th>
              <th className="px-3 py-2 text-right font-medium text-surface-500">Purchases</th>
              <th className="px-3 py-2 text-right font-medium text-surface-500">Payments</th>
              <th className="px-3 py-2 text-right font-medium text-surface-500">Balance</th>
              <th className="px-3 py-2 font-medium text-surface-500"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-surface-100 last:border-0 dark:border-surface-800">
                <td className="px-3 py-2 text-surface-700 dark:text-surface-300">{r.name}</td>
                <td className="px-3 py-2 text-right text-red-600">Rs {r.purchases.toLocaleString()}</td>
                <td className="px-3 py-2 text-right text-green-600">Rs {r.payments.toLocaleString()}</td>
                <td className="px-3 py-2 text-right font-medium text-surface-900 dark:text-white">Rs {(r.purchases - r.payments).toLocaleString()}</td>
                <td className="px-3 py-2">
                  <Link href={`/admin/suppliers/${r.id}/statement?start=${startDate}&end=${endDate}`} className="text-xs font-medium text-brand-600 hover:underline">
                    Detail Dekhein
                  </Link>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={5} className="px-3 py-8 text-center text-surface-400">Is period mein koi transaction nahi hai.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}