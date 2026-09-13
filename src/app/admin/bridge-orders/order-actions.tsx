"use client";
import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { adminVerifyOrder, adminMarkDelivered, recordOrderAdvancePayment, type ActionState } from "@/actions/bridge-orders";
import { CheckCircle2, Truck, X, CreditCard } from "lucide-react";
import { t } from "@/lib/i18n/translations";
import { useLang } from "@/lib/i18n/lang-context";

const initialState: ActionState = {};

const PAYMENT_METHODS = [
  { value: "cash", label: "Cash" },
  { value: "bank_transfer", label: "Bank Transfer" },
  { value: "credit_card", label: "Credit Card" },
  { value: "debit_card", label: "Debit Card" },
  { value: "qr_code", label: "QR Code" },
  { value: "raast", label: "RAAST" },
  { value: "jazzcash", label: "JazzCash" },
  { value: "easypaisa", label: "EasyPaisa" },
  { value: "kisan_card", label: "Kisan Card" },
  { value: "zarkhaiz", label: "Zarkhaiz" },
];

export function OrderActions({
  orderId,
  status,
  paymentMode,
  advanceRequired,
  advancePaid,
  financeAccounts,
}: {
  orderId: string;
  status: string;
  paymentMode?: string | null;
  advanceRequired?: number;
  advancePaid?: number;
  financeAccounts: { id: string; name: string }[];
}) {
  const lang = useLang();
  const [verifyState, verifyAction] = useFormState(adminVerifyOrder, initialState);
  const [deliverState, deliverAction] = useFormState(adminMarkDelivered, initialState);
  const [showPayment, setShowPayment] = useState(false);

  const remaining = (advanceRequired ?? 0) - (advancePaid ?? 0);

  return (
    <div className="flex flex-col items-start gap-2">
      {paymentMode && (
        <div className="text-xs">
          <span className="font-medium text-surface-600">{paymentMode === "cod" ? "COD (20% Advance)" : "Full Advance"}</span>
          {remaining > 0 ? (
            <button onClick={() => setShowPayment(true)} className="ml-2 font-medium text-brand-600 hover:underline">
              Rs {remaining.toLocaleString()} Baaqi - Payment Lein
            </button>
          ) : (
            <span className="ml-2 font-medium text-green-600">{t("at_payment_full", lang)}</span>
          )}
        </div>
      )}
      <div className="flex items-center gap-2">
        {status === "dealer_accepted" && (
          <form action={verifyAction}>
            <input type="hidden" name="order_id" value={orderId} />
            <VerifyButton />
          </form>
        )}
        {status === "dealer_dispatched" && (
          <form action={deliverAction}>
            <input type="hidden" name="order_id" value={orderId} />
            <DeliverButton />
          </form>
        )}
      </div>
      {verifyState.error && <p className="text-xs text-red-600">{verifyState.error}</p>}
      {deliverState.error && <p className="text-xs text-red-600">{deliverState.error}</p>}

      {showPayment && (
        <PaymentModal orderId={orderId} remaining={remaining} financeAccounts={financeAccounts} onClose={() => setShowPayment(false)} />
      )}
    </div>
  );
}

function PaymentModal({
  orderId,
  remaining,
  financeAccounts,
  onClose,
}: {
  orderId: string;
  remaining: number;
  financeAccounts: { id: string; name: string }[];
  onClose: () => void;
}) {
  const lang = useLang();
  const [state, formAction] = useFormState(recordOrderAdvancePayment, initialState);
  if (state.success) setTimeout(() => window.location.reload(), 800);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-sm rounded-card bg-white p-5 shadow-xl">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="flex items-center gap-2 font-display text-base font-semibold text-surface-900">
            <CreditCard className="h-4 w-4 text-brand-600" />{t("at_record_payment", lang)}</h3>
          <button onClick={onClose} className="text-surface-400 hover:text-surface-700"><X className="h-5 w-5" /></button>
        </div>
        <p className="mb-3 text-sm text-surface-500">Baaqi: Rs {remaining.toLocaleString()}</p>
        {state.error && <p className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{state.error}</p>}
        <form action={formAction} className="space-y-2">
          <input type="hidden" name="order_id" value={orderId} />
          <input type="number" step="0.01" name="amount" max={remaining} defaultValue={remaining} required placeholder={t("at_amount_rs", lang)} className="w-full rounded-lg border border-surface-200 p-2 text-sm" />
          <select name="payment_method" required className="w-full rounded-lg border border-surface-200 p-2 text-sm">
            <option value="">- Payment Method Select Karein -</option>
            {PAYMENT_METHODS.map((m) => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
          <select name="account_id" required className="w-full rounded-lg border border-surface-200 p-2 text-sm">
            <option value="">- Konsa Account -</option>
            {financeAccounts.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
          <SubmitButton />
        </form>
      </div>
    </div>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={pending} className="w-full rounded-lg bg-brand-600 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60">{pending ? "..." : "Record Karein"}</button>;
}

function VerifyButton() {
  const lang = useLang();
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="flex items-center gap-1 rounded-lg bg-brand-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-60"
    >
      <CheckCircle2 className="h-3.5 w-3.5" />{t("at_verify_release_payout", lang)}</button>
  );
}

function DeliverButton() {
  const lang = useLang();
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="flex items-center gap-1 rounded-lg bg-green-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-60"
    >
      <Truck className="h-3.5 w-3.5" />{t("at_mark_delivered", lang)}</button>
  );
}