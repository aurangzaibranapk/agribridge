"use client";
import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import {
  verifyTransferPayment,
  approveShopToShopTransfer,
  dispatchTransfer,
  matchAndAcceptTransfer,
  resolveDiscrepancy,
  finalizeDiscrepancyAccept,
  cancelInternalTransfer,
  type ActionState,
} from "@/actions/stock-transfer-workflow";
import { Input, Select, Textarea } from "@/components/ui/form";
import { t } from "@/lib/i18n/translations";
import { useLang } from "@/lib/i18n/lang-context";

const initialState: ActionState = {};

interface FinanceAccount {
  id: string;
  name: string;
  account_type: string;
}

interface Props {
  transferId: string;
  status: string;
  discrepancyResolvedAt: string | null;
  currentUserRole: string;
  currentUserBranchId: string | null;
  toBranchId: string | null;
  isShopToShop: boolean;
  financeAccounts: FinanceAccount[];
}

function isAdminLevel(role: string) {
  return role === "super_admin" || role === "admin";
}

export function TransferWorkflowActions({
  transferId,
  status,
  discrepancyResolvedAt,
  currentUserRole,
  currentUserBranchId,
  toBranchId,
  isShopToShop,
  financeAccounts,
}: Props) {
  const lang = useLang();
  const admin = isAdminLevel(currentUserRole);
  const isReceivingManager = currentUserRole === "manager" && currentUserBranchId === toBranchId;

  const [approveState, approveAction] = useFormState(approveShopToShopTransfer, initialState);
  const [verifyState, verifyAction] = useFormState(verifyTransferPayment, initialState);
  const [dispatchState, dispatchAction] = useFormState(dispatchTransfer, initialState);
  const [matchState, matchAction] = useFormState(matchAndAcceptTransfer, initialState);
  const [resolveState, resolveAction] = useFormState(resolveDiscrepancy, initialState);
  const [finalState, finalAction] = useFormState(finalizeDiscrepancyAccept, initialState);
  const [cancelState, cancelAction] = useFormState(cancelInternalTransfer, initialState);

  const [confirmedQty, setConfirmedQty] = useState("");
  const [resolutionNotes, setResolutionNotes] = useState("");
  const [accountId, setAccountId] = useState("");

  const canCancel = admin && status !== "completed" && status !== "cancelled";

  return (
    <div className="space-y-2 text-xs">
      {status === "pending" && (admin || currentUserRole === "finance") && isShopToShop && (
        <form action={approveAction}>
          <input type="hidden" name="transfer_id" value={transferId} />
          <SmallButton label={t("st_approve", lang)} pendingLabel={t("st_approving", lang)} />
          {approveState.error && <p className="text-red-600">{approveState.error}</p>}
        </form>
      )}

      {status === "pending" && (admin || currentUserRole === "finance") && !isShopToShop && (
        <form action={verifyAction} className="space-y-1">
          <input type="hidden" name="transfer_id" value={transferId} />
          <input type="hidden" name="account_id" value={accountId} />
          <Select value={accountId} onChange={(e) => setAccountId(e.target.value)} className="h-7 w-36 text-xs">
            <option value="">{t("st_account", lang)}</option>
            {financeAccounts.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </Select>
          <SmallButton label={t("st_verify_payment", lang)} pendingLabel={t("st_verifying", lang)} />
          {verifyState.error && <p className="text-red-600">{verifyState.error}</p>}
        </form>
      )}

      {status === "payment_verified" && (admin || currentUserRole === "warehouse") && (
        <form action={dispatchAction}>
          <input type="hidden" name="transfer_id" value={transferId} />
          <SmallButton label={t("st_dispatch", lang)} pendingLabel={t("st_dispatching", lang)} />
          {dispatchState.error && <p className="text-red-600">{dispatchState.error}</p>}
        </form>
      )}

      {status === "in_transit" && (admin || isReceivingManager || currentUserRole === "sales_staff") && (
        <form action={matchAction} className="space-y-1">
          <input type="hidden" name="transfer_id" value={transferId} />
          <input type="hidden" name="confirmed_quantity" value={confirmedQty} />
          <Input
            type="number"
            step="0.01"
            placeholder={t("st_qty_received", lang)}
            value={confirmedQty}
            onChange={(e) => setConfirmedQty(e.target.value)}
            className="h-7 w-28 text-xs"
          />
          <SmallButton label={t("st_match_accept", lang)} pendingLabel={t("st_saving", lang)} />
          {matchState.error && <p className="text-red-600">{matchState.error}</p>}
        </form>
      )}

      {status === "discrepancy" && !discrepancyResolvedAt && (admin || currentUserRole === "admin_assistant") && (
        <form action={resolveAction} className="space-y-1">
          <input type="hidden" name="transfer_id" value={transferId} />
          <input type="hidden" name="resolution_notes" value={resolutionNotes} />
          <Textarea
            placeholder={t("st_resolution_notes", lang)}
            value={resolutionNotes}
            onChange={(e) => setResolutionNotes(e.target.value)}
            rows={2}
            className="w-40 text-xs"
          />
          <SmallButton label={t("st_resolve", lang)} pendingLabel={t("st_resolving", lang)} />
          {resolveState.error && <p className="text-red-600">{resolveState.error}</p>}
        </form>
      )}

      {status === "discrepancy" && discrepancyResolvedAt && (admin || isReceivingManager) && (
        <form action={finalAction}>
          <input type="hidden" name="transfer_id" value={transferId} />
          <SmallButton label={t("st_final_accept", lang)} pendingLabel={t("st_accepting", lang)} />
          {finalState.error && <p className="text-red-600">{finalState.error}</p>}
        </form>
      )}

      {canCancel && (
        <form action={cancelAction}>
          <input type="hidden" name="transfer_id" value={transferId} />
          <button type="submit" className="text-red-500 hover:underline">{t("st_cancel", lang)}</button>
          {cancelState.error && <p className="text-red-600">{cancelState.error}</p>}
        </form>
      )}
    </div>
  );
}

function SmallButton({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg bg-brand-600 px-2 py-1 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-60"
    >
      {pending ? pendingLabel : label}
    </button>
  );
}