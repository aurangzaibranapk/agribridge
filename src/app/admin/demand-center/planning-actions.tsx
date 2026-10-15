"use client";

import Link from "next/link";
import { useFormState } from "@/lib/hooks/use-safe-form-state";
import { approveProcurementPlan, markSupplierAsked, markPlanStockArrived, notifyDemandFarmer, type PlanActionState } from "@/actions/demand-center";

const init: PlanActionState = {};

function Msg({ s }: { s: PlanActionState }) {
  if (s.error) return <p className="text-xs text-red-700">{s.error}</p>;
  if (!s.success) return null;
  return (
    <div className="space-y-1">
      <p className="text-xs text-emerald-700">{s.message}</p>
      {s.poHref && <Link href={s.poHref} className="text-xs font-medium text-brand-700 underline">Nayi Kharid (PO) kholein — miqdar saath</Link>}
      {s.notifyText && <textarea readOnly value={s.notifyText} rows={3} className="w-full rounded border p-2 text-xs" onFocus={(e) => e.currentTarget.select()} />}
    </div>
  );
}

export function SuggestionCard(props: {
  productKey: string; productName: string; unit: string; confirmed: number; buffer: number; suggested: number;
  farmers: number; isApprover: boolean; canAskSupplier: boolean;
}) {
  const [planState, planAction] = useFormState(approveProcurementPlan, init);
  const [askState, askAction] = useFormState(markSupplierAsked, init);
  const { productKey, productName, unit, confirmed, buffer, suggested, farmers } = props;
  return (
    <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-3 text-sm">
      <p className="font-medium">{productName}</p>
      <p className="mt-1 text-surface-700">
        {confirmed} {unit} confirmed demand ({farmers} kisan) — rate mangwa kar ~{suggested} {unit} ({confirmed}+{buffer} buffer) purchase karein?
      </p>
      <p className="mt-1 text-xs text-surface-500">Manzoori sirf planning ka status lagati hai. Kuch khud nahi khareeda jata, stock ya ledger nahi badalta.</p>
      <div className="mt-2 flex flex-wrap items-start gap-2">
        {props.canAskSupplier && (
          <form action={askAction}><input type="hidden" name="product_key" value={productKey} />
            <button className="rounded bg-amber-600 px-3 py-1 text-xs text-white">Supplier se rate manga</button></form>
        )}
        {props.isApprover && (
          <form action={planAction} className="flex items-center gap-2">
            <input type="hidden" name="product_key" value={productKey} />
            <label className="text-xs">Buffer <input name="buffer" type="number" min={0} step="1" defaultValue={buffer} className="w-16 rounded border px-1 py-0.5 text-xs" /></label>
            <button className="rounded bg-emerald-700 px-3 py-1 text-xs text-white">Plan manzoor (Admin)</button>
          </form>
        )}
      </div>
      <Msg s={askState} /><Msg s={planState} />
    </div>
  );
}

export function PlanArrivedButton({ planId }: { planId: string }) {
  const [s, a] = useFormState(markPlanStockArrived, init);
  return (
    <form action={a} className="inline-flex items-center gap-2"><input type="hidden" name="plan_id" value={planId} />
      <button className="rounded bg-sky-700 px-3 py-1 text-xs text-white">Maal aa gaya</button><Msg s={s} /></form>
  );
}

export function NotifyButton({ demandId, already }: { demandId: string; already: boolean }) {
  const [s, a] = useFormState(notifyDemandFarmer, init);
  return (
    <form action={a} className="space-y-1"><input type="hidden" name="demand_id" value={demandId} />
      <button className="rounded bg-brand-600 px-3 py-1 text-xs text-white">{already ? "Message dobara tayyar" : "Notify (message tayyar)"}</button><Msg s={s} /></form>
  );
}
