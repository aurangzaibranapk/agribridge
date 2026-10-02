import Link from "next/link";
import { createServiceClient } from "@/lib/supabase/service";
import { aajKaKhana } from "@/lib/utils/format";
import { Wallet, AlertTriangle, TrendingUp, FileText, CheckCircle2, Clock } from "lucide-react";

const money = (n: number | null | undefined) =>
  n == null ? "—" : `Rs ${Math.round(n).toLocaleString("en-PK")}`;
const ct = (n: number | null) => (n == null ? "—" : n.toLocaleString("en-PK"));

export async function FinanceOverview({ branchId }: { branchId: string | null }) {
  const service = createServiceClient();
  const today = aajKaKhana();

  try {
    const [accountsRes, pendingExpRes, pendingBillRes, recentTxRes] = await Promise.all([
      service
        .from("finance_accounts")
        .select("id, name, account_type, current_balance")
        .eq("is_active", true)
        .order("account_type"),
      service
        .from("company_expense_requests")
        .select("id, amount", { count: "exact" })
        .eq("status", "pending"),
      service
        .from("purchases")
        .select("id, grand_total, status", { count: "exact" })
        .in("status", ["pending", "received"]),
      service
        .from("finance_transactions")
        .select("id, amount, transaction_type, description, created_at, finance_accounts(name)")
        .order("created_at", { ascending: false })
        .limit(6),
    ]);

    const accounts = accountsRes.data ?? [];
    const cashAccounts = accounts.filter((a) => a.account_type === "cash");
    const bankAccounts = accounts.filter((a) => a.account_type === "bank");
    const totalCash = cashAccounts.reduce((s, a) => s + Number(a.current_balance ?? 0), 0);
    const totalBank = bankAccounts.reduce((s, a) => s + Number(a.current_balance ?? 0), 0);
    const pendingExpCount = pendingExpRes.count ?? 0;
    const pendingExpAmount = (pendingExpRes.data ?? []).reduce((s: number, r: any) => s + Number(r.amount ?? 0), 0);
    const pendingBillCount = pendingBillRes.count ?? 0;
    const recentTx = recentTxRes.data ?? [];

    return (
      <div className="staff-desk-screen">
        <div className="staff-desk-top-grid">
          <section className="desk-card staff-desk-ledger">
            <div className="staff-desk-card-title">
              <span><Wallet /> Cash Khata</span>
              <span className="staff-desk-live">Live</span>
            </div>
            <div className="staff-desk-ledger-total">
              <strong>{money(totalCash)}</strong>
              <span>Sab cash accounts ka total</span>
            </div>
            <div className="staff-desk-ledger-split">
              <div><span>Bank</span><strong>{money(totalBank)}</strong></div>
              <div><span>Cash Accounts</span><strong>{ct(cashAccounts.length)}</strong></div>
              <div><span>Bank Accounts</span><strong>{ct(bankAccounts.length)}</strong></div>
            </div>
            <div className="mt-3 space-y-1.5">
              {accounts.slice(0, 5).map((a) => (
                <div key={a.id} className="flex items-center justify-between text-[12.5px]">
                  <span className="text-surface-500 dark:text-surface-400">{a.name}</span>
                  <strong className={Number(a.current_balance ?? 0) < 0 ? "text-red-600 dark:text-red-400" : "text-surface-800 dark:text-surface-100"}>
                    {money(Number(a.current_balance ?? 0))}
                  </strong>
                </div>
              ))}
            </div>
            <Link href="/admin/finance" className="mt-3 block text-[12px] text-brand-600 dark:text-brand-400">
              Sab accounts →
            </Link>
          </section>

          <section className="desk-card staff-desk-summary">
            <h2><AlertTriangle /> Pending Kharche</h2>
            <div className="staff-desk-funnel">
              <div><strong>{ct(pendingExpCount)}</strong><span>Requests</span></div>
              <div><strong>{money(pendingExpAmount)}</strong><span>Total raqam</span></div>
              <div><strong>{ct(pendingBillCount)}</strong><span>Supplier bills</span></div>
            </div>
            <Link href="/admin/finance/queue" className="mt-3 block text-[12px] text-brand-600 dark:text-brand-400">
              Finance queue →
            </Link>
          </section>

          <section className="desk-card staff-desk-summary">
            <h2><TrendingUp /> Finance Accounts</h2>
            <div className="staff-desk-health">
              <div><strong>{ct(cashAccounts.length)}</strong><span>Cash</span></div>
              <div><strong>{ct(bankAccounts.length)}</strong><span>Bank</span></div>
              <div><strong>{ct(accounts.length)}</strong><span>Total</span></div>
            </div>
            <Link href="/admin/finance" className="mt-3 block text-[12px] text-brand-600 dark:text-brand-400">
              Finance kholein →
            </Link>
          </section>

          <section className="desk-card staff-desk-summary staff-desk-urgent">
            <h2><FileText /> Supplier Bills</h2>
            <div className="staff-desk-funnel">
              <div><strong>{ct(pendingBillCount)}</strong><span>Pending bills</span></div>
            </div>
            {pendingBillCount > 0 ? (
              <Link href="/admin/purchases" className="mt-3 block text-[12px] text-red-600 dark:text-red-400 font-medium">
                Bills dekhein →
              </Link>
            ) : (
              <p className="mt-3 flex items-center gap-1 text-[12px] text-surface-400">
                <CheckCircle2 className="h-3.5 w-3.5 text-green-500" /> Koi pending nahi
              </p>
            )}
          </section>
        </div>

        {/* Recent Finance Transactions */}
        <section className="desk-card">
          <div className="staff-desk-card-title">
            <span><Clock /> Haal Ki Finance Transactions</span>
            <Link href="/admin/finance" className="text-[11px] text-brand-600 dark:text-brand-400">Sab dekhein →</Link>
          </div>
          <div className="divide-y divide-surface-100 dark:divide-surface-800">
            {recentTx.length === 0 ? (
              <p className="py-4 text-center text-[12px] text-surface-400">Koi record nahi mila.</p>
            ) : (
              recentTx.map((tx: any) => {
                const acct = Array.isArray(tx.finance_accounts) ? tx.finance_accounts[0] : tx.finance_accounts;
                return (
                  <div key={tx.id} className="flex items-center justify-between gap-3 px-1 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-medium text-surface-800 dark:text-surface-100">
                        {tx.description || tx.transaction_type || "Transaction"}
                      </p>
                      <p className="text-[11px] text-surface-500">{acct?.name ?? "—"}</p>
                    </div>
                    <span className={`shrink-0 text-[13px] font-semibold tabular-nums ${tx.transaction_type === "credit" ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                      {tx.transaction_type === "credit" ? "+" : "-"}{money(Number(tx.amount ?? 0))}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </section>
      </div>
    );
  } catch {
    return (
      <div className="desk-card">
        <p className="text-sm text-surface-500">Finance ka data load nahi hua. Refresh karein.</p>
        <Link href="/admin/finance" className="mt-2 block text-sm text-brand-600">Finance kholein →</Link>
      </div>
    );
  }
}
