import { createClient } from "@/lib/supabase/server";
import { PageHeader, EmptyState } from "@/components/ui/layout-primitives";
import { FinanceClient } from "@/app/admin/finance/finance-client";

export const dynamic = "force-dynamic";

export default async function AdminFinancePage() {
  const supabase = createClient();

  const { data: accounts } = await supabase
    .from("finance_accounts")
    .select("id, name, account_type, current_balance")
    .eq("is_active", true)
    .order("created_at");

  if (!accounts || accounts.length === 0) {
    return (
      <div>
        <PageHeader title="Finance / Cash Book" description="Multi-account cash book with income, expenses, and transfers" />
        <EmptyState
          title="No accounts yet"
          description="You'll need at least one account (e.g. 'Cash' or a bank name) to get started - reload this page after creating one from the button that will appear here."
        />
        <div className="mt-4">
          <FinanceClient accounts={[]} transactions={[]} />
        </div>
      </div>
    );
  }

  const { data: rawTransactions } = await supabase
    .from("finance_transactions")
    .select("id, account_id, transaction_type, category, amount, transaction_date, notes")
    .order("transaction_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(200);

  const transactions = (rawTransactions ?? []).map((t) => ({
    id: t.id,
    account_id: t.account_id,
    transaction_type: t.transaction_type,
    category: t.category,
    amount: Number(t.amount),
    transaction_date: t.transaction_date,
    notes: t.notes,
  }));

  return (
    <div>
      <PageHeader title="Finance / Cash Book" description="Multi-account cash book with income, expenses, and transfers" />
      <FinanceClient accounts={accounts} transactions={transactions} />
    </div>
  );
}