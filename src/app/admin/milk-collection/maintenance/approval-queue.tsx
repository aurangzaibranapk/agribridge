"use client";
import { useFormState, useFormStatus } from "react-dom";
import {
  branchVerifyMaintenance,
  approveMaintenance,
  rejectMaintenance,
  type ActionState,
} from "@/actions/maintenance";
import { MAINT_COMMENT_MAX } from "@/lib/maintenance-rules";
import { CheckCircle2, ShieldCheck, X, Clock } from "lucide-react";
import { t } from "@/lib/i18n/translations";
import { useLang } from "@/lib/i18n/lang-context";

const initial: ActionState = {};

export interface PendingMaintenance {
  id: string;
  vehicleName: string;
  serviceDate: string;
  description: string;
  type: string;
  cost: number;
  km: number;
  status: string;
  branchComment: string | null;
  branchVerifiedBy: string | null;
}

const TYPE_LABEL: Record<string, string> = {
  oil_change: "Oil Change",
  service: "Service",
  repair: "Marammat",
  tyre: "Tyre",
  battery: "Battery",
  other: "Deegar",
};

/**
 * Maintenance ke faisle ki qatar.
 *
 * Do qadam alag alag dikhaye jate hain, aur tarteeb saaf nazar aati
 * hai: pehle branch manager (jo mauqe par tha), phir milk manager (jis
 * ke khate mein kharcha girta hai). Dono ek jaise button hote to koi
 * bhi kisi bhi qadam par daba deta, aur do qadam ka poora maqsad khatam
 * ho jata.
 */
export function ApprovalQueue({
  rows,
  canVerify,
  canApprove,
}: {
  rows: PendingMaintenance[];
  canVerify: boolean;
  canApprove: boolean;
}) {
  const lang = useLang();

  if (rows.length === 0) {
    return (
      <div className="rounded-card border border-surface-200 bg-white p-6 text-center text-sm text-surface-400 dark:border-surface-800 dark:bg-surface-900">{t("mc_no_pending_maintenance", lang)}</div>
    );
  }

  return (
    <div className="space-y-3">
      {rows.map((row) => (
        <div
          key={row.id}
          className="rounded-card border border-surface-200 bg-white p-4 shadow-card dark:border-surface-800 dark:bg-surface-900"
        >
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-surface-900 dark:text-white">
                {row.vehicleName} — {TYPE_LABEL[row.type] ?? row.type}
              </p>
              <p className="text-xs text-surface-500">
                {row.serviceDate} • {Math.round(row.km).toLocaleString()} km • Rs {row.cost.toLocaleString()}
              </p>
              <p className="mt-1 text-xs text-surface-600 dark:text-surface-400">{row.description}</p>
            </div>

            <span
              className={`flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${
                row.status === "pending"
                  ? "bg-amber-50 text-amber-700 dark:bg-amber-950/30"
                  : "bg-blue-50 text-blue-700 dark:bg-blue-950/30"
              }`}
            >
              <Clock className="h-3 w-3" />
              {row.status === "pending" ? "Branch Manager ke intezar mein" : "Milk Manager ke intezar mein"}
            </span>
          </div>

          {row.branchComment && (
            <p className="mt-2 rounded-lg bg-surface-50 px-3 py-2 text-xs text-surface-600 dark:bg-surface-800/50 dark:text-surface-400">
              <ShieldCheck className="mr-1 inline h-3 w-3 text-green-600" />
              Branch manager: {row.branchComment}
            </p>
          )}

          {row.status === "pending" && canVerify && <StepForm id={row.id} step="branch" />}
          {row.status === "branch_verified" && canApprove && <StepForm id={row.id} step="final" />}

          {row.status === "pending" && !canVerify && (
            <p className="mt-2 text-xs text-surface-400">{t("mc_waiting_branch_manager", lang)}</p>
          )}
          {row.status === "branch_verified" && !canApprove && (
            <p className="mt-2 text-xs text-surface-400">{t("mc_waiting_milk_manager", lang)}</p>
          )}
        </div>
      ))}
    </div>
  );
}

function StepForm({ id, step }: { id: string; step: "branch" | "final" }) {
  const lang = useLang();
  const [state, action] = useFormState(
    step === "branch" ? branchVerifyMaintenance : approveMaintenance,
    initial
  );
  const [rejectState, rejectAction] = useFormState(rejectMaintenance, initial);

  return (
    <div className="mt-3 space-y-2 border-t border-surface-200 pt-3 dark:border-surface-800">
      <form action={action} className="space-y-2">
        <input type="hidden" name="maintenance_id" value={id} />
        <textarea
          name={step === "branch" ? "branch_comment" : "approve_comment"}
          rows={2}
          maxLength={MAINT_COMMENT_MAX}
          required
          placeholder={
            step === "branch"
              ? "Misal: gaari workshop gayi thi, bill dekh liya, kaam waqai hua."
              : "Misal: kharcha maqool hai, doodh ke khate mein ja sakta hai."
          }
          className="w-full rounded-lg border border-surface-200 p-2 text-sm"
        />
        <SubmitButton step={step} />
        {state.error && <p className="text-xs text-red-700">{state.error}</p>}
      </form>

      <form action={rejectAction} className="flex gap-2">
        <input type="hidden" name="maintenance_id" value={id} />
        <input
          name="rejection_reason"
          placeholder={t("c_reject_reason", lang)}
          className="flex-1 rounded-lg border border-surface-200 p-1.5 text-xs"
        />
        <RejectButton />
        {rejectState.error && <p className="text-xs text-red-700">{rejectState.error}</p>}
      </form>
    </div>
  );
}

function SubmitButton({ step }: { step: "branch" | "final" }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={`flex w-full items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-semibold text-white disabled:opacity-50 ${
        step === "branch" ? "bg-blue-600" : "bg-green-600"
      }`}
    >
      {step === "branch" ? <ShieldCheck className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
      {pending ? "Ho raha hai..." : step === "branch" ? "Verify Karein (Branch)" : "Aakhri Manzoori (Milk)"}
    </button>
  );
}

function RejectButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="flex items-center gap-1 rounded-lg border border-red-300 px-2.5 py-1.5 text-xs font-medium text-red-700 disabled:opacity-50"
    >
      <X className="h-3 w-3" />
      {pending ? "..." : "Rad"}
    </button>
  );
}
