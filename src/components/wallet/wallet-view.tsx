import { Wallet as WalletIcon, ArrowUpCircle, ArrowDownCircle } from "lucide-react";

interface Transaction {
  id: string;
  type: string;
  direction: string;
  amount: number;
  balance_after: number;
  notes: string | null;
  created_at: string;
}

export function WalletView({
  balance,
  heldBalance,
  transactions,
}: {
  balance: number;
  heldBalance: number;
  transactions: Transaction[];
}) {
  function typeLabel(type: string) {
    const map: Record<string, string> = {
      manual_topup: "Top-up",
      withdrawal: "Withdrawal",
      manual_adjustment: "Adjustment",
      cashback: "Cashback",
      referral_bonus: "Referral Bonus",
      incentive: "Incentive",
      subsidy: "Subsidy",
      loan_disbursement: "Loan Disbursement",
      loan_repayment: "Loan Repayment",
      commission_credit: "Payment Received",
      escrow_hold: "Held",
      escrow_release: "Released",
      escrow_refund: "Refunded",
    };
    return map[type] ?? type;
  }

  return (
    <div>
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 p-6 text-white shadow-lg">
          <div className="flex items-center gap-2 text-white/80">
            <WalletIcon className="h-5 w-5" />
            <span className="text-xs font-medium uppercase tracking-wide">Available Balance</span>
          </div>
          <p className="mt-2 font-display text-3xl font-bold">Rs {balance.toLocaleString()}</p>
        </div>
        {heldBalance > 0 && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6">
            <span className="text-xs font-medium uppercase tracking-wide text-amber-700">Held (Pending)</span>
            <p className="mt-2 font-display text-2xl font-bold text-amber-800">Rs {heldBalance.toLocaleString()}</p>
          </div>
        )}
      </div>

      <h2 className="mb-3 font-display text-base font-semibold text-surface-900">Transaction History</h2>
      <div className="overflow-hidden rounded-card border border-surface-200 bg-white shadow-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-surface-200 bg-surface-50 text-left">
              <th className="px-4 py-3 font-medium text-surface-500">Date</th>
              <th className="px-4 py-3 font-medium text-surface-500">Description</th>
              <th className="px-4 py-3 text-right font-medium text-surface-500">Amount</th>
              <th className="px-4 py-3 text-right font-medium text-surface-500">Balance</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((t) => (
              <tr key={t.id} className="border-b border-surface-100 last:border-0">
                <td className="px-4 py-3 text-surface-500">{new Date(t.created_at).toLocaleDateString()}</td>
                <td className="px-4 py-3 text-surface-700">
                  <div className="flex items-center gap-1.5">
                    {t.direction === "credit" ? (
                      <ArrowUpCircle className="h-3.5 w-3.5 text-green-600" />
                    ) : (
                      <ArrowDownCircle className="h-3.5 w-3.5 text-red-600" />
                    )}
                    {typeLabel(t.type)}
                    {t.notes && <span className="text-xs text-surface-400"> - {t.notes}</span>}
                  </div>
                </td>
                <td className={`px-4 py-3 text-right font-semibold ${t.direction === "credit" ? "text-green-600" : "text-red-600"}`}>
                  {t.direction === "credit" ? "+" : "-"}Rs {t.amount.toLocaleString()}
                </td>
                <td className="px-4 py-3 text-right font-semibold text-surface-900">Rs {t.balance_after.toLocaleString()}</td>
              </tr>
            ))}
            {transactions.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-surface-400">
                  No transactions yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}