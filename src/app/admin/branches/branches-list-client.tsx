"use client";
import { useState } from "react";
import { useFormState } from "react-dom";
import Link from "next/link";
import { Users, FileText, CheckSquare } from "lucide-react";
import { DeleteBranchButton } from "./delete-branch-button";
import { BranchStatusManager } from "./branch-status-manager";
import { EditBranchButton } from "./edit-branch-modal";
import { bulkUpdateBranchStatus, bulkDeleteBranches, type ActionState } from "@/actions/branches-bulk";
import { t } from "@/lib/i18n/translations";
import { useLang } from "@/lib/i18n/lang-context";

const initialState: ActionState = {};

interface Branch {
  id: string;
  name: string;
  district: string | null;
  tehsil: string | null;
  address: string | null;
  is_main_branch: boolean;
  status: string;
  status_reason: string | null;
}

interface Worker {
  full_name: string;
  role: string;
}

export function BranchesListClient({ branches, staffByBranch }: { branches: Branch[]; staffByBranch: Record<string, Worker[]> }) {
  const [selected, setSelected] = useState<string[]>([]);
  const lang = useLang();

  function toggleSelect(id: string) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function toggleSelectAll() {
    const selectableIds = branches.filter((b) => !b.is_main_branch).map((b) => b.id);
    setSelected(selected.length === selectableIds.length ? [] : selectableIds);
  }

  return (
    <div>
      {selected.length > 0 && <BulkActionBar selectedIds={selected} onDone={() => setSelected([])} />}

      <div className="mb-2 flex items-center gap-2 px-1">
        <input type="checkbox" checked={selected.length > 0 && selected.length === branches.filter((b) => !b.is_main_branch).length} onChange={toggleSelectAll} />
        <span className="text-xs text-surface-500">Sab Select Karein ({selected.length} selected)</span>
      </div>

      <div className="space-y-2">
        {branches.map((b) => {
          const workers = staffByBranch[b.id] ?? [];
          return (
            <div key={b.id} className="rounded-card border border-surface-200 bg-white p-4 shadow-card dark:border-surface-800 dark:bg-surface-900">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-2">
                  {!b.is_main_branch && (
                    <input type="checkbox" checked={selected.includes(b.id)} onChange={() => toggleSelect(b.id)} className="mt-1" />
                  )}
                  <div>
                    <p className="flex items-center gap-2 font-medium text-surface-900 dark:text-white">
                      {b.name}
                      <EditBranchButton branch={b} />
                      {b.is_main_branch && <span className="rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700 dark:bg-brand-900/30 dark:text-brand-300">{t("br_main", lang)}</span>}
                      {b.status === "suspended" && <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">{t("c_suspended", lang)}</span>}
                      {b.status === "blocked" && <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">{t("br_blocked", lang)}</span>}
                    </p>
                    <p className="mt-0.5 text-xs text-surface-500">{[b.district, b.tehsil].filter(Boolean).join(", ") || "-"}</p>
                    {b.address && <p className="mt-0.5 text-xs text-surface-400">{b.address}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Link href={`/admin/branches/${b.id}/statement`} className="flex items-center gap-1 rounded-lg border border-surface-200 px-2 py-1.5 text-xs text-surface-600 hover:bg-surface-50">
                    <FileText className="h-3.5 w-3.5" /> Statement
                  </Link>
                  <BranchStatusManager branchId={b.id} status={b.status} />
                  {!b.is_main_branch && <DeleteBranchButton branchId={b.id} />}
                </div>
              </div>
              {b.status_reason && (
                <p className="mt-2 rounded-lg bg-surface-50 px-3 py-2 text-xs text-surface-600 dark:bg-surface-800 dark:text-surface-300">
                  <strong>{t("br_reason_label", lang)}</strong> {b.status_reason}
                </p>
              )}
              <div className="mt-3 border-t border-surface-100 pt-3 dark:border-surface-800">
                <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-surface-400">
                  <Users className="h-3.5 w-3.5" /> Workers ({workers.length})
                </p>
                {workers.length === 0 ? (
                  <p className="mt-1 text-xs text-surface-400">{t("br_no_staff", lang)}</p>
                ) : (
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {workers.map((w, i) => (
                      <span key={i} className="rounded-full bg-surface-100 px-2 py-0.5 text-xs text-surface-700 dark:bg-surface-800 dark:text-surface-300">
                        {w.full_name} <span className="opacity-60">({w.role})</span>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function BulkActionBar({ selectedIds, onDone }: { selectedIds: string[]; onDone: () => void }) {
  const lang = useLang();
  const [statusState, statusAction] = useFormState(bulkUpdateBranchStatus, initialState);
  const [deleteState, deleteAction] = useFormState(bulkDeleteBranches, initialState);

  if (statusState.success || deleteState.success) setTimeout(onDone, 500);

  return (
    <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg bg-brand-50 p-3 dark:bg-brand-900/20">
      <span className="flex items-center gap-1 text-sm font-medium text-brand-700">
        <CheckSquare className="h-4 w-4" /> {selectedIds.length} selected
      </span>
      <form action={statusAction} className="flex gap-1">
        <input type="hidden" name="ids" value={selectedIds.join(",")} />
        <input type="hidden" name="status" value="active" />
        <button type="submit" className="rounded-lg bg-green-100 px-2 py-1 text-xs font-medium text-green-700 hover:bg-green-200">{t("c_activate", lang)}</button>
      </form>
      <form action={statusAction} className="flex gap-1">
        <input type="hidden" name="ids" value={selectedIds.join(",")} />
        <input type="hidden" name="status" value="suspended" />
        <button type="submit" className="rounded-lg bg-amber-100 px-2 py-1 text-xs font-medium text-amber-700 hover:bg-amber-200">{t("c_suspend", lang)}</button>
      </form>
      <form
        action={deleteAction}
        onSubmit={(e) => {
          if (!confirm(`Kya aap ${selectedIds.length} branches delete karna chahte hain?`)) e.preventDefault();
        }}
      >
        <input type="hidden" name="ids" value={selectedIds.join(",")} />
        <button type="submit" className="rounded-lg bg-red-100 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-200">{t("c_delete", lang)}</button>
      </form>
    </div>
  );
}