"use client";
import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { Button, Input, Label, Select, Textarea } from "@/components/ui/form";
import { recordLifterPayment, type LifterState } from "@/actions/crop-lifters";

const empty: LifterState = {};

/**
 * Uthane wale se paisa lena.
 *
 * Cash par khata nahi poochha jata -- wo lene wale ke haath mein hota
 * hai, kisi khate mein nahi (migration 171 ka wohi faisla). Bank aur
 * wallet par khata lazmi hai: wahan paisa waqai kisi khate mein aata
 * hai, aur us ka naam na likhein to paisa aa to gaya magar pahuncha
 * kahin nahi.
 */
export function LifterPaymentForm({
  lifterId,
  remaining,
  accounts,
}: {
  lifterId: string;
  remaining: number;
  accounts: Array<{ id: string; name: string; account_type: string }>;
}) {
  const [state, action] = useFormState(recordLifterPayment, empty);
  const [method, setMethod] = useState("cash");
  const [again, setAgain] = useState(false);

  // Bhara hua khana jawab ke baad khula rehna sab se mehnga masla hai:
  // banda samajhta hai ke shayad gaya nahi, aur dobara dabata hai -- ek
  // hi raqam do dafa.
  if (state.success && !again) {
    return (
      <div className="space-y-2">
        <p className="rounded-lg border border-brand-200 bg-brand-50 p-3 text-sm text-brand-800 dark:border-brand-900/40 dark:bg-brand-950/20 dark:text-brand-200">
          {state.notice}
        </p>
        <button
          type="button"
          onClick={() => setAgain(true)}
          className="text-sm font-medium text-brand-600 hover:underline"
        >
          Aur adaigi darj karein
        </button>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-3">
      {state.error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}
      <input type="hidden" name="lifter_id" value={lifterId} />

      <p className="text-sm text-surface-600 dark:text-surface-300">Baqi: Rs {remaining.toLocaleString()}</p>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div>
          <Label htmlFor="method">Tareeqa</Label>
          <Select id="method" name="method" value={method} onChange={(e) => setMethod(e.target.value)}>
            <option value="cash">Cash</option>
            <option value="bank">Bank</option>
            <option value="wallet">Wallet</option>
            <option value="other">Doosra</option>
          </Select>
        </div>
        <div>
          <Label htmlFor="amount">Raqam</Label>
          {/* Poora dena lazmi nahi -- jitna waqai mila utna. */}
          <Input id="amount" name="amount" type="number" step="0.01" required placeholder="0" />
        </div>
        <div>
          {method === "cash" || method === "other" ? (
            <p className="mt-6 text-xs text-surface-500">
              Cash lene wale ke haath mein rehta hai — us ka khata nahi poochha jata.
            </p>
          ) : (
            <>
              <Label htmlFor="finance_account_id">Khata</Label>
              <Select id="finance_account_id" name="finance_account_id" defaultValue="">
                <option value="">—</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </Select>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="payment_date">Tareekh</Label>
          <Input
            id="payment_date"
            name="payment_date"
            type="date"
            defaultValue={new Date().toISOString().slice(0, 10)}
          />
        </div>
        <div>
          <Label htmlFor="reference">Reference</Label>
          <Input id="reference" name="reference" placeholder="Cheque / transaction number" />
        </div>
      </div>

      <div>
        <Label htmlFor="notes">Note</Label>
        <Textarea id="notes" name="notes" rows={2} />
      </div>

      <Submit />
    </form>
  );
}

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Darj ho rahi hai..." : "Adaigi darj karein"}
    </Button>
  );
}
