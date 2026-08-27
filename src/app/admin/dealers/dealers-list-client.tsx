"use client";
import { useState } from "react";
import Link from "next/link";
import { useFormState } from "react-dom";
import { updateDealerStatus, deleteDealer, type ActionState } from "@/actions/dealers";
import { bulkUpdateDealerStatus, bulkDeleteDealers, type ActionState as BulkActionState } from "@/actions/dealers-bulk";
import { DeleteButton } from "@/components/admin/delete-button";
import { DealerForm } from "./dealer-form";
import { EmptyState } from "@/components/ui/layout-primitives";
import { CheckSquare } from "lucide-react";

const initialState: ActionState = {};
const initialBulkState: BulkActionState = {};

interface Dealer {
  id: string;
  dealer_code: string;
  business_name: string;
  phone_number: string;
  district: string | null;
  current_payable: number;
  verification_status: string;
  status: string;
  created_at: string;
}

export function DealersListClient({ dealers }: { dealers: Dealer[] }) {
  const [selected, setSelected] = useState<string[]>([]);

  function toggleSelect(id: string) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function toggleSelectAll() {
    setSelected(selected.length === dealers.length ? [] : dealers.map((d) => d.id));
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div className="lg:col-span-2">
        {selected.length > 0 && <BulkActionBar selectedIds={selected} onDone={() => setSelected([])} />}

        {dealers.length === 0 ? (
          <EmptyState title="No dealers yet" description="'Add New Dealer' form use karein, ya investor inquiry convert karein." />
        ) : (
          <div className="overflow-hidden rounded-card border border-surface-200 bg-white shadow-card dark:border-surface-800 dark:bg-surface-900">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-200 bg-surface-50 text-left dark:border-surface-800 dark:bg-surface-800">
                  <th className="px-3 py-3">
                    <input type="checkbox" checked={selected.length > 0 && selected.length === dealers.length} onChange={toggleSelectAll} />
                  </th>
                  <th className="px-4 py-3 font-medium text-surface-500">Dealer Code</th>
                  <th className="px-4 py-3 font-medium text-surface-500">Business Name</th>
                  <th className="px-4 py-3 font-medium text-surface-500">Phone</th>
                  <th className="px-4 py-3 font-medium text-surface-500">District</th>
                  <th className="px-4 py-3 text-right font-medium text-surface-500">Payable</th>
                  <th className="px-4 py-3 font-medium text-surface-500">Status</th>
                  <th className="px-4 py-3 font-medium text-surface-500">Statement</th>
                  <th className="px-4 py-3 font-medium text-surface-500">Edit</th>
                  <th className="px-4 py-3 font-medium text-surface-500">Delete</th>
                </tr>
              </thead>
              <tbody>
                {dealers.map((d) => (
                  <tr key={d.id} className="border-b border-surface-100 last:border-0 dark:border-surface-800">
                    <td className="px-3 py-3">
                      <input type="checkbox" checked={selected.includes(d.id)} onChange={() => toggleSelect(d.id)} />
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-surface-500">{d.dealer_code}</td>
                    <td className="px-4 py-3 font-medium text-surface-800 dark:text-surface-200">{d.business_name}</td>
                    <td className="px-4 py-3 text-surface-600 dark:text-surface-400">{d.phone_number}</td>
                    <td className="px-4 py-3 text-surface-600 dark:text-surface-400">{d.district ?? "-"}</td>
                    <td className="px-4 py-3 text-right text-surface-700 dark:text-surface-300">
                      Rs {Number(d.current_payable).toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <StatusSelect dealerId={d.id} currentStatus={d.status} />
                    </td>
                    <td className="px-4 py-3">
                      <Link href={`/admin/dealers/${d.id}/statement`} className="flex items-center gap-1 text-xs font-medium text-brand-600 hover:underline">
                        Statement
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <Link href={`/admin/dealers/${d.id}/edit`} className="flex items-center gap-1 text-xs font-medium text-brand-600 hover:underline">
                        Edit
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <DeleteButton id={d.id} action={deleteDealer} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <DealerForm />
    </div>
  );
}

function StatusSelect({ dealerId, currentStatus }: { dealerId: string; currentStatus: string }) {
  const [, formAction] = useFormState(updateDealerStatus, initialState);
  return (
    <form action={formAction}>
      <input type="hidden" name="id" value={dealerId} />
      <select
        name="status"
        defaultValue={currentStatus}
        onChange={(e) => e.target.form?.requestSubmit()}
        className="rounded-lg border border-surface-200 px-2 py-1 text-xs"
      >
        <option value="active">Active</option>
        <option value="inactive">Inactive</option>
        <option value="suspended">Suspended</option>
      </select>
    </form>
  );
}

function BulkActionBar({ selectedIds, onDone }: { selectedIds: string[]; onDone: () => void }) {
  const [statusState, statusAction] = useFormState(bulkUpdateDealerStatus, initialBulkState);
  const [deleteState, deleteAction] = useFormState(bulkDeleteDealers, initialBulkState);

  if (statusState.success || deleteState.success) setTimeout(onDone, 500);

  return (
    <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg bg-brand-50 p-3 dark:bg-brand-900/20">
      <span className="flex items-center gap-1 text-sm font-medium text-brand-700">
        <CheckSquare className="h-4 w-4" /> {selectedIds.length} selected
      </span>
      <form action={statusAction} className="flex gap-1">
        <input type="hidden" name="ids" value={selectedIds.join(",")} />
        <input type="hidden" name="status" value="active" />
        <button type="submit" className="rounded-lg bg-green-100 px-2 py-1 text-xs font-medium text-green-700 hover:bg-green-200">Active Karein</button>
      </form>
      <form action={statusAction} className="flex gap-1">
        <input type="hidden" name="ids" value={selectedIds.join(",")} />
        <input type="hidden" name="status" value="suspended" />
        <button type="submit" className="rounded-lg bg-amber-100 px-2 py-1 text-xs font-medium text-amber-700 hover:bg-amber-200">Suspend Karein</button>
      </form>
      <form
        action={deleteAction}
        onSubmit={(e) => {
          if (!confirm(`Kya aap ${selectedIds.length} dealers delete karna chahte hain?`)) e.preventDefault();
        }}
      >
        <input type="hidden" name="ids" value={selectedIds.join(",")} />
        <button type="submit" className="rounded-lg bg-red-100 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-200">Delete Karein</button>
      </form>
    </div>
  );
}