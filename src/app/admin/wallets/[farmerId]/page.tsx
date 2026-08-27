import { createClient } from "@/lib/supabase/server";
import { WalletStatementClient } from "./statement-client";

export const dynamic = "force-dynamic";

const TYPE_LABELS: Record<string, string> = {
  milk_income: "Milk Income",
  milk_cash_payment: "Milk Cash Payment",
  loan_disbursement: "Loan Diya Gaya",
  loan_repayment: "Loan Installment",
  machinery_payment: "Machinery Payment",
  commission_credit: "Commission/Payout",
};

export default async function WalletStatementPage({ params }: { params: Promise<{ farmerId: string }> }) {
  const { farmerId } = await params;
  const supabase = createClient();

  const [{ data: farmer }, { data: wallet }] = await Promise.all([
    supabase.from("farmers").select("id, full_name, farmer_code, phone_number").eq("id", farmerId).single(),
    supabase.from("wallets").select("id, balance").eq("owner_type", "farmer").eq("owner_id", farmerId).single(),
  ]);

  if (!farmer || !wallet) {
    return <div className="p-8 text-center text-surface-400">Farmer ya Wallet nahi mila.</div>;
  }

  const { data: rawTxns } = await supabase
    .from("wallet_transactions")
    .select("id, type, direction, amount, notes, created_at")
    .eq("wallet_id", wallet.id)
    .order("created_at", { ascending: true });

  let runningBalance = 0;
  const transactions = (rawTxns ?? []).map((t) => {
    runningBalance += t.direction === "credit" ? Number(t.amount) : -Number(t.amount);
    return {
      id: t.id,
      typeLabel: TYPE_LABELS[t.type] ?? t.type,
      direction: t.direction,
      amount: Number(t.amount),
      notes: t.notes,
      date: t.created_at,
      balanceAfter: runningBalance,
    };
  });

  return (
    <WalletStatementClient
      farmer={{ id: farmer.id, name: farmer.full_name, code: farmer.farmer_code, phone: farmer.phone_number }}
      currentBalance={Number(wallet.balance)}
      transactions={transactions.reverse()}
    />
  );
}