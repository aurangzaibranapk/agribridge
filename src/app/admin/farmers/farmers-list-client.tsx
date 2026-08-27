"use client";
import { useState } from "react";
import { useFormState } from "react-dom";
import Link from "next/link";
import { Badge } from "@/components/ui/form";
import { formatDate } from "@/lib/utils/format";
import { VerifyFarmerButton } from "@/app/admin/farmers/verify-farmer-button";
import { FarmerActions } from "@/app/admin/farmers/farmer-actions";
import { bulkToggleFarmerActive, bulkDeleteFarmers, type ActionState } from "@/actions/farmers-bulk";
import { CheckSquare, FileText } from "lucide-react";

const initialState: ActionState = {};

interface Farmer {
  id: string;
  full_name: string;
  farmer_code: string | null;
  phone_number: string | null;
  tehsil: string | null;
  district: string | null;
  is_verified: boolean;
  is_active: boolean | null;
  created_at: string;
}

export function FarmersListClient({ farmers }: { farmers: Farmer[] }) {
  const [selected, setSelected] = useState<string[]>([]);

  function toggleSelect(id: string) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function toggleSelectAll() {
    setSelected(selected.length === farmers.length ? [] : farmers.map((f) => f.id));
  }

  return (
    <div>
      {selected.length > 0 && <BulkActionBar selectedIds={selected} onDone={() => setSelected([])} />}

      <div className="rounded-card border border-surface-200 bg-white shadow-card dark:border-surface-800 dark:bg-surface-900">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-surface-100 text-left text-xs font-medium uppercase tracking-wide text-surface-400 dark:border-surface-800 dark:text-surface-500">
              <th className="px-3 py-3"><input type="checkbox" checked={selected.length === farmers.length && farmers.length > 0} onChange={toggleSelectAll} /></th>
              <th className="px-5 py-3">Name</th>
              <th className="px-5 py-3">Contact</th>
              <th className="px-5 py-3">Location</th>
              <th className="px-5 py-3">Status</th>
              <th className="px-5 py-3">Active</th>
              <th className="px-5 py-3 text-right">Registered</th>
              <th className="px-5 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {farmers.map((f) => (
              <tr key={f.id} className="border-b border-surface-50 last:border-0 dark:border-surface-800/60">
                <td className="px-3 py-3"><input type="checkbox" checked={selected.includes(f.id)} onChange={() => toggleSelect(f.id)} /></td>
                <td className="px-5 py-3">
                  <p className="font-medium text-surface-900 dark:text-white">{f.full_name}</p>
                  <p className="text-xs text-surface-400 dark:text-surface-500">{f.farmer_code}</p>
                </td>
                <td className="px-5 py-3 text-surface-600 dark:text-surface-300">{f.phone_number}</td>
                <td className="px-5 py-3 text-surface-600 dark:text-surface-300">{[f.tehsil, f.district].filter(Boolean).join(", ") || "-"}</td>
                <td className="px-5 py-3">{f.is_verified ? <Badge tone="green">Verified</Badge> : <VerifyFarmerButton id={f.id} />}</td>
                <td className="px-5 py-3"><Badge tone={f.is_active ? "green" : "gray"}>{f.is_active ? "Active" : "Inactive"}</Badge></td>
                <td className="px-5 py-3 text-right text-xs text-surface-400 dark:text-surface-500">{formatDate(f.created_at)}</td>
                <td className="px-5 py-3">
                  <div className="flex items-center gap-2">
                    <Link href={`/admin/farmers/${f.id}`} className="text-xs font-medium text-brand-600 hover:underline">Details</Link>
                    <Link href={`/admin/farmers/${f.id}/statement`} className="flex items-center gap-1 text-xs font-medium text-surface-500 hover:underline"><FileText className="h-3 w-3" /> Statement</Link>
                    <FarmerActions farmerId={f.id} isActive={f.is_active ?? true} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function BulkActionBar({ selectedIds, onDone }: { selectedIds: string[]; onDone: () => void }) {
  const [activateState, activateAction] = useFormState(bulkToggleFarmerActive, initialState);
  const [deleteState, deleteAction] = useFormState(bulkDeleteFarmers, initialState);

  if (activateState.success || deleteState.success) setTimeout(onDone, 500);

  return (
    <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg bg-brand-50 p-3 dark:bg-brand-900/20">
      <span className="flex items-center gap-1 text-sm font-medium text-brand-700">
        <CheckSquare className="h-4 w-4" /> {selectedIds.length} selected
      </span>
      <form action={activateAction}>
        <input type="hidden" name="ids" value={selectedIds.join(",")} />
        <input type="hidden" name="is_active" value="true" />
        <button type="submit" className="rounded-lg bg-green-100 px-2 py-1 text-xs font-medium text-green-700 hover:bg-green-200">Active Karein</button>
      </form>
      <form action={activateAction}>
        <input type="hidden" name="ids" value={selectedIds.join(",")} />
        <input type="hidden" name="is_active" value="false" />
        <button type="submit" className="rounded-lg bg-surface-100 px-2 py-1 text-xs font-medium text-surface-600 hover:bg-surface-200">Inactive Karein</button>
      </form>
      <form
        action={deleteAction}
        onSubmit={(e) => {
          if (!confirm(`Kya aap ${selectedIds.length} farmers delete karna chahte hain?`)) e.preventDefault();
        }}
      >
        <input type="hidden" name="ids" value={selectedIds.join(",")} />
        <button type="submit" className="rounded-lg bg-red-100 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-200">Delete Karein</button>
      </form>
    </div>
  );
}