"use client";
import { useEffect, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import {
  approveGrainPendingEntry,
  rejectGrainPendingEntry,
  editGrainPendingEntry,
  type ActionState,
} from "@/actions/grain-procurement";
import { Button, Input, Label, Select, Textarea } from "@/components/ui/form";
import { GRAIN_PENDING_EDITABLE, GRAIN_EXPENSE_LABELS, grainPendingExpenses, type GrainPendingPayload } from "@/lib/grain/pending-payload";

const initial: ActionState = {};

function Submit({ label, pendingLabel, variant, disabled }: { label: string; pendingLabel: string; variant?: "primary" | "secondary"; disabled?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant={variant} disabled={pending || disabled}>
      {pending ? pendingLabel : label}
    </Button>
  );
}

function Message({ state }: { state: ActionState }) {
  if (state.error) return <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{state.error}</p>;
  if (state.success) return <p className="mt-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-800">{state.notice ?? "Ho gaya."}</p>;
  return null;
}

export function GrainApprovalActions({
  pendingId,
  status,
  payload,
  warehouses,
  accounts,
}: {
  pendingId: string;
  status: string;
  payload: GrainPendingPayload;
  warehouses: { id: string; name: string }[];
  accounts: { id: string; name: string }[];
}) {
  const [approveState, approveAction] = useFormState(approveGrainPendingEntry, initial);
  const [rejectState, rejectAction] = useFormState(rejectGrainPendingEntry, initial);
  const [editState, editAction] = useFormState(editGrainPendingEntry, initial);
  const [mode, setMode] = useState<"" | "reject" | "edit">("");
  const [confirmed, setConfirmed] = useState(false);
  const [expenses, setExpenses] = useState(() =>
    grainPendingExpenses(payload).map((e) => ({ ...e, amount: String(e.amount) }))
  );

  useEffect(() => {
    if (approveState.success || rejectState.success || editState.success) {
      const timer = window.setTimeout(() => window.location.reload(), 2500);
      return () => window.clearTimeout(timer);
    }
  }, [approveState.success, rejectState.success, editState.success]);

  const expensesJson = JSON.stringify(
    expenses.filter((e) => Number(e.amount) > 0).map((e) => ({ category: e.category, description: e.description, amount: Number(e.amount), account_id: e.account_id }))
  );

  if (status === "approving") {
    return <p className="mt-4 rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-800">Ye entry abhi Approve ho rahi hai. Thori der baad safha taaza karein.</p>;
  }

  return (
    <div className="mt-4 space-y-3 border-t border-surface-100 pt-4 dark:border-surface-800">
      <div className="flex flex-wrap items-center gap-2">
        <form action={approveAction} className="flex flex-wrap items-center gap-2">
          <input type="hidden" name="pending_id" value={pendingId} />
          <label className="flex items-center gap-1 text-xs text-surface-600">
            <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} /> Maine poora hisaab parh liya hai
          </label>
          <Submit label="Approve -- ab darj karein" pendingLabel="Approve ho rahi hai..." disabled={!confirmed || Boolean(approveState.success)} />
        </form>
        <Button type="button" variant="secondary" onClick={() => setMode(mode === "edit" ? "" : "edit")}>Edit</Button>
        <Button type="button" variant="secondary" onClick={() => setMode(mode === "reject" ? "" : "reject")}>Reject</Button>
      </div>
      <Message state={approveState} />

      {mode === "reject" && (
        <form action={rejectAction} className="space-y-2 rounded-xl border border-red-200 bg-red-50/50 p-3 dark:border-red-900/40 dark:bg-red-950/10">
          <input type="hidden" name="pending_id" value={pendingId} />
          <Label>Reject ki wajah * (staff ko nazar aayegi)</Label>
          <Textarea name="reject_reason" rows={2} required minLength={3} placeholder="Jaise: rate ghalat hai, dobara sahi rate se entry karein" />
          <Submit label="Reject karein" pendingLabel="Reject ho rahi hai..." variant="secondary" />
          <Message state={rejectState} />
        </form>
      )}

      {mode === "edit" && (
        <form action={editAction} className="space-y-3 rounded-xl border border-amber-200 bg-amber-50/50 p-3 dark:border-amber-900/40 dark:bg-amber-950/10">
          <input type="hidden" name="pending_id" value={pendingId} />
          <input type="hidden" name="expenses_json" value={expensesJson} />
          <p className="text-xs text-surface-600">Khaane theek karein. Save par hisaab dobara banega; entry Pending hi rahegi. Bechne wala ya fasal ghalat ho to Reject kar ke nayi entry banwayein.</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {GRAIN_PENDING_EDITABLE.filter((f) => f.key !== "payment_amount" || payload.make_payment === "yes").map((f) => (
              <div key={f.key}>
                <Label>{f.label}</Label>
                <Input name={f.key} type={f.type} step={f.type === "number" ? "any" : undefined} defaultValue={payload[f.key] ?? ""} />
              </div>
            ))}
            <div>
              <Label>Godam</Label>
              <Select name="warehouse_id" defaultValue={payload.warehouse_id ?? ""}>
                {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
              </Select>
            </div>
          </div>
          <div>
            <Label>Kharche</Label>
            <div className="space-y-2">
              {expenses.map((e, i) => (
                <div key={i} className="grid gap-2 sm:grid-cols-4">
                  <select value={e.category} onChange={(ev) => setExpenses((rows) => rows.map((r, j) => (j === i ? { ...r, category: ev.target.value } : r)))} className="rounded-lg border border-surface-200 p-1.5 text-xs">
                    {Object.entries(GRAIN_EXPENSE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                  <input value={e.description} placeholder="Tafseel" onChange={(ev) => setExpenses((rows) => rows.map((r, j) => (j === i ? { ...r, description: ev.target.value } : r)))} className="rounded-lg border border-surface-200 p-1.5 text-xs" />
                  <input type="number" step="any" value={e.amount} placeholder="Rs (0 = hata dein)" onChange={(ev) => setExpenses((rows) => rows.map((r, j) => (j === i ? { ...r, amount: ev.target.value } : r)))} className="rounded-lg border border-surface-200 p-1.5 text-xs" />
                  <select value={e.account_id} onChange={(ev) => setExpenses((rows) => rows.map((r, j) => (j === i ? { ...r, account_id: ev.target.value } : r)))} className="rounded-lg border border-surface-200 p-1.5 text-xs">
                    <option value="">- Kis account se paisa gaya -</option>
                    {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                </div>
              ))}
              <button type="button" onClick={() => setExpenses((rows) => [...rows, { category: "labor_mazdoori", description: "", amount: "", account_id: "" }])} className="text-xs font-medium text-brand-700 hover:underline">+ Kharcha add karein</button>
            </div>
          </div>
          <Submit label="Edit save karein" pendingLabel="Save ho raha hai..." />
          <Message state={editState} />
        </form>
      )}
    </div>
  );
}
