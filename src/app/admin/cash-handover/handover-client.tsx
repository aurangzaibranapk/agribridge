"use client";
import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { sendCash, receiveCash, type ActionState } from "@/actions/cash-handover";
import { AlertTriangle } from "lucide-react";

const initialState: ActionState = {};

function rs(v: number): string {
  return `Rs ${Math.round(v).toLocaleString()}`;
}

function Submit({ label, blocked }: { label: string; blocked?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending || blocked}
      className="w-full rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
    >
      {pending ? "Ruk jayein…" : label}
    </button>
  );
}

export function SendCashForm({
  people,
  branches,
}: {
  people: { id: string; name: string; role: string }[];
  branches: { id: string; name: string }[];
}) {
  const [state, formAction] = useFormState(sendCash, initialState);

  return (
    <form action={formAction} className="space-y-3">
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-surface-600 dark:text-surface-400">
          Kis ko de rahe hain? <span className="text-red-600">(lazmi)</span>
        </span>
        <select
          name="to_profile_id"
          required
          className="w-full rounded-lg border border-surface-300 bg-white px-3 py-2 text-sm dark:border-surface-700 dark:bg-surface-900"
        >
          <option value="">— select karein —</option>
          {people.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} ({p.role})
            </option>
          ))}
        </select>
        <span className="mt-1 block text-xs text-surface-400">
          Ye wohi shakhs hoga jo doosri taraf tasdeeq karega. Aap khud tasdeeq nahi kar sakte.
        </span>
      </label>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-surface-600 dark:text-surface-400">
            Raqam <span className="text-red-600">(lazmi)</span>
          </span>
          <input
            name="amount"
            type="number"
            min={1}
            step="0.01"
            required
            inputMode="numeric"
            className="w-full rounded-lg border border-surface-300 px-3 py-2 text-sm dark:border-surface-700 dark:bg-surface-900"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-surface-600 dark:text-surface-400">
            Kahan ja raha hai
          </span>
          <select
            name="to_branch_id"
            className="w-full rounded-lg border border-surface-300 bg-white px-3 py-2 text-sm dark:border-surface-700 dark:bg-surface-900"
          >
            <option value="">— maloom nahi —</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="block">
        <span className="mb-1 block text-xs font-medium text-surface-600 dark:text-surface-400">
          Le kaun ja raha hai? (driver / mulazim)
        </span>
        <select
          name="carrier_profile_id"
          className="w-full rounded-lg border border-surface-300 bg-white px-3 py-2 text-sm dark:border-surface-700 dark:bg-surface-900"
        >
          <option value="">— khud le ja raha hai —</option>
          {people.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} ({p.role})
            </option>
          ))}
        </select>
        <span className="mt-1 block text-xs text-surface-400">
          Raqam gum ho jaye to ye sawal tabhi ban sakta hai ke wo kis ke paas thi.
        </span>
      </label>

      <label className="block">
        <span className="mb-1 block text-xs font-medium text-surface-600 dark:text-surface-400">
          Koi baat (marzi)
        </span>
        <input
          name="sent_note"
          maxLength={255}
          placeholder="Jaise: HQ ke liye teen din ki bikri"
          className="w-full rounded-lg border border-surface-300 px-3 py-2 text-sm dark:border-surface-700 dark:bg-surface-900"
        />
      </label>

      {state.error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-400">
          {state.error}
        </p>
      )}
      {state.success && (
        <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-800 dark:bg-green-950/30 dark:text-green-400">
          {state.message}
        </p>
      )}

      <Submit label="Cash bheja hua darj karein" />
    </form>
  );
}

export function ReceiveCard({
  handover,
}: {
  handover: {
    id: string;
    amount: number;
    sentBy: string | null;
    carrier: string | null;
    fromBranch: string | null;
    note: string | null;
    daysOld: number;
  };
}) {
  const [state, formAction] = useFormState(receiveCash, initialState);
  const [received, setReceived] = useState("");
  const [reason, setReason] = useState("");

  const got = Number(received);
  const entered = received.trim() !== "" && Number.isFinite(got);
  const difference = entered ? Math.round((got - handover.amount) * 100) / 100 : 0;
  const needsReason = entered && difference !== 0 && reason.trim().length < 5;

  return (
    <form
      action={formAction}
      className="rounded-card border border-brand-300 bg-brand-50/50 p-4 dark:border-brand-800 dark:bg-brand-950/20"
    >
      <input type="hidden" name="handover_id" value={handover.id} />

      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-display text-xl font-bold text-surface-900 dark:text-white">
            {rs(handover.amount)}
          </p>
          <p className="mt-0.5 text-xs text-surface-600 dark:text-surface-400">
            {handover.sentBy ?? "—"}
            {handover.fromBranch ? ` (${handover.fromBranch})` : ""} ne bheja
            {handover.carrier ? ` — ${handover.carrier} le kar aaya` : ""}
          </p>
          {handover.note && (
            <p className="mt-0.5 text-xs text-surface-500">{handover.note}</p>
          )}
        </div>
        {handover.daysOld >= 2 && (
          <span className="shrink-0 rounded-md bg-red-100 px-2 py-1 text-xs font-medium text-red-800 dark:bg-red-950/40 dark:text-red-400">
            {handover.daysOld} din se
          </span>
        )}
      </div>

      <label className="mt-3 block">
        <span className="mb-1 block text-xs font-medium text-surface-600 dark:text-surface-400">
          Aap ko kitna mila? (gin kar likhein)
        </span>
        <input
          name="amount_received"
          type="number"
          min={0}
          step="0.01"
          required
          inputMode="numeric"
          value={received}
          onChange={(e) => setReceived(e.target.value)}
          className="w-full rounded-lg border border-surface-300 px-3 py-2 text-sm dark:border-surface-700 dark:bg-surface-900"
        />
      </label>

      {entered && difference !== 0 && (
        <>
          <p className="mt-2 flex items-start gap-1.5 text-sm font-semibold text-red-800 dark:text-red-400">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              {rs(Math.abs(difference))} {difference < 0 ? "KAM" : "ZYADA"} mile
            </span>
          </p>
          <label className="mt-2 block">
            <span className="mb-1 block text-xs font-medium text-surface-600 dark:text-surface-400">
              Kya samajh aaya? <span className="text-red-600">(lazmi)</span>
            </span>
            <input
              name="difference_reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={255}
              placeholder="Wajah maloom na ho to wahi likhein"
              className="w-full rounded-lg border border-surface-300 px-3 py-2 text-sm dark:border-surface-700 dark:bg-surface-900"
            />
          </label>
        </>
      )}

      {entered && difference === 0 && (
        <p className="mt-2 text-sm font-medium text-green-800 dark:text-green-400">
          Poore mile — hisaab barabar.
        </p>
      )}

      {state.error && (
        <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-400">
          {state.error}
        </p>
      )}
      {state.success && (
        <p className="mt-2 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-800 dark:bg-green-950/30 dark:text-green-400">
          {state.message}
        </p>
      )}

      <div className="mt-3">
        <Submit label="Wusooli darj karein" blocked={!entered || needsReason} />
      </div>
    </form>
  );
}
