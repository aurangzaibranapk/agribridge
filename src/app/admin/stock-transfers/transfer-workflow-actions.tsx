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
          <SmallButton label="Approve" pendingLabel="Approving..." />
          {approveState.error && <p className="text-red-600">{approveState.error}</p>}
        </form>
      )}

      {status === "pending" && (admin || currentUserRole === "finance") && !isShopToShop && (
        <form action={verifyAction} className="space-y-1">
          <input type="hidden" name="transfer_id" value={transferId} />
          <input type="hidden" name="account_id" value={accountId} />
          <Select value={accountId} onChange={(e) => setAccountId(e.target.value)} className="h-7 w-36 text-xs">
            <option value="">— account —</option>
            {financeAccounts.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </Select>
          <SmallButton label="Verify Payment" pendingLabel="Verifying..." />
          {verifyState.error && <p className="text-red-600">{verifyState.error}</p>}
        </form>
      )}

      {status === "payment_verified" && (admin || currentUserRole === "warehouse") && (
        <form action={dispatchAction}>
          <input type="hidden" name="transfer_id" value={transferId} />
          <SmallButton label="Dispatch" pendingLabel="Dispatching..." />
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
            placeholder="Qty received"
            value={confirmedQty}
            onChange={(e) => setConfirmedQty(e.target.value)}
            className="h-7 w-28 text-xs"
          />
          <SmallButton label="Match & Accept" pendingLabel="Saving..." />
          {matchState.error && <p className="text-red-600">{matchState.error}</p>}
        </form>
      )}

      {status === "discrepancy" && !discrepancyResolvedAt && (admin || currentUserRole === "admin_assistant") && (
        <form action={resolveAction} className="space-y-1">
          <input type="hidden" name="transfer_id" value={transferId} />
          <input type="hidden" name="resolution_notes" value={resolutionNotes} />
          <Textarea
            placeholder="Resolution notes"
            value={resolutionNotes}
            onChange={(e) => setResolutionNotes(e.target.value)}
            rows={2}
            className="w-40 text-xs"
          />
          <SmallButton label="Resolve" pendingLabel="Resolving..." />
          {resolveState.error && <p className="text-red-600">{resolveState.error}</p>}
        </form>
      )}

      {status === "discrepancy" && discrepancyResolvedAt && (admin || isReceivingManager) && (
        <form action={finalAction}>
          <input type="hidden" name="transfer_id" value={transferId} />
          <SmallButton label="Final Accept" pendingLabel="Accepting..." />
          {finalState.error && <p className="text-red-600">{finalState.error}</p>}
        </form>
      )}

      {canCancel && (
        <form action={cancelAction}>
          <input type="hidden" name="transfer_id" value={transferId} />
          <button type="submit" className="text-red-500 hover:underline">Cancel</button>
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