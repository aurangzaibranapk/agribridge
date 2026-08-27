"use client";
import { useMemo, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { createFinanceAccount, recordFinanceTransaction, transferBetweenAccounts, type ActionState } from "@/actions/finance";
import { BankLogo, getBankLogo } from "@/lib/bank-logos";
import { Button, Input, Label, Select, Textarea } from "@/components/ui/form";
import { Card } from "@/components/ui/layout-primitives";
import { Wallet, ArrowUpCircle, ArrowLeftRight, Plus } from "lucide-react";

interface Account {
  id: string;
  name: string;
  account_type: string;
  current_balance: number;
}

interface Transaction {
  id: string;
  account_id: string;
  transaction_type: string;
  category: string | null;
  amount: number;
  transaction_date: string;
  notes: string | null;
}

const initialState: ActionState = {};

/** Bank ka logo, ya jis account ka logo na ho (jaise Cash in Hand) us par wallet icon. */
function AccountIcon({ name, size = 16 }: { name: string; size?: number }) {
  if (getBankLogo(name)) return <BankLogo name={name} size={size} />;
  return <Wallet style={{ height: size, width: size }} className="shrink-0" />;
}

export function FinanceClient({ accounts, transactions }: { accounts: Account[]; transactions: Transaction[] }) {
  const [selectedAccountId, setSelectedAccountId] = useState<string>(accounts[0]?.id ?? "");
  const [showNewAccount, setShowNewAccount] = useState(false);

  const totalBalance = useMemo(() => accounts.reduce((sum, a) => sum + a.current_balance, 0), [accounts]);

  const filteredTxns = useMemo(() => {
    if (!selectedAccountId) return transactions;
    return transactions.filter((t) => t.account_id === selectedAccountId);
  }, [transactions, selectedAccountId]);

  const selectedAccount = accounts.find((a) => a.id === selectedAccountId);
  let runningBalance = selectedAccount?.current_balance ?? 0;
  const rowsWithBalance = filteredTxns.map((t) => {
    const balanceAtThisRow = runningBalance;
    const isCredit = t.transaction_type === "income" || t.transaction_type === "transfer_in";
    runningBalance = isCredit ? runningBalance - t.amount : runningBalance + t.amount;
    return { ...t, balanceAfter: balanceAtThisRow, isCredit };
  });

  return (
    <div>
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="border-brand-200 bg-brand-50 dark:border-brand-900/40 dark:bg-brand-950/30">
          <div className="flex items-center gap-2 text-brand-600">
            <Wallet className="h-4 w-4" />
            <span className="text-xs font-medium uppercase tracking-wide">Total Balance (All Accounts)</span>
          </div>
          <p className="mt-2 font-display text-xl font-semibold text-brand-700 dark:text-brand-300">
            Rs {totalBalance.toLocaleString()}
          </p>
        </Card>
        {accounts.slice(0, 2).map((a) => (
          <Card key={a.id} className="border-surface-200 bg-white dark:border-surface-800 dark:bg-surface-900">
            <div className="flex items-center gap-2 text-surface-500">
              <AccountIcon name={a.name} size={18} />
              <span className="text-xs font-medium uppercase tracking-wide">{a.name}</span>
            </div>
            <p className="mt-2 font-display text-xl font-semibold text-surface-900 dark:text-white">
              Rs {a.current_balance.toLocaleString()}
            </p>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1.5">
              {accounts.map((a) => {
                const isActive = a.id === selectedAccountId;
                return (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => setSelectedAccountId(a.id)}
                    aria-pressed={isActive}
                    className={
                      isActive
                        ? "flex items-center gap-1.5 rounded-lg border border-brand-300 bg-brand-50 px-2 py-1.5 text-xs font-semibold text-brand-800 dark:border-brand-700 dark:bg-brand-900/30 dark:text-brand-200"
                        : "flex items-center gap-1.5 rounded-lg border border-surface-200 bg-white px-2 py-1.5 text-xs font-medium text-surface-600 hover:bg-surface-50 dark:border-surface-800 dark:bg-surface-900 dark:text-surface-300 dark:hover:bg-surface-800"
                    }
                  >
                    <AccountIcon name={a.name} />
                    {a.name}
                  </button>
                );
              })}
            </div>
            <button
              onClick={() => setShowNewAccount(true)}
              className="flex shrink-0 items-center gap-1 rounded-lg border border-brand-200 px-2.5 py-1.5 text-xs font-medium text-brand-700 hover:bg-brand-50"
            >
              <Plus className="h-3.5 w-3.5" /> New Account
            </button>
          </div>

          <div className="overflow-hidden rounded-card border border-surface-200 bg-white shadow-card dark:border-surface-800 dark:bg-surface-900">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-200 bg-surface-50 text-left dark:border-surface-800 dark:bg-surface-800">
                  <th className="px-3 py-2 font-medium text-surface-500">Date</th>
                  <th className="px-3 py-2 font-medium text-surface-500">Description</th>
                  <th className="px-3 py-2 text-right font-medium text-surface-500">Credit</th>
                  <th className="px-3 py-2 text-right font-medium text-surface-500">Debit</th>
                  <th className="px-3 py-2 text-right font-medium text-surface-500">Balance</th>
                </tr>
              </thead>
              <tbody>
                {rowsWithBalance.map((t) => (
                  <tr key={t.id} className="border-b border-surface-100 last:border-0 dark:border-surface-800">
                    <td className="px-3 py-2 text-surface-500">{t.transaction_date}</td>
                    <td className="px-3 py-2 text-surface-700 dark:text-surface-300">
                      {t.category ?? t.transaction_type} {t.notes && `- ${t.notes}`}
                    </td>
                    <td className="px-3 py-2 text-right text-green-600">
                      {t.isCredit ? `Rs ${t.amount.toLocaleString()}` : ""}
                    </td>
                    <td className="px-3 py-2 text-right text-red-600">
                      {!t.isCredit ? `Rs ${t.amount.toLocaleString()}` : ""}
                    </td>
                    <td className="px-3 py-2 text-right font-semibold text-surface-900 dark:text-white">
                      Rs {t.balanceAfter.toLocaleString()}
                    </td>
                  </tr>
                ))}
                {rowsWithBalance.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-3 py-8 text-center text-surface-400">
                      No transactions yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-4">
          <TransactionForm accounts={accounts} />
          <TransferForm accounts={accounts} />
        </div>
      </div>

      {showNewAccount && <NewAccountModal onClose={() => setShowNewAccount(false)} />}
    </div>
  );
}

function TransactionForm({ accounts }: { accounts: Account[] }) {
  const [state, formAction] = useFormState(recordFinanceTransaction, initialState);

  return (
    <div className="rounded-card border border-surface-200 bg-white p-4 shadow-card dark:border-surface-800 dark:bg-surface-900">
      <h3 className="mb-3 flex items-center gap-2 font-display text-sm font-semibold text-surface-900 dark:text-white">
        <ArrowUpCircle className="h-4 w-4 text-green-600" /> Add Income/Expense
      </h3>
      {state.error && <p className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-900/30 dark:text-red-300">{state.error}</p>}
      {state.success && <p className="mb-2 rounded-lg bg-brand-50 px-3 py-2 text-xs text-brand-700 dark:bg-brand-900/30 dark:text-brand-300">Recorded.</p>}
      <form action={formAction} className="space-y-2">
        <Select name="account_id" required>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </Select>
        <Select name="transaction_type" defaultValue="expense">
          <option value="income">Income (Credit)</option>
          <option value="expense">Expense (Debit)</option>
        </Select>
        <Input name="category" placeholder="Category (e.g. Rent, Salary, Utility Bill)" />
        <Input type="number" step="0.01" name="amount" placeholder="Amount" required />
        <Input type="date" name="transaction_date" defaultValue={new Date().toISOString().slice(0, 10)} />
        <Textarea name="notes" rows={2} placeholder="Notes (optional)" />
        <TxnSubmitButton />
      </form>
    </div>
  );
}

function TransferForm({ accounts }: { accounts: Account[] }) {
  const [state, formAction] = useFormState(transferBetweenAccounts, initialState);

  return (
    <div className="rounded-card border border-surface-200 bg-white p-4 shadow-card dark:border-surface-800 dark:bg-surface-900">
      <h3 className="mb-3 flex items-center gap-2 font-display text-sm font-semibold text-surface-900 dark:text-white">
        <ArrowLeftRight className="h-4 w-4 text-blue-600" /> Transfer Between Accounts
      </h3>
      {state.error && <p className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-900/30 dark:text-red-300">{state.error}</p>}
      {state.success && <p className="mb-2 rounded-lg bg-brand-50 px-3 py-2 text-xs text-brand-700 dark:bg-brand-900/30 dark:text-brand-300">Transferred.</p>}
      <form action={formAction} className="space-y-2">
        <Select name="from_account_id" required>
          <option value="">From account</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </Select>
        <Select name="to_account_id" required>
          <option value="">To account</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </Select>
        <Input type="number" step="0.01" name="amount" placeholder="Amount" required />
        <Input type="date" name="transaction_date" defaultValue={new Date().toISOString().slice(0, 10)} />
        <Textarea name="notes" rows={2} placeholder="Notes (optional)" />
        <TransferSubmitButton />
      </form>
    </div>
  );
}

function NewAccountModal({ onClose }: { onClose: () => void }) {
  const [state, formAction] = useFormState(createFinanceAccount, initialState);

  if (state.success) {
    setTimeout(onClose, 800);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-sm rounded-card bg-white p-5 shadow-xl dark:bg-surface-900">
        <h3 className="mb-3 font-display text-base font-semibold text-surface-900 dark:text-white">New Account</h3>
        {state.error && <p className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-900/30 dark:text-red-300">{state.error}</p>}
        <form action={formAction} className="space-y-3">
          <Input name="name" placeholder="Account Name (e.g. Meezan Bank)" required />
          <Select name="account_type" defaultValue="cash">
            <option value="cash">Cash</option>
            <option value="bank">Bank</option>
            <option value="mobile_wallet">Mobile Wallet</option>
            <option value="other">Other</option>
          </Select>
          <Input type="number" step="0.01" name="opening_balance" placeholder="Opening Balance" />
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="flex-1 rounded-lg border border-surface-200 px-3 py-2 text-sm">
              Cancel
            </button>
            <AccountSubmitButton />
          </div>
        </form>
      </div>
    </div>
  );
}

function TxnSubmitButton() {
  const { pending } = useFormStatus();
  return <Button type="submit" disabled={pending} className="w-full">{pending ? "Saving..." : "Add Transaction"}</Button>;
}
function TransferSubmitButton() {
  const { pending } = useFormStatus();
  return <Button type="submit" disabled={pending} className="w-full">{pending ? "Transferring..." : "Transfer"}</Button>;
}
function AccountSubmitButton() {
  const { pending } = useFormStatus();
  return <Button type="submit" disabled={pending} className="flex-1">{pending ? "Creating..." : "Create"}</Button>;
}