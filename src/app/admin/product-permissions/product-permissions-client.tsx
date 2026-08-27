"use client";
import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { saveStaffProductPermissions, type ActionState } from "@/actions/product-permissions";

const initialState: ActionState = {};

interface Staff {
  id: string;
  full_name: string;
  role: string;
  can_add: boolean;
  can_edit: boolean;
  can_view: boolean;
  can_delete: boolean;
  can_approve_products: boolean;
}

export function ProductPermissionsClient({ staff }: { staff: Staff[] }) {
  const [selectedId, setSelectedId] = useState(staff[0]?.id ?? "");
  const selected = staff.find((s) => s.id === selectedId);

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div className="rounded-card border border-surface-200 bg-white p-4 shadow-card dark:border-surface-800 dark:bg-surface-900">
        <h2 className="mb-3 text-sm font-semibold text-surface-900 dark:text-white">Staff Select Karein</h2>
        <div className="space-y-1">
          {staff.map((s) => (
            <button
              key={s.id}
              onClick={() => setSelectedId(s.id)}
              className={`block w-full rounded-lg px-3 py-2 text-left text-sm ${
                selectedId === s.id ? "bg-brand-600 text-white" : "text-surface-700 hover:bg-surface-50 dark:text-surface-300"
              }`}
            >
              {s.full_name} <span className="text-xs opacity-70">({s.role})</span>
            </button>
          ))}
          {staff.length === 0 && <p className="text-sm text-surface-400">Koi staff nahi mila.</p>}
        </div>
      </div>

      <div className="lg:col-span-2">
        {selected && <PermissionForm key={selected.id} staff={selected} />}
      </div>
    </div>
  );
}

function PermissionForm({ staff }: { staff: Staff }) {
  const [state, formAction] = useFormState(saveStaffProductPermissions, initialState);

  return (
    <form action={formAction} className="rounded-card border border-surface-200 bg-white p-4 shadow-card dark:border-surface-800 dark:bg-surface-900">
      <input type="hidden" name="profile_id" value={staff.id} />
      <h2 className="mb-3 text-sm font-semibold text-surface-900 dark:text-white">{staff.full_name} - Product Catalog Permissions</h2>
      {state.error && <p className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{state.error}</p>}
      {state.success && <p className="mb-2 rounded-lg bg-brand-50 px-3 py-2 text-xs text-brand-700">Permissions save ho gayin.</p>}

      <div className="space-y-2">
        <label className="flex items-center justify-between rounded-lg bg-surface-50 px-3 py-2.5 dark:bg-surface-800">
          <div>
            <p className="text-sm font-medium text-surface-800 dark:text-surface-200">Add</p>
            <p className="text-xs text-surface-400">Naya product propose kar sake - approval ke baad hi live hoga</p>
          </div>
          <input type="checkbox" name="can_add" defaultChecked={staff.can_add} className="h-5 w-5" />
        </label>
        <label className="flex items-center justify-between rounded-lg bg-surface-50 px-3 py-2.5 dark:bg-surface-800">
          <div>
            <p className="text-sm font-medium text-surface-800 dark:text-surface-200">Edit</p>
            <p className="text-xs text-surface-400">Maujooda product mein change propose kar sake - approval ke baad hi live hoga</p>
          </div>
          <input type="checkbox" name="can_edit" defaultChecked={staff.can_edit} className="h-5 w-5" />
        </label>
        <label className="flex items-center justify-between rounded-lg bg-surface-50 px-3 py-2.5 dark:bg-surface-800">
          <div>
            <p className="text-sm font-medium text-surface-800 dark:text-surface-200">View</p>
            <p className="text-xs text-surface-400">Sirf products dekh sake</p>
          </div>
          <input type="checkbox" name="can_view" defaultChecked={staff.can_view} className="h-5 w-5" />
        </label>
        <label className="flex items-center justify-between rounded-lg bg-surface-50 px-3 py-2.5 dark:bg-surface-800">
          <div>
            <p className="text-sm font-medium text-surface-800 dark:text-surface-200">Delete</p>
            <p className="text-xs text-surface-400">Ye kabhi kisi staff ko na dein - Product delete hamesha sirf Admin/Owner khud kar sakta hai</p>
          </div>
          <input type="checkbox" name="can_delete" defaultChecked={staff.can_delete} className="h-5 w-5" />
        </label>
        <label className="flex items-center justify-between rounded-lg bg-brand-50 px-3 py-2.5 dark:bg-brand-950/20">
          <div>
            <p className="text-sm font-medium text-brand-800 dark:text-brand-300">Can Approve</p>
            <p className="text-xs text-brand-600 dark:text-brand-400">Ye staff dusron ke Add/Edit proposals ko verify (Approve/Reject/Changes Chahiye) kar sakega - jaisa admin karta hai</p>
          </div>
          <input type="checkbox" name="can_approve_products" defaultChecked={staff.can_approve_products} className="h-5 w-5" />
        </label>
      </div>

      <SubmitButton />
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={pending} className="mt-4 w-full rounded-lg bg-brand-600 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60">{pending ? "..." : "Permissions Save Karein"}</button>;
}