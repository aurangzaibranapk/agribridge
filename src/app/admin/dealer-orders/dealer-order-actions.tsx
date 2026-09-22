"use client";
import { useFormState, useFormStatus } from "react-dom";
import { dealerRespondToOrder, dealerDispatchOrder, type ActionState } from "@/actions/bridge-orders";
import { Check, X, Truck } from "lucide-react";
import { t } from "@/lib/i18n/translations";
import { useLang } from "@/lib/i18n/lang-context";

const initialState: ActionState = {};

export function DealerOrderActions({ orderId, status }: { orderId: string; status: string }) {
  const [respondState, respondAction] = useFormState(dealerRespondToOrder, initialState);
  const [dispatchState, dispatchAction] = useFormState(dealerDispatchOrder, initialState);

  if (status === "assigned") {
    return (
      <div className="flex items-center gap-2">
        <form action={respondAction}>
          <input type="hidden" name="order_id" value={orderId} />
          <input type="hidden" name="response" value="accept" />
          <AcceptButton />
        </form>
        <form action={respondAction}>
          <input type="hidden" name="order_id" value={orderId} />
          <input type="hidden" name="response" value="reject" />
          <RejectButton />
        </form>
        {respondState.error && <p className="text-xs text-red-600">{respondState.error}</p>}
      </div>
    );
  }

  if (status === "staff_verified") {
    return (
      <form action={dispatchAction}>
        <input type="hidden" name="order_id" value={orderId} />
        <DispatchButton />
        {dispatchState.error && <p className="mt-1 text-xs text-red-600">{dispatchState.error}</p>}
      </form>
    );
  }

  return null;
}

function AcceptButton() {
  const lang = useLang();
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="flex items-center gap-1 rounded-lg bg-brand-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-60"
    >
      <Check className="h-3.5 w-3.5" />{t("at_accept", lang)}</button>
  );
}

function RejectButton() {
  const lang = useLang();
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="flex items-center gap-1 rounded-lg bg-red-50 px-2.5 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100 disabled:opacity-60 dark:bg-red-950/30 dark:text-red-300"
    >
      <X className="h-3.5 w-3.5" />{t("at_reject", lang)}</button>
  );
}

function DispatchButton() {
  const lang = useLang();
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="flex items-center gap-1 rounded-lg bg-green-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-60"
    >
      <Truck className="h-3.5 w-3.5" />{t("at_mark_dispatched", lang)}</button>
  );
}