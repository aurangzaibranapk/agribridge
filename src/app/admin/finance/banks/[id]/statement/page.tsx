import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/layout-primitives";
import { StatementClient } from "./statement-client";

export const dynamic = "force-dynamic";

export default async function BankStatementPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ start?: string; end?: string }>;
}) {
  const { id: bankId } = await params;
  const sp = await searchParams;
  const now = new Date();
  const defaultStart = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate()).toISOString().slice(0, 10);
  const startDate = sp.start ?? defaultStart;
  const endDate = sp.end ?? now.toISOString().slice(0, 10);

  const supabase = createClient();
  const { data: bank } = await supabase
    .from("finance_accounts")
    .select("id, name, account_number, opening_balance, current_balance")
    .eq("id", bankId)
    .single();

  const { data: rawTxns } = await supabase
    .from("finance_transactions")
    .select("id, created_at, description, amount, type")
    .eq("account_id", bankId)
    .gte("created_at", startDate)
    .lte("created_at", `${endDate}T23:59:59`)
    .order("created_at", { ascending: true });

  let runningBalance = Number(bank?.opening_balance ?? 0);
  let totalCredit = 0;
  let totalDebit = 0;
  const transactions = (rawTxns ?? []).map((t) => {
    const amount = Number(t.amount);
    if (t.type === "income") {
      totalCredit += amount;
      runningBalance += amount;
    } else {
      totalDebit += amount;
      runningBalance -= amount;
    }
    return { ...t, amount, runningBalance };
  });

  return (
    <div>
      <PageHeader title={`${bank?.name ?? "Bank"} - Statement`} description="Date range se transaction history dekhein" />
      <StatementClient
        bankName={bank?.name ?? "Bank"}
        accountNumber={bank?.account_number ?? null}
        startDate={startDate}
        endDate={endDate}
        openingBalance={Number(bank?.opening_balance ?? 0)}
        transactions={transactions}
        totalCredit={totalCredit}
        totalDebit={totalDebit}
        closingBalance={runningBalance}
      />
    </div>
  );
}