"use client";

import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import {
  addImportDraftRows,
  updateImportDraft,
  deleteImportDraft,
  submitImportDraft,
  rejectImportDraft,
  type ActionState,
} from "@/actions/customer-import";
import { Check, Pencil, Trash2, X } from "lucide-react";

const initialState: ActionState = {};

interface Draft {
  id: string;
  name: string;
  phone_number: string | null;
  opening_balance: number;
  status: string;
  imported_customer_id: string | null;
  created_at: string;
}

function rs(n: number): string {
  return `Rs ${Number(n).toLocaleString("en-PK", { maximumFractionDigits: 0 })}`;
}

function SubmitBtn({ label, className }: { label: string; className: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={className}>
      {pending ? "..." : label}
    </button>
  );
}

function PasteBox() {
  const [state, formAction] = useFormState(addImportDraftRows, initialState);
  return (
    <div className="mb-5 rounded-card border border-surface-200 bg-white p-4 dark:border-surface-800 dark:bg-surface-900">
      <p className="mb-2 text-sm font-medium text-surface-700 dark:text-surface-200">List paste karein</p>
      <p className="mb-2 text-xs text-surface-500">
        Ek customer fi line, comma se alag: <span className="font-mono">Naam, Number, Balance</span> — jaise{" "}
        <span className="font-mono">Shoukat Abbas, 03001234567, 90635</span>. Balance na pata ho to khali chhoR dein (0 samjha jayega).
      </p>
      <form action={formAction} className="space-y-2">
        <textarea
          name="raw_list"
          rows={6}
          required
          placeholder={"Shoukat Abbas, 03001234567, 90635\nAli Traders, 03009876543, 15000"}
          className="w-full rounded-lg border border-surface-200 p-2 font-mono text-xs dark:border-surface-700 dark:bg-surface-800"
        />
        {state.error && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-950/30 dark:text-red-400">{state.error}</p>}
        {state.notice && <p className="rounded-lg bg-brand-50 px-3 py-2 text-xs text-brand-700 dark:bg-brand-950/30 dark:text-brand-400">{state.notice}</p>}
        <SubmitBtn label="Draft Mein Add Karein" className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60" />
      </form>
    </div>
  );
}

function EditForm({ draft, onDone }: { draft: Draft; onDone: () => void }) {
  const [state, formAction] = useFormState(updateImportDraft, initialState);
  if (state.success) setTimeout(onDone, 300);
  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="id" value={draft.id} />
      <input name="name" defaultValue={draft.name} required className="w-40 rounded-lg border border-surface-200 p-1.5 text-sm dark:border-surface-700 dark:bg-surface-800" />
      <input
        name="phone_number"
        defaultValue={draft.phone_number ?? ""}
        placeholder="Mobile number"
        className="w-36 rounded-lg border border-surface-200 p-1.5 text-sm dark:border-surface-700 dark:bg-surface-800"
      />
      <input
        name="opening_balance"
        type="number"
        step="0.01"
        defaultValue={draft.opening_balance}
        className="w-28 rounded-lg border border-surface-200 p-1.5 text-sm dark:border-surface-700 dark:bg-surface-800"
      />
      <SubmitBtn label="Save" className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-60" />
      <button type="button" onClick={onDone} className="text-xs text-surface-400 hover:text-surface-600">
        Cancel
      </button>
      {state.error && <p className="w-full text-xs text-red-600">{state.error}</p>}
    </form>
  );
}

function PendingRow({ draft }: { draft: Draft }) {
  const [editing, setEditing] = useState(false);
  const [submitState, submitAction] = useFormState(submitImportDraft, initialState);
  const [rejectState, rejectAction] = useFormState(rejectImportDraft, initialState);
  const [deleteState, deleteAction] = useFormState(deleteImportDraft, initialState);

  if (editing) {
    return (
      <tr className="border-t border-surface-100 dark:border-surface-800">
        <td colSpan={4} className="px-3 py-2">
          <EditForm draft={draft} onDone={() => setEditing(false)} />
        </td>
      </tr>
    );
  }

  return (
    <tr className="border-t border-surface-100 dark:border-surface-800">
      <td className="px-3 py-2 text-sm font-medium text-surface-900 dark:text-white">{draft.name}</td>
      <td className="px-3 py-2 text-sm text-surface-600 dark:text-surface-300">
        {draft.phone_number ?? <span className="text-red-500">number missing</span>}
      </td>
      <td className="px-3 py-2 text-right text-sm tabular-nums text-surface-700 dark:text-surface-300">{rs(draft.opening_balance)}</td>
      <td className="px-3 py-2">
        <div className="flex flex-wrap items-center justify-end gap-1.5">
          <button onClick={() => setEditing(true)} title="Edit" className="rounded-lg p-1.5 text-surface-500 hover:bg-surface-100 dark:hover:bg-surface-800">
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <form action={rejectAction}>
            <input type="hidden" name="id" value={draft.id} />
            <button type="submit" title="Hata dein (customer nahi banega)" className="rounded-lg p-1.5 text-surface-500 hover:bg-surface-100 dark:hover:bg-surface-800">
              <X className="h-3.5 w-3.5" />
            </button>
          </form>
          <form action={deleteAction}>
            <input type="hidden" name="id" value={draft.id} />
            <button type="submit" title="Poori tarah delete" className="rounded-lg p-1.5 text-surface-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </form>
          <form action={submitAction}>
            <input type="hidden" name="id" value={draft.id} />
            <SubmitBtn
              label="Submit"
              className="flex items-center gap-1 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-60"
            />
          </form>
        </div>
        {submitState.error && <p className="mt-1 text-right text-xs text-red-600">{submitState.error}</p>}
        {submitState.notice && <p className="mt-1 text-right text-xs text-brand-600">{submitState.notice}</p>}
        {rejectState.error && <p className="mt-1 text-right text-xs text-red-600">{rejectState.error}</p>}
        {deleteState.error && <p className="mt-1 text-right text-xs text-red-600">{deleteState.error}</p>}
      </td>
    </tr>
  );
}

export function ImportClient({ pending, decided }: { pending: Draft[]; decided: Draft[] }) {
  const totalLena = pending.filter((d) => d.opening_balance > 0).reduce((s, d) => s + d.opening_balance, 0);
  const totalDena = pending.filter((d) => d.opening_balance < 0).reduce((s, d) => s + Math.abs(d.opening_balance), 0);

  return (
    <div className="space-y-5">
      <PasteBox />

      {pending.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-card border border-surface-200 bg-white p-4 dark:border-surface-800 dark:bg-surface-900">
            <p className="text-xs text-surface-500 dark:text-surface-400">Total lena hai (draft mein, {pending.filter((d) => d.opening_balance > 0).length} customer)</p>
            <p className="font-display text-xl font-semibold tabular-nums text-red-700 dark:text-red-300">{rs(totalLena)}</p>
          </div>
          <div className="rounded-card border border-surface-200 bg-white p-4 dark:border-surface-800 dark:bg-surface-900">
            <p className="text-xs text-surface-500 dark:text-surface-400">Total dena hai (draft mein, {pending.filter((d) => d.opening_balance < 0).length} customer)</p>
            <p className="font-display text-xl font-semibold tabular-nums text-brand-700 dark:text-brand-300">{rs(totalDena)}</p>
          </div>
        </div>
      )}

      <div className="rounded-card border border-surface-200 bg-white p-0 dark:border-surface-800 dark:bg-surface-900">
        <p className="border-b border-surface-100 px-4 py-3 text-sm font-medium text-surface-700 dark:border-surface-800 dark:text-surface-200">
          Review — abhi tak customer nahi bana, sirf draft hai ({pending.length})
        </p>
        {pending.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-surface-400">Koi pending draft nahi.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[36rem] text-sm">
              <thead className="bg-surface-50 text-left text-xs text-surface-500 dark:bg-surface-800/50">
                <tr>
                  <th className="px-3 py-2">Naam</th>
                  <th className="px-3 py-2">Number</th>
                  <th className="px-3 py-2 text-right">Shuruati Baqi</th>
                  <th className="px-3 py-2 text-right">Kaam</th>
                </tr>
              </thead>
              <tbody>
                {pending.map((d) => (
                  <PendingRow key={d.id} draft={d} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {decided.length > 0 && (
        <div className="rounded-card border border-surface-200 bg-white p-0 dark:border-surface-800 dark:bg-surface-900">
          <p className="border-b border-surface-100 px-4 py-3 text-sm font-medium text-surface-700 dark:border-surface-800 dark:text-surface-200">
            Pehle se decide ho chuki ({decided.length})
          </p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[36rem] text-sm">
              <tbody>
                {decided.map((d) => (
                  <tr key={d.id} className="border-t border-surface-100 dark:border-surface-800">
                    <td className="px-3 py-2 text-surface-700 dark:text-surface-300">{d.name}</td>
                    <td className="px-3 py-2 text-surface-500">{d.phone_number ?? "—"}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-surface-500">{rs(d.opening_balance)}</td>
                    <td className="px-3 py-2 text-right">
                      {d.status === "imported" ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2 py-1 text-xs text-brand-700 dark:bg-brand-950/30 dark:text-brand-400">
                          <Check className="h-3 w-3" /> Import ho gaye
                        </span>
                      ) : (
                        <span className="rounded-full bg-surface-100 px-2 py-1 text-xs text-surface-500 dark:bg-surface-800">Hataya gaya</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
