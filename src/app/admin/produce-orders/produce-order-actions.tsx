"use client";
import { useFormState, useFormStatus } from "react-dom";
import { adminVerifyProduceOrder, adminMarkProduceDelivered, type ActionState } from "@/actions/produce";
import { CheckCircle2, Truck } from "lucide-react";
import { t } from "@/lib/i18n/translations";
import { useLang } from "@/lib/i18n/lang-context";

const initialState: ActionState = {};

export function ProduceOrderActions({ orderId, status }: { orderId: string; status: string }) {
  const [verifyState, verifyAction] = useFormState(adminVerifyProduceOrder, initialState);
  const [deliverState, deliverAction] = useFormState(adminMarkProduceDelivered, initialState);

  if (status === "farmer_accepted") {
    return (
      <form action={verifyAction}>
        <input type="hidden" name="order_id" value={orderId} />
        <VerifyButton />
        {verifyState.error && <p className="mt-1 text-xs text-red-600">{verifyState.error}</p>}
      </form>
    );
  }

  if (status === "staff_verified") {
    return (
      <form action={deliverAction}>
        <input type="hidden" name="order_id" value={orderId} />
        <DeliverButton />
        {deliverState.error && <p className="mt-1 text-xs text-red-600">{deliverState.error}</p>}
      </form>
    );
  }

  return null;
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