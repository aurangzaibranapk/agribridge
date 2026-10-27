"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { useFormState } from "@/lib/hooks/use-safe-form-state";
import { forwardCustody, submitCustodyBankDeposit, type CustodyActionState } from "@/actions/cash-custody-chain";
import { PaymentSlipUpload } from "@/components/ui/payment-slip-upload";

const INIT: CustodyActionState = {};

function Go({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="w-full rounded-xl bg-brand-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">
      {pending ? "Ho raha hai..." : label}
    </button>
  );
}

export function PacketActions({
  packetId,
  amountLabel,
  depositDate,
  canForward,
  canDeposit,
  finance,
  banks,
  handoverHref,
}: {
  packetId: string;
  amountLabel: string;
  depositDate: string;
  canForward: boolean;
  canDeposit: boolean;
  finance: { id: string; name: string; role: string }[];
  banks: { id: string; name: string }[];
  handoverHref: string | null;
}) {
  const [forwardState, forwardAction] = useFormState(forwardCustody, INIT);
  const [depositState, depositAction] = useFormState(submitCustodyBankDeposit, INIT);
  const [slipUrl, setSlipUrl] = useState("");

  return (
    <div className="space-y-4">
      {handoverHref && (
        <a href={handoverHref} className="block rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-900">
          Wasoli Cash Handover slip par — jis ne cash li hai wahi tasdeeq kare
        </a>
      )}
      {canForward && (
        <form action={forwardAction} className="space-y-2 rounded-xl border border-surface-200 p-3">
          <input type="hidden" name="packet_id" value={packetId} />
          <p className="text-sm font-medium text-surface-800">Agla qadam: Finance / Manager ko bhejein ({amountLabel})</p>
          <p className="text-xs text-surface-500">Wasoli ho chuki hai. Ye raqam ab company ke cash se aage jati hai, phir bank jama.</p>
          {finance.length === 0 ? (
            <p className="text-xs text-amber-700">Koi Finance login nahi mila. Neeche bank jama karein.</p>
          ) : (
            <>
              <select name="to_profile_id" required className="w-full rounded-lg border border-surface-200 px-2 py-1.5 text-sm">
                <option value="">— chunein —</option>
                {finance.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.role})
                  </option>
                ))}
              </select>
              {forwardState.error && <p className="text-xs text-red-700">{forwardState.error}</p>}
              {forwardState.success && <p className="text-xs text-emerald-800">{forwardState.message}</p>}
              {!forwardState.success && <Go label="Aage bhejein" />}
            </>
          )}
        </form>
      )}
      {canDeposit && (
        <form action={depositAction} className="space-y-2 rounded-xl border border-surface-200 p-3">
          <input type="hidden" name="packet_id" value={packetId} />
          <input type="hidden" name="deposit_date" value={depositDate} />
          <input type="hidden" name="slip_url" value={slipUrl} />
          <p className="text-sm font-medium text-surface-800">Bank mein jama ({amountLabel})</p>
          <p className="text-xs text-surface-500">Wasoli ho chuki hai, is liye ye raqam company ke cash se bank jati hai. Outstanding us sales staff par rehti hai jab tak Finance verify na kare.</p>
          <select name="bank_account_id" required className="w-full rounded-lg border border-surface-200 px-2 py-1.5 text-sm">
            <option value="">— bank —</option>
            {banks.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
          <PaymentSlipUpload onUploaded={setSlipUrl} />
          {!slipUrl && <p className="text-[11px] text-surface-400">Bank slip upload lazmi hai.</p>}
          <input name="staff_note" placeholder="Note (agar ho)" className="w-full rounded-lg border border-surface-200 px-2 py-1.5 text-sm" />
          {depositState.error && <p className="text-xs text-red-700">{depositState.error}</p>}
          {depositState.success && <p className="text-xs text-emerald-800">{depositState.message}</p>}
          {!depositState.success && <Go label="Jama darj karein" />}
        </form>
      )}
    </div>
  );
}
