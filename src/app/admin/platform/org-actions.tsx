"use client";
import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { toggleOrganizationActive, deleteOrganization, type ActionState } from "@/actions/platform";
import { Power, Trash2, X } from "lucide-react";
import { t } from "@/lib/i18n/translations";
import { useLang } from "@/lib/i18n/lang-context";

const initialState: ActionState = {};

export function OrgActions({ orgId, orgSlug, isActive }: { orgId: string; orgSlug: string; isActive: boolean }) {
  const lang = useLang();
  const [toggleState, toggleAction] = useFormState(toggleOrganizationActive, initialState);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const isMainOrg = orgSlug === "al-rana-traders";

  if (isMainOrg) {
    return <span className="text-xs text-surface-400">(Main account)</span>;
  }

  return (
    <div className="flex items-center gap-2">
      <form action={toggleAction}>
        <input type="hidden" name="org_id" value={orgId} />
        <input type="hidden" name="is_active" value={isActive ? "false" : "true"} />
        <ToggleButton isActive={isActive} />
      </form>
      <button
        onClick={() => setShowDeleteConfirm(true)}
        className="rounded-lg border border-red-200 p-1.5 text-red-600 hover:bg-red-50 dark:border-red-900/40 dark:hover:bg-red-950/30"
        title={t("at_delete_org", lang)}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
      {toggleState.error && <p className="text-xs text-red-600">{toggleState.error}</p>}

      {showDeleteConfirm && (
        <DeleteConfirmModal orgId={orgId} orgSlug={orgSlug} onClose={() => setShowDeleteConfirm(false)} />
      )}
    </div>
  );
}

function ToggleButton({ isActive }: { isActive: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={`flex items-center gap-1 rounded-lg border px-2 py-1.5 text-xs font-medium disabled:opacity-50 ${
        isActive
          ? "border-surface-200 text-surface-600 hover:bg-surface-50"
          : "border-brand-200 text-brand-700 hover:bg-brand-50"
      }`}
      title={isActive ? "Deactivate" : "Activate"}
    >
      <Power className="h-3.5 w-3.5" /> {isActive ? "Deactivate" : "Activate"}
    </button>
  );
}

function DeleteConfirmModal({ orgId, orgSlug, onClose }: { orgId: string; orgSlug: string; onClose: () => void }) {
  const lang = useLang();
  const [state, formAction] = useFormState(deleteOrganization, initialState);

  if (state.success) {
    setTimeout(onClose, 800);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-sm rounded-card bg-white p-5 shadow-xl dark:bg-surface-900">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display text-base font-semibold text-red-700 dark:text-red-400">{t("at_delete_org_q", lang)}</h3>
          <button onClick={onClose} className="text-surface-400 hover:text-surface-700 dark:hover:text-surface-200">
            <X className="h-5 w-5" />
          </button>
        </div>
        <p className="mb-4 text-sm text-surface-600 dark:text-surface-400">
          This permanently deletes this organization and everything linked to it (branches, users, products, etc).
          This cannot be undone.
        </p>
        {state.error && (
          <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-900/30 dark:text-red-300">
            {state.error}
          </p>
        )}
        {state.success && (
          <p className="mb-3 rounded-lg bg-brand-50 px-3 py-2 text-xs text-brand-700 dark:bg-brand-900/30 dark:text-brand-300">{t("at_deleted", lang)}</p>
        )}
        <form action={formAction} className="flex gap-2">
          <input type="hidden" name="org_id" value={orgId} />
          <input type="hidden" name="org_slug" value={orgSlug} />
          <button type="button" onClick={onClose} className="flex-1 rounded-lg border border-surface-200 px-3 py-2 text-sm">{t("at_cancel", lang)}</button>
          <DeleteSubmitButton />
        </form>
      </div>
    </div>
  );
}

function DeleteSubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="flex-1 rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60"
    >
      {pending ? "Deleting..." : "Delete"}
    </button>
  );
}