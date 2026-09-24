"use client";
import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { updateBranch, type ActionState } from "@/actions/branches";
import { Pencil, X } from "lucide-react";
import { t } from "@/lib/i18n/translations";
import { useLang } from "@/lib/i18n/lang-context";

const initialState: ActionState = {};

interface Branch {
  id: string;
  name: string;
  district: string | null;
  tehsil: string | null;
  address: string | null;
}

export function EditBranchButton({ branch }: { branch: Branch }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)} className="text-surface-400 hover:text-brand-600">
        <Pencil className="h-4 w-4" />
      </button>
      {open && <EditModal branch={branch} onClose={() => setOpen(false)} />}
    </>
  );
}

function EditModal({ branch, onClose }: { branch: Branch; onClose: () => void }) {
  const [state, formAction] = useFormState(updateBranch, initialState);
  const lang = useLang();
  if (state.success) setTimeout(onClose, 600);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-sm rounded-card bg-white p-5 shadow-xl">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display text-base font-semibold text-surface-900">{t("br_edit", lang)}</h3>
          <button onClick={onClose} className="text-surface-400 hover:text-surface-700"><X className="h-5 w-5" /></button>
        </div>
        {state.error && <p className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{state.error}</p>}
        <form action={formAction} className="space-y-2">
          <input type="hidden" name="branch_id" value={branch.id} />
          <input name="name" defaultValue={branch.name} required placeholder={t("br_name", lang)} className="w-full rounded-lg border border-surface-200 p-2 text-sm" />
          <input name="district" defaultValue={branch.district ?? ""} placeholder={t("c_district", lang)} className="w-full rounded-lg border border-surface-200 p-2 text-sm" />
          <input name="tehsil" defaultValue={branch.tehsil ?? ""} placeholder={t("c_tehsil", lang)} className="w-full rounded-lg border border-surface-200 p-2 text-sm" />
          <input name="address" defaultValue={branch.address ?? ""} placeholder={t("c_address", lang)} className="w-full rounded-lg border border-surface-200 p-2 text-sm" />
          <SubmitButton />
        </form>
      </div>
    </div>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={pending} className="w-full rounded-lg bg-brand-600 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60">{pending ? "Saving..." : "Save"}</button>;
}