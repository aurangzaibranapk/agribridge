import { createClient } from "@/lib/supabase/server";
import { PageHeader, Card, EmptyState } from "@/components/ui/layout-primitives";
import { FarmerCreditClient } from "./farmer-credit-client";

export const dynamic = "force-dynamic";

export default async function AdminFarmerCreditPage() {
  const supabase = createClient();
  const [{ data: farmers }, { data: rawLedger }, { data: financeAccounts }] = await Promise.all([
    supabase.from("farmers").select("id, full_name, farmer_code, credit_limit").eq("is_deleted", false).order("full_name"),
    supabase.from("farmer_credit_ledger").select("*, farmers(full_name, farmer_code)").order("created_at", { ascending: false }).limit(300),
    supabase.from("finance_accounts").select("id, name, account_type").eq("is_active", true).order("account_type"),
  ]);

  const ledger = (rawLedger ?? []).map((r: any) => {
    const farmer = Array.isArray(r.farmers) ? r.farmers[0] : r.farmers;
    return {
      id: r.id,
      farmer_id: r.farmer_id,
      farmer_name: farmer?.full_name ?? "-",
      farmer_code: farmer?.farmer_code ?? "-",
      source_type: r.source_type,
      ledger_type: r.ledger_type,
      amount: Number(r.amount),
      collected_by: r.collected_by,
      notes: r.notes,
      created_at: r.created_at,
    };
  });

  const balanceMap: Record<string, { farmer_id: string; farmer_name: string; farmer_code: string; totalDebit: number; totalCredit: number; credit_limit: number | null }> = {};
  (farmers ?? []).forEach((f) => {
    balanceMap[f.id] = { farmer_id: f.id, farmer_name: f.full_name, farmer_code: f.farmer_code, totalDebit: 0, totalCredit: 0, credit_limit: f.credit_limit ? Number(f.credit_limit) : null };
  });
  ledger.forEach((r) => {
    if (!balanceMap[r.farmer_id]) return;
    if (r.ledger_type === "debit") balanceMap[r.farmer_id].totalDebit += r.amount;
    else balanceMap[r.farmer_id].totalCredit += r.amount;
  });
  const balances = Object.values(balanceMap)
    .map((b) => ({ ...b, balance_due: b.totalDebit - b.totalCredit }))
    .filter((b) => b.balance_due !== 0)
    .sort((a, b) => b.balance_due - a.balance_due);

  const bySource: Record<string, number> = {};
  ledger.filter((r) => r.ledger_type === "debit").forEach((r) => {
    bySource[r.source_type] = (bySource[r.source_type] ?? 0) + r.amount;
  });

  const totalOutstanding = balances.reduce((s, b) => s + Math.max(b.balance_due, 0), 0);
  const totalIssued = ledger.filter((r) => r.ledger_type === "debit").reduce((s, r) => s + r.amount, 0);
  const totalRepaid = ledger.filter((r) => r.ledger_type === "credit").reduce((s, r) => s + r.amount, 0);

  return (
    <div>
      <PageHeader title="Farmer Credit Line" description="Seed/Fertilizer/Pesticide/Machinery/Wanda/Milk credit - poora hisaab" />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <p className="text-xs font-medium uppercase tracking-wide text-surface-500">Total Issued</p>
          <p className="mt-2 font-display text-xl font-semibold text-surface-900 dark:text-white">Rs {totalIssued.toLocaleString()}</p>
        </Card>
        <Card className="border-green-200 bg-green-50 dark:border-green-900/40 dark:bg-green-950/30">
          <p className="text-xs font-medium uppercase tracking-wide text-green-600">Total Repaid</p>
          <p className="mt-2 font-display text-xl font-semibold text-green-700">Rs {totalRepaid.toLocaleString()}</p>
        </Card>
        <Card className="border-amber-200 bg-amber-50 dark:border-amber-900/40 dark:bg-amber-950/30">
          <p className="text-xs font-medium uppercase tracking-wide text-amber-600">Outstanding</p>
          <p className="mt-2 font-display text-xl font-semibold text-amber-700">Rs {totalOutstanding.toLocaleString()}</p>
        </Card>
        <Card>
          <p className="text-xs font-medium uppercase tracking-wide text-surface-500">Farmers On Credit</p>
          <p className="mt-2 font-display text-xl font-semibold text-surface-900 dark:text-white">{balances.length}</p>
        </Card>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {Object.entries(bySource).map(([source, amt]) => (
          <div key={source} className="rounded-card border border-surface-200 bg-white p-3 shadow-card dark:border-surface-800 dark:bg-surface-900">
            <p className="text-xs capitalize text-surface-500">{source.replace(/_/g, " ")}</p>
            <p className="mt-1 font-display text-lg font-semibold text-surface-900 dark:text-white">Rs {amt.toLocaleString()}</p>
          </div>
        ))}
      </div>

      <FarmerCreditClient farmers={farmers ?? []} balances={balances} ledger={ledger} financeAccounts={financeAccounts ?? []} />
    </div>
  );
}