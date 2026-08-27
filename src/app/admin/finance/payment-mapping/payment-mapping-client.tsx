"use client";
import { useFormState } from "react-dom";
import { setPaymentMethodAccount, type ActionState } from "@/actions/payment-mapping";
import { Landmark, Wallet } from "lucide-react";

const initialState: ActionState = {};

interface Account {
  id: string;
  name: string;
  account_type: string;
}

interface Row {
  paymentMethod: string;
  label: string;
  financeAccountId: string | null;
}

export function PaymentMappingClient({ rows, accounts }: { rows: Row[]; accounts: Account[] }) {
  return (
    <div className="max-w-xl space-y-2">
      {rows.map((row) => (
        <MappingRow key={row.paymentMethod} row={row} accounts={accounts} />
      ))}
    </div>
  );
}

function MappingRow({ row, accounts }: { row: Row; accounts: Account[] }) {
  const [, formAction] = useFormState(setPaymentMethodAccount, initialState);

  return (
    <form action={formAction} className="flex items-center justify-between gap-3 rounded-card border border-surface-200 bg-white p-3 shadow-card dark:border-surface-800 dark:bg-surface-900">
      <input type="hidden" name="payment_method" value={row.paymentMethod} />
      <div className="flex items-center gap-2">
        {row.paymentMethod === "cash" ? <Wallet className="h-4 w-4 text-brand-600" /> : <Landmark className="h-4 w-4 text-brand-600" />}
        <span className="text-sm font-medium text-surface-800 dark:text-surface-200">{row.label}</span>
      </div>
      <select
        name="finance_account_id"
        defaultValue={row.financeAccountId ?? ""}
        onChange={(e) => e.target.form?.requestSubmit()}
        className="rounded-lg border border-surface-200 px-2 py-1.5 text-sm"
      >
        <option value="">- Account Select Karein -</option>
        {accounts.map((a) => (
          <option key={a.id} value={a.id}>{a.name} ({a.account_type})</option>
        ))}
      </select>
    </form>
  );
}