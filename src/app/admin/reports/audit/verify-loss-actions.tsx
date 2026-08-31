"use client";
import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { verifyLossRecord, type ActionState } from "@/actions/stock-loss";
import { CheckCircle2, XCircle, Percent, X } from "lucide-react";
import { t } from "@/lib/i18n/translations";
import { useLang } from "@/lib/i18n/lang-context";

const initialState: ActionState = {};

export function VerifyLossActions({ lossId }: { lossId: string }) {
  const [showReject, setShowReject] = useState(false);
  const [showReduced, setShowReduced] = useState(false);
  const [approveState, approveAction] = useFormState(verifyLossRecord, initialState);

  return (
    <div className="flex flex-col gap-1">
      <div className="flex gap-1">
        <form action={approveAction}>
          <input type="hidden" name="loss_id" value={lossId} />
          <input type="hidden" name="decision" value="approve" />
          <ApproveButton />
        </form>
        <button onClick={() => setShowReduced(true)} className="flex items-center gap-1 rounded-lg bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100">
          <Percent className="h-3 w-3" /> Kam Rate
        </button>
        <button onClick={() => setShowReject(true)} className="flex items-center gap-1 rounded-lg bg-red-50 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-100">
          <XCircle className="h-3 w-3" /> Reject
        </button>
      </div>
      {approveState.error && <p className="text-xs text-red-600">{approveState.error}</p>}
      {showReject && <RejectModal lossId={lossId} onClose={() => setShowReject(false)} />}
      {showReduced && <ReducedRateModal lossId={lossId} onClose={() => setShowReduced(false)} />}
    </div>
  );
}

function ApproveButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="flex items-center gap-1 rounded-lg bg-green-50 px-2 py-1 text-xs font-medium text-green-700 hover:bg-green-100 disabled:opacity-60">
      <CheckCircle2 className="h-3 w-3" /> {pending ? "..." : "Approve"}
    </button>
  );
}

function RejectModal({ lossId, onClose }: { lossId: string; onClose: () => void }) {
  const lang = useLang();
  const [state, formAction] = useFormState(verifyLossRecord, initialState);
  if (state.success) setTimeout(onClose, 800);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-sm rounded-card bg-white p-5 shadow-xl">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display text-base font-semibold text-surface-900">{t("rl_reject_loss", lang)}</h3>
          <button onClick={onClose} className="text-surface-400 hover:text-surface-700"><X className="h-5 w-5" /></button>
        </div>
        {state.error && <p className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{state.error}</p>}
        <form action={formAction} className="space-y-2">
          <input type="hidden" name="loss_id" value={lossId} />
          <input type="hidden" name="decision" value="reject" />
          <textarea name="rejection_reason" required rows={3} placeholder={t("rl_reject_reason_eg", lang)} className="w-full rounded-lg border border-surface-200 p-2 text-sm" />
          <button type="submit" className="w-full rounded-lg bg-red-600 py-2 text-sm font-medium text-white hover:bg-red-700">{t("c_confirm_reject", lang)}</button>
        </form>
      </div>
    </div>
  );
}

function ReducedRateModal({ lossId, onClose }: { lossId: string; onClose: () => void }) {
  const lang = useLang();
  const [state, formAction] = useFormState(verifyLossRecord, initialState);
  if (state.success) setTimeout(onClose, 800);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-sm rounded-card bg-white p-5 shadow-xl">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display text-base font-semibold text-surface-900">{t("rl_sell_lower_rate", lang)}</h3>
          <button onClick={onClose} className="text-surface-400 hover:text-surface-700"><X className="h-5 w-5" /></button>
        </div>
        <p className="mb-2 text-xs text-surface-400">Ye poora loss nahi hai - stock waise hi rahega, sirf naye kam rate pe sale hoga. Sirf farak (original - naya rate) loss mein count hoga.</p>
        {state.error && <p className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{state.error}</p>}
        <form action={formAction} className="space-y-2">
          <input type="hidden" name="loss_id" value={lossId} />
          <input type="hidden" name="decision" value="reduced_rate" />
          <div>
            <label className="text-xs text-surface-500">{t("rl_new_rate_per_unit", lang)}</label>
            <input type="number" step="0.01" name="reduced_rate" required placeholder={t("rl_new_rate", lang)} className="mt-1 w-full rounded-lg border border-surface-200 p-2 text-sm" />
          </div>
          <button type="submit" className="w-full rounded-lg bg-blue-600 py-2 text-sm font-medium text-white hover:bg-blue-700">{t("rl_confirm_lower_rate", lang)}</button>
        </form>
      </div>
    </div>
  );
}